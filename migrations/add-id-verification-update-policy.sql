-- Add RLS policies for verification_documents table
-- This migration adds the missing policies that allow:
-- 1. Users to view and insert their own verification documents
-- 2. Admins to view all verification documents
-- 3. Admins to update verification documents (approve/reject)

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view their own verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can view all verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Users can insert their own verification documents" ON verification_documents;
DROP POLICY IF EXISTS "Admins can update verification documents" ON verification_documents;

-- Users can view their own verification documents
CREATE POLICY "Users can view their own verification documents"
  ON verification_documents FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all verification documents
CREATE POLICY "Admins can view all verification documents"
  ON verification_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Users can insert their own verification documents
CREATE POLICY "Users can insert their own verification documents"
  ON verification_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update verification documents (approve/reject)
CREATE POLICY "Admins can update verification documents"
  ON verification_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

