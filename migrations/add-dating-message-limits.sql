-- ============================================
-- DATING MESSAGE LIMITS
-- ============================================
-- Adds message limits for dating conversations:
-- 1. Conversation starter limit (1 per user)
-- 2. Pre-match message limit (messages before matching)
-- 3. Messages per conversation limit (for non-premium users)

-- Add new feature limits for messaging
INSERT INTO dating_feature_limits (plan_id, feature_name, limit_value, limit_period)
SELECT 
  sp.id,
  feature,
  CASE 
    WHEN feature = 'conversation_starter' THEN 1  -- Only 1 conversation starter per user
    WHEN feature = 'pre_match_messages' THEN 3    -- 3 messages before matching
    WHEN feature = 'messages_per_conversation' THEN 10  -- 10 messages per conversation for free users
    ELSE NULL
  END,
  'lifetime'  -- These are per-user/conversation limits, not daily
FROM subscription_plans sp
CROSS JOIN (VALUES 
  ('conversation_starter'), 
  ('pre_match_messages'), 
  ('messages_per_conversation')
) AS features(feature)
WHERE sp.name = 'free'
ON CONFLICT (plan_id, feature_name) DO NOTHING;

-- Premium users get unlimited messaging
INSERT INTO dating_feature_limits (plan_id, feature_name, limit_value, limit_period)
SELECT 
  sp.id,
  feature,
  NULL, -- NULL means unlimited
  'lifetime'
FROM subscription_plans sp
CROSS JOIN (VALUES 
  ('conversation_starter'), 
  ('pre_match_messages'), 
  ('messages_per_conversation')
) AS features(feature)
WHERE sp.name = 'premium'
ON CONFLICT (plan_id, feature_name) DO NOTHING;

-- ============================================
-- FUNCTION: Check if user can send conversation starter
-- ============================================
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

-- ============================================
-- FUNCTION: Check if user can send message (pre-match or per-conversation)
-- ============================================
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

