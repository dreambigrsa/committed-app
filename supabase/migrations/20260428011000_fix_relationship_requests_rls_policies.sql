-- Ensure relationship request accept/reject actions are visible and writable
-- to the correct users, and manageable by admins/moderators.

ALTER TABLE relationship_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relationship requests involving them" ON relationship_requests;
DROP POLICY IF EXISTS "Users can create outgoing relationship requests" ON relationship_requests;
DROP POLICY IF EXISTS "Recipients can respond to relationship requests" ON relationship_requests;
DROP POLICY IF EXISTS "Admins can manage all relationship requests" ON relationship_requests;

CREATE POLICY "Users can view relationship requests involving them" ON relationship_requests
  FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create outgoing relationship requests" ON relationship_requests
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Recipients can respond to relationship requests" ON relationship_requests
  FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);

CREATE POLICY "Admins can manage all relationship requests" ON relationship_requests
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

GRANT SELECT, INSERT, UPDATE, DELETE ON relationship_requests TO authenticated;
