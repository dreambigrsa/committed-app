-- ============================================
-- SEED INITIAL PROFESSIONAL ROLES
-- ============================================
-- This script creates the initial set of professional roles
-- These can be modified, disabled, or extended by Admins via the Admin Panel
-- Run this after running professional-system-schema.sql
-- ============================================

-- Insert initial professional roles
-- Using ON CONFLICT to prevent duplicates if run multiple times
INSERT INTO professional_roles (
  name,
  category,
  description,
  requires_credentials,
  requires_verification,
  eligible_for_live_chat,
  approval_required,
  disclaimer_text,
  ai_matching_rules,
  is_active,
  display_order
) VALUES
  (
    'Counselor',
    'Mental Health & Support',
    'Provides emotional support, guidance, and coping strategies.',
    true,
    true,
    true,
    true,
    'This professional provides counseling support but does not replace medical or psychiatric treatment.',
    '{}'::jsonb,
    true,
    1
  ),
  (
    'Relationship Therapist',
    'Mental Health & Relationships',
    'Helps individuals or couples resolve relationship conflicts and improve communication.',
    true,
    true,
    true,
    true,
    'Relationship therapy is not a substitute for emergency or psychiatric care.',
    '{}'::jsonb,
    true,
    2
  ),
  (
    'Psychologist',
    'Mental Health',
    'Provides psychological assessment and therapy within professional scope.',
    true,
    true,
    true,
    true,
    'This service does not include diagnosis or prescription of medication.',
    '{}'::jsonb,
    true,
    3
  ),
  (
    'Mental Health Professional',
    'Mental Health',
    'Provides general mental health support and guidance.',
    true,
    true,
    true,
    true,
    'For emergencies, contact local emergency services.',
    '{}'::jsonb,
    true,
    4
  ),
  (
    'Life Coach',
    'Personal Development',
    'Supports personal growth, goal-setting, and life direction.',
    false,
    false,
    true,
    true,
    'Life coaching is not therapy or medical treatment.',
    '{}'::jsonb,
    true,
    5
  ),
  (
    'Business Mentor',
    'Business & Career',
    'Advises on business growth, strategy, and professional development.',
    false,
    false,
    true,
    true,
    'Business advice is for guidance only and not legally binding.',
    '{}'::jsonb,
    true,
    6
  ),
  (
    'General Mentor',
    'Mentorship',
    'Provides guidance based on experience and expertise.',
    false,
    false,
    true,
    true,
    'Mentorship is advisory and does not replace professional services.',
    '{}'::jsonb,
    true,
    7
  ),
  (
    'Legal Advisor',
    'Legal',
    'Provides general legal guidance and information.',
    true,
    true,
    true,
    true,
    'Legal advice provided is general information and not a substitute for licensed legal representation.',
    '{}'::jsonb,
    true,
    8
  ),
  (
    'Lawyer / Legal Consultant',
    'Legal',
    'Provides professional legal consultation within licensed jurisdictions.',
    true,
    true,
    true,
    true,
    'This does not establish an attorney-client relationship.',
    '{}'::jsonb,
    true,
    9
  )
ON CONFLICT (name) DO UPDATE SET
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  requires_credentials = EXCLUDED.requires_credentials,
  requires_verification = EXCLUDED.requires_verification,
  eligible_for_live_chat = EXCLUDED.eligible_for_live_chat,
  approval_required = EXCLUDED.approval_required,
  disclaimer_text = EXCLUDED.disclaimer_text,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Verify the roles were created
SELECT 
  name,
  category,
  is_active,
  eligible_for_live_chat,
  requires_credentials,
  display_order
FROM professional_roles
ORDER BY display_order;

-- Expected output: 9 rows with all roles active and properly configured

