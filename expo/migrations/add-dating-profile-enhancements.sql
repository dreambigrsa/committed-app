-- ============================================
-- DATING PROFILE ENHANCEMENTS
-- ============================================
-- Adds comprehensive profile features for deeper connections

-- Add new columns to dating_profiles table
ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS headline TEXT, -- One-line catchy headline
  ADD COLUMN IF NOT EXISTS intro_voice_url TEXT, -- 10-20 sec voice/video intro
  ADD COLUMN IF NOT EXISTS values TEXT[] DEFAULT ARRAY[]::TEXT[], -- Family, Faith, Growth, Honesty, Adventure
  ADD COLUMN IF NOT EXISTS mood TEXT CHECK (mood IN ('chill', 'romantic', 'fun', 'serious', 'adventurous')),
  ADD COLUMN IF NOT EXISTS what_makes_me_different TEXT, -- Single answer box
  ADD COLUMN IF NOT EXISTS weekend_style TEXT CHECK (weekend_style IN ('homebody', 'out_with_friends', 'church_faith', 'side_hustling', 'exploring')),
  ADD COLUMN IF NOT EXISTS conversation_starters TEXT[] DEFAULT ARRAY[]::TEXT[], -- Auto-generated conversation prompts
  ADD COLUMN IF NOT EXISTS daily_question_answer TEXT, -- Answer to rotating daily question
  ADD COLUMN IF NOT EXISTS daily_question_id UUID, -- Reference to current daily question
  ADD COLUMN IF NOT EXISTS intention_tag TEXT CHECK (intention_tag IN ('friendship', 'dating', 'serious', 'marriage')),
  ADD COLUMN IF NOT EXISTS respect_first_badge BOOLEAN DEFAULT FALSE, -- Respect First badge
  ADD COLUMN IF NOT EXISTS local_food TEXT, -- Favorite local food
  ADD COLUMN IF NOT EXISTS local_slang TEXT, -- Favorite slang word
  ADD COLUMN IF NOT EXISTS local_spot TEXT, -- Favorite local spot
  ADD COLUMN IF NOT EXISTS what_im_looking_for TEXT,
  ADD COLUMN IF NOT EXISTS bio_video_url TEXT,
  ADD COLUMN IF NOT EXISTS kids TEXT CHECK (kids IN ('have_kids', 'want_kids', 'dont_want_kids', 'have_and_want_more', 'not_sure')),
  ADD COLUMN IF NOT EXISTS work TEXT,
  ADD COLUMN IF NOT EXISTS smoke TEXT CHECK (smoke IN ('yes', 'no', 'sometimes', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS drink TEXT CHECK (drink IN ('yes', 'no', 'sometimes', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS prompts JSONB DEFAULT '[]'::jsonb; -- Array of {question: string, answer: string}

-- Create daily questions table
CREATE TABLE IF NOT EXISTS daily_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user badges table
CREATE TABLE IF NOT EXISTS user_dating_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('verified', 'good_conversationalist', 'replies_fast', 'respectful_member', 'active_member', 'premium')),
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_badge UNIQUE (user_id, badge_type)
);

-- Create compatibility scores table (for caching)
CREATE TABLE IF NOT EXISTS dating_compatibility_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compatibility_score INTEGER NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_compatibility UNIQUE (user1_id, user2_id),
  CONSTRAINT ordered_compatibility CHECK (user1_id < user2_id)
);

-- Insert default daily questions
INSERT INTO daily_questions (question, is_active, display_order) VALUES
  ('What made you smile today?', TRUE, 1),
  ('What are you grateful for this week?', TRUE, 2),
  ('What''s one thing you''re looking forward to?', TRUE, 3),
  ('What makes you feel most alive?', TRUE, 4),
  ('What''s a small win you had recently?', TRUE, 5)
ON CONFLICT DO NOTHING;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_dating_profiles_last_active ON dating_profiles(last_active_at DESC);

-- Add RLS policies for new tables
ALTER TABLE daily_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active daily questions" ON daily_questions;
CREATE POLICY "Anyone can view active daily questions" ON daily_questions
  FOR SELECT USING (is_active = TRUE);

ALTER TABLE user_dating_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own badges" ON user_dating_badges;
DROP POLICY IF EXISTS "Users can view all badges" ON user_dating_badges;
CREATE POLICY "Users can view their own badges" ON user_dating_badges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view all badges" ON user_dating_badges
  FOR SELECT USING (true); -- Allow viewing all badges for profile display

ALTER TABLE dating_compatibility_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own compatibility scores" ON dating_compatibility_scores;
CREATE POLICY "Users can view their own compatibility scores" ON dating_compatibility_scores
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Update last_active_at when profile is viewed/updated
CREATE OR REPLACE FUNCTION update_dating_profile_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dating_profile_last_active ON dating_profiles;
CREATE TRIGGER trigger_update_dating_profile_last_active
  BEFORE UPDATE ON dating_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_dating_profile_last_active();

-- Add last_active_at column if it doesn't exist
ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

