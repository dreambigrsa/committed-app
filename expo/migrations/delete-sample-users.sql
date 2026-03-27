-- ============================================
-- DELETE SAMPLE USERS
-- ============================================
-- This file deletes all sample users and their associated data
-- WARNING: This will permanently delete all sample users and their data

-- ============================================
-- DELETE FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION delete_all_sample_users()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
  v_user_ids UUID[];
BEGIN
  -- Get all sample user IDs
  SELECT ARRAY_AGG(id) INTO v_user_ids
  FROM users
  WHERE is_sample_user = TRUE;
  
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get count before deletion
  SELECT COUNT(*) INTO v_deleted_count
  FROM users
  WHERE is_sample_user = TRUE;
  
  -- Delete dating-related data first
  DELETE FROM dating_photos
  WHERE dating_profile_id IN (
    SELECT id FROM dating_profiles WHERE user_id = ANY(v_user_ids)
  );
  
  DELETE FROM dating_videos
  WHERE dating_profile_id IN (
    SELECT id FROM dating_profiles WHERE user_id = ANY(v_user_ids)
  );
  
  DELETE FROM dating_likes
  WHERE liker_id = ANY(v_user_ids) OR liked_id = ANY(v_user_ids);
  
  DELETE FROM dating_matches
  WHERE user1_id = ANY(v_user_ids) OR user2_id = ANY(v_user_ids);
  
  DELETE FROM dating_date_requests
  WHERE from_user_id = ANY(v_user_ids) OR to_user_id = ANY(v_user_ids);
  
  DELETE FROM dating_profiles
  WHERE user_id = ANY(v_user_ids);
  
  DELETE FROM user_dating_badges
  WHERE user_id = ANY(v_user_ids);
  
  DELETE FROM user_subscriptions
  WHERE user_id = ANY(v_user_ids);
  
  -- Delete other user-related data
  DELETE FROM posts WHERE user_id = ANY(v_user_ids);
  DELETE FROM reels WHERE user_id = ANY(v_user_ids);
  DELETE FROM messages WHERE sender_id = ANY(v_user_ids);
  DELETE FROM relationships WHERE user_id = ANY(v_user_ids) OR partner_user_id = ANY(v_user_ids);
  
  -- Finally, delete the users (cascade will handle remaining related data)
  DELETE FROM users WHERE is_sample_user = TRUE;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- USAGE
-- ============================================
-- To delete all sample users, run:
-- SELECT delete_all_sample_users();

-- To see how many sample users exist:
-- SELECT COUNT(*) FROM users WHERE is_sample_user = TRUE;

