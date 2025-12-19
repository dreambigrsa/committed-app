# Database Setup Requirements for Professional System

## ✅ Already Created (from previous migrations)

### Tables
All tables are created by `migrations/professional-system-schema.sql`:
- `professional_roles`
- `professional_profiles`
- `professional_status`
- `professional_sessions`
- `escalation_rules`
- `escalation_events`
- `professional_reviews`
- `professional_system_settings`
- `user_onboarding_data`
- `professional_applications`
- `professional_session_analytics`
- `professional_system_logs`

### Functions Already Created
From `migrations/professional-session-helpers.sql`:
- ✅ `increment_professional_session_count(prof_id UUID)` - Increments session count
- ✅ `decrement_professional_session_count(prof_id UUID)` - Decrements session count

From `migrations/professional-system-schema.sql`:
- ✅ `get_available_professionals(...)` - Gets available professionals for matching
- ✅ `log_professional_action(...)` - Logs professional system actions
- ✅ `update_professional_rating()` - Trigger function to update ratings
- ✅ `create_professional_status()` - Trigger function to create status on profile creation

## ⚠️ New Functions to Create

### 1. `send_ai_message` RPC Function
**Status**: ✅ Migration created: `migrations/create-send-ai-message-function.sql`

**Location**: Used in:
- `lib/professional-sessions.ts` (for introduction messages)
- `app/messages/[conversationId].tsx` (for AI responses)
- `lib/session-monitor.ts` (for escalation suggestions)

**What it does**: Insert a message from the AI user into a conversation, bypassing RLS policies.

**Required**: ✅ Run `migrations/create-send-ai-message-function.sql` to create this function.

## 🔄 Optional But Recommended

### 2. `check_pending_session_timeouts()` Function
**Status**: ✅ Created in `migrations/professional-session-timeout-handler.sql`

**Purpose**: Automatically checks for pending sessions that have timed out. Should be called periodically (e.g., every 5 minutes).

**Setup**: 
- The function is created by running the migration
- To automate it, you can use pg_cron (if available) or set up an external cron job/service

**If using pg_cron** (uncomment in the migration file):
```sql
SELECT cron.schedule(
  'check-pending-session-timeouts',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT check_pending_session_timeouts();$$
);
```

## 📋 Migration Order

### Database Functions (SQL Migrations)

Run these SQL files in Supabase SQL Editor in order:

1. ✅ `professional-system-schema.sql` - Creates all tables
2. ✅ `professional-session-helpers.sql` - Creates helper functions
3. ✅ `seed-initial-professional-roles.sql` - Seeds initial roles (optional)
4. ⚠️ **REQUIRED**: `create-send-ai-message-function.sql` - Creates AI message sending function
5. ⚠️ **OPTIONAL**: `professional-session-timeout-handler.sql` - Creates timeout checking database function

### Edge Functions (Deploy via Supabase CLI)

1. ⚠️ **OPTIONAL**: Deploy `check-session-timeouts` Edge Function:
   ```bash
   supabase functions deploy check-session-timeouts
   ```

2. ⚠️ **OPTIONAL**: Run `enable-session-timeout-cron.sql` to schedule the timeout checker:
   - First, update the URL in the SQL file with your project reference
   - Then run the migration to set up pg_cron scheduling

## 🧪 Testing

After running migrations, verify:

```sql
-- Check if send_ai_message exists
SELECT proname, proargnames 
FROM pg_proc 
WHERE proname = 'send_ai_message';

-- Check if timeout function exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'check_pending_session_timeouts';

-- Verify all tables exist
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'professional%';
```

## 🔍 Quick Check Script

Run this to see what's missing:

```sql
-- Check for required functions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'send_ai_message'
  ) THEN
    RAISE NOTICE '⚠️ send_ai_message function is MISSING - run create-send-ai-message-function.sql';
  ELSE
    RAISE NOTICE '✅ send_ai_message function exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_pending_session_timeouts'
  ) THEN
    RAISE NOTICE '⚠️ check_pending_session_timeouts function is MISSING - run professional-session-timeout-handler.sql (optional)';
  ELSE
    RAISE NOTICE '✅ check_pending_session_timeouts function exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_professional_session_count'
  ) THEN
    RAISE NOTICE '⚠️ increment_professional_session_count function is MISSING - run professional-session-helpers.sql';
  ELSE
    RAISE NOTICE '✅ increment_professional_session_count function exists';
  END IF;
END $$;
```

