-- ============================================
-- DATING ADMIN CONTROLS
-- ============================================
-- Adds admin capabilities for managing dating profiles

-- Add admin control columns to dating_profiles
ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS admin_suspended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_suspended_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_limited BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_limited_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_limited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_limited_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS premium_trial_ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS premium_trial_granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS premium_trial_granted_at TIMESTAMP WITH TIME ZONE;

-- Update RLS policies to allow admins to manage all profiles
DROP POLICY IF EXISTS "Admins can manage all dating profiles" ON dating_profiles;
CREATE POLICY "Admins can manage all dating profiles" ON dating_profiles
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

-- Allow admins to manage user badges
DROP POLICY IF EXISTS "Admins can manage all badges" ON user_dating_badges;
CREATE POLICY "Admins can manage all badges" ON user_dating_badges
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

-- Allow admins to manage subscriptions
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON user_subscriptions;
CREATE POLICY "Admins can manage all subscriptions" ON user_subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Function to grant trial premium membership
CREATE OR REPLACE FUNCTION grant_trial_premium(
  p_user_id UUID,
  p_granted_by UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN AS $$
DECLARE
  v_profile_id UUID;
  v_trial_ends_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get or create dating profile
  SELECT id INTO v_profile_id
  FROM dating_profiles
  WHERE user_id = p_user_id;

  IF v_profile_id IS NULL THEN
    -- Create minimal profile if it doesn't exist
    INSERT INTO dating_profiles (user_id, is_active)
    VALUES (p_user_id, true)
    RETURNING id INTO v_profile_id;
  END IF;

  -- Calculate trial end date
  v_trial_ends_at := NOW() + (p_days || ' days')::INTERVAL;

  -- Update profile with trial info
  UPDATE dating_profiles
  SET 
    premium_trial_ends_at = v_trial_ends_at,
    premium_trial_granted_by = p_granted_by,
    premium_trial_granted_at = NOW()
  WHERE id = v_profile_id;

  -- Create or update subscription
  INSERT INTO user_subscriptions (
    user_id,
    plan_id,
    status,
    started_at,
    expires_at
  )
  SELECT 
    p_user_id,
    sp.id,
    'trial',
    NOW(),
    v_trial_ends_at
  FROM subscription_plans sp
  WHERE sp.name = 'Premium'
  LIMIT 1
  ON CONFLICT (user_id) 
  DO UPDATE SET
    status = 'trial',
    plan_id = (SELECT id FROM subscription_plans WHERE name = 'Premium' LIMIT 1),
    started_at = NOW(),
    expires_at = v_trial_ends_at,
    updated_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-grant trial to new members (can be called by trigger)
CREATE OR REPLACE FUNCTION auto_grant_trial_premium()
RETURNS TRIGGER AS $$
BEGIN
  -- Only grant trial if user is new (created in last 24 hours)
  -- and doesn't already have a subscription
  IF NEW.created_at > NOW() - INTERVAL '24 hours' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_subscriptions
      WHERE user_id = NEW.id
      AND status IN ('active', 'trial')
    ) THEN
      -- Grant 7-day trial (you can customize this)
      PERFORM grant_trial_premium(NEW.id, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-grant trial (optional - can be enabled/disabled)
-- DROP TRIGGER IF EXISTS auto_grant_trial_on_user_create ON users;
-- CREATE TRIGGER auto_grant_trial_on_user_create
--   AFTER INSERT ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_grant_trial_premium();

