// Supabase Edge Function: github-integration
// Bidirectional sync with GitHub (issues, PRs, repos)

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
} from '../_shared/supabase.ts';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  GitHubError,
  ConflictError,
} from '../_shared/errors.ts';
import { Logger } from '../_shared/logger.ts';

// GitHub API configuration
const GITHUB_API_URL = 'https://api.github.com';

// Request types
interface GitHubRequest {
  action: 'sync_to_github' | 'sync_from_github' | 'connect_repo' | 'disconnect_repo' | 'webhook';
  projectId?: string;
  ticketId?: string;
  repoUrl?: string;
  webhookPayload?: Record<string, unknown>;
  webhookEvent?: string;
}

// GitHub API types
interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  assignee: { login: string } | null;
  created_at: string;
  updated_at: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

// Get GitHub token for user
async function getGitHubToken(supabase: ReturnType<typeof createSupabaseClient>, userId: string): Promise<string> {
  // In production, this would decrypt the token from the profile
  // For now, we'll use an environment variable or user's stored token
  const { data: profile } = await supabase
    .from('profiles')
    .select('github_token_encrypted')
    .eq('id', userId)
    .single();

  if (!profile?.github_token_encrypted) {
    // Fall back to environment variable for service-level operations
    const envToken = Deno.env.get('GITHUB_PAT');
    if (!envToken) {
      throw new AuthenticationError('GitHub token not configured');
    }
    return envToken;
  }

  // In production, decrypt the token here
  return profile.github_token_encrypted;
}

// GitHub API request helper
async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'PMO-Platform/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new GitHubError(`GitHub API error: ${error.message}`, {
      status: response.status,
      endpoint,
    });
  }

  if (response.status === 204) {
    return {} as T;
  }

  return await response.json() as T;
}

// Parse repo URL to owner/repo
function parseRepoUrl(url: string): { owner: string; repo: string } {
  // Handle various formats: https://github.com/owner/repo, git@github.com:owner/repo.git
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) {
    throw new ValidationError('Invalid GitHub repository URL');
  }
  return { owner: match[1], repo: match[2] };
}

// Map ticket status to GitHub labels
function statusToLabels(status: string): string[] {
  const statusLabels: Record<string, string> = {
    'open': 'status:open',
    'in_progress': 'status:in-progress',
    'blocked': 'status:blocked',
    'review': 'status:review',
    'done': 'status:done',
  };
  return statusLabels[status] ? [statusLabels[status]] : [];
}

// Map ticket priority to GitHub labels
function priorityToLabel(priority: string): string {
  const priorityLabels: Record<string, string> = {
    'low': 'priority:low',
    'medium': 'priority:medium',
    'high': 'priority:high',
    'critical': 'priority:critical',
  };
  return priorityLabels[priority] || 'priority:medium';
}

// Map GitHub labels back to ticket status
function labelsToStatus(labels: Array<{ name: string }>): string | null {
  const statusLabel = labels.find(l => l.name.startsWith('status:'));
  if (!statusLabel) return null;

  const statusMap: Record<string, string> = {
    'status:open': 'open',
    'status:in-progress': 'in_progress',
    'status:blocked': 'blocked',
    'status:review': 'review',
    'status:done': 'done',
  };
  return statusMap[statusLabel.name] || null;
}

// Sync ticket to GitHub issue
async function syncTicketToGitHub(
  supabase: ReturnType<typeof createSupabaseClient>,
  adminClient: ReturnType<typeof createSupabaseAdmin>,
  ticketId: string,
  token: string,
  logger: Logger
): Promise<{ issue: GitHubIssue; created: boolean }> {
  // Fetch ticket with project info
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('*, projects!inner(*)')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    throw new ValidationError('Ticket not found');
  }

  const project = ticket.projects as { github_repo_url: string | null; github_repo_id: number | null };
  if (!project.github_repo_url) {
    throw new ValidationError('Project has no connected GitHub repository');
  }

  const { owner, repo } = parseRepoUrl(project.github_repo_url);
  logger.info('Syncing ticket to GitHub', { ticketId, owner, repo });

  // Check for existing sync record
  const { data: existingSync } = await adminClient
    .from('github_sync')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('github_entity_type', 'issue')
    .single();

  const issueBody = `${ticket.description || ''}\n\n---\n*Synced from PMO Platform - Ticket ID: ${ticket.id}*`;
  const labels = [
    ...statusToLabels(ticket.status),
    priorityToLabel(ticket.priority),
    ...ticket.labels || [],
  ];

  let issue: GitHubIssue;
  let created = false;

  if (existingSync?.github_entity_id) {
    // Update existing issue
    logger.info('Updating existing GitHub issue', { issueNumber: existingSync.github_entity_id });

    issue = await githubRequest<GitHubIssue>(
      `/repos/${owner}/${repo}/issues/${existingSync.github_entity_id}`,
      token,
      'PATCH',
      {
        title: ticket.title,
        body: issueBody,
        labels,
        state: ticket.status === 'done' || ticket.status === 'cancelled' ? 'closed' : 'open',
      }
    );
  } else {
    // Create new issue
    logger.info('Creating new GitHub issue');
    created = true;

    issue = await githubRequest<GitHubIssue>(
      `/repos/${owner}/${repo}/issues`,
      token,
      'POST',
      {
        title: ticket.title,
        body: issueBody,
        labels,
      }
    );

    // Create sync record
    await adminClient.from('github_sync').insert({
      project_id: ticket.project_id,
      github_repo_id: project.github_repo_id!,
      github_entity_type: 'issue',
      github_entity_id: issue.number,
      ticket_id: ticketId,
      direction: 'outbound',
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
    });
  }

  // Update ticket with GitHub issue number
  await supabase
    .from('tickets')
    .update({
      github_issue_number: issue.number,
      github_synced_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  // Update sync record timestamp
  if (existingSync) {
    await adminClient
      .from('github_sync')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('id', existingSync.id);
  }

  return { issue, created };
}

// Sync GitHub issue to ticket
async function syncIssueToTicket(
  adminClient: ReturnType<typeof createSupabaseAdmin>,
  issue: GitHubIssue,
  projectId: string,
  repoId: number,
  logger: Logger
): Promise<{ ticketId: string; created: boolean }> {
  logger.info('Syncing GitHub issue to ticket', { issueNumber: issue.number, projectId });

  // Check for existing sync record
  const { data: existingSync } = await adminClient
    .from('github_sync')
    .select('ticket_id')
    .eq('github_repo_id', repoId)
    .eq('github_entity_type', 'issue')
    .eq('github_entity_id', issue.number)
    .single();

  const status = labelsToStatus(issue.labels) || (issue.state === 'closed' ? 'done' : 'open');
  const priorityLabel = issue.labels.find(l => l.name.startsWith('priority:'));
  const priority = priorityLabel?.name.replace('priority:', '') || 'medium';

  // Extract description (remove our sync footer)
  const description = issue.body?.replace(/\n\n---\n\*Synced from PMO Platform.*\*$/s, '') || '';

  if (existingSync?.ticket_id) {
    // Update existing ticket
    await adminClient
      .from('tickets')
      .update({
        title: issue.title,
        description,
        status: status as 'open' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled',
        priority: priority as 'low' | 'medium' | 'high' | 'critical',
        github_synced_at: new Date().toISOString(),
      })
      .eq('id', existingSync.ticket_id);

    // Update sync record
    await adminClient
      .from('github_sync')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('ticket_id', existingSync.ticket_id);

    return { ticketId: existingSync.ticket_id, created: false };
  }

  // Create new ticket
  const { data: newTicket, error } = await adminClient
    .from('tickets')
    .insert({
      project_id: projectId,
      title: issue.title,
      description,
      status: status as 'open' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled',
      priority: priority as 'low' | 'medium' | 'high' | 'critical',
      github_issue_number: issue.number,
      github_synced_at: new Date().toISOString(),
      labels: issue.labels.filter(l => !l.name.startsWith('status:') && !l.name.startsWith('priority:')).map(l => l.name),
    })
    .select()
    .single();

  if (error || !newTicket) {
    throw new GitHubError('Failed to create ticket from GitHub issue');
  }

  // Create sync record
  await adminClient.from('github_sync').insert({
    project_id: projectId,
    github_repo_id: repoId,
    github_entity_type: 'issue',
    github_entity_id: issue.number,
    ticket_id: newTicket.id,
    direction: 'inbound',
    last_synced_at: new Date().toISOString(),
    sync_status: 'synced',
  });

  return { ticketId: newTicket.id, created: true };
}

// Main handler
const handler = createHandler(async (req: Request, logger: Logger, requestId: string) => {
  validateMethod(req, ['POST']);

  const body = await parseJsonBody<GitHubRequest>(req);

  // Webhook doesn't require user auth
  if (body.action === 'webhook') {
    return handleWebhook(body, logger, requestId);
  }

  const authHeader = requireAuthHeader(req);
  const supabase = createSupabaseClient(authHeader);
  const adminClient = createSupabaseAdmin();

  // Authenticate user
  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthenticationError();
  }

  logger.setUserId(user.id);
  const token = await getGitHubToken(supabase, user.id);

  switch (body.action) {
    case 'connect_repo': {
      if (!body.projectId || !body.repoUrl) {
        throw new ValidationError('projectId and repoUrl are required');
      }

      // Check user has PM or higher role
      const profile = await getUserProfile(supabase, user.id);
      if (!profile || !['super_admin', 'org_admin', 'project_manager', 'tech_lead'].includes(profile.role)) {
        throw new AuthorizationError('Insufficient permissions to connect repository');
      }

      const { owner, repo } = parseRepoUrl(body.repoUrl);
      logger.info('Connecting GitHub repository', { projectId: body.projectId, owner, repo });

      // Verify repo access
      const repoInfo = await githubRequest<GitHubRepo>(`/repos/${owner}/${repo}`, token);

      // Update project with repo info
      const { error } = await supabase
        .from('projects')
        .update({
          github_repo_url: repoInfo.html_url,
          github_repo_id: repoInfo.id,
        })
        .eq('id', body.projectId);

      if (error) {
        throw new ValidationError('Failed to update project');
      }

      return jsonResponse({
        connected: true,
        repository: {
          id: repoInfo.id,
          name: repoInfo.full_name,
          url: repoInfo.html_url,
          private: repoInfo.private,
        },
      }, 200, requestId);
    }

    case 'disconnect_repo': {
      if (!body.projectId) {
        throw new ValidationError('projectId is required');
      }

      // Check user has PM or higher role
      const profile = await getUserProfile(supabase, user.id);
      if (!profile || !['super_admin', 'org_admin', 'project_manager'].includes(profile.role)) {
        throw new AuthorizationError('Insufficient permissions to disconnect repository');
      }

      await supabase
        .from('projects')
        .update({
          github_repo_url: null,
          github_repo_id: null,
        })
        .eq('id', body.projectId);

      // Mark all sync records as disconnected
      await adminClient
        .from('github_sync')
        .update({ sync_status: 'disconnected' })
        .eq('project_id', body.projectId);

      return jsonResponse({ disconnected: true }, 200, requestId);
    }

    case 'sync_to_github': {
      if (!body.ticketId) {
        throw new ValidationError('ticketId is required');
      }

      const result = await syncTicketToGitHub(supabase, adminClient, body.ticketId, token, logger);

      return jsonResponse({
        synced: true,
        created: result.created,
        issue: {
          number: result.issue.number,
          url: `https://github.com/${result.issue.id}`, // This would need proper URL construction
          state: result.issue.state,
        },
      }, 200, requestId);
    }

    case 'sync_from_github': {
      if (!body.projectId) {
        throw new ValidationError('projectId is required');
      }

      logger.setProjectId(body.projectId);

      // Fetch project with repo info
      const { data: project } = await supabase
        .from('projects')
        .select('*')
        .eq('id', body.projectId)
        .single();

      if (!project?.github_repo_url || !project?.github_repo_id) {
        throw new ValidationError('Project has no connected GitHub repository');
      }

      const { owner, repo } = parseRepoUrl(project.github_repo_url);
      logger.info('Syncing issues from GitHub', { owner, repo });

      // Fetch all open issues
      const issues = await githubRequest<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues?state=all&per_page=100`,
        token
      );

      const results: Array<{ issueNumber: number; ticketId: string; created: boolean }> = [];

      for (const issue of issues) {
        // Skip pull requests (they appear in issues API)
        if ('pull_request' in issue) continue;

        try {
          const result = await syncIssueToTicket(
            adminClient,
            issue,
            body.projectId,
            project.github_repo_id,
            logger
          );
          results.push({
            issueNumber: issue.number,
            ticketId: result.ticketId,
            created: result.created,
          });
        } catch (error) {
          logger.warn('Failed to sync issue', { issueNumber: issue.number, error: String(error) });
        }
      }

      return jsonResponse({
        synced: true,
        issuesProcessed: results.length,
        created: results.filter(r => r.created).length,
        updated: results.filter(r => !r.created).length,
        results,
      }, 200, requestId);
    }

    default:
      throw new ValidationError(`Unknown action: ${body.action}`);
  }
}, 'github-integration');

// Webhook handler (separate because no user auth)
async function handleWebhook(
  body: GitHubRequest,
  logger: Logger,
  requestId: string
): Promise<Response> {
  if (!body.webhookEvent || !body.webhookPayload) {
    throw new ValidationError('webhookEvent and webhookPayload are required');
  }

  const adminClient = createSupabaseAdmin();
  logger.info('Processing GitHub webhook', { event: body.webhookEvent });

  // Verify webhook signature in production
  // const signature = headers.get('X-Hub-Signature-256');
  // verifyWebhookSignature(signature, JSON.stringify(body.webhookPayload));

  const payload = body.webhookPayload;

  switch (body.webhookEvent) {
    case 'issues': {
      const issue = payload.issue as GitHubIssue;
      const repoId = (payload.repository as { id: number }).id;

      // Find project with this repo
      const { data: project } = await adminClient
        .from('projects')
        .select('id')
        .eq('github_repo_id', repoId)
        .single();

      if (!project) {
        logger.warn('No project found for repository', { repoId });
        return jsonResponse({ ignored: true, reason: 'No matching project' }, 200, requestId);
      }

      const result = await syncIssueToTicket(adminClient, issue, project.id, repoId, logger);

      return jsonResponse({
        processed: true,
        action: payload.action,
        ticketId: result.ticketId,
        created: result.created,
      }, 200, requestId);
    }

    default:
      logger.info('Ignoring unhandled webhook event', { event: body.webhookEvent });
      return jsonResponse({ ignored: true, event: body.webhookEvent }, 200, requestId);
  }
}

serve(handler);
