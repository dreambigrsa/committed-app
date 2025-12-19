-- ============================================
-- ENABLE QUIET HOURS ENFORCEMENT CRON JOB
-- Runs every 15 minutes to enforce quiet hours
-- for all professionals
-- ============================================

-- Check if pg_cron extension is available
DO $$
BEGIN
  -- Check if extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule existing job if it exists
    PERFORM cron.unschedule('enforce-quiet-hours');

    -- Schedule the job to run every 15 minutes
    PERFORM cron.schedule(
      'enforce-quiet-hours',
      '*/15 * * * *', -- Every 15 minutes
      $$
      SELECT
        net.http_post(
          url := current_setting('app.settings.supabase_url') || '/functions/v1/enforce-quiet-hours',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
          ),
          body := '{}'::jsonb
        ) AS request_id;
      $$
    );

    RAISE NOTICE 'Quiet hours enforcement cron job scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension is not available. Quiet hours enforcement cron job not scheduled.';
    RAISE NOTICE 'To enable, install pg_cron extension or use external cron service to call /functions/v1/enforce-quiet-hours';
  END IF;
END $$;

