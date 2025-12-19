-- ================================================
-- PRODUCTION COMPLETE DATABASE SETUP
-- Complete relationship verification platform
-- Run this in your Supabase SQL editor
-- ================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================================
-- RELATIONSHIP TIMELINE & MILESTONES
-- ================================================

CREATE TABLE IF NOT EXISTS relationship_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  milestone_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_milestone_type CHECK (milestone_type IN ('first_date', 'engagement', 'marriage', 'anniversary', 'moved_in', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_milestones_relationship ON relationship_milestones(relationship_id);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON relationship_milestones(date);

-- ================================================
-- COUPLE ACHIEVEMENTS & GAMIFICATION
-- ================================================

CREATE TABLE IF NOT EXISTS couple_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  achievement_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  points INT DEFAULT 0,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_achievement_type CHECK (achievement_type IN ('verified', 'first_month', 'first_year', 'engagement', 'marriage', 'milestone_completed', 'custom'))
);

CREATE TABLE IF NOT EXISTS couple_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL UNIQUE REFERENCES relationships(id) ON DELETE CASCADE,
  level INT DEFAULT 1,
  total_points INT DEFAULT 0,
  streak_days INT DEFAULT 0,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievements_relationship ON couple_achievements(relationship_id);
CREATE INDEX IF NOT EXISTS idx_couple_levels_relationship ON couple_levels(relationship_id);

-- ================================================
-- TWO-FACTOR AUTHENTICATION
-- ================================================

CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  secret TEXT NOT NULL,
  backup_codes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_2fa_user ON user_2fa(user_id);

-- ================================================
-- PHONE & EMAIL VERIFICATION
-- ================================================

CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_type VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_verification_type CHECK (verification_type IN ('phone', 'email', 'reset_password'))
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- ================================================
-- ID VERIFICATION
-- ================================================

CREATE TABLE IF NOT EXISTS id_verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_url TEXT NOT NULL,
  selfie_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_document_type CHECK (document_type IN ('passport', 'drivers_license', 'national_id', 'other')),
  CONSTRAINT valid_id_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_id_verification_user ON id_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_id_verification_status ON id_verification_requests(status);

-- ================================================
-- COUPLE SELFIE VERIFICATION
-- ================================================

CREATE TABLE IF NOT EXISTS couple_selfie_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  selfie_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_selfie_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_couple_selfie_relationship ON couple_selfie_verifications(relationship_id);
CREATE INDEX IF NOT EXISTS idx_couple_selfie_status ON couple_selfie_verifications(status);

-- ================================================
-- ANNIVERSARY REMINDERS
-- ================================================

CREATE TABLE IF NOT EXISTS anniversary_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL,
  reminder_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('monthly', 'yearly', 'custom'))
);

CREATE INDEX IF NOT EXISTS idx_anniversary_reminders_relationship ON anniversary_reminders(relationship_id);
CREATE INDEX IF NOT EXISTS idx_anniversary_reminders_date ON anniversary_reminders(reminder_date);
CREATE INDEX IF NOT EXISTS idx_anniversary_reminders_notified ON anniversary_reminders(notified);

-- ================================================
-- USER SETTINGS
-- ================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  notification_settings JSONB DEFAULT '{"relationshipRequests": true, "cheatingAlerts": true, "partnerActivity": true, "verificationUpdates": true}'::jsonb,
  privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "showRelationshipHistory": false, "allowSearchByPhone": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ================================================
-- AI RELATIONSHIP INSIGHTS
-- ================================================

CREATE TABLE IF NOT EXISTS relationship_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  score NUMERIC(3, 2),
  data JSONB,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_insight_type CHECK (insight_type IN ('health_score', 'engagement', 'communication', 'milestone_suggestion', 'warning'))
);

CREATE INDEX IF NOT EXISTS idx_insights_relationship ON relationship_insights(relationship_id);
CREATE INDEX IF NOT EXISTS idx_insights_generated ON relationship_insights(generated_at);

-- ================================================
-- FRAUD DETECTION LOGS
-- ================================================

CREATE TABLE IF NOT EXISTS fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  detection_type VARCHAR(50) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL,
  data JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_detection_type CHECK (detection_type IN ('duplicate_relationship', 'suspicious_activity', 'multiple_accounts', 'fake_profile', 'other')),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_fraud_logs_user ON fraud_detection_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_resolved ON fraud_detection_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_severity ON fraud_detection_logs(severity);

-- ================================================
-- PUSH NOTIFICATION TOKENS
-- ================================================

CREATE TABLE IF NOT EXISTS push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_type VARCHAR(20) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_device_type CHECK (device_type IN ('ios', 'android', 'web'))
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_notification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_notification_tokens(active);

-- ================================================
-- FUNCTIONS FOR GAMIFICATION
-- ================================================

-- Calculate couple level based on points
CREATE OR REPLACE FUNCTION calculate_couple_level(points INT)
RETURNS INT AS $$
BEGIN
  IF points < 100 THEN RETURN 1;
  ELSIF points < 500 THEN RETURN 2;
  ELSIF points < 1000 THEN RETURN 3;
  ELSIF points < 2500 THEN RETURN 4;
  ELSIF points < 5000 THEN RETURN 5;
  ELSIF points < 10000 THEN RETURN 6;
  ELSE RETURN 7 + ((points - 10000) / 5000)::INT;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update couple level when points change
CREATE OR REPLACE FUNCTION update_couple_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level := calculate_couple_level(NEW.total_points);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_couple_level
  BEFORE UPDATE OF total_points ON couple_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_couple_level();

-- ================================================
-- FUNCTIONS FOR AUTO-RESOLVE DISPUTES
-- ================================================

CREATE OR REPLACE FUNCTION auto_resolve_disputes()
RETURNS void AS $$
BEGIN
  UPDATE disputes
  SET
    status = 'resolved',
    resolution = 'auto_resolved',
    resolved_at = NOW()
  WHERE
    status = 'pending'
    AND auto_resolve_at <= NOW();

  UPDATE relationships
  SET
    status = 'ended',
    end_date = NOW()
  WHERE id IN (
    SELECT relationship_id
    FROM disputes
    WHERE status = 'resolved'
    AND resolution = 'auto_resolved'
    AND dispute_type = 'end_relationship'
  );
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- FUNCTIONS FOR ANNIVERSARY REMINDERS
-- ================================================

CREATE OR REPLACE FUNCTION process_anniversary_reminders()
RETURNS void AS $$
DECLARE
  reminder RECORD;
  relationship RECORD;
BEGIN
  FOR reminder IN
    SELECT * FROM anniversary_reminders
    WHERE reminder_date = CURRENT_DATE
    AND notified = FALSE
  LOOP
    SELECT * INTO relationship
    FROM relationships
    WHERE id = reminder.relationship_id;

    IF relationship.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        relationship.user_id,
        'anniversary_reminder',
        reminder.title,
        reminder.description,
        jsonb_build_object('relationshipId', reminder.relationship_id, 'reminderId', reminder.id)
      );
    END IF;

    IF relationship.partner_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        relationship.partner_user_id,
        'anniversary_reminder',
        reminder.title,
        reminder.description,
        jsonb_build_object('relationshipId', reminder.relationship_id, 'reminderId', reminder.id)
      );
    END IF;

    UPDATE anniversary_reminders
    SET notified = TRUE
    WHERE id = reminder.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- FUNCTION FOR FRAUD DETECTION
-- ================================================

CREATE OR REPLACE FUNCTION detect_duplicate_relationships(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  relationship_count INT,
  active_relationships JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.user_id,
    COUNT(*)::INT as relationship_count,
    jsonb_agg(jsonb_build_object(
      'id', r.id,
      'partnerName', r.partner_name,
      'status', r.status,
      'startDate', r.start_date
    )) as active_relationships
  FROM relationships r
  WHERE r.user_id = p_user_id
  AND r.status IN ('pending', 'verified')
  GROUP BY r.user_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- RLS POLICIES
-- ================================================

-- Relationship milestones
ALTER TABLE relationship_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their relationship milestones"
  ON relationship_milestones FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their relationship milestones"
  ON relationship_milestones FOR INSERT
  WITH CHECK (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Couple achievements
ALTER TABLE couple_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their couple achievements"
  ON couple_achievements FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Couple levels
ALTER TABLE couple_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their couple level"
  ON couple_levels FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- 2FA
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own 2FA"
  ON user_2fa FOR ALL
  USING (user_id = auth.uid());

-- Verification codes
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification codes"
  ON verification_codes FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own verification codes"
  ON verification_codes FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ID verification
ALTER TABLE id_verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ID verification"
  ON id_verification_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "Users can create their own ID verification"
  ON id_verification_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Couple selfie verification
ALTER TABLE couple_selfie_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their couple selfie verification"
  ON couple_selfie_verifications FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "Users can create couple selfie verification"
  ON couple_selfie_verifications FOR INSERT
  WITH CHECK (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Anniversary reminders
ALTER TABLE anniversary_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their anniversary reminders"
  ON anniversary_reminders FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their anniversary reminders"
  ON anniversary_reminders FOR INSERT
  WITH CHECK (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- User settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own settings"
  ON user_settings FOR ALL
  USING (user_id = auth.uid());

-- Relationship insights
ALTER TABLE relationship_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their relationship insights"
  ON relationship_insights FOR SELECT
  USING (
    relationship_id IN (
      SELECT id FROM relationships
      WHERE user_id = auth.uid() OR partner_user_id = auth.uid()
    )
  );

-- Fraud detection logs
ALTER TABLE fraud_detection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fraud logs"
  ON fraud_detection_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "System can insert fraud logs"
  ON fraud_detection_logs FOR INSERT
  WITH CHECK (true);

-- Push notification tokens
ALTER TABLE push_notification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON push_notification_tokens FOR ALL
  USING (user_id = auth.uid());

-- ================================================
-- SCHEDULED JOBS (Manual execution required)
-- ================================================

-- Note: These need to be set up as cron jobs or scheduled functions
-- in your Supabase dashboard or using pg_cron extension

-- Example: Run every hour to auto-resolve disputes
-- SELECT cron.schedule('auto-resolve-disputes', '0 * * * *', 'SELECT auto_resolve_disputes()');

-- Example: Run daily to process anniversary reminders
-- SELECT cron.schedule('process-anniversary-reminders', '0 9 * * *', 'SELECT process_anniversary_reminders()');

-- ================================================
-- INITIAL DATA SETUP
-- ================================================

-- Create default user settings for existing users
INSERT INTO user_settings (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_settings)
ON CONFLICT (user_id) DO NOTHING;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'PRODUCTION COMPLETE DATABASE SETUP SUCCESSFUL!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'All tables, functions, and policies created.';
  RAISE NOTICE 'Your app is now production-ready with:';
  RAISE NOTICE '- Relationship Timeline & Milestones';
  RAISE NOTICE '- Couple Achievements & Gamification';
  RAISE NOTICE '- Two-Factor Authentication';
  RAISE NOTICE '- Phone & Email Verification';
  RAISE NOTICE '- ID & Couple Selfie Verification';
  RAISE NOTICE '- Anniversary Reminders';
  RAISE NOTICE '- AI Relationship Insights';
  RAISE NOTICE '- Fraud Detection';
  RAISE NOTICE '- Push Notifications';
  RAISE NOTICE '==============================================';
END $$;
