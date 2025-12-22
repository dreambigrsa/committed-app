-- ============================================
-- DATING FEATURES - DATABASE SCHEMA
-- ============================================
-- This migration adds dating/discovery features to the Committed app
-- Allows users to discover and match with potential partners

-- ============================================
-- DATING PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  age INTEGER,
  date_of_birth DATE,
  location_city TEXT,
  location_country TEXT,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  location_updated_at TIMESTAMP WITH TIME ZONE,
  relationship_goals TEXT[] DEFAULT ARRAY[]::TEXT[] CHECK (
    array_length(relationship_goals, 1) IS NULL OR 
    array_length(relationship_goals, 1) <= 5
  ),
  interests TEXT[] DEFAULT ARRAY[]::TEXT[],
  looking_for TEXT CHECK (looking_for IN ('men', 'women', 'everyone')),
  age_range_min INTEGER DEFAULT 18,
  age_range_max INTEGER DEFAULT 99,
  max_distance_km INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  show_me BOOLEAN DEFAULT TRUE, -- Whether profile appears in discovery
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_age_range CHECK (age_range_min >= 18 AND age_range_max <= 99 AND age_range_min <= age_range_max),
  CONSTRAINT valid_distance CHECK (max_distance_km > 0 AND max_distance_km <= 1000)
);

-- ============================================
-- DATING PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dating_profile_id UUID NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- DATING LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  liker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  liked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_super_like BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT no_self_like CHECK (liker_id != liked_id),
  CONSTRAINT unique_like UNIQUE (liker_id, liked_id)
);

-- ============================================
-- DATING MATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  is_unmatched BOOLEAN DEFAULT FALSE,
  unmatched_at TIMESTAMP WITH TIME ZONE,
  unmatched_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT no_self_match CHECK (user1_id != user2_id),
  CONSTRAINT unique_match UNIQUE (user1_id, user2_id),
  CONSTRAINT ordered_match CHECK (user1_id < user2_id)
);

-- ============================================
-- DATING PASSES TABLE (to avoid showing same person again)
-- ============================================
CREATE TABLE IF NOT EXISTS dating_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT no_self_pass CHECK (passer_id != passed_id),
  CONSTRAINT unique_pass UNIQUE (passer_id, passed_id)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dating_profiles_user_id ON dating_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_dating_profiles_active ON dating_profiles(is_active, show_me) WHERE is_active = TRUE AND show_me = TRUE;
CREATE INDEX IF NOT EXISTS idx_dating_profiles_location ON dating_profiles(location_latitude, location_longitude) WHERE location_latitude IS NOT NULL AND location_longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dating_photos_profile_id ON dating_photos(dating_profile_id);

-- Unique index to ensure only one primary photo per profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_dating_photos_one_primary 
ON dating_photos(dating_profile_id) 
WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_dating_likes_liker ON dating_likes(liker_id);
CREATE INDEX IF NOT EXISTS idx_dating_likes_liked ON dating_likes(liked_id);
CREATE INDEX IF NOT EXISTS idx_dating_matches_user1 ON dating_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_dating_matches_user2 ON dating_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_dating_passes_passer ON dating_passes(passer_id);
CREATE INDEX IF NOT EXISTS idx_dating_passes_passed ON dating_passes(passed_id);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Dating Profiles: Users can view active profiles, manage their own
CREATE POLICY "Users can view active dating profiles" ON dating_profiles FOR SELECT
  USING (
    is_active = TRUE 
    AND show_me = TRUE 
    AND user_id != auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM relationships r 
      WHERE r.user_id = dating_profiles.user_id 
      AND r.status IN ('pending', 'verified')
    )
  );

CREATE POLICY "Users can view their own dating profile" ON dating_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own dating profile" ON dating_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own dating profile" ON dating_profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own dating profile" ON dating_profiles FOR DELETE
  USING (user_id = auth.uid());

-- Dating Photos: Users can view photos of profiles they can see, manage their own
CREATE POLICY "Users can view dating photos" ON dating_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dating_profiles dp
      WHERE dp.id = dating_photos.dating_profile_id
      AND (
        dp.user_id = auth.uid() OR
        (dp.is_active = TRUE AND dp.show_me = TRUE AND dp.user_id != auth.uid())
      )
    )
  );

CREATE POLICY "Users can manage their own dating photos" ON dating_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dating_profiles dp
      WHERE dp.id = dating_photos.dating_profile_id
      AND dp.user_id = auth.uid()
    )
  );

-- Dating Likes: Users can view their own likes, create likes
CREATE POLICY "Users can view their own likes" ON dating_likes FOR SELECT
  USING (liker_id = auth.uid() OR liked_id = auth.uid());

CREATE POLICY "Users can create likes" ON dating_likes FOR INSERT
  WITH CHECK (liker_id = auth.uid());

-- Dating Matches: Users can view their matches
CREATE POLICY "Users can view their matches" ON dating_matches FOR SELECT
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

CREATE POLICY "Users can update their matches" ON dating_matches FOR UPDATE
  USING (user1_id = auth.uid() OR user2_id = auth.uid());

-- Dating Passes: Users can view their passes, create passes
CREATE POLICY "Users can view their own passes" ON dating_passes FOR SELECT
  USING (passer_id = auth.uid());

CREATE POLICY "Users can create passes" ON dating_passes FOR INSERT
  WITH CHECK (passer_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get potential matches (discovery feed)
CREATE OR REPLACE FUNCTION get_dating_discovery(
  current_user_id UUID,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  profile_picture TEXT,
  bio TEXT,
  age INTEGER,
  location_city TEXT,
  distance_km DECIMAL,
  photos JSONB,
  phone_verified BOOLEAN,
  email_verified BOOLEAN,
  id_verified BOOLEAN,
  relationship_goals TEXT[],
  interests TEXT[]
) AS $$
DECLARE
  current_profile RECORD;
  current_lat DECIMAL;
  current_lng DECIMAL;
BEGIN
  -- Get current user's profile and preferences
  SELECT * INTO current_profile
  FROM dating_profiles
  WHERE user_id = current_user_id AND is_active = TRUE;
  
  IF current_profile IS NULL THEN
    RETURN;
  END IF;
  
  current_lat := current_profile.location_latitude;
  current_lng := current_profile.location_longitude;
  
  RETURN QUERY
  SELECT DISTINCT
    u.id AS user_id,
    u.full_name,
    u.profile_picture,
    dp.bio,
    dp.age,
    dp.location_city,
    CASE 
      WHEN current_lat IS NOT NULL AND current_lng IS NOT NULL 
           AND dp.location_latitude IS NOT NULL AND dp.location_longitude IS NOT NULL
      THEN (
        6371 * acos(
          cos(radians(current_lat)) * 
          cos(radians(dp.location_latitude)) * 
          cos(radians(dp.location_longitude) - radians(current_lng)) + 
          sin(radians(current_lat)) * 
          sin(radians(dp.location_latitude))
        )
      )
      ELSE NULL
    END AS distance_km,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'photo_url', photo_url,
            'display_order', display_order,
            'is_primary', is_primary
          ) ORDER BY display_order, created_at
        )
        FROM dating_photos
        WHERE dating_profile_id = dp.id
      ),
      '[]'::jsonb
    ) AS photos,
    u.phone_verified,
    u.email_verified,
    u.id_verified,
    dp.relationship_goals,
    dp.interests
  FROM dating_profiles dp
  INNER JOIN users u ON u.id = dp.user_id
  WHERE 
    dp.is_active = TRUE
    AND dp.show_me = TRUE
    AND dp.user_id != current_user_id
    -- Exclude users with active relationships
    AND NOT EXISTS (
      SELECT 1 FROM relationships r
      WHERE r.user_id = dp.user_id
      AND r.status IN ('pending', 'verified')
    )
    -- Exclude users already liked
    AND NOT EXISTS (
      SELECT 1 FROM dating_likes dl
      WHERE dl.liker_id = current_user_id
      AND dl.liked_id = dp.user_id
    )
    -- Exclude users already passed
    AND NOT EXISTS (
      SELECT 1 FROM dating_passes dpass
      WHERE dpass.passer_id = current_user_id
      AND dpass.passed_id = dp.user_id
    )
    -- Exclude users already matched
    AND NOT EXISTS (
      SELECT 1 FROM dating_matches dm
      WHERE (dm.user1_id = current_user_id AND dm.user2_id = dp.user_id)
         OR (dm.user2_id = current_user_id AND dm.user1_id = dp.user_id)
      AND dm.is_unmatched = FALSE
    )
    -- Age range filter
    AND (current_profile.age_range_min IS NULL OR dp.age >= current_profile.age_range_min)
    AND (current_profile.age_range_max IS NULL OR dp.age <= current_profile.age_range_max)
    -- Distance filter (if location available)
    AND (
      current_lat IS NULL OR current_lng IS NULL OR
      dp.location_latitude IS NULL OR dp.location_longitude IS NULL OR
      (
        6371 * acos(
          cos(radians(current_lat)) * 
          cos(radians(dp.location_latitude)) * 
          cos(radians(dp.location_longitude) - radians(current_lng)) + 
          sin(radians(current_lat)) * 
          sin(radians(dp.location_latitude))
        )
      ) <= current_profile.max_distance_km
    )
    -- Gender preference filter (simplified)
    AND (
      current_profile.looking_for = 'everyone' OR
      (current_profile.looking_for = 'men' AND u.id IN (SELECT id FROM users WHERE id = dp.user_id)) OR
      (current_profile.looking_for = 'women' AND u.id IN (SELECT id FROM users WHERE id = dp.user_id))
    )
  ORDER BY 
    -- Prioritize verified users
    CASE WHEN u.phone_verified AND u.email_verified THEN 0 ELSE 1 END,
    -- Then by distance if available
    CASE 
      WHEN current_lat IS NOT NULL AND current_lng IS NOT NULL 
           AND dp.location_latitude IS NOT NULL AND dp.location_longitude IS NOT NULL
      THEN (
        6371 * acos(
          cos(radians(current_lat)) * 
          cos(radians(dp.location_latitude)) * 
          cos(radians(dp.location_longitude) - radians(current_lng)) + 
          sin(radians(current_lat)) * 
          sin(radians(dp.location_latitude))
        )
      )
      ELSE 999999
    END,
    dp.last_active_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for mutual match and create match
DROP FUNCTION IF EXISTS check_and_create_match(UUID, UUID);
CREATE OR REPLACE FUNCTION check_and_create_match(
  user1_id UUID,
  user2_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  mutual_like BOOLEAN;
  match_id UUID;
BEGIN
  -- Check if both users liked each other
  SELECT EXISTS (
    SELECT 1 FROM dating_likes dl1
    INNER JOIN dating_likes dl2 ON dl1.liker_id = dl2.liked_id AND dl1.liked_id = dl2.liker_id
    WHERE dl1.liker_id = user1_id AND dl1.liked_id = user2_id
    AND dl2.liker_id = user2_id AND dl2.liked_id = user1_id
  ) INTO mutual_like;
  
  IF mutual_like THEN
    -- Create match (ensure user1_id < user2_id for consistency)
    INSERT INTO dating_matches (user1_id, user2_id)
    VALUES (
      LEAST(user1_id, user2_id),
      GREATEST(user1_id, user2_id)
    )
    ON CONFLICT (user1_id, user2_id) DO NOTHING
    RETURNING id INTO match_id;
    
    -- Create notifications for both users
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES 
      (user1_id, 'dating_match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id, 'matched_user_id', user2_id)),
      (user2_id, 'dating_match', 'New Match!', 'You have a new match!', jsonb_build_object('match_id', match_id, 'matched_user_id', user1_id));
    
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check for matches when a like is created
-- Drop trigger first (it depends on the function)
DROP TRIGGER IF EXISTS check_match_on_like ON dating_likes;
-- Now we can drop and recreate the function
DROP FUNCTION IF EXISTS trigger_check_match();
CREATE OR REPLACE FUNCTION trigger_check_match()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_and_create_match(NEW.liker_id, NEW.liked_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER check_match_on_like
AFTER INSERT ON dating_likes
FOR EACH ROW
EXECUTE FUNCTION trigger_check_match();

-- ============================================
-- UPDATE NOTIFICATIONS TYPE
-- ============================================
-- Add dating-related notification types
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'relationship_request', 'cheating_alert', 'relationship_verified', 
  'relationship_ended', 'post_like', 'post_comment', 'message', 
  'follow', 'anniversary_reminder', 'verification_attempt', 
  'status_reaction', 'dating_match', 'dating_like', 'dating_super_like'
));

