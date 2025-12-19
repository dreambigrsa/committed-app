-- Fix RLS policies for professional_sessions table
-- Add missing INSERT and UPDATE policies to allow users to create and manage sessions

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can create professional sessions" ON professional_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON professional_sessions;
DROP POLICY IF EXISTS "Professionals can update their sessions" ON professional_sessions;
DROP POLICY IF EXISTS "Admins can manage all professional sessions" ON professional_sessions;

-- Users can create (INSERT) sessions where they are the user
CREATE POLICY "Users can create professional sessions" ON professional_sessions
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Users can update their own sessions (e.g., cancel, end early)
CREATE POLICY "Users can update their own sessions" ON professional_sessions
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Professionals can update sessions where they are the assigned professional
CREATE POLICY "Professionals can update their sessions" ON professional_sessions
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_sessions.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_sessions.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
  );

-- Admins can manage (INSERT/UPDATE/DELETE) all sessions
CREATE POLICY "Admins can manage all professional sessions" ON professional_sessions
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

