-- Add referral code column so we can attach referral when user signs up (after opening referral link).
-- Client sets this once from stored deep-link; existing "Users can update own profile" RLS allows the update.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS referred_by_code text;

COMMENT ON COLUMN users.referred_by_code IS 'Referral code used when user signed up; set from stored deep-link.';
