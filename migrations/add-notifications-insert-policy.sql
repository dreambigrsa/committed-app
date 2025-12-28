-- ============================================
-- ADD NOTIFICATIONS INSERT POLICY
-- ============================================
-- This migration adds an INSERT policy for the notifications table
-- to allow users to create notifications for other users (e.g., when ending relationships)

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;

-- Allow authenticated users to create notifications
-- This is needed for features like end relationship requests where User A needs to notify User B
CREATE POLICY "Users can create notifications" ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

