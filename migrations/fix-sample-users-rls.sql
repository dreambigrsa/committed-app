-- ============================================
-- FIX RLS FOR SAMPLE USERS
-- ============================================
-- This fixes the RLS policy violation when creating sample users
-- The function needs SECURITY DEFINER with proper search_path

-- Update the function to properly bypass RLS
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

  -- Create or update user record (SECURITY DEFINER bypasses RLS)
  INSERT INTO public.users (id, full_name, email, phone_number, role, phone_verified, email_verified, is_sample_user, created_at, updated_at)
  VALUES (v_auth_user_id, p_full_name, p_email, p_phone, 'user', TRUE, TRUE, TRUE, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    is_sample_user = TRUE,
    full_name = EXCLUDED.full_name,
    phone_number = EXCLUDED.phone_number,
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN v_auth_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also update the dating profile function
CREATE OR REPLACE FUNCTION create_sample_dating_profile(
  p_user_email TEXT,
  p_age INTEGER,
  p_bio TEXT,
  p_location_city TEXT,
  p_location_country TEXT,
  p_location_latitude DECIMAL,
  p_location_longitude DECIMAL,
  p_interests TEXT[],
  p_headline TEXT,
  p_values TEXT[],
  p_mood TEXT,
  p_what_makes_me_different TEXT,
  p_weekend_style TEXT,
  p_intention_tag TEXT,
  p_respect_first_badge BOOLEAN,
  p_local_food TEXT,
  p_local_slang TEXT,
  p_local_spot TEXT,
  p_what_im_looking_for TEXT,
  p_kids TEXT,
  p_work TEXT,
  p_smoke TEXT,
  p_drink TEXT,
  p_prompts JSONB
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = p_user_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User with email % does not exist.', p_user_email;
    RETURN NULL;
  END IF;

  -- Create or update dating profile
  INSERT INTO dating_profiles (
    user_id, age, bio, location_city, location_country,
    location_latitude, location_longitude, interests,
    headline, values, mood, what_makes_me_different,
    weekend_style, intention_tag, respect_first_badge,
    local_food, local_slang, local_spot, what_im_looking_for,
    kids, work, smoke, drink, prompts, is_active, created_at, updated_at
  )
  VALUES (
    v_user_id, p_age, p_bio, p_location_city, p_location_country,
    p_location_latitude, p_location_longitude, p_interests,
    p_headline, p_values, p_mood, p_what_makes_me_different,
    p_weekend_style, p_intention_tag, p_respect_first_badge,
    p_local_food, p_local_slang, p_local_spot, p_what_im_looking_for,
    p_kids, p_work, p_smoke, p_drink, p_prompts, TRUE, NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    age = EXCLUDED.age,
    bio = EXCLUDED.bio,
    location_city = EXCLUDED.location_city,
    location_country = EXCLUDED.location_country,
    location_latitude = EXCLUDED.location_latitude,
    location_longitude = EXCLUDED.location_longitude,
    interests = EXCLUDED.interests,
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
    updated_at = NOW()
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

