-- Complete Database Schema for Relationship Verification Platform
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add missing tables for new features

-- Relationship Milestones Table
CREATE TABLE IF NOT EXISTS relationship_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('first_date', 'first_kiss', 'engagement', 'marriage', 'anniversary', 'moved_in', 'other')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Couple Achievements Table  
CREATE TABLE IF NOT EXISTS couple_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT,
  points_earned INT DEFAULT 0,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  notification_settings JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  theme_preference TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Two Factor Authentication Table
CREATE TABLE IF NOT EXISTS user_2fa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  secret TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  backup_codes TEXT[],
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationship Insights Table (AI-generated)
CREATE TABLE IF NOT EXISTS relationship_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  insight_data JSONB NOT NULL,
  health_score INT CHECK (health_score >= 0 AND health_score <= 100),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push Notification Tokens Table
CREATE TABLE IF NOT EXISTS push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_relationship_id ON relationship_milestones(relationship_id);
CREATE INDEX IF NOT EXISTS idx_relationship_milestones_date ON relationship_milestones(date);
CREATE INDEX IF NOT EXISTS idx_couple_achievements_relationship_id ON couple_achievements(relationship_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_2fa_user_id ON user_2fa(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_insights_relationship_id ON relationship_insights(relationship_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_tokens_user_id ON push_notification_tokens(user_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_relationship_milestones_updated_at BEFORE UPDATE ON relationship_milestones 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_2fa_updated_at BEFORE UPDATE ON user_2fa 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for new tables

-- Relationship Milestones RLS
ALTER TABLE relationship_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view milestones of their relationships"
ON relationship_milestones FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.id = relationship_milestones.relationship_id
    AND (r.user_id = auth.uid() OR r.partner_user_id = auth.uid())
  )
);

CREATE POLICY "Users can create milestones for their relationships"
ON relationship_milestones FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.id = relationship_milestones.relationship_id
    AND (r.user_id = auth.uid() OR r.partner_user_id = auth.uid())
  )
);

CREATE POLICY "Users can delete their own milestones"
ON relationship_milestones FOR DELETE
USING (created_by = auth.uid());

-- Couple Achievements RLS
ALTER TABLE couple_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view achievements of their relationships"
ON couple_achievements FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.id = couple_achievements.relationship_id
    AND (r.user_id = auth.uid() OR r.partner_user_id = auth.uid())
  )
);

-- User Settings RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
ON user_settings FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own settings"
ON user_settings FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own settings"
ON user_settings FOR INSERT
WITH CHECK (user_id = auth.uid());

-- User 2FA RLS
ALTER TABLE user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own 2FA settings"
ON user_2fa FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own 2FA settings"
ON user_2fa FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own 2FA settings"
ON user_2fa FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Relationship Insights RLS
ALTER TABLE relationship_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insights for their relationships"
ON relationship_insights FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM relationships r
    WHERE r.id = relationship_insights.relationship_id
    AND (r.user_id = auth.uid() OR r.partner_user_id = auth.uid())
  )
);

-- Push Notification Tokens RLS
ALTER TABLE push_notification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push tokens"
ON push_notification_tokens FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own push tokens"
ON push_notification_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own push tokens"
ON push_notification_tokens FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own push tokens"
ON push_notification_tokens FOR DELETE
USING (user_id = auth.uid());

-- Functions for auto-resolving disputes after 7 days
CREATE OR REPLACE FUNCTION auto_resolve_disputes()
RETURNS void AS $$
BEGIN
  UPDATE disputes
  SET status = 'auto_resolved',
      resolved_at = NOW(),
      resolution = 'Auto-resolved after 7 days'
  WHERE status = 'pending'
    AND auto_resolve_at <= NOW();
  
  -- End relationships for auto-resolved disputes
  UPDATE relationships r
  SET status = 'ended',
      end_date = NOW()
  FROM disputes d
  WHERE d.relationship_id = r.id
    AND d.status = 'auto_resolved'
    AND d.dispute_type = 'end_relationship'
    AND r.status != 'ended';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate couple level
CREATE OR REPLACE FUNCTION get_couple_level(rel_id UUID)
RETURNS TABLE (
  level INT,
  level_name TEXT,
  points INT,
  next_level_points INT
) AS $$
DECLARE
  milestone_count INT;
  achievement_count INT;
  days_together INT;
  total_points INT;
  calculated_level INT;
  calculated_level_name TEXT;
BEGIN
  SELECT COUNT(*) INTO milestone_count
  FROM relationship_milestones
  WHERE relationship_id = rel_id;
  
  SELECT COUNT(*) INTO achievement_count
  FROM couple_achievements
  WHERE relationship_id = rel_id;
  
  SELECT FLOOR(EXTRACT(EPOCH FROM (NOW() - r.start_date)) / 86400) INTO days_together
  FROM relationships r
  WHERE r.id = rel_id;
  
  total_points := (COALESCE(milestone_count, 0) * 10) +
                  (COALESCE(achievement_count, 0) * 20) +
                  (COALESCE(days_together, 0) / 30 * 5);
  
  -- Calculate level and name
  IF total_points >= 1000 THEN
    calculated_level := 10;
    calculated_level_name := 'Legendary';
  ELSIF total_points >= 750 THEN
    calculated_level := 9;
    calculated_level_name := 'Inseparable';
  ELSIF total_points >= 500 THEN
    calculated_level := 8;
    calculated_level_name := 'Soulmates';
  ELSIF total_points >= 350 THEN
    calculated_level := 7;
    calculated_level_name := 'Power Couple';
  ELSIF total_points >= 250 THEN
    calculated_level := 6;
    calculated_level_name := 'Devoted';
  ELSIF total_points >= 150 THEN
    calculated_level := 5;
    calculated_level_name := 'Committed';
  ELSIF total_points >= 100 THEN
    calculated_level := 4;
    calculated_level_name := 'Serious';
  ELSIF total_points >= 50 THEN
    calculated_level := 3;
    calculated_level_name := 'Growing';
  ELSIF total_points >= 20 THEN
    calculated_level := 2;
    calculated_level_name := 'Starting';
  ELSE
    calculated_level := 1;
    calculated_level_name := 'New Couple';
  END IF;
  
  RETURN QUERY SELECT calculated_level, calculated_level_name, total_points, calculated_level * 50;
END;
$$ LANGUAGE plpgsql;

-- Seed some initial achievements
INSERT INTO couple_achievements (relationship_id, achievement_type, achievement_name, achievement_description, points_earned)
SELECT 
  r.id,
  'first_week',
  'First Week Together',
  'Completed your first week as a couple',
  10
FROM relationships r
WHERE r.status = 'verified'
  AND EXTRACT(EPOCH FROM (NOW() - r.start_date)) / 86400 >= 7
  AND NOT EXISTS (
    SELECT 1 FROM couple_achievements ca 
    WHERE ca.relationship_id = r.id 
    AND ca.achievement_type = 'first_week'
  )
ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Advanced features database schema created successfully!' AS message;
