-- ============================================
-- RLS POLICIES FOR PROFESSIONAL BOOKINGS
-- Adds policies to allow users and professionals
-- to manage their bookings
-- ============================================

-- Ensure RLS is enabled
ALTER TABLE professional_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own bookings
DROP POLICY IF EXISTS "Users can view their bookings" ON professional_sessions;
CREATE POLICY "Users can view their bookings"
  ON professional_sessions FOR SELECT
  USING (
    auth.uid() = user_id 
    AND session_type IN ('offline_booking', 'scheduled')
  );

-- Policy: Professionals can view their bookings
DROP POLICY IF EXISTS "Professionals can view their bookings" ON professional_sessions;
CREATE POLICY "Professionals can view their bookings"
  ON professional_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_sessions.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
    AND session_type IN ('offline_booking', 'scheduled')
  );

-- Policy: Users can create their own bookings
DROP POLICY IF EXISTS "Users can create their bookings" ON professional_sessions;
CREATE POLICY "Users can create their bookings"
  ON professional_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND session_type IN ('offline_booking', 'scheduled')
  );

-- Policy: Users can update their own bookings (reschedule, cancel)
DROP POLICY IF EXISTS "Users can update their bookings" ON professional_sessions;
CREATE POLICY "Users can update their bookings"
  ON professional_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND session_type IN ('offline_booking', 'scheduled')
  );

-- Policy: Professionals can update their bookings (confirm, complete, reschedule, cancel)
DROP POLICY IF EXISTS "Professionals can update their bookings" ON professional_sessions;
CREATE POLICY "Professionals can update their bookings"
  ON professional_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_sessions.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
    AND session_type IN ('offline_booking', 'scheduled')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_sessions.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
    AND session_type IN ('offline_booking', 'scheduled')
  );

-- Policy: Admins can manage all bookings
DROP POLICY IF EXISTS "Admins can manage all bookings" ON professional_sessions;
CREATE POLICY "Admins can manage all bookings"
  ON professional_sessions FOR ALL
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

