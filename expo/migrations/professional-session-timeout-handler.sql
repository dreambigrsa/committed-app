-- ============================================
-- PROFESSIONAL SESSION TIMEOUT HANDLER
-- Automatic timeout checking and escalation for pending sessions
-- ============================================
-- Run this after professional-system-schema.sql and professional-session-helpers.sql

-- Function to check and handle pending session timeouts
-- This should be called periodically (e.g., via pg_cron every 1-5 minutes)
CREATE OR REPLACE FUNCTION check_pending_session_timeouts()
RETURNS TABLE(
  sessions_checked INTEGER,
  sessions_escalated INTEGER,
  sessions_notified INTEGER
) AS $$
DECLARE
  v_session RECORD;
  v_rule RECORD;
  v_timeout_minutes INTEGER;
  v_sessions_checked INTEGER := 0;
  v_sessions_escalated INTEGER := 0;
  v_sessions_notified INTEGER := 0;
  v_escalation_result JSONB;
BEGIN
  -- Default timeout: 5 minutes if no escalation rule exists
  v_timeout_minutes := 5;

  -- Get all pending sessions that have exceeded the timeout
  FOR v_session IN
    SELECT 
      ps.id,
      ps.conversation_id,
      ps.user_id,
      ps.professional_id,
      ps.role_id,
      ps.created_at,
      ps.escalation_level,
      EXTRACT(EPOCH FROM (NOW() - ps.created_at)) / 60 AS minutes_pending
    FROM professional_sessions ps
    WHERE ps.status = 'pending_acceptance'
      AND ps.created_at < NOW() - INTERVAL '5 minutes'
    ORDER BY ps.created_at ASC
    LIMIT 50 -- Process up to 50 sessions per run
  LOOP
    v_sessions_checked := v_sessions_checked + 1;

    -- Try to find escalation rule for this role
    SELECT er.* INTO v_rule
    FROM escalation_rules er
    WHERE er.role_id = v_session.role_id
      AND er.is_active = true
      AND er.trigger_type = 'timeout'
      AND er.timeout_minutes IS NOT NULL
    ORDER BY er.priority DESC, er.created_at DESC
    LIMIT 1;

    -- Use rule timeout if found, otherwise default
    IF v_rule IS NOT NULL AND v_rule.timeout_minutes IS NOT NULL THEN
      v_timeout_minutes := v_rule.timeout_minutes;
    END IF;

    -- Check if session has exceeded timeout
    IF v_session.minutes_pending >= v_timeout_minutes THEN
      -- Mark this session as needing escalation
      -- The actual escalation logic is handled client-side via escalation-service.ts
      -- But we can log it here for tracking
      
      v_sessions_notified := v_sessions_notified + 1;
      
      -- Update session with timeout reason (optional - helps with analytics)
      UPDATE professional_sessions
      SET escalation_reason = 'Timeout: Professional did not respond within ' || v_timeout_minutes || ' minutes',
          updated_at = NOW()
      WHERE id = v_session.id;
    END IF;
  END LOOP;

  -- Return statistics
  RETURN QUERY SELECT 
    v_sessions_checked,
    v_sessions_escalated,
    v_sessions_notified;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_pending_session_timeouts() TO authenticated;

-- ============================================
-- OPTIONAL: Set up pg_cron to run this function periodically
-- ============================================
-- Uncomment the following if you have pg_cron extension enabled:
-- 
-- SELECT cron.schedule(
--   'check-pending-session-timeouts',
--   '*/5 * * * *', -- Every 5 minutes
--   $$SELECT check_pending_session_timeouts();$$
-- );

COMMENT ON FUNCTION check_pending_session_timeouts() IS 
  'Checks pending professional sessions for timeouts. Should be called periodically via cron or scheduled job. Returns statistics about sessions checked and escalated.';

