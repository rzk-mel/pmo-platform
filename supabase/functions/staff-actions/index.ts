// Supabase Edge Function: staff-actions
// Internal staff actions: approval workflows, project transitions, assignments

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import {
  createHandler,
  jsonResponse,
  requireAuthHeader,
  parseJsonBody,
  validateMethod,
} from '../_shared/response.ts';
import {
  createSupabaseClient,
  createSupabaseAdmin,
  getCurrentUser,
  getUserProfile,
  Database,
} from '../_shared/supabase.ts';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
} from '../_shared/errors.ts';
import { Logger } from '../_shared/logger.ts';

// Request types
interface StaffActionRequest {
  action:
    | 'approve_artifact'
    | 'reject_artifact'
    | 'request_changes'
    | 'delegate_signoff'
    | 'transition_project'
    | 'assign_ticket'
    | 'bulk_assign'
    | 'create_signoff_request';
  artifactId?: string;
  signoffId?: string;
  projectId?: string;
  ticketId?: string;
  ticketIds?: string[];
  targetStatus?: string;
  assigneeId?: string;
  delegateToId?: string;
  comments?: string;
  dueDate?: string;
  approverIds?: string[];
}

// Project status transition rules
type ProjectStatus = Database['public']['Tables']['projects']['Row']['status'];

const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ['scoping', 'cancelled'],
  scoping: ['sow_draft', 'cancelled'],
  sow_draft: ['sow_review', 'cancelled'],
  sow_review: ['sow_draft', 'poc_phase', 'cancelled'],
  poc_phase: ['development', 'cancelled'],
  development: ['uat_phase', 'cancelled'],
  uat_phase: ['development', 'sign_off', 'cancelled'],
  sign_off: ['uat_phase', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// Role requirements for transitions
const TRANSITION_ROLES: Partial<Record<ProjectStatus, string[]>> = {
  sow_review: ['project_manager', 'org_admin', 'super_admin'],
  poc_phase: ['client_stakeholder', 'project_manager'],
  development: ['client_stakeholder', 'tech_lead'],
  uat_phase: ['project_manager', 'tech_lead'],
  sign_off: ['client_stakeholder'],
  completed: ['client_stakeholder', 'project_manager'],
};

// Check if user can perform action
function checkRole(
  userRole: string,
  requiredRoles: string[],
  action: string
): void {
  const adminRoles = ['super_admin', 'org_admin'];
  if (adminRoles.includes(userRole)) return;
  
  if (!requiredRoles.includes(userRole)) {
    throw new AuthorizationError(
      `Role '${userRole}' is not authorized to ${action}. Required: ${requiredRoles.join(', ')}`
    );
  }
}

// Main handler
const handler = createHandler(async (req: Request, logger: Logger, requestId: string) => {
  validateMethod(req, ['POST']);

  const authHeader = requireAuthHeader(req);
  const supabase = createSupabaseClient(authHeader);
  const adminClient = createSupabaseAdmin();

  // Authenticate user
  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthenticationError();
  }

  logger.setUserId(user.id);

  const profile = await getUserProfile(supabase, user.id);
  if (!profile) {
    throw new AuthenticationError('User profile not found');
  }

  const body = await parseJsonBody<StaffActionRequest>(req);

  switch (body.action) {
    case 'approve_artifact': {
      if (!body.signoffId) {
        throw new ValidationError('signoffId is required');
      }

      logger.info('Approving artifact', { signoffId: body.signoffId });

      // Fetch signoff request
      const { data: signoff, error } = await supabase
        .from('signoffs')
        .select('*, artifacts!inner(*)')
        .eq('id', body.signoffId)
        .single();

      if (error || !signoff) {
        throw new ValidationError('Signoff request not found');
      }

      // Check user is the assignee or delegate
      if (signoff.assignee_id !== user.id && signoff.delegated_to_id !== user.id) {
        throw new AuthorizationError('You are not assigned to this signoff');
      }

      // Check signoff is pending
      if (signoff.status !== 'pending') {
        throw new ConflictError('Signoff is not in pending status');
      }

      // Get artifact content hash for signature
      const artifact = signoff.artifacts as Database['public']['Tables']['artifacts']['Row'];
      const contentHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(artifact.content || '')
      );
      const hashArray = Array.from(new Uint8Array(contentHash));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Get client IP from request
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

      // Update signoff
      await adminClient
        .from('signoffs')
        .update({
          status: 'approved',
          decision_at: new Date().toISOString(),
          comments: body.comments,
          signature_hash: hashHex,
          ip_address: clientIP,
          user_agent: req.headers.get('user-agent'),
        })
        .eq('id', body.signoffId);

      // Check if all signoffs for this artifact are approved
      const { data: allSignoffs } = await adminClient
        .from('signoffs')
        .select('status')
        .eq('artifact_id', artifact.id);

      const allApproved = allSignoffs?.every(s => s.status === 'approved');

      if (allApproved) {
        // Update artifact status to approved
        await adminClient
          .from('artifacts')
          .update({ status: 'approved' })
          .eq('id', artifact.id);
      }

      // Log audit
      await adminClient.from('audit_logs').insert({
        org_id: profile.org_id,
        user_id: user.id,
        user_email: profile.email,
        user_role: profile.role,
        action: 'approve',
        entity_type: 'signoff',
        entity_id: body.signoffId,
        new_values: { status: 'approved', comments: body.comments },
        ip_address: clientIP,
      });

      return jsonResponse({
        approved: true,
        signoffId: body.signoffId,
        artifactStatus: allApproved ? 'approved' : 'pending_review',
        allApproved,
      }, 200, requestId);
    }

    case 'reject_artifact': {
      if (!body.signoffId) {
        throw new ValidationError('signoffId is required');
      }

      if (!body.comments) {
        throw new ValidationError('comments are required for rejection');
      }

      logger.info('Rejecting artifact', { signoffId: body.signoffId });

      const { data: signoff } = await supabase
        .from('signoffs')
        .select('*, artifacts!inner(*)')
        .eq('id', body.signoffId)
        .single();

      if (!signoff) {
        throw new ValidationError('Signoff request not found');
      }

      if (signoff.assignee_id !== user.id && signoff.delegated_to_id !== user.id) {
        throw new AuthorizationError('You are not assigned to this signoff');
      }

      const artifact = signoff.artifacts as Database['public']['Tables']['artifacts']['Row'];

      // Update signoff
      await adminClient
        .from('signoffs')
        .update({
          status: 'rejected',
          decision_at: new Date().toISOString(),
          comments: body.comments,
        })
        .eq('id', body.signoffId);

      // Update artifact status to rejected
      await adminClient
        .from('artifacts')
        .update({ status: 'rejected' })
        .eq('id', artifact.id);

      return jsonResponse({
        rejected: true,
        signoffId: body.signoffId,
        artifactStatus: 'rejected',
      }, 200, requestId);
    }

    case 'request_changes': {
      if (!body.signoffId || !body.comments) {
        throw new ValidationError('signoffId and comments are required');
      }

      const { data: signoff } = await supabase
        .from('signoffs')
        .select('*, artifacts!inner(*)')
        .eq('id', body.signoffId)
        .single();

      if (!signoff) {
        throw new ValidationError('Signoff request not found');
      }

      const artifact = signoff.artifacts as Database['public']['Tables']['artifacts']['Row'];

      // Keep signoff pending but add comments, set artifact back to draft
      await adminClient
        .from('signoffs')
        .update({
          comments: body.comments,
        })
        .eq('id', body.signoffId);

      await adminClient
        .from('artifacts')
        .update({ status: 'draft' })
        .eq('id', artifact.id);

      return jsonResponse({
        changesRequested: true,
        signoffId: body.signoffId,
        artifactStatus: 'draft',
      }, 200, requestId);
    }

    case 'delegate_signoff': {
      if (!body.signoffId || !body.delegateToId) {
        throw new ValidationError('signoffId and delegateToId are required');
      }

      const { data: signoff } = await supabase
        .from('signoffs')
        .select('*')
        .eq('id', body.signoffId)
        .single();

      if (!signoff) {
        throw new ValidationError('Signoff request not found');
      }

      if (signoff.assignee_id !== user.id) {
        throw new AuthorizationError('You are not the assignee of this signoff');
      }

      await adminClient
        .from('signoffs')
        .update({
          status: 'delegated',
          delegated_to_id: body.delegateToId,
          comments: body.comments || `Delegated by ${profile.full_name}`,
        })
        .eq('id', body.signoffId);

      return jsonResponse({
        delegated: true,
        signoffId: body.signoffId,
        delegatedTo: body.delegateToId,
      }, 200, requestId);
    }

    case 'transition_project': {
      if (!body.projectId || !body.targetStatus) {
        throw new ValidationError('projectId and targetStatus are required');
      }

      logger.setProjectId(body.projectId);
      logger.info('Transitioning project status', { targetStatus: body.targetStatus });

      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', body.projectId)
        .single();

      if (!project) {
        throw new ValidationError('Project not found');
      }

      const currentStatus = project.status as ProjectStatus;
      const targetStatus = body.targetStatus as ProjectStatus;

      // Validate transition is allowed
      const allowedTransitions = PROJECT_TRANSITIONS[currentStatus];
      if (!allowedTransitions.includes(targetStatus)) {
        throw new ValidationError(
          `Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${allowedTransitions.join(', ')}`
        );
      }

      // Check role requirements
      const requiredRoles = TRANSITION_ROLES[targetStatus];
      if (requiredRoles) {
        checkRole(profile.role, requiredRoles, `transition to ${targetStatus}`);
      }

      // Apply transition
      const updates: Partial<Database['public']['Tables']['projects']['Update']> = {
        status: targetStatus,
      };

      // Set dates based on transition
      if (targetStatus === 'completed') {
        updates.actual_end_date = new Date().toISOString().split('T')[0];
      }

      await adminClient
        .from('projects')
        .update(updates)
        .eq('id', body.projectId);

      // Audit log
      await adminClient.from('audit_logs').insert({
        org_id: profile.org_id,
        user_id: user.id,
        user_email: profile.email,
        user_role: profile.role,
        action: 'transition',
        entity_type: 'project',
        entity_id: body.projectId,
        old_values: { status: currentStatus },
        new_values: { status: targetStatus },
      });

      return jsonResponse({
        transitioned: true,
        projectId: body.projectId,
        previousStatus: currentStatus,
        newStatus: targetStatus,
      }, 200, requestId);
    }

    case 'assign_ticket': {
      if (!body.ticketId || !body.assigneeId) {
        throw new ValidationError('ticketId and assigneeId are required');
      }

      logger.info('Assigning ticket', { ticketId: body.ticketId, assigneeId: body.assigneeId });

      const { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', body.ticketId)
        .single();

      if (!ticket) {
        throw new ValidationError('Ticket not found');
      }

      // Verify assignee is a project member
      const { data: member } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', ticket.project_id)
        .eq('profile_id', body.assigneeId)
        .single();

      if (!member) {
        throw new ValidationError('Assignee is not a member of this project');
      }

      await adminClient
        .from('tickets')
        .update({ assignee_id: body.assigneeId })
        .eq('id', body.ticketId);

      return jsonResponse({
        assigned: true,
        ticketId: body.ticketId,
        assigneeId: body.assigneeId,
      }, 200, requestId);
    }

    case 'bulk_assign': {
      if (!body.ticketIds || body.ticketIds.length === 0 || !body.assigneeId) {
        throw new ValidationError('ticketIds array and assigneeId are required');
      }

      logger.info('Bulk assigning tickets', { count: body.ticketIds.length, assigneeId: body.assigneeId });

      await adminClient
        .from('tickets')
        .update({ assignee_id: body.assigneeId })
        .in('id', body.ticketIds);

      return jsonResponse({
        assigned: true,
        ticketCount: body.ticketIds.length,
        assigneeId: body.assigneeId,
      }, 200, requestId);
    }

    case 'create_signoff_request': {
      if (!body.artifactId || !body.approverIds || body.approverIds.length === 0) {
        throw new ValidationError('artifactId and approverIds are required');
      }

      // Check user can initiate signoffs
      checkRole(profile.role, ['project_manager', 'tech_lead', 'developer'], 'create signoff request');

      logger.info('Creating signoff requests', { artifactId: body.artifactId, approverCount: body.approverIds.length });

      // Verify artifact exists and is not already approved
      const { data: artifact } = await supabase
        .from('artifacts')
        .select('*')
        .eq('id', body.artifactId)
        .single();

      if (!artifact) {
        throw new ValidationError('Artifact not found');
      }

      if (artifact.status === 'approved') {
        throw new ConflictError('Artifact is already approved');
      }

      // Create signoff requests for each approver
      const signoffRows = body.approverIds.map(approverId => ({
        artifact_id: body.artifactId!,
        assignee_id: approverId,
        status: 'pending' as const,
        due_date: body.dueDate,
        created_by: user.id,
      }));

      const { data: signoffs, error } = await adminClient
        .from('signoffs')
        .insert(signoffRows)
        .select();

      if (error) {
        throw new ValidationError('Failed to create signoff requests');
      }

      // Update artifact status to pending review
      await adminClient
        .from('artifacts')
        .update({ status: 'pending_review' })
        .eq('id', body.artifactId);

      // Create notifications for approvers
      const notifications = body.approverIds.map(approverId => ({
        user_id: approverId,
        title: 'Signoff Request',
        body: `You have been requested to review and sign off on "${artifact.title}"`,
        type: 'signoff_request',
        entity_type: 'signoff',
        entity_id: signoffs?.find(s => s.assignee_id === approverId)?.id,
        action_url: `/artifacts/${body.artifactId}/signoff`,
      }));

      await adminClient.from('notifications').insert(notifications);

      return jsonResponse({
        created: true,
        signoffCount: signoffs?.length || 0,
        artifactId: body.artifactId,
        signoffs: signoffs?.map(s => ({ id: s.id, assigneeId: s.assignee_id })),
      }, 200, requestId);
    }

    default:
      throw new ValidationError(`Unknown action: ${body.action}`);
  }
}, 'staff-actions');

serve(handler);
