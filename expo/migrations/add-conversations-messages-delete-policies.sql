-- ============================================
-- Allow participants to DELETE conversations and their messages
-- Without these policies, conversation delete in the app fails silently (RLS blocks)
-- and the chat reappears after refresh.
-- ============================================

-- 1) Messages: allow sender or receiver to delete (e.g. when deleting whole conversation)
DROP POLICY IF EXISTS "Users can delete their messages" ON messages;
CREATE POLICY "Users can delete their messages" ON messages
  FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- 2) Conversations: allow any participant to delete the conversation
DROP POLICY IF EXISTS "Users can delete their conversations" ON conversations;
CREATE POLICY "Users can delete their conversations" ON conversations
  FOR DELETE
  USING (auth.uid() = ANY(participant_ids));
