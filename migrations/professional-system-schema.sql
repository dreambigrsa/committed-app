-- ============================================
-- PROFESSIONAL JOIN & ESCALATION SYSTEM
-- Complete database schema for admin-managed
-- professional roles and live join system
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFESSIONAL ROLE DEFINITIONS (Admin-Managed)
-- ============================================
CREATE TABLE IF NOT EXISTS professional_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- e.g., "Counselor", "Relationship Therapist"
  category TEXT NOT NULL, -- e.g., "Therapy", "Coaching", "Legal", "Business"
  description TEXT,
  requires_credentials BOOLEAN DEFAULT TRUE,
  requires_verification BOOLEAN DEFAULT TRUE,
  eligible_for_live_chat BOOLEAN DEFAULT TRUE,
  approval_required BOOLEAN DEFAULT TRUE,
  disclaimer_text TEXT, -- Role-specific disclaimer shown to users
  ai_matching_rules JSONB DEFAULT '{}', -- Rules for AI to match users to this role
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS professional_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  role_id UUID NOT NULL REFERENCES professional_roles(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  bio TEXT,
  credentials TEXT[], -- Array of credential strings
  credential_documents JSONB DEFAULT '[]', -- Array of {type, url, verified}
  location TEXT, -- City, Country or region
  location_coordinates POINT, -- For geolocation-based matching
  online_availability BOOLEAN DEFAULT TRUE,
  in_person_availability BOOLEAN DEFAULT FALSE,
  service_areas TEXT[], -- If in-person, list of service areas
  pricing_info JSONB, -- {currency, rate, unit} or null if free
  languages TEXT[] DEFAULT ARRAY['en'], -- Languages spoken
  rating_average DECIMAL(3,2) DEFAULT 0.00 CHECK (rating_average >= 0 AND rating_average <= 5),
  rating_count INTEGER DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
  rejection_reason TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  public_profile_url TEXT, -- Slug-based URL for public profile
  max_concurrent_sessions INTEGER DEFAULT 3,
  quiet_hours_start TIME, -- e.g., "22:00"
  quiet_hours_end TIME, -- e.g., "08:00"
  quiet_hours_timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL ONLINE STATUS
-- ============================================
CREATE TABLE IF NOT EXISTS professional_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'offline', 'away')),
  current_session_count INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  status_override BOOLEAN DEFAULT FALSE, -- Admin override flag
  status_override_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status_override_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL SESSIONS (Live Join Conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS professional_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES professional_roles(id) ON DELETE RESTRICT,
  session_type TEXT NOT NULL DEFAULT 'live_chat' CHECK (session_type IN ('live_chat', 'escalated', 'scheduled')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_acceptance', 'active', 'ended', 'declined', 'cancelled')),
  ai_summary TEXT, -- AI-generated summary of user issue before escalation
  user_consent_given BOOLEAN DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ,
  professional_joined_at TIMESTAMPTZ,
  professional_ended_at TIMESTAMPTZ,
  escalation_level INTEGER DEFAULT 0, -- Track how many escalations occurred
  escalation_reason TEXT,
  ai_observer_mode BOOLEAN DEFAULT FALSE, -- Whether AI is in observer mode
  ended_by TEXT CHECK (ended_by IN ('user', 'professional', 'system', 'admin')),
  ended_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ESCALATION RULES (Admin-Configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS escalation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  role_id UUID REFERENCES professional_roles(id) ON DELETE CASCADE, -- Null means global rule
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('timeout', 'user_request', 'ai_detection', 'manual')),
  timeout_seconds INTEGER, -- For timeout triggers
  max_escalation_attempts INTEGER DEFAULT 3,
  escalation_strategy TEXT NOT NULL DEFAULT 'sequential' CHECK (escalation_strategy IN ('sequential', 'broadcast', 'round_robin')),
  fallback_rules JSONB DEFAULT '{}', -- e.g., {"local_to_online": true, "role_expansion": true}
  require_user_confirmation BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Lower = higher priority
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ESCALATION EVENTS (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS escalation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES professional_sessions(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES escalation_rules(id) ON DELETE SET NULL,
  from_professional_id UUID REFERENCES professional_profiles(id) ON DELETE SET NULL,
  to_professional_id UUID REFERENCES professional_profiles(id) ON DELETE SET NULL,
  escalation_level INTEGER NOT NULL,
  reason TEXT,
  user_notified BOOLEAN DEFAULT FALSE,
  user_confirmed BOOLEAN,
  result TEXT CHECK (result IN ('accepted', 'declined', 'timeout', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL REVIEWS & RATINGS
-- ============================================
CREATE TABLE IF NOT EXISTS professional_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES professional_sessions(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  moderation_reason TEXT,
  reported_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id) -- One review per session per user
);

-- ============================================
-- PROFESSIONAL SYSTEM SETTINGS (Admin-Configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS professional_system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'ai', 'escalation', 'safety', 'ui')),
  is_public BOOLEAN DEFAULT FALSE, -- Whether clients can see this setting
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO professional_system_settings (setting_key, setting_value, description, category) VALUES
  ('ai_behavior', '{"mode": "moderator", "observe_when_professional_joins": true, "provide_context_summary": true}', 'AI behavior configuration', 'ai'),
  ('escalation_default_timeout', '{"seconds": 300}', 'Default timeout for escalations (5 minutes)', 'escalation'),
  ('crisis_rules', '{"enabled": true, "regions": {}, "immediate_escalation": true}', 'Crisis handling rules per region', 'safety'),
  ('user_onboarding_consent_required', '{"enabled": true, "text": "I understand that Committed provides support but may connect me with human professionals when appropriate. I consent to this service."}', 'User consent text for onboarding', 'general'),
  ('professional_onboarding_agreement', '{"required": true, "text": "I agree to provide professional services according to platform guidelines and maintain confidentiality."}', 'Professional onboarding agreement', 'general')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- USER ONBOARDING DATA
-- ============================================
CREATE TABLE IF NOT EXISTS user_onboarding_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  has_completed_onboarding BOOLEAN DEFAULT FALSE,
  onboarding_version TEXT, -- Track onboarding flow version
  ai_explanation_viewed BOOLEAN DEFAULT FALSE,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_given_at TIMESTAMPTZ,
  location_provided TEXT, -- Optional location
  location_coordinates POINT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL APPLICATION TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS professional_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES professional_roles(id) ON DELETE RESTRICT,
  application_data JSONB NOT NULL, -- Stores application form data
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'withdrawn')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL SESSION ANALYTICS
-- ============================================
CREATE TABLE IF NOT EXISTS professional_session_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES professional_sessions(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metrics JSONB NOT NULL DEFAULT '{}', -- {response_time, resolution_time, satisfaction_score, etc.}
  ai_referral_accuracy DECIMAL(3,2), -- How well AI matched user to professional (0-1)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROFESSIONAL SYSTEM AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS professional_system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'role', 'profile', 'session', 'escalation', 'review'
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_professional_roles_category ON professional_roles(category);
CREATE INDEX IF NOT EXISTS idx_professional_roles_active ON professional_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_professional_profiles_user_id ON professional_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_profiles_role_id ON professional_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_professional_profiles_approval_status ON professional_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_professional_profiles_location ON professional_profiles USING GIST(location_coordinates);
CREATE INDEX IF NOT EXISTS idx_professional_status_professional_id ON professional_status(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_status_status ON professional_status(status);
CREATE INDEX IF NOT EXISTS idx_professional_sessions_conversation_id ON professional_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_professional_sessions_user_id ON professional_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_sessions_professional_id ON professional_sessions(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_sessions_status ON professional_sessions(status);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_role_id ON escalation_rules(role_id);
CREATE INDEX IF NOT EXISTS idx_escalation_rules_active ON escalation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_events_session_id ON escalation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_professional_reviews_professional_id ON professional_reviews(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_reviews_session_id ON professional_reviews(session_id);
CREATE INDEX IF NOT EXISTS idx_professional_reviews_moderation_status ON professional_reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_data_user_id ON user_onboarding_data(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_applications_user_id ON professional_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_applications_role_id ON professional_applications(role_id);
CREATE INDEX IF NOT EXISTS idx_professional_applications_status ON professional_applications(status);
-- Partial unique index: Only one pending application per user/role
CREATE UNIQUE INDEX IF NOT EXISTS idx_professional_applications_unique_pending 
  ON professional_applications(user_id, role_id) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_professional_session_analytics_session_id ON professional_session_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_professional_session_analytics_professional_id ON professional_session_analytics(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_system_logs_user_id ON professional_system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_professional_system_logs_resource_type ON professional_system_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_professional_system_logs_created_at ON professional_system_logs(created_at DESC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE TRIGGER update_professional_roles_updated_at BEFORE UPDATE ON professional_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professional_profiles_updated_at BEFORE UPDATE ON professional_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professional_status_updated_at BEFORE UPDATE ON professional_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professional_sessions_updated_at BEFORE UPDATE ON professional_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escalation_rules_updated_at BEFORE UPDATE ON escalation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professional_reviews_updated_at BEFORE UPDATE ON professional_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_onboarding_data_updated_at BEFORE UPDATE ON user_onboarding_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professional_applications_updated_at BEFORE UPDATE ON professional_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update professional rating when review is approved
CREATE OR REPLACE FUNCTION update_professional_rating()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.moderation_status = 'approved' AND (OLD.moderation_status IS NULL OR OLD.moderation_status != 'approved') THEN
    -- Recalculate average rating and counts
    UPDATE professional_profiles
    SET
      rating_average = (
        SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0)
        FROM professional_reviews
        WHERE professional_id = NEW.professional_id AND moderation_status = 'approved'
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM professional_reviews
        WHERE professional_id = NEW.professional_id AND moderation_status = 'approved'
      ),
      review_count = (
        SELECT COUNT(*)
        FROM professional_reviews
        WHERE professional_id = NEW.professional_id AND moderation_status = 'approved' AND review_text IS NOT NULL
      )
    WHERE id = NEW.professional_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_professional_rating_on_approval
  AFTER INSERT OR UPDATE ON professional_reviews
  FOR EACH ROW EXECUTE FUNCTION update_professional_rating();

-- Auto-create professional_status when profile is created
CREATE OR REPLACE FUNCTION create_professional_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO professional_status (professional_id, status)
  VALUES (NEW.id, 'offline')
  ON CONFLICT (professional_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_professional_status_on_profile_create
  AFTER INSERT ON professional_profiles
  FOR EACH ROW EXECUTE FUNCTION create_professional_status();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE professional_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_session_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_system_logs ENABLE ROW LEVEL SECURITY;

-- Professional roles: Everyone can view active roles
CREATE POLICY "Anyone can view active professional roles" ON professional_roles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage professional roles" ON professional_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Professional profiles: Public view of approved profiles, professionals can edit their own
CREATE POLICY "Anyone can view approved professional profiles" ON professional_profiles
  FOR SELECT USING (approval_status = 'approved' AND is_active = true);

CREATE POLICY "Professionals can view their own profile" ON professional_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Professionals can update their own profile" ON professional_profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can create professional profile" ON professional_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all professional profiles" ON professional_profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Professional status: Public view of online status, professionals can update their own
CREATE POLICY "Anyone can view professional status" ON professional_status
  FOR SELECT USING (true);

CREATE POLICY "Professionals can update their own status" ON professional_status
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_status.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all professional status" ON professional_status
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Professional sessions: Users and professionals can view their sessions
CREATE POLICY "Users can view their sessions" ON professional_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Professionals can view their sessions" ON professional_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM professional_profiles
      WHERE professional_profiles.id = professional_sessions.professional_id
      AND professional_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all sessions" ON professional_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Professional reviews: Public approved reviews, users can create reviews for their sessions
CREATE POLICY "Anyone can view approved reviews" ON professional_reviews
  FOR SELECT USING (moderation_status = 'approved');

CREATE POLICY "Users can create reviews for their sessions" ON professional_reviews
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM professional_sessions
      WHERE professional_sessions.id = professional_reviews.session_id
      AND professional_sessions.user_id = auth.uid()
      AND professional_sessions.status = 'ended'
    )
  );

CREATE POLICY "Admins can moderate reviews" ON professional_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- User onboarding data: Users can view and update their own
CREATE POLICY "Users can manage their own onboarding data" ON user_onboarding_data
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all onboarding data" ON user_onboarding_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Professional applications: Users can view and create their own
CREATE POLICY "Users can manage their own applications" ON professional_applications
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all applications" ON professional_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- System settings: Public settings visible to all, private settings only to admins
CREATE POLICY "Anyone can view public system settings" ON professional_system_settings
  FOR SELECT USING (is_public = true);

CREATE POLICY "Admins can manage all system settings" ON professional_system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Escalation rules: Admins only
CREATE POLICY "Admins can manage escalation rules" ON escalation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Analytics and logs: Admins only
CREATE POLICY "Admins can view analytics" ON professional_session_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can view system logs" ON professional_system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get available professionals for a role
CREATE OR REPLACE FUNCTION get_available_professionals(
  role_id_param UUID,
  location_param POINT DEFAULT NULL,
  max_distance_km INTEGER DEFAULT NULL
)
RETURNS TABLE (
  professional_id UUID,
  user_id UUID,
  full_name TEXT,
  rating_average DECIMAL,
  status TEXT,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.user_id,
    pp.full_name,
    pp.rating_average,
    ps.status,
    CASE
      WHEN location_param IS NOT NULL AND pp.location_coordinates IS NOT NULL THEN
        (ST_Distance(
          ST_Transform(ST_SetSRID(location_param, 4326)::geometry, 3857),
          ST_Transform(ST_SetSRID(pp.location_coordinates, 4326)::geometry, 3857)
        ) / 1000)::DECIMAL
      ELSE NULL
    END as distance_km
  FROM professional_profiles pp
  INNER JOIN professional_status ps ON ps.professional_id = pp.id
  WHERE pp.role_id = role_id_param
    AND pp.approval_status = 'approved'
    AND pp.is_active = true
    AND ps.status IN ('online', 'busy')
    AND (max_distance_km IS NULL OR location_param IS NULL OR pp.location_coordinates IS NULL OR
         (ST_Distance(
           ST_Transform(ST_SetSRID(location_param, 4326)::geometry, 3857),
           ST_Transform(ST_SetSRID(pp.location_coordinates, 4326)::geometry, 3857)
         ) / 1000) <= max_distance_km)
  ORDER BY
    CASE WHEN ps.status = 'online' THEN 0 ELSE 1 END,
    pp.rating_average DESC NULLS LAST,
    distance_km ASC NULLS LAST
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log professional system action
CREATE OR REPLACE FUNCTION log_professional_action(
  user_id_param UUID,
  action_param TEXT,
  resource_type_param TEXT,
  resource_id_param UUID DEFAULT NULL,
  details_param JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO professional_system_logs (user_id, action, resource_type, resource_id, details)
  VALUES (user_id_param, action_param, resource_type_param, resource_id_param, details_param)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE professional_roles IS 'Admin-managed professional role definitions (e.g., Counselor, Therapist)';
COMMENT ON TABLE professional_profiles IS 'Professional user profiles with credentials and availability';
COMMENT ON TABLE professional_status IS 'Real-time online status of professionals';
COMMENT ON TABLE professional_sessions IS 'Live chat sessions between users and professionals';
COMMENT ON TABLE escalation_rules IS 'Admin-configurable escalation rules and logic';
COMMENT ON TABLE escalation_events IS 'Audit trail of escalation attempts';
COMMENT ON TABLE professional_reviews IS 'User reviews and ratings of professionals';
COMMENT ON TABLE professional_system_settings IS 'System-wide configuration settings';
COMMENT ON TABLE user_onboarding_data IS 'User onboarding completion and consent data';
COMMENT ON TABLE professional_applications IS 'Professional onboarding applications';
COMMENT ON TABLE professional_session_analytics IS 'Analytics data for professional sessions';
COMMENT ON TABLE professional_system_logs IS 'Audit logs for professional system actions';

