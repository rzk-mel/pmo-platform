// Database types matching Supabase schema

export type UserRole = 
  | 'super_admin'
  | 'org_admin'
  | 'project_manager'
  | 'tech_lead'
  | 'developer'
  | 'client_stakeholder'
  | 'viewer';

export type ProjectStatus =
  | 'draft'
  | 'scoping'
  | 'sow_draft'
  | 'sow_review'
  | 'poc_phase'
  | 'development'
  | 'uat_phase'
  | 'sign_off'
  | 'completed'
  | 'cancelled';

export type ArtifactType =
  | 'scope_document'
  | 'sow'
  | 'technical_spec'
  | 'meeting_minutes'
  | 'poc_report'
  | 'test_plan'
  | 'uat_report'
  | 'sign_off_document'
  | 'risk_assessment'
  | 'other';

export type ArtifactStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'superseded';

export type SignoffStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'delegated';

export type TicketStatus =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'done'
  | 'cancelled';

export type TicketPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type InquiryStatus =
  | 'open'
  | 'answered'
  | 'closed';

// Entity interfaces
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  preferences: Record<string, unknown>;
  github_username: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface Project {
  id: string;
  org_id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  phase_metadata: Record<string, unknown>;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  project_manager_id: string | null;
  tech_lead_id: string | null;
  client_contact_id: string | null;
  github_repo_url: string | null;
  github_repo_id: number | null;
  estimated_budget: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  project_manager?: Profile;
  tech_lead?: Profile;
  client_contact?: Profile;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  profile_id: string;
  role: UserRole;
  permissions: Record<string, unknown>;
  created_at: string;
  // Joined data
  profile?: Profile;
}

export interface Artifact {
  id: string;
  project_id: string;
  type: ArtifactType;
  title: string;
  content: string | null;
  content_json: Record<string, unknown> | null;
  status: ArtifactStatus;
  version: number;
  parent_id: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  ai_prompt_used: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  creator?: Profile;
  signoffs?: Signoff[];
}

export interface Signoff {
  id: string;
  artifact_id: string;
  assignee_id: string;
  delegated_to_id: string | null;
  status: SignoffStatus;
  decision_at: string | null;
  comments: string | null;
  signature_hash: string | null;
  due_date: string | null;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  assignee?: Profile;
  delegated_to?: Profile;
  artifact?: Artifact;
}

export interface Ticket {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  reporter_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_hours: number | null;
  logged_hours: number;
  parent_id: string | null;
  artifact_id: string | null;
  labels: string[];
  github_issue_number: number | null;
  github_synced_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  assignee?: Profile;
  reporter?: Profile;
}

export interface Inquiry {
  id: string;
  project_id: string | null;
  artifact_id: string | null;
  subject: string;
  body: string;
  status: InquiryStatus;
  asked_by: string;
  answered_by: string | null;
  answer: string | null;
  answered_at: string | null;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  asker?: Profile;
  answerer?: Profile;
  project?: Project;
}

export interface ConversationMessage {
  id: string;
  project_id: string | null;
  artifact_id: string | null;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  user_id: string | null;
  created_at: string;
}

export interface GitHubSync {
  id: string;
  project_id: string;
  github_repo_id: number;
  github_entity_type: string;
  github_entity_id: number;
  ticket_id: string | null;
  artifact_id: string | null;
  direction: 'inbound' | 'outbound' | 'bilateral';
  last_synced_at: string;
  sync_status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  labels: GitHubLabel[];
  assignee: {
    login: string;
    avatar_url: string;
  } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface TicketWithGitHub extends Ticket {
  github_issue?: GitHubIssue;
  project?: Project;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

// Collaboration types
export type CommentEntityType = 'artifact' | 'ticket' | 'project' | 'inquiry';

export interface Comment {
  id: string;
  content: string;
  author_id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  parent_id: string | null;
  mentions: string[];
  is_edited: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: Profile;
  replies?: Comment[];
}

export type ActivityAction = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'commented'
  | 'mentioned'
  | 'status_changed'
  | 'assigned'
  | 'completed'
  | 'approved'
  | 'rejected'
  | 'uploaded'
  | 'synced'
  | 'signed_off';

export type ActivityEntityType = 'project' | 'artifact' | 'ticket' | 'inquiry' | 'signoff' | 'comment';

export interface Activity {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: ActivityAction;
  entity_type: ActivityEntityType;
  entity_id: string;
  entity_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined data
  actor?: Profile;
  project?: Project;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
  requestId?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

// UI helper types
export interface SelectOption {
  value: string;
  label: string;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
}
