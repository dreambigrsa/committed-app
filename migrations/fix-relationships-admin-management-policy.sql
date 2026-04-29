-- Allow admins/moderators to manage relationship verification records.
-- Root cause: existing relationship RLS only allowed the owner/partner to update.
-- Admin verify/reject/delete could therefore affect zero rows and leave records pending.

DROP POLICY IF EXISTS "Admins can manage all relationships" ON relationships;

CREATE POLICY "Admins can manage all relationships" ON relationships
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON relationships TO authenticated;
