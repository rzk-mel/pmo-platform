-- PMO Platform Database Schema
-- Run this FIRST before seed.sql

-- ============================================
-- Enable Extensions
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Custom Types (ENUMs)
-- ============================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin', 'org_admin', 'project_manager', 
    'tech_lead', 'developer', 'client_stakeholder', 'viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'draft', 'scoping', 'sow_draft', 'sow_review', 'poc_phase',
    'development', 'uat_phase', 'sign_off', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE artifact_type AS ENUM (
    'scope_document', 'sow', 'technical_spec', 'meeting_minutes',
    'poc_report', 'test_plan', 'uat_report', 'sign_off_document',
    'risk_assessment', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE artifact_status AS ENUM (
    'draft', 'pending_review', 'approved', 'rejected', 'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE signoff_status AS ENUM (
    'pending', 'approved', 'rejected', 'delegated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM (
    'open', 'in_progress', 'blocked', 'review', 'done', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM (
    'low', 'medium', 'high', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inquiry_status AS ENUM (
    'open', 'answered', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Organizations
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- User Profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role user_role DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT true,
  preferences JSONB DEFAULT '{}',
  github_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ============================================
-- Projects
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT REFERENCES organizations(id),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status project_status DEFAULT 'draft',
  phase_metadata JSONB DEFAULT '{}',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  project_manager_id TEXT REFERENCES profiles(id),
  tech_lead_id TEXT REFERENCES profiles(id),
  client_contact_id TEXT REFERENCES profiles(id),
  github_repo_url TEXT,
  github_repo_id BIGINT,
  estimated_budget DECIMAL(15,2),
  currency TEXT DEFAULT 'IDR',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(id)
);

-- ============================================
-- Project Members
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  profile_id TEXT REFERENCES profiles(id),
  role user_role NOT NULL,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, profile_id)
);

-- ============================================
-- Artifacts
-- ============================================
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  type artifact_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  content_json JSONB,
  status artifact_status DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  parent_id TEXT REFERENCES artifacts(id),
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2),
  ai_prompt_used TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(id)
);

-- ============================================
-- Signoffs
-- ============================================
CREATE TABLE IF NOT EXISTS signoffs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id TEXT REFERENCES artifacts(id) ON DELETE CASCADE,
  assignee_id TEXT REFERENCES profiles(id),
  delegated_to_id TEXT REFERENCES profiles(id),
  status signoff_status DEFAULT 'pending',
  decision_at TIMESTAMPTZ,
  comments TEXT,
  signature_hash TEXT,
  due_date DATE,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(id)
);

-- ============================================
-- Tickets
-- ============================================
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status ticket_status DEFAULT 'open',
  priority ticket_priority DEFAULT 'medium',
  assignee_id TEXT REFERENCES profiles(id),
  reporter_id TEXT REFERENCES profiles(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  estimated_hours DECIMAL(6,2),
  logged_hours DECIMAL(6,2) DEFAULT 0,
  parent_id TEXT REFERENCES tickets(id),
  artifact_id TEXT REFERENCES artifacts(id),
  labels TEXT[] DEFAULT '{}',
  github_issue_number INTEGER,
  github_synced_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES profiles(id)
);

-- ============================================
-- Inquiries
-- ============================================
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id),
  artifact_id TEXT REFERENCES artifacts(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status inquiry_status DEFAULT 'open',
  asked_by TEXT REFERENCES profiles(id),
  answered_by TEXT REFERENCES profiles(id),
  answer TEXT,
  answered_at TIMESTAMPTZ,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Conversation Messages (AI Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id),
  artifact_id TEXT REFERENCES artifacts(id),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_used TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  user_id TEXT REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GitHub Sync
-- ============================================
CREATE TABLE IF NOT EXISTS github_syncs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  github_repo_id BIGINT NOT NULL,
  github_entity_type TEXT NOT NULL,
  github_entity_id BIGINT NOT NULL,
  ticket_id TEXT REFERENCES tickets(id),
  artifact_id TEXT REFERENCES artifacts(id),
  direction TEXT DEFAULT 'bilateral' CHECK (direction IN ('inbound', 'outbound', 'bilateral')),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES profiles(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  entity_type TEXT,
  entity_id TEXT,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Internal Artifacts (for RAG)
-- ============================================
CREATE TABLE IF NOT EXISTS internal_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  mime_type TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Document Embeddings (for RAG with pgvector)
-- ============================================
-- Note: Requires pgvector extension
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE TABLE IF NOT EXISTS document_embeddings (
--   id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
--   artifact_id TEXT REFERENCES artifacts(id),
--   internal_artifact_id TEXT REFERENCES internal_artifacts(id),
--   conversation_id TEXT,
--   chunk_index INTEGER NOT NULL,
--   chunk_text TEXT NOT NULL,
--   embedding vector(1536),
--   metadata JSONB DEFAULT '{}',
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_artifacts_project ON artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
CREATE INDEX IF NOT EXISTS idx_signoffs_artifact ON signoffs(artifact_id);
CREATE INDEX IF NOT EXISTS idx_signoffs_assignee ON signoffs(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_project ON inquiries(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations', 'profiles', 'projects', 'artifacts', 'signoffs', 'tickets', 'inquiries', 'github_syncs', 'internal_artifacts']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trigger_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

SELECT 'Schema created successfully!' as message;
