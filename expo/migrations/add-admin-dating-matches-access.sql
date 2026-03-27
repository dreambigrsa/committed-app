-- ============================================
-- ADMIN ACCESS TO DATING MATCHES
-- ============================================
-- Allows admins to view all dating matches in the admin panel

-- Drop existing admin policy if it exists
DROP POLICY IF EXISTS "Admins can view all matches" ON dating_matches;

-- Create policy for admins to view all matches
CREATE POLICY "Admins can view all matches" ON dating_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Also allow admins to view all likes
DROP POLICY IF EXISTS "Admins can view all likes" ON dating_likes;
CREATE POLICY "Admins can view all likes" ON dating_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Allow admins to view all passes
DROP POLICY IF EXISTS "Admins can view all passes" ON dating_passes;
CREATE POLICY "Admins can view all passes" ON dating_passes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

