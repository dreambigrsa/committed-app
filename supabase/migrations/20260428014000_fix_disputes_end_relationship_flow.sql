-- Relationship end disputes must be actionable by involved users and admins.
-- Admins may create/manage end reviews; partners may respond; relationship rows
-- are only ended by explicit confirmation or overdue auto-resolution.

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view disputes involving them" ON disputes;
DROP POLICY IF EXISTS "Users can create disputes involving them" ON disputes;
DROP POLICY IF EXISTS "Users can update disputes" ON disputes;
DROP POLICY IF EXISTS "Admins can manage disputes" ON disputes;

CREATE POLICY "Users can view disputes involving them" ON disputes
  FOR SELECT
  USING (
    initiated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM relationships
      WHERE relationships.id = disputes.relationship_id
        AND (relationships.user_id = auth.uid() OR relationships.partner_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create disputes involving them" ON disputes
  FOR INSERT
  WITH CHECK (
    initiated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM relationships
      WHERE relationships.id = disputes.relationship_id
        AND (relationships.user_id = auth.uid() OR relationships.partner_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can update disputes" ON disputes
  FOR UPDATE
  USING (
    initiated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM relationships
      WHERE relationships.id = disputes.relationship_id
        AND (relationships.user_id = auth.uid() OR relationships.partner_user_id = auth.uid())
    )
  )
  WITH CHECK (
    initiated_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM relationships
      WHERE relationships.id = disputes.relationship_id
        AND (relationships.user_id = auth.uid() OR relationships.partner_user_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage disputes" ON disputes
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

GRANT SELECT, INSERT, UPDATE, DELETE ON disputes TO authenticated;
