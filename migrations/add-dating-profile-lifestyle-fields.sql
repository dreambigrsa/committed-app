-- Add richer dating profile fields used by the profile setup and profile view.
ALTER TABLE dating_profiles
  ADD COLUMN IF NOT EXISTS religion TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER CHECK (height_cm IS NULL OR (height_cm BETWEEN 90 AND 250)),
  ADD COLUMN IF NOT EXISTS exercise TEXT CHECK (exercise IS NULL OR exercise IN ('often', 'sometimes', 'rarely', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS pets TEXT CHECK (pets IS NULL OR pets IN ('have_pets', 'want_pets', 'no_pets', 'prefer_not_to_say'));

CREATE INDEX IF NOT EXISTS idx_dating_profiles_religion
  ON dating_profiles(religion)
  WHERE religion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dating_profiles_education
  ON dating_profiles(education)
  WHERE education IS NOT NULL;
