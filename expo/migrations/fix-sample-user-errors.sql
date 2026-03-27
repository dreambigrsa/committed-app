-- ============================================
-- FIX ERRORS FOR SAMPLE USERS
-- ============================================
-- Fixes two issues affecting newly created sample users:
-- 1. Ambiguous column error when liking (in match trigger)
-- 2. RLS policy error when creating user_status

-- ============================================
-- 1. FIX AMBIGUOUS COLUMN ERROR IN MATCH TRIGGER
-- ============================================
-- The trigger function might be querying dating_matches with ambiguous columns
-- Fix the check_and_create_match function to be more explicit

DROP FUNCTION IF EXISTS check_and_create_match(UUID, UUID);
CREATE OR REPLACE FUNCTION check_and_create_match(
  user1_id_param UUID,
  user2_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  mutual_like BOOLEAN;
  match_id UUID;
  ordered_user1 UUID;
  ordered_user2 UUID;
BEGIN
  -- Order users consistently (user1 < user2)
  ordered_user1 := LEAST(user1_id_param, user2_id_param);
  ordered_user2 := GREATEST(user1_id_param, user2_id_param);
  
  -- Check if both users liked each other
  SELECT EXISTS (
    SELECT 1 FROM dating_likes dl1
    INNER JOIN dating_likes dl2 ON dl1.liker_id = dl2.liked_id AND dl1.liked_id = dl2.liker_id
    WHERE dl1.liker_id = user1_id_param AND dl1.liked_id = user2_id_param
    AND dl2.liker_id = user2_id_param AND dl2.liked_id = user1_id_param
  ) INTO mutual_like;
  
  IF mutual_like THEN
    -- Create match (ensure user1_id < user2_id for consistency)
    INSERT INTO dating_matches (user1_id, user2_id)
    VALUES (ordered_user1, ordered_user2)
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO match_id;
    
    -- Only create notifications if match was actually created (not a conflict)
    IF match_id IS NOT NULL THEN
      -- Create notifications for both users
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES 
        (user1_id_param, 'dating_match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id, 'matched_user_id', user2_id_param)),
        (user2_id_param, 'dating_match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id, 'matched_user_id', user1_id_param));
    END IF;
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. FIX USER_STATUS RLS POLICY
-- ============================================
-- Ensure users can insert their own user_status record

-- Enable RLS if not already enabled
ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own status" ON user_status;
DROP POLICY IF EXISTS "Users can view own status" ON user_status;
DROP POLICY IF EXISTS "Users can update own status" ON user_status;
DROP POLICY IF EXISTS "Users can view statuses" ON user_status;

-- Create policies for user_status
-- Users can insert their own status
CREATE POLICY "Users can insert own status" ON user_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own status
CREATE POLICY "Users can view own status" ON user_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can view other users' statuses based on visibility settings
CREATE POLICY "Users can view statuses" ON user_status
  FOR SELECT
  USING (
    -- Can always see own status
    auth.uid() = user_id
    OR
    -- Can see if status_visibility allows it
    (
      status_visibility = 'everyone'
      OR
      (status_visibility = 'friends' AND EXISTS (
        SELECT 1 FROM follows
        WHERE (follower_id = auth.uid() AND following_id = user_status.user_id)
        OR (follower_id = user_status.user_id AND following_id = auth.uid())
      ))
    )
  );

-- Users can update their own status
CREATE POLICY "Users can update own status" ON user_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow upsert (insert or update) for user's own status
-- This helps when the app tries to create status on first load
CREATE POLICY "Users can upsert own status" ON user_status
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

