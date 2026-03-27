-- ============================================
-- DEFAULT ESCALATION RULES
-- Comprehensive escalation rules for the professional system
-- ============================================

-- Note: role_id is NULL for global rules, or set to specific role_id for role-specific rules
-- Priority: Lower number = higher priority (0 is highest)

-- ============================================
-- 1. URGENT MENTAL HEALTH ESCALATION (AI Detection)
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Urgent Mental Health Detection',
  'Automatically escalates when AI detects urgent mental health concerns (suicidal ideation, severe depression, crisis situations). Requires immediate professional intervention.',
  NULL, -- Global rule (applies to all mental health roles)
  'ai_detection',
  NULL,
  5, -- More attempts for urgent situations
  'broadcast', -- Broadcast to multiple professionals simultaneously for faster response
  '{"local_to_online": true, "role_expansion": true, "allow_any_available": true}'::jsonb,
  false, -- No confirmation needed for urgent situations
  true,
  0 -- Highest priority
);

-- ============================================
-- 2. PROFESSIONAL NO RESPONSE TIMEOUT
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Professional No Response - 5 Minutes',
  'Escalates to another professional if current professional has not responded within 5 minutes of session start or last user message.',
  NULL,
  'timeout',
  300, -- 5 minutes
  3,
  'sequential', -- Try one professional at a time
  '{"local_to_online": true, "role_expansion": false}'::jsonb,
  true, -- Ask user before escalating
  true,
  10
);

-- ============================================
-- 3. PROFESSIONAL NO RESPONSE - EXTENDED
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Professional No Response - 15 Minutes',
  'Escalates if professional has not responded for 15 minutes. More aggressive escalation with role expansion.',
  NULL,
  'timeout',
  900, -- 15 minutes
  5,
  'broadcast', -- Broadcast to multiple professionals
  '{"local_to_online": true, "role_expansion": true, "allow_lower_rated": true}'::jsonb,
  true,
  true,
  20
);

-- ============================================
-- 4. USER REQUESTED ESCALATION
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'User Requested Escalation',
  'When user explicitly requests to be transferred to another professional. Immediate escalation with user preference consideration.',
  NULL,
  'user_request',
  NULL,
  3,
  'sequential',
  '{"local_to_online": true, "role_expansion": false, "respect_user_preference": true}'::jsonb,
  false, -- Already confirmed by user request
  true,
  5
);

-- ============================================
-- 5. RELATIONSHIP CRISIS ESCALATION
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Relationship Crisis Detection',
  'AI detects relationship crisis situations (domestic violence, breakup crisis, infidelity discovery). Requires immediate specialized professional.',
  NULL, -- Applies to relationship therapists/counselors
  'ai_detection',
  NULL,
  5,
  'broadcast',
  '{"local_to_online": true, "role_expansion": true, "prioritize_specialized": true}'::jsonb,
  false, -- Urgent situation
  true,
  1 -- Very high priority
);

-- ============================================
-- 6. BUSINESS/LEGAL URGENT MATTERS
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Business/Legal Urgent Matters',
  'Escalates urgent business or legal matters that require immediate professional attention (contract disputes, urgent legal advice, business crisis).',
  NULL,
  'ai_detection',
  NULL,
  4,
  'sequential',
  '{"local_to_online": true, "role_expansion": false, "require_credentials": true}'::jsonb,
  true,
  true,
  3
);

-- ============================================
-- 7. PROFESSIONAL BECAME UNAVAILABLE
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Professional Unavailable During Session',
  'Automatically escalates when a professional becomes unavailable (goes offline, busy, or ends session unexpectedly) during an active session.',
  NULL,
  'ai_detection', -- Detected by system monitoring
  NULL,
  3,
  'broadcast',
  '{"local_to_online": true, "role_expansion": false, "maintain_session_context": true}'::jsonb,
  false, -- Automatic escalation
  true,
  2
);

-- ============================================
-- 8. MULTIPLE ESCALATION ATTEMPTS FAILED
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Multiple Escalation Failures',
  'When previous escalation attempts have failed (professionals declined or unavailable), this rule applies more aggressive fallback strategies.',
  NULL,
  'manual', -- Triggered by system after failed escalations
  NULL,
  10, -- More attempts
  'broadcast',
  '{"local_to_online": true, "role_expansion": true, "allow_any_available": true, "lower_rating_threshold": 3.5}'::jsonb,
  true,
  true,
  15
);

-- ============================================
-- 9. SESSION QUALITY ESCALATION
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Session Quality Issues',
  'Escalates when user expresses dissatisfaction or AI detects poor session quality (professional not helpful, communication issues).',
  NULL,
  'ai_detection',
  NULL,
  2,
  'sequential',
  '{"local_to_online": true, "role_expansion": false, "prioritize_higher_rated": true}'::jsonb,
  true,
  true,
  12
);

-- ============================================
-- 10. OFF-HOURS ESCALATION
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Off-Hours Availability',
  'During off-hours or when local professionals are unavailable, automatically expand to online professionals in different time zones.',
  NULL,
  'timeout',
  600, -- 10 minutes
  5,
  'broadcast',
  '{"local_to_online": true, "role_expansion": true, "allow_different_timezone": true}'::jsonb,
  true,
  true,
  25
);

-- ============================================
-- 11. HIGH-VOLUME PERIOD ESCALATION
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'High Demand Period',
  'During high-demand periods when many users need help, use broadcast strategy to find available professionals faster.',
  NULL,
  'timeout',
  180, -- 3 minutes (faster during high demand)
  4,
  'broadcast',
  '{"local_to_online": true, "role_expansion": true, "fast_response_mode": true}'::jsonb,
  true,
  true,
  8
);

-- ============================================
-- 12. SPECIALIZED ROLE ESCALATION
-- ============================================
INSERT INTO escalation_rules (
  name,
  description,
  role_id,
  trigger_type,
  timeout_seconds,
  max_escalation_attempts,
  escalation_strategy,
  fallback_rules,
  require_user_confirmation,
  is_active,
  priority
) VALUES (
  'Specialized Role Unavailable',
  'When a specialized professional role is unavailable, expand to related roles that can still provide help (e.g., counselor if therapist unavailable).',
  NULL,
  'timeout',
  300, -- 5 minutes
  3,
  'sequential',
  '{"local_to_online": true, "role_expansion": true, "related_roles_only": true}'::jsonb,
  true,
  true,
  18
);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE escalation_rules IS 'Default escalation rules inserted for comprehensive professional session management';

