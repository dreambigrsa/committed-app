-- ============================================
-- SEED INITIAL PROFESSIONAL ROLES
-- Creates the default set of professional roles
-- for the Committed app professional system
-- ============================================

-- Insert initial professional roles
-- These can be edited, enabled/disabled, or extended by admins via the admin panel

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
  -- 1. Counselor
  (
    'Counselor',
    'Mental Health & Support',
    'Provides emotional support, guidance, and coping strategies.',
    true,  -- requires_credentials
    true,  -- requires_verification
    true,  -- eligible_for_live_chat
    true,  -- approval_required
    'This professional provides counseling support but does not replace medical or psychiatric treatment.',
    '{"keywords": ["counseling", "emotional support", "coping", "guidance", "mental health"], "priority": 1}'::jsonb,
    true,  -- is_active
    1      -- display_order
  ),

  -- 2. Relationship Therapist
  (
    'Relationship Therapist',
    'Mental Health & Relationships',
    'Helps individuals or couples resolve relationship conflicts and improve communication.',
    true,
    true,
    true,
    true,
    'Relationship therapy is not a substitute for emergency or psychiatric care.',
    '{"keywords": ["relationship", "couples", "marriage", "communication", "conflict resolution"], "priority": 1}'::jsonb,
    true,
    2
  ),

  -- 3. Psychologist
  (
    'Psychologist',
    'Mental Health',
    'Provides psychological assessment and therapy within professional scope.',
    true,
    true,
    true,
    true,
    'This service does not include diagnosis or prescription of medication.',
    '{"keywords": ["psychology", "therapy", "assessment", "mental health", "psychological"], "priority": 1}'::jsonb,
    true,
    3
  ),

  -- 4. Mental Health Professional
  (
    'Mental Health Professional',
    'Mental Health',
    'Provides general mental health support and guidance.',
    true,
    true,
    true,
    true,
    'For emergencies, contact local emergency services.',
    '{"keywords": ["mental health", "support", "wellness", "emotional", "psychological"], "priority": 1}'::jsonb,
    true,
    4
  ),

  -- 5. Life Coach
  (
    'Life Coach',
    'Personal Development',
    'Supports personal growth, goal-setting, and life direction.',
    false,  -- credentials optional
    false,  -- verification optional if credentials not required
    true,
    true,
    'Life coaching is not therapy or medical treatment.',
    '{"keywords": ["life coach", "personal development", "goals", "growth", "motivation"], "priority": 2}'::jsonb,
    true,
    5
  ),

  -- 6. Business Mentor
  (
    'Business Mentor',
    'Business & Career',
    'Advises on business growth, strategy, and professional development.',
    false,  -- credentials optional
    false,
    true,
    true,
    'Business advice is for guidance only and not legally binding.',
    '{"keywords": ["business", "entrepreneur", "career", "strategy", "professional development"], "priority": 2}'::jsonb,
    true,
    6
  ),

  -- 7. General Mentor
  (
    'General Mentor',
    'Mentorship',
    'Provides guidance based on experience and expertise.',
    false,  -- credentials optional
    false,
    true,
    true,
    'Mentorship is advisory and does not replace professional services.',
    '{"keywords": ["mentor", "guidance", "advice", "experience", "support"], "priority": 3}'::jsonb,
    true,
    7
  ),

  -- 8. Legal Advisor
  (
    'Legal Advisor',
    'Legal',
    'Provides general legal guidance and information.',
    true,
    true,
    true,
    true,
    'Legal advice provided is general information and not a substitute for licensed legal representation.',
    '{"keywords": ["legal", "law", "legal advice", "legal guidance", "legal information"], "priority": 1}'::jsonb,
    true,
    8
  ),

  -- 9. Lawyer / Legal Consultant
  (
    'Lawyer / Legal Consultant',
    'Legal',
    'Provides professional legal consultation within licensed jurisdictions.',
    true,
    true,
    true,
    true,
    'This does not establish an attorney-client relationship.',
    '{"keywords": ["lawyer", "attorney", "legal consultant", "legal consultation", "legal representation"], "priority": 1}'::jsonb,
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
  ai_matching_rules = EXCLUDED.ai_matching_rules,
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully created/updated % professional roles', (SELECT COUNT(*) FROM professional_roles);
END $$;

