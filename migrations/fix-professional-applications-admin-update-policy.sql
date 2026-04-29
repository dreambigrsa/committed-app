-- Allow admins/moderators to approve or reject professional applications.
-- Without this policy, RLS permits reading applications but blocks the status update,
-- leaving professional_applications.status as pending while professional_profiles is approved.

DROP POLICY IF EXISTS "Admins can update all applications" ON professional_applications;

CREATE POLICY "Admins can update all applications" ON professional_applications
  FOR UPDATE USING (
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
