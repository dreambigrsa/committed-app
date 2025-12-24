-- ============================================
-- ADD GENDER FIELD TO DATING PROFILES
-- ============================================
-- Adds gender field to enable proper gender-based filtering in discovery

-- Add gender column to dating_profiles table
ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say'));

-- Create index for faster gender-based queries
CREATE INDEX IF NOT EXISTS idx_dating_profiles_gender ON dating_profiles(gender) WHERE gender IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN dating_profiles.gender IS 'User gender for matching: male, female, non_binary, or prefer_not_to_say';

