// Supabase Edge Functions - Supabase Client
// Initialize Supabase client with proper auth handling

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Database types (generated from schema)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: 'super_admin' | 'org_admin' | 'project_manager' | 'tech_lead' | 'developer' | 'client_stakeholder' | 'viewer';
          is_active: boolean;
          preferences: Record<string, unknown>;
          github_username: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          name: string;
          description: string | null;
          status: 'draft' | 'scoping' | 'sow_draft' | 'sow_review' | 'poc_phase' | 'development' | 'uat_phase' | 'sign_off' | 'completed' | 'cancelled';
          start_date: string | null;
          target_end_date: string | null;
          project_manager_id: string | null;
          tech_lead_id: string | null;
          github_repo_url: string | null;
          github_repo_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      artifacts: {
        Row: {
          id: string;
          project_id: string;
          type: 'scope_document' | 'sow' | 'technical_spec' | 'meeting_minutes' | 'poc_report' | 'test_plan' | 'uat_report' | 'sign_off_document' | 'risk_assessment' | 'other';
          title: string;
          content: string | null;
          content_json: Record<string, unknown> | null;
          status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'superseded';
          version: number;
          parent_id: string | null;
          file_path: string | null;
          ai_generated: boolean;
          ai_confidence: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['artifacts']['Row'], 'id' | 'created_at' | 'updated_at' | 'version'>;
        Update: Partial<Database['public']['Tables']['artifacts']['Insert']>;
      };
      tickets: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          description: string | null;
          status: 'open' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled';
          priority: 'low' | 'medium' | 'high' | 'critical';
          assignee_id: string | null;
          reporter_id: string | null;
          due_date: string | null;
          github_issue_number: number | null;
          github_synced_at: string | null;
          labels: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>;
      };
      conversation_messages: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['conversation_messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['conversation_messages']['Insert']>;
      };
      document_embeddings: {
        Row: {
          id: string;
          artifact_id: string | null;
          internal_artifact_id: string | null;
          conversation_id: string | null;
          chunk_index: number;
          chunk_text: string;
          embedding: number[];
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['document_embeddings']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['document_embeddings']['Insert']>;
      };
      github_sync: {
        Row: {
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
        };
        Insert: Omit<Database['public']['Tables']['github_sync']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['github_sync']['Insert']>;
      };
    };
    Functions: {
      search_documents: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          p_project_id?: string | null;
        };
        Returns: {
          id: string;
          chunk_text: string;
          similarity: number;
          source_type: string;
          source_id: string;
          metadata: Record<string, unknown>;
        }[];
      };
    };
  };
}

// Get Supabase URL and keys from environment
function getSupabaseConfig() {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey) {
    throw new Error('Missing Supabase configuration');
  }

  return { url, anonKey, serviceRoleKey };
}

// Create client with user's JWT (RLS enforced)
export function createSupabaseClient(authHeader: string | null): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseConfig();

  return createClient<Database>(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Create admin client (bypasses RLS - use carefully!)
export function createSupabaseAdmin(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getSupabaseConfig();

  if (!serviceRoleKey) {
    throw new Error('Service role key not configured');
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Get current user from JWT
export async function getCurrentUser(client: SupabaseClient<Database>) {
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return user;
}

// Get user's profile with role
export async function getUserProfile(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return null;
  }

  return data;
}
