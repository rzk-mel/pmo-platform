-- Migration: Add collaboration tables (comments and activities)
-- Run this in Supabase SQL Editor

-- ============================================
-- Comments table
-- Supports comments on artifacts, tickets, projects
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('artifact', 'ticket', 'project', 'inquiry')),
  entity_id TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  mentions TEXT[] DEFAULT '{}',
  is_edited BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- ============================================
-- Activities table
-- Logs all project activities for activity stream
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'updated', 'deleted', 'commented', 'mentioned',
    'status_changed', 'assigned', 'completed', 'approved', 'rejected',
    'uploaded', 'synced', 'signed_off'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'project', 'artifact', 'ticket', 'inquiry', 'signoff', 'comment'
  )),
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);
CREATE INDEX IF NOT EXISTS idx_activities_actor ON activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "Users can view comments on entities they have access to"
  ON comments FOR SELECT
  TO authenticated
  USING (true); -- Simplified, can add entity-level access control later

CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = author_id);

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = author_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid()::text = author_id);

-- Activities policies
CREATE POLICY "Users can view activities"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Enable realtime for comments
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- ============================================
-- Function to log activity
-- ============================================
CREATE OR REPLACE FUNCTION log_activity(
  p_project_id TEXT,
  p_actor_id TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_entity_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  activity_id TEXT;
BEGIN
  INSERT INTO activities (project_id, actor_id, action, entity_type, entity_id, entity_name, metadata)
  VALUES (p_project_id, p_actor_id, p_action, p_entity_type, p_entity_id, p_entity_name, p_metadata)
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$;
