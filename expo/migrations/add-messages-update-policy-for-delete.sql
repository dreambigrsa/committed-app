-- ============================================
-- Allow message soft-delete (deleted_for_sender / deleted_for_receiver)
-- Without this policy, UPDATE on messages is denied by RLS and deletes never persist.
-- ============================================

-- Ensure soft-delete columns exist (idempotent)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN DEFAULT FALSE;

-- Allow sender or receiver to update a message (e.g. set their delete flag)
-- Required so "Delete for me" and "Delete for everyone" persist after refresh
DROP POLICY IF EXISTS "Users can update their messages" ON messages;
CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);
