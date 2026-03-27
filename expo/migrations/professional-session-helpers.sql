-- Helper functions for professional session management
-- Run this after professional-system-schema.sql

-- Function to increment professional session count
CREATE OR REPLACE FUNCTION increment_professional_session_count(prof_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE professional_status
  SET current_session_count = current_session_count + 1,
      updated_at = NOW()
  WHERE professional_id = prof_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement professional session count
CREATE OR REPLACE FUNCTION decrement_professional_session_count(prof_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE professional_status
  SET current_session_count = GREATEST(0, current_session_count - 1),
      updated_at = NOW()
  WHERE professional_id = prof_id;
END;
$$ LANGUAGE plpgsql;

