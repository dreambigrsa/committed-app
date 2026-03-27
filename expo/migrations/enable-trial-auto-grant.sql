-- ============================================
-- ENABLE AUTO-GRANT TRIAL FOR NEW MEMBERS
-- ============================================
-- This migration enables the automatic trial premium grant for new users
-- Uncomment the trigger creation to enable this feature

-- Create trigger to auto-grant trial (optional - can be enabled/disabled)
DROP TRIGGER IF EXISTS auto_grant_trial_on_user_create ON users;
CREATE TRIGGER auto_grant_trial_on_user_create
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_grant_trial_premium();

-- Note: To disable this feature, run:
-- DROP TRIGGER IF EXISTS auto_grant_trial_on_user_create ON users;

