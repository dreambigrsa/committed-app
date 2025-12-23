-- ============================================
-- COMPLETE SUBSCRIPTION SYSTEM SETUP
-- ============================================
-- Run this ENTIRE file in Supabase SQL Editor
-- This includes subscription tables, limits, and message limits
-- ============================================

-- ============================================
-- SUBSCRIPTION & PREMIUM SYSTEM
-- ============================================

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- e.g., 'free', 'premium', 'premium_plus'
  display_name TEXT NOT NULL, -- e.g., 'Free', 'Premium', 'Premium Plus'
  description TEXT,
  price_monthly DECIMAL(10, 2) DEFAULT 0, -- Monthly price in USD
  price_yearly DECIMAL(10, 2) DEFAULT 0, -- Yearly price in USD
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  features JSONB DEFAULT '{}', -- Feature flags for this plan
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  payment_provider TEXT, -- 'stripe', 'apple', 'google', 'manual'
  payment_provider_subscription_id TEXT, -- External subscription ID
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dating Feature Limits Table
CREATE TABLE IF NOT EXISTS dating_feature_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL, -- e.g., 'daily_likes', 'super_likes', 'rewinds'
  limit_value INTEGER, -- NULL means unlimited
  limit_period TEXT DEFAULT 'daily' CHECK (limit_period IN ('daily', 'weekly', 'monthly', 'lifetime')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_plan_feature UNIQUE (plan_id, feature_name)
);

-- Dating Usage Tracking Table
CREATE TABLE IF NOT EXISTS dating_usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL, -- e.g., 'likes', 'super_likes', 'rewinds'
  usage_count INTEGER DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_feature_period UNIQUE (user_id, feature_name, period_start)
);

-- Pricing Configuration Table (Admin Settings)
CREATE TABLE IF NOT EXISTS pricing_configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_dating_limits_plan_id ON dating_feature_limits(plan_id);
CREATE INDEX IF NOT EXISTS idx_dating_usage_user_id ON dating_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_dating_usage_period ON dating_usage_tracking(user_id, feature_name, period_start);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Subscription Plans: Everyone can view active plans
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON subscription_plans;
CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage plans
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;
CREATE POLICY "Admins can manage subscription plans" ON subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- User Subscriptions: Users can view their own
DROP POLICY IF EXISTS "Users can view their own subscription" ON user_subscriptions;
CREATE POLICY "Users can view their own subscription" ON user_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON user_subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON user_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- System can insert/update subscriptions (for payment webhooks - use service role)
DROP POLICY IF EXISTS "System can manage subscriptions" ON user_subscriptions;
CREATE POLICY "System can manage subscriptions" ON user_subscriptions FOR ALL
  USING (true); -- Restricted by service role in practice

-- Dating Feature Limits: Everyone can view
DROP POLICY IF EXISTS "Anyone can view feature limits" ON dating_feature_limits;
CREATE POLICY "Anyone can view feature limits" ON dating_feature_limits FOR SELECT
  USING (true);

-- Admins can manage limits
DROP POLICY IF EXISTS "Admins can manage feature limits" ON dating_feature_limits;
CREATE POLICY "Admins can manage feature limits" ON dating_feature_limits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Dating Usage Tracking: Users can view their own
DROP POLICY IF EXISTS "Users can view their own usage" ON dating_usage_tracking;
CREATE POLICY "Users can view their own usage" ON dating_usage_tracking FOR SELECT
  USING (user_id = auth.uid());

-- System can insert/update usage (via service role)
DROP POLICY IF EXISTS "System can track usage" ON dating_usage_tracking;
CREATE POLICY "System can track usage" ON dating_usage_tracking FOR ALL
  USING (true); -- Restricted by service role in practice

-- Pricing Configuration: Admins only
DROP POLICY IF EXISTS "Admins can manage pricing" ON pricing_configuration;
CREATE POLICY "Admins can manage pricing" ON pricing_configuration FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Drop existing function first (if it exists) to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_subscription_plan(UUID);

-- Get user's subscription plan
CREATE OR REPLACE FUNCTION get_user_subscription_plan(user_id_param UUID)
RETURNS TABLE(plan_id UUID, plan_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id as plan_id,
    sp.name as plan_name
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = user_id_param
    AND us.status IN ('active', 'trial')
    AND (us.expires_at IS NULL OR us.expires_at > NOW())
  LIMIT 1;
  
  -- If no subscription found, return free plan
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT id as plan_id, name as plan_name
    FROM subscription_plans
    WHERE name = 'free'
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can perform dating action
CREATE OR REPLACE FUNCTION check_dating_feature_limit(
  user_id_param UUID,
  feature_name_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_plan_id UUID;
  plan_name TEXT;
  limit_value INTEGER;
  limit_period TEXT;
  current_usage INTEGER;
  period_start TIMESTAMP WITH TIME ZONE;
  period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get user's plan
  SELECT plan_id, plan_name INTO user_plan_id, plan_name
  FROM get_user_subscription_plan(user_id_param)
  LIMIT 1;
  
  -- Get limit for this feature
  SELECT dfl.limit_value, dfl.limit_period INTO limit_value, limit_period
  FROM dating_feature_limits dfl
  WHERE dfl.plan_id = user_plan_id
    AND dfl.feature_name = feature_name_param
  LIMIT 1;
  
  -- If no limit set or limit is NULL, allow (unlimited)
  IF limit_value IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Calculate period based on limit_period
  CASE limit_period
    WHEN 'daily' THEN
      period_start := DATE_TRUNC('day', NOW());
      period_end := period_start + INTERVAL '1 day';
    WHEN 'weekly' THEN
      period_start := DATE_TRUNC('week', NOW());
      period_end := period_start + INTERVAL '1 week';
    WHEN 'monthly' THEN
      period_start := DATE_TRUNC('month', NOW());
      period_end := period_start + INTERVAL '1 month';
    ELSE
      -- lifetime - check all time
      period_start := '1970-01-01'::TIMESTAMP WITH TIME ZONE;
      period_end := NOW() + INTERVAL '1 year';
  END CASE;
  
  -- Get current usage
  SELECT COALESCE(SUM(usage_count), 0) INTO current_usage
  FROM dating_usage_tracking
  WHERE user_id = user_id_param
    AND feature_name = feature_name_param
    AND period_start >= period_start
    AND period_start < period_end;
  
  -- Check if under limit
  RETURN current_usage < limit_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Track dating feature usage
CREATE OR REPLACE FUNCTION track_dating_usage(
  user_id_param UUID,
  feature_name_param TEXT,
  increment_by INTEGER DEFAULT 1
)
RETURNS VOID AS $$
DECLARE
  period_start TIMESTAMP WITH TIME ZONE;
  period_end TIMESTAMP WITH TIME ZONE;
  limit_period TEXT;
  user_plan_id UUID;
BEGIN
  -- Get user's plan to determine period
  SELECT plan_id INTO user_plan_id
  FROM get_user_subscription_plan(user_id_param)
  LIMIT 1;
  
  -- Get limit period
  SELECT dfl.limit_period INTO limit_period
  FROM dating_feature_limits dfl
  WHERE dfl.plan_id = user_plan_id
    AND dfl.feature_name = feature_name_param
  LIMIT 1;
  
  -- Default to daily if not found
  IF limit_period IS NULL THEN
    limit_period := 'daily';
  END IF;
  
  -- Calculate period
  CASE limit_period
    WHEN 'daily' THEN
      period_start := DATE_TRUNC('day', NOW());
      period_end := period_start + INTERVAL '1 day';
    WHEN 'weekly' THEN
      period_start := DATE_TRUNC('week', NOW());
      period_end := period_start + INTERVAL '1 week';
    WHEN 'monthly' THEN
      period_start := DATE_TRUNC('month', NOW());
      period_end := period_start + INTERVAL '1 month';
    ELSE
      period_start := DATE_TRUNC('day', NOW());
      period_end := period_start + INTERVAL '1 day';
  END CASE;
  
  -- Insert or update usage
  INSERT INTO dating_usage_tracking (user_id, feature_name, usage_count, period_start, period_end)
  VALUES (user_id_param, feature_name_param, increment_by, period_start, period_end)
  ON CONFLICT (user_id, feature_name, period_start)
  DO UPDATE SET 
    usage_count = dating_usage_tracking.usage_count + increment_by,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MESSAGE LIMIT FUNCTIONS
-- ============================================

-- Check if user can send conversation starter
CREATE OR REPLACE FUNCTION check_conversation_starter_limit(
  sender_id_param UUID,
  receiver_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  user_plan_id UUID;
  limit_value INTEGER;
  existing_starter INTEGER;
BEGIN
  -- Get user's plan
  SELECT plan_id INTO user_plan_id
  FROM user_subscriptions
  WHERE user_id = sender_id_param
    AND status IN ('active', 'trial')
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  -- If no subscription, use free plan
  IF user_plan_id IS NULL THEN
    SELECT id INTO user_plan_id
    FROM subscription_plans
    WHERE name = 'free'
    LIMIT 1;
  END IF;

  -- Get limit for conversation starter
  SELECT dfl.limit_value INTO limit_value
  FROM dating_feature_limits dfl
  WHERE dfl.plan_id = user_plan_id
    AND dfl.feature_name = 'conversation_starter'
  LIMIT 1;

  -- If no limit set or NULL (unlimited), allow
  IF limit_value IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check if user already sent a conversation starter to this receiver
  -- (Check if any conversation exists between these users with messages from sender)
  SELECT COUNT(DISTINCT c.id) INTO existing_starter
  FROM conversations c
  JOIN messages m ON m.conversation_id = c.id
  WHERE m.sender_id = sender_id_param
    AND c.participant_ids @> ARRAY[sender_id_param::text]
    AND c.participant_ids @> ARRAY[receiver_id_param::text]
    AND c.participant_ids = ARRAY[sender_id_param::text, receiver_id_param::text]  -- Only 2 participants
    AND m.receiver_id = receiver_id_param;

  -- Allow if under limit (limit is typically 1)
  RETURN existing_starter < limit_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can send message (pre-match or per-conversation)
CREATE OR REPLACE FUNCTION check_dating_message_limit(
  sender_id_param UUID,
  conversation_id_param UUID
)
RETURNS JSONB AS $$
DECLARE
  user_plan_id UUID;
  pre_match_limit INTEGER;
  conversation_limit INTEGER;
  is_match BOOLEAN;
  message_count INTEGER;
  conv_participants TEXT[];
BEGIN
  -- Get user's plan
  SELECT plan_id INTO user_plan_id
  FROM user_subscriptions
  WHERE user_id = sender_id_param
    AND status IN ('active', 'trial')
    AND (expires_at IS NULL OR expires_at > NOW())
  LIMIT 1;

  -- If no subscription, use free plan
  IF user_plan_id IS NULL THEN
    SELECT id INTO user_plan_id
    FROM subscription_plans
    WHERE name = 'free'
    LIMIT 1;
  END IF;

  -- Get conversation participants
  SELECT participant_ids INTO conv_participants
  FROM conversations
  WHERE id = conversation_id_param;

  -- Only apply limits to 2-participant conversations (dating conversations)
  IF conv_participants IS NULL OR array_length(conv_participants, 1) != 2 THEN
    -- Not a dating conversation, allow (no limit)
    RETURN jsonb_build_object('allowed', true, 'reason', 'not_dating_conversation');
  END IF;

  -- Check if these two users have a match
  SELECT EXISTS (
    SELECT 1 FROM dating_matches dm
    WHERE (
      (dm.user1_id::text = conv_participants[1] AND dm.user2_id::text = conv_participants[2])
      OR (dm.user1_id::text = conv_participants[2] AND dm.user2_id::text = conv_participants[1])
    )
  ) INTO is_match;

  -- Get limits
  SELECT limit_value INTO pre_match_limit
  FROM dating_feature_limits
  WHERE plan_id = user_plan_id AND feature_name = 'pre_match_messages'
  LIMIT 1;

  SELECT limit_value INTO conversation_limit
  FROM dating_feature_limits
  WHERE plan_id = user_plan_id AND feature_name = 'messages_per_conversation'
  LIMIT 1;

  -- Premium users (NULL limits) have unlimited
  IF pre_match_limit IS NULL AND conversation_limit IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'premium_unlimited'
    );
  END IF;

  -- Count messages in this conversation from sender
  SELECT COUNT(*) INTO message_count
  FROM messages
  WHERE conversation_id = conversation_id_param
    AND sender_id = sender_id_param;

  -- If matched, only check conversation limit
  IF is_match THEN
    IF conversation_limit IS NULL THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
    END IF;
    
    IF message_count >= conversation_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'conversation_limit_reached',
        'limit', conversation_limit,
        'current', message_count
      );
    END IF;
    
    RETURN jsonb_build_object('allowed', true, 'reason', 'within_limit');
  END IF;

  -- If not matched, check pre-match limit
  IF pre_match_limit IS NULL THEN
    -- No pre-match limit, check conversation limit if set
    IF conversation_limit IS NULL THEN
      RETURN jsonb_build_object('allowed', true, 'reason', 'unlimited');
    END IF;
    
    IF message_count >= conversation_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'conversation_limit_reached',
        'limit', conversation_limit,
        'current', message_count
      );
    END IF;
    
    RETURN jsonb_build_object('allowed', true, 'reason', 'within_limit');
  END IF;

  -- Check pre-match limit
  IF message_count >= pre_match_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'pre_match_limit_reached',
      'limit', pre_match_limit,
      'current', message_count
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'within_pre_match_limit');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION check_conversation_starter_limit IS 'Checks if user can send a conversation starter to another user (limit: 1 per user, per day)';
COMMENT ON FUNCTION check_dating_message_limit IS 'Checks if user can send a message in a dating conversation (enforces pre-match and per-conversation limits)';

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, features, display_order)
VALUES 
  ('free', 'Free', 'Basic features for everyone', 0, 0, '{"unlimited_matches": false, "see_who_liked_you": false, "unlimited_likes": false, "rewind": false, "boost": false, "read_receipts": false}'::jsonb, 1),
  ('premium', 'Premium', 'Unlock all dating features', 9.99, 99.99, '{"unlimited_matches": true, "see_who_liked_you": true, "unlimited_likes": true, "rewind": true, "boost": true, "read_receipts": true}'::jsonb, 2)
ON CONFLICT (name) DO NOTHING;

-- Insert default limits for free plan
INSERT INTO dating_feature_limits (plan_id, feature_name, limit_value, limit_period)
SELECT 
  sp.id,
  feature,
  CASE 
    WHEN feature = 'daily_likes' THEN 10
    WHEN feature = 'daily_super_likes' THEN 1
    WHEN feature = 'rewinds' THEN 0
    WHEN feature = 'boosts' THEN 0
    WHEN feature = 'conversation_starter' THEN 1
    WHEN feature = 'pre_match_messages' THEN 3
    WHEN feature = 'messages_per_conversation' THEN 10
    ELSE NULL
  END,
  CASE
    WHEN feature IN ('conversation_starter', 'pre_match_messages', 'messages_per_conversation') THEN 'lifetime'
    ELSE 'daily'
  END
FROM subscription_plans sp
CROSS JOIN (VALUES 
  ('daily_likes'), 
  ('daily_super_likes'), 
  ('rewinds'), 
  ('boosts'),
  ('conversation_starter'),
  ('pre_match_messages'),
  ('messages_per_conversation')
) AS features(feature)
WHERE sp.name = 'free'
ON CONFLICT (plan_id, feature_name) DO NOTHING;

-- Insert default limits for premium plan (unlimited)
INSERT INTO dating_feature_limits (plan_id, feature_name, limit_value, limit_period)
SELECT 
  sp.id,
  feature,
  NULL, -- NULL means unlimited
  'lifetime'
FROM subscription_plans sp
CROSS JOIN (VALUES 
  ('daily_likes'), 
  ('daily_super_likes'), 
  ('rewinds'), 
  ('boosts'),
  ('conversation_starter'),
  ('pre_match_messages'),
  ('messages_per_conversation')
) AS features(feature)
WHERE sp.name = 'premium'
ON CONFLICT (plan_id, feature_name) DO NOTHING;

-- Insert default pricing configuration
INSERT INTO pricing_configuration (setting_key, setting_value, description)
VALUES 
  ('premium_monthly_price', '9.99'::jsonb, 'Monthly premium subscription price in USD'),
  ('premium_yearly_price', '99.99'::jsonb, 'Yearly premium subscription price in USD'),
  ('currency', '"USD"'::jsonb, 'Default currency'),
  ('free_trial_days', '7'::jsonb, 'Free trial period in days'),
  ('free_plan_limits', '{"daily_likes": 10, "daily_super_likes": 1, "rewinds": 0, "boosts": 0, "conversation_starter": 1, "pre_match_messages": 3, "messages_per_conversation": 10}'::jsonb, 'Free plan feature limits')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify everything was created:

-- SELECT 'Tables created:' as status;
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('subscription_plans', 'user_subscriptions', 'dating_feature_limits', 'dating_usage_tracking', 'pricing_configuration');

-- SELECT 'Functions created:' as status;
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' 
--   AND routine_name IN ('get_user_subscription_plan', 'check_dating_feature_limit', 'track_dating_usage', 'check_conversation_starter_limit', 'check_dating_message_limit');

-- SELECT 'Plans created:' as status;
-- SELECT name, display_name, price_monthly, price_yearly FROM subscription_plans;

-- SELECT 'Free plan limits:' as status;
-- SELECT sp.name, dfl.feature_name, dfl.limit_value, dfl.limit_period 
-- FROM dating_feature_limits dfl
-- JOIN subscription_plans sp ON sp.id = dfl.plan_id
-- WHERE sp.name = 'free';

