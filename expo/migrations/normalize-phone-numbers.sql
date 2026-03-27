-- ============================================
-- NORMALIZE EXISTING PHONE NUMBERS
-- ============================================
-- This migration normalizes all existing phone numbers in the database
-- to ensure consistency and prevent duplicate relationships
--
-- Format: +[country code][number] (e.g., +11234567890)
--
-- IMPORTANT: Review the normalized values before running in production!
-- Run this in Supabase SQL Editor

-- ============================================
-- HELPER FUNCTION: Normalize Phone Number
-- ============================================
CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT, default_country_code TEXT DEFAULT '1')
RETURNS TEXT AS $$
DECLARE
  cleaned TEXT;
  digits_only TEXT;
BEGIN
  -- Return NULL if input is NULL or empty
  IF phone IS NULL OR TRIM(phone) = '' THEN
    RETURN NULL;
  END IF;

  -- Remove all non-digit characters except +
  cleaned := REGEXP_REPLACE(TRIM(phone), '[^\d+]', '', 'g');

  -- If empty after cleaning, return NULL
  IF cleaned = '' THEN
    RETURN NULL;
  END IF;

  -- If it starts with +, remove it for processing
  IF cleaned LIKE '+%' THEN
    cleaned := SUBSTRING(cleaned FROM 2);
  END IF;

  -- Extract only digits
  digits_only := REGEXP_REPLACE(cleaned, '\D', '', 'g');

  -- Validate: should be between 10-15 digits (E.164 standard)
  IF LENGTH(digits_only) < 10 OR LENGTH(digits_only) > 15 THEN
    RETURN NULL;
  END IF;

  -- If 10 digits, add default country code
  IF LENGTH(digits_only) = 10 THEN
    digits_only := default_country_code || digits_only;
  ELSIF LENGTH(digits_only) = 11 AND SUBSTRING(digits_only FROM 1 FOR 1) = '1' THEN
    -- Already has US country code, keep as is
    digits_only := digits_only;
  ELSIF LENGTH(digits_only) > 11 THEN
    -- More than 11 digits, assume country code is already included
    digits_only := digits_only;
  ELSE
    -- Less than 10 digits, add default country code
    digits_only := default_country_code || digits_only;
  END IF;

  -- Return in format +[country code][number]
  RETURN '+' || digits_only;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NORMALIZE USERS TABLE
-- ============================================
-- Create a backup column first (optional, for safety)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number_backup TEXT;
-- UPDATE users SET phone_number_backup = phone_number;

-- Normalize phone numbers in users table
UPDATE users
SET phone_number = normalize_phone_number(phone_number)
WHERE phone_number IS NOT NULL
  AND phone_number != normalize_phone_number(phone_number);

-- ============================================
-- NORMALIZE RELATIONSHIPS TABLE
-- ============================================
-- Create a backup column first (optional, for safety)
-- ALTER TABLE relationships ADD COLUMN IF NOT EXISTS partner_phone_backup TEXT;
-- UPDATE relationships SET partner_phone_backup = partner_phone;

-- Normalize partner phone numbers in relationships table
UPDATE relationships
SET partner_phone = normalize_phone_number(partner_phone)
WHERE partner_phone IS NOT NULL
  AND partner_phone != normalize_phone_number(partner_phone);

-- ============================================
-- NORMALIZE VERIFICATION CODES TABLE (if exists)
-- ============================================
-- If you have a verification_codes table with phone numbers
-- UPDATE verification_codes
-- SET phone_number = normalize_phone_number(phone_number)
-- WHERE phone_number IS NOT NULL
--   AND phone_number != normalize_phone_number(phone_number);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
-- These indexes help with phone number lookups
CREATE INDEX IF NOT EXISTS idx_users_phone_normalized ON users(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_relationships_partner_phone_normalized ON relationships(partner_phone) WHERE partner_phone IS NOT NULL;

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify normalization worked correctly
-- SELECT 
--   COUNT(*) as total_users,
--   COUNT(CASE WHEN phone_number LIKE '+%' THEN 1 END) as normalized_users,
--   COUNT(CASE WHEN phone_number NOT LIKE '+%' AND phone_number IS NOT NULL THEN 1 END) as unnormalized_users
-- FROM users;

-- SELECT 
--   COUNT(*) as total_relationships,
--   COUNT(CASE WHEN partner_phone LIKE '+%' THEN 1 END) as normalized_relationships,
--   COUNT(CASE WHEN partner_phone NOT LIKE '+%' AND partner_phone IS NOT NULL THEN 1 END) as unnormalized_relationships
-- FROM relationships;

-- ============================================
-- CLEANUP (Optional - remove after verification)
-- ============================================
-- DROP FUNCTION IF EXISTS normalize_phone_number(TEXT, TEXT);
-- ALTER TABLE users DROP COLUMN IF EXISTS phone_number_backup;
-- ALTER TABLE relationships DROP COLUMN IF EXISTS partner_phone_backup;

