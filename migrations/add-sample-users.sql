-- ============================================
-- SAMPLE USERS FOR TESTING
-- ============================================
-- This file creates sample users for testing the dating app
-- Includes users in Kwekwe and other locations
-- Password for all: "Test123456!"
--
-- IMPORTANT: Auth users must be created via Supabase Dashboard or Admin API
-- This SQL only creates user records in the users table
-- After running this, create auth users in Supabase Dashboard:
-- Authentication → Users → Add user (for each email)

-- ============================================
-- ADD SAMPLE USER COLUMN
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_sample_user BOOLEAN DEFAULT FALSE;

-- ============================================
-- SAMPLE USERS DATA
-- ============================================
-- Kwekwe Users (5 users)
INSERT INTO users (id, full_name, email, phone_number, role, phone_verified, email_verified, is_sample_user, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Sarah Moyo', 'sarah.moyo@sample.com', '+263771234501', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Tendai Ndlovu', 'tendai.ndlovu@sample.com', '+263771234502', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Blessing Sibanda', 'blessing.sibanda@sample.com', '+263771234503', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Grace Chidziva', 'grace.chidziva@sample.com', '+263771234504', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'John Maphosa', 'john.maphosa@sample.com', '+263771234505', 'user', TRUE, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  is_sample_user = TRUE,
  full_name = EXCLUDED.full_name,
  phone_number = EXCLUDED.phone_number,
  updated_at = NOW();

-- Harare Users (5 users)
INSERT INTO users (id, full_name, email, phone_number, role, phone_verified, email_verified, is_sample_user, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Linda Chiwenga', 'linda.chiwenga@sample.com', '+263771234506', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'David Mutasa', 'david.mutasa@sample.com', '+263771234507', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Ruth Makoni', 'ruth.makoni@sample.com', '+263771234508', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Peter Muzenda', 'peter.muzenda@sample.com', '+263771234509', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Faith Nyathi', 'faith.nyathi@sample.com', '+263771234510', 'user', TRUE, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  is_sample_user = TRUE,
  full_name = EXCLUDED.full_name,
  phone_number = EXCLUDED.phone_number,
  updated_at = NOW();

-- Bulawayo Users (5 users)
INSERT INTO users (id, full_name, email, phone_number, role, phone_verified, email_verified, is_sample_user, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'Thabo Nkomo', 'thabo.nkomo@sample.com', '+263771234511', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Nomsa Dube', 'nomsa.dube@sample.com', '+263771234512', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Sipho Moyo', 'sipho.moyo@sample.com', '+263771234513', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Zanele Khumalo', 'zanele.khumalo@sample.com', '+263771234514', 'user', TRUE, TRUE, TRUE, NOW(), NOW()),
  (gen_random_uuid(), 'Lungile Ncube', 'lungile.ncube@sample.com', '+263771234515', 'user', TRUE, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  is_sample_user = TRUE,
  full_name = EXCLUDED.full_name,
  phone_number = EXCLUDED.phone_number,
  updated_at = NOW();

-- ============================================
-- CREATE DATING PROFILES
-- ============================================
-- Kwekwe profiles
INSERT INTO dating_profiles (user_id, bio, age, location_city, location_country, is_active, show_me, created_at, updated_at)
SELECT 
  id,
  'Looking for meaningful connections in Kwekwe',
  25 + (random() * 15)::int,
  'Kwekwe',
  'Zimbabwe',
  TRUE,
  TRUE,
  NOW(),
  NOW()
FROM users
WHERE email IN ('sarah.moyo@sample.com', 'tendai.ndlovu@sample.com', 'blessing.sibanda@sample.com', 'grace.chidziva@sample.com', 'john.maphosa@sample.com')
ON CONFLICT (user_id) DO UPDATE SET
  location_city = EXCLUDED.location_city,
  location_country = EXCLUDED.location_country,
  bio = EXCLUDED.bio,
  age = EXCLUDED.age,
  updated_at = NOW();

-- Harare profiles
INSERT INTO dating_profiles (user_id, bio, age, location_city, location_country, is_active, show_me, created_at, updated_at)
SELECT 
  id,
  'Exploring the dating scene in Harare',
  25 + (random() * 15)::int,
  'Harare',
  'Zimbabwe',
  TRUE,
  TRUE,
  NOW(),
  NOW()
FROM users
WHERE email IN ('linda.chiwenga@sample.com', 'david.mutasa@sample.com', 'ruth.makoni@sample.com', 'peter.muzenda@sample.com', 'faith.nyathi@sample.com')
ON CONFLICT (user_id) DO UPDATE SET
  location_city = EXCLUDED.location_city,
  location_country = EXCLUDED.location_country,
  bio = EXCLUDED.bio,
  age = EXCLUDED.age,
  updated_at = NOW();

-- Bulawayo profiles
INSERT INTO dating_profiles (user_id, bio, age, location_city, location_country, is_active, show_me, created_at, updated_at)
SELECT 
  id,
  'Ready to meet new people in Bulawayo',
  25 + (random() * 15)::int,
  'Bulawayo',
  'Zimbabwe',
  TRUE,
  TRUE,
  NOW(),
  NOW()
FROM users
WHERE email IN ('thabo.nkomo@sample.com', 'nomsa.dube@sample.com', 'sipho.moyo@sample.com', 'zanele.khumalo@sample.com', 'lungile.ncube@sample.com')
ON CONFLICT (user_id) DO UPDATE SET
  location_city = EXCLUDED.location_city,
  location_country = EXCLUDED.location_country,
  bio = EXCLUDED.bio,
  age = EXCLUDED.age,
  updated_at = NOW();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN users.is_sample_user IS 'Marks users created for testing purposes. These can be bulk deleted.';

