-- ============================================
-- SAMPLE DATING PROFILES FOR TESTING
-- ============================================
-- This file creates sample users with COMPLETE dating profiles for testing
-- Includes users in Kwekwe, Harare, and Bulawayo with full profile data
-- Password for all: "Test123456!"
--
-- IMPORTANT: Auth users MUST be created FIRST via Supabase Dashboard or Admin API
-- This SQL will ONLY work if auth users already exist in auth.users table
--
-- STEP 1: Create auth users in Supabase Dashboard:
--   Authentication → Users → Add user (for each email below)
--   Password: Test123456!
--
-- STEP 2: Then run this SQL to create user records and dating profiles
--
-- Sample user emails:
-- Kwekwe: sarah.moyo@sample.com, tendai.ndlovu@sample.com, blessing.sibanda@sample.com, 
--         grace.chidziva@sample.com, john.maphosa@sample.com
-- Harare: linda.chiwenga@sample.com, david.mutasa@sample.com, ruth.makoni@sample.com,
--         peter.muzenda@sample.com, faith.nyathi@sample.com
-- Bulawayo: thabo.nkomo@sample.com, nomsa.dube@sample.com, sipho.moyo@sample.com,
--           zanele.khumalo@sample.com, lungile.ncube@sample.com

-- ============================================
-- ADD SAMPLE USER COLUMN
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sample_user BOOLEAN DEFAULT FALSE;

-- ============================================
-- SAMPLE USERS DATA
-- ============================================
-- This function creates user records for existing auth users
-- It uses the auth user's ID from auth.users table
CREATE OR REPLACE FUNCTION create_sample_user_record(
  p_email TEXT,
  p_full_name TEXT,
  p_phone TEXT
)
RETURNS UUID AS $$
DECLARE
  v_auth_user_id UUID;
BEGIN
  -- Get the auth user ID from auth.users
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  -- If auth user doesn't exist, return NULL
  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE 'Auth user with email % does not exist. Please create it first in Supabase Dashboard.', p_email;
    RETURN NULL;
  END IF;

  -- Create or update user record
  INSERT INTO users (id, full_name, email, phone_number, role, phone_verified, email_verified, is_sample_user, created_at, updated_at)
  VALUES (v_auth_user_id, p_full_name, p_email, p_phone, 'user', TRUE, TRUE, TRUE, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    is_sample_user = TRUE,
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN v_auth_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user records for existing auth users
-- NOTE: These will only work if auth users already exist in auth.users table
-- Kwekwe Users (5 users)
DO $$
BEGIN
  PERFORM create_sample_user_record('sarah.moyo@sample.com', 'Sarah Moyo', '+263771234501');
  PERFORM create_sample_user_record('tendai.ndlovu@sample.com', 'Tendai Ndlovu', '+263771234502');
  PERFORM create_sample_user_record('blessing.sibanda@sample.com', 'Blessing Sibanda', '+263771234503');
  PERFORM create_sample_user_record('grace.chidziva@sample.com', 'Grace Chidziva', '+263771234504');
  PERFORM create_sample_user_record('john.maphosa@sample.com', 'John Maphosa', '+263771234505');
END $$;

-- Harare Users (5 users)
DO $$
BEGIN
  PERFORM create_sample_user_record('linda.chiwenga@sample.com', 'Linda Chiwenga', '+263771234506');
  PERFORM create_sample_user_record('david.mutasa@sample.com', 'David Mutasa', '+263771234507');
  PERFORM create_sample_user_record('ruth.makoni@sample.com', 'Ruth Makoni', '+263771234508');
  PERFORM create_sample_user_record('peter.muzenda@sample.com', 'Peter Muzenda', '+263771234509');
  PERFORM create_sample_user_record('faith.nyathi@sample.com', 'Faith Nyathi', '+263771234510');
END $$;

-- Bulawayo Users (5 users)
DO $$
BEGIN
  PERFORM create_sample_user_record('thabo.nkomo@sample.com', 'Thabo Nkomo', '+263771234511');
  PERFORM create_sample_user_record('nomsa.dube@sample.com', 'Nomsa Dube', '+263771234512');
  PERFORM create_sample_user_record('sipho.moyo@sample.com', 'Sipho Moyo', '+263771234513');
  PERFORM create_sample_user_record('zanele.khumalo@sample.com', 'Zanele Khumalo', '+263771234514');
  PERFORM create_sample_user_record('lungile.ncube@sample.com', 'Lungile Ncube', '+263771234515');
END $$;

-- ============================================
-- CREATE COMPLETE DATING PROFILES
-- ============================================
-- Helper function to create complete dating profiles
CREATE OR REPLACE FUNCTION create_sample_dating_profile(
  p_user_email TEXT,
  p_bio TEXT,
  p_age INTEGER,
  p_headline TEXT,
  p_values TEXT[],
  p_mood TEXT,
  p_what_makes_me_different TEXT,
  p_weekend_style TEXT,
  p_intention_tag TEXT,
  p_local_food TEXT,
  p_local_slang TEXT,
  p_local_spot TEXT,
  p_what_im_looking_for TEXT,
  p_kids TEXT,
  p_work TEXT,
  p_smoke TEXT,
  p_drink TEXT,
  p_interests TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM users WHERE email = p_user_email;
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  
  INSERT INTO dating_profiles (
    user_id, bio, age, location_city, location_country,
    headline, values, mood, what_makes_me_different, weekend_style,
    intention_tag, respect_first_badge, local_food, local_slang, local_spot,
    what_im_looking_for, kids, work, smoke, drink, prompts,
    interests, looking_for, age_range_min, age_range_max, max_distance_km,
    is_active, show_me, last_active_at, created_at, updated_at
  )
  VALUES (
    v_user_id,
    p_bio,
    p_age,
    CASE 
      WHEN p_user_email LIKE '%kwekwe%' OR p_user_email IN ('sarah.moyo@sample.com', 'tendai.ndlovu@sample.com', 'blessing.sibanda@sample.com', 'grace.chidziva@sample.com', 'john.maphosa@sample.com') THEN 'Kwekwe'
      WHEN p_user_email LIKE '%harare%' OR p_user_email IN ('linda.chiwenga@sample.com', 'david.mutasa@sample.com', 'ruth.makoni@sample.com', 'peter.muzenda@sample.com', 'faith.nyathi@sample.com') THEN 'Harare'
      WHEN p_user_email LIKE '%bulawayo%' OR p_user_email IN ('thabo.nkomo@sample.com', 'nomsa.dube@sample.com', 'sipho.moyo@sample.com', 'zanele.khumalo@sample.com', 'lungile.ncube@sample.com') THEN 'Bulawayo'
      ELSE (SELECT location_city FROM dating_profiles WHERE user_id = v_user_id LIMIT 1)
    END,
    'Zimbabwe',
    p_headline,
    p_values,
    p_mood,
    p_what_makes_me_different,
    p_weekend_style,
    p_intention_tag,
    TRUE,
    p_local_food,
    p_local_slang,
    p_local_spot,
    p_what_im_looking_for,
    p_kids,
    p_work,
    p_smoke,
    p_drink,
    '[
      {"question": "What makes you laugh?", "answer": "Good jokes and genuine moments"},
      {"question": "Perfect weekend?", "answer": "Quality time with loved ones"},
      {"question": "What are you passionate about?", "answer": "Building meaningful connections"}
    ]'::jsonb,
    p_interests,
    'everyone',
    22,
    40,
    50,
    TRUE,
    TRUE,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    bio = EXCLUDED.bio,
    age = EXCLUDED.age,
    headline = EXCLUDED.headline,
    values = EXCLUDED.values,
    mood = EXCLUDED.mood,
    what_makes_me_different = EXCLUDED.what_makes_me_different,
    weekend_style = EXCLUDED.weekend_style,
    intention_tag = EXCLUDED.intention_tag,
    respect_first_badge = EXCLUDED.respect_first_badge,
    local_food = EXCLUDED.local_food,
    local_slang = EXCLUDED.local_slang,
    local_spot = EXCLUDED.local_spot,
    what_im_looking_for = EXCLUDED.what_im_looking_for,
    kids = EXCLUDED.kids,
    work = EXCLUDED.work,
    smoke = EXCLUDED.smoke,
    drink = EXCLUDED.drink,
    prompts = EXCLUDED.prompts,
    interests = EXCLUDED.interests,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Kwekwe profiles with complete data
SELECT create_sample_dating_profile(
  'sarah.moyo@sample.com',
  'Looking for meaningful connections in Kwekwe. Love good conversations and authentic people.',
  28,
  'Serious about love, fun about life',
  ARRAY['Family', 'Faith', 'Growth', 'Honesty']::TEXT[],
  'romantic',
  'I never give up on people I care about',
  'church_faith',
  'serious',
  'Sadza & nyama',
  'Sharp',
  'Kwekwe City Centre',
  'Looking for someone genuine, kind, and ready for something real. Values family and growth.',
  'want_kids',
  'Teacher',
  'no',
  'sometimes',
  ARRAY['Music', 'Travel', 'Food', 'Family', 'Faith']::TEXT[]
);

SELECT create_sample_dating_profile(
  'tendai.ndlovu@sample.com',
  'Building something real, one conversation at a time. Faith-driven and family-focused.',
  32,
  'Building something real, one conversation at a time',
  ARRAY['Family', 'Faith', 'Growth']::TEXT[],
  'serious',
  'I see the best in everyone and help them see it too',
  'out_with_friends',
  'marriage',
  'Kapenta',
  'Eish',
  'Sebakwe Dam',
  'Seeking someone who shares my values and is ready for a committed relationship.',
  'have_and_want_more',
  'Business Owner',
  'no',
  'no',
  ARRAY['Business', 'Family', 'Faith', 'Travel']::TEXT[]
);

SELECT create_sample_dating_profile(
  'blessing.sibanda@sample.com',
  'Adventure seeker with a heart for home. Love exploring but value family time.',
  26,
  'Adventure seeker with a heart for home',
  ARRAY['Adventure', 'Family', 'Growth']::TEXT[],
  'adventurous',
  'I turn every challenge into an adventure',
  'exploring',
  'dating',
  'Mazondo',
  'Yebo',
  'Redcliff',
  'Looking for an adventurous partner who also values home and family.',
  'not_sure',
  'Nurse',
  'no',
  'sometimes',
  ARRAY['Travel', 'Adventure', 'Food', 'Family']::TEXT[]
);

SELECT create_sample_dating_profile(
  'grace.chidziva@sample.com',
  'Faith-driven, family-focused, future-ready. Building a life of purpose and love.',
  29,
  'Faith-driven, family-focused, future-ready',
  ARRAY['Faith', 'Family', 'Honesty']::TEXT[],
  'chill',
  'My faith guides my decisions and relationships',
  'church_faith',
  'marriage',
  'Road runner',
  'Aweh',
  'Gweru Road',
  'Seeking a God-fearing partner ready for marriage and family.',
  'want_kids',
  'Engineer',
  'no',
  'no',
  ARRAY['Faith', 'Family', 'Music', 'Travel']::TEXT[]
);

SELECT create_sample_dating_profile(
  'john.maphosa@sample.com',
  'Genuine connections only, no games. Looking for someone real and authentic.',
  31,
  'Genuine connections only, no games',
  ARRAY['Honesty', 'Growth', 'Family']::TEXT[],
  'fun',
  'I build bridges, not walls',
  'side_hustling',
  'serious',
  'Sadza & nyama',
  'Sharp',
  'Kwekwe City Centre',
  'Looking for someone authentic, honest, and ready for something real.',
  'have_kids',
  'Entrepreneur',
  'sometimes',
  'sometimes',
  ARRAY['Business', 'Family', 'Food', 'Music']::TEXT[]
);

-- Harare profiles with complete data
SELECT create_sample_dating_profile(
  'linda.chiwenga@sample.com',
  'Exploring the dating scene in Harare. Love city life, good food, and great conversations.',
  27,
  'City girl with country values',
  ARRAY['Growth', 'Adventure', 'Honesty', 'Family']::TEXT[],
  'romantic',
  'I turn dreams into reality, one step at a time',
  'out_with_friends',
  'serious',
  'Sadza rezviyo',
  'Sharp',
  'Sam Levy''s Village',
  'Seeking someone ambitious, kind, and ready to build something beautiful together.',
  'want_kids',
  'Marketing Manager',
  'no',
  'sometimes',
  ARRAY['Business', 'Travel', 'Food', 'Fitness', 'Art']::TEXT[]
);

SELECT create_sample_dating_profile(
  'david.mutasa@sample.com',
  'Building my empire, looking for my partner. Professional by day, adventurer by weekend.',
  33,
  'Building my empire, looking for my partner',
  ARRAY['Growth', 'Adventure', 'Honesty']::TEXT[],
  'adventurous',
  'I balance ambition with authenticity',
  'exploring',
  'serious',
  'Kapenta',
  'Eish',
  'Harare Gardens',
  'Looking for someone who shares my drive and values genuine connection.',
  'not_sure',
  'Software Developer',
  'no',
  'sometimes',
  ARRAY['Business', 'Technology', 'Travel', 'Fitness']::TEXT[]
);

SELECT create_sample_dating_profile(
  'ruth.makoni@sample.com',
  'Creative soul seeking genuine connection. Love art, music, and meaningful conversations.',
  25,
  'Creative soul seeking genuine connection',
  ARRAY['Growth', 'Adventure', 'Honesty']::TEXT[],
  'fun',
  'I see art and beauty in everyday moments',
  'out_with_friends',
  'dating',
  'Mazondo',
  'Yebo',
  'Avondale',
  'Seeking someone creative, open-minded, and ready for adventure.',
  'dont_want_kids',
  'Doctor',
  'no',
  'no',
  ARRAY['Art', 'Music', 'Travel', 'Food']::TEXT[]
);

SELECT create_sample_dating_profile(
  'peter.muzenda@sample.com',
  'Professional by day, adventurer by weekend. Looking for someone to share life''s journey with.',
  30,
  'Professional by day, adventurer by weekend',
  ARRAY['Growth', 'Family', 'Adventure']::TEXT[],
  'chill',
  'I''m always learning and growing',
  'side_hustling',
  'serious',
  'Road runner',
  'Aweh',
  'Eastgate',
  'Looking for a partner who values growth, family, and adventure.',
  'want_kids',
  'Lawyer',
  'no',
  'sometimes',
  ARRAY['Business', 'Family', 'Travel', 'Fitness']::TEXT[]
);

SELECT create_sample_dating_profile(
  'faith.nyathi@sample.com',
  'Looking for someone to share life''s journey with. Building meaningful connections.',
  28,
  'Looking for someone to share life''s journey with',
  ARRAY['Family', 'Growth', 'Honesty']::TEXT[],
  'romantic',
  'I build meaningful connections wherever I go',
  'church_faith',
  'marriage',
  'Sadza rezviyo',
  'Sharp',
  'Sam Levy''s Village',
  'Seeking a life partner ready for marriage and building a family together.',
  'want_kids',
  'Consultant',
  'no',
  'no',
  ARRAY['Family', 'Faith', 'Travel', 'Food']::TEXT[]
);

-- Bulawayo profiles with complete data
SELECT create_sample_dating_profile(
  'thabo.nkomo@sample.com',
  'Ready to meet new people in Bulawayo. Love culture, music, and authentic connections.',
  29,
  'Cultural enthusiast with a modern twist',
  ARRAY['Family', 'Adventure', 'Honesty', 'Growth']::TEXT[],
  'chill',
  'I celebrate culture while embracing progress',
  'out_with_friends',
  'serious',
  'Sadza & nyama',
  'Sharp',
  'City Hall',
  'Looking for someone who values culture, family, and genuine connection.',
  'want_kids',
  'Musician',
  'no',
  'sometimes',
  ARRAY['Music', 'Culture', 'Food', 'Family', 'Travel']::TEXT[]
);

SELECT create_sample_dating_profile(
  'nomsa.dube@sample.com',
  'Music lover seeking harmony in relationships. Love live music and authentic connections.',
  26,
  'Music lover seeking harmony in relationships',
  ARRAY['Family', 'Adventure', 'Honesty']::TEXT[],
  'romantic',
  'I find beauty in music and human connection',
  'out_with_friends',
  'dating',
  'Kapenta',
  'Eish',
  'Centenary Park',
  'Seeking someone who appreciates music and values genuine connection.',
  'not_sure',
  'Teacher',
  'no',
  'no',
  ARRAY['Music', 'Culture', 'Family', 'Travel']::TEXT[]
);

SELECT create_sample_dating_profile(
  'sipho.moyo@sample.com',
  'Down-to-earth, looking for real connections. No games, just genuine people.',
  31,
  'Down-to-earth, looking for real connections',
  ARRAY['Family', 'Honesty', 'Growth']::TEXT[],
  'fun',
  'I keep it real, no pretenses',
  'homebody',
  'serious',
  'Mazondo',
  'Yebo',
  'Hillside',
  'Looking for someone authentic, honest, and ready for something real.',
  'have_kids',
  'Business Owner',
  'no',
  'sometimes',
  ARRAY['Business', 'Family', 'Food', 'Music']::TEXT[]
);

SELECT create_sample_dating_profile(
  'zanele.khumalo@sample.com',
  'Adventurous spirit, grounded values. Love exploring but value family and culture.',
  27,
  'Adventurous spirit, grounded values',
  ARRAY['Family', 'Adventure', 'Growth']::TEXT[],
  'adventurous',
  'I balance adventure with responsibility',
  'exploring',
  'dating',
  'Road runner',
  'Aweh',
  'CBD',
  'Seeking an adventurous partner who also values family and culture.',
  'want_kids',
  'Nurse',
  'no',
  'no',
  ARRAY['Travel', 'Adventure', 'Family', 'Culture']::TEXT[]
);

SELECT create_sample_dating_profile(
  'lungile.ncube@sample.com',
  'Building meaningful relationships, one day at a time. Value depth over surface-level connections.',
  30,
  'Building meaningful relationships, one day at a time',
  ARRAY['Family', 'Honesty', 'Growth']::TEXT[],
  'serious',
  'I value depth over surface-level connections',
  'church_faith',
  'marriage',
  'Sadza & nyama',
  'Sharp',
  'City Hall',
  'Looking for a life partner ready for marriage and building a family together.',
  'want_kids',
  'Artist',
  'no',
  'sometimes',
  ARRAY['Art', 'Family', 'Culture', 'Music']::TEXT[]
);

-- ============================================
-- CREATE JUNCTION TABLE FOR DATING INTERESTS
-- ============================================
-- Create junction table to link dating profiles to dating interests
CREATE TABLE IF NOT EXISTS dating_profile_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dating_profile_id UUID NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
  interest_id UUID NOT NULL REFERENCES dating_interests(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dating_profile_id, interest_id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_dating_profile_interests_profile ON dating_profile_interests(dating_profile_id);
CREATE INDEX IF NOT EXISTS idx_dating_profile_interests_interest ON dating_profile_interests(interest_id);

-- Enable RLS
ALTER TABLE dating_profile_interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view all profile interests" ON dating_profile_interests;
CREATE POLICY "Users can view all profile interests" ON dating_profile_interests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own profile interests" ON dating_profile_interests;
CREATE POLICY "Users can manage their own profile interests" ON dating_profile_interests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM dating_profiles
      WHERE dating_profiles.id = dating_profile_interests.dating_profile_id
      AND dating_profiles.user_id = auth.uid()
    )
  );

-- ============================================
-- LINK SAMPLE PROFILES TO DATING INTERESTS
-- ============================================
-- Link sample profiles to interests from dating_interests table
-- This matches the interest names in the interests array to actual interest records
INSERT INTO dating_profile_interests (dating_profile_id, interest_id)
SELECT DISTINCT
  dp.id,
  di.id
FROM dating_profiles dp
CROSS JOIN LATERAL unnest(dp.interests) AS interest_name
INNER JOIN dating_interests di ON di.name = interest_name
WHERE dp.user_id IN (SELECT id FROM users WHERE is_sample_user = TRUE)
  AND di.is_active = TRUE
ON CONFLICT (dating_profile_id, interest_id) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN users.is_sample_user IS 'Marks users created for testing purposes. These can be bulk deleted.';
COMMENT ON TABLE dating_profiles IS 'Complete dating profiles with all enhancement fields populated for testing.';

