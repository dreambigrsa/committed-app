-- ============================================
-- DATING PROFILE VIDEOS
-- ============================================
-- Allows users to upload short videos to their dating profile

-- ============================================
-- DATING VIDEOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dating_profile_id UUID NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT, -- Thumbnail for video preview
  duration_seconds INTEGER, -- Video duration in seconds
  display_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE, -- Primary video (shown first)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dating_videos_profile_id ON dating_videos(dating_profile_id);
CREATE INDEX IF NOT EXISTS idx_dating_videos_display_order ON dating_videos(display_order);
CREATE INDEX IF NOT EXISTS idx_dating_videos_primary ON dating_videos(dating_profile_id, is_primary) WHERE is_primary = TRUE;

-- Ensure only one primary video per profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_dating_videos_one_primary
ON dating_videos(dating_profile_id)
WHERE is_primary = TRUE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Users can view videos of active dating profiles
CREATE POLICY "Anyone can view active profile videos" ON dating_videos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dating_profiles
      WHERE dating_profiles.id = dating_videos.dating_profile_id
      AND dating_profiles.is_active = TRUE
    )
  );

-- Users can manage their own profile videos
CREATE POLICY "Users can manage their own videos" ON dating_videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM dating_profiles
      WHERE dating_profiles.id = dating_videos.dating_profile_id
      AND dating_profiles.user_id = auth.uid()
    )
  );

