# Fix Legal Acceptances RLS Policy Error

## Problem

When users try to save legal acceptances during signup or when accepting documents, they get this error:
```
Error saving legal acceptances: { 
  "message": "new row violates row-level security policy for table \"user_legal_acceptances\"", 
  "code": "42501", 
  "details": null, 
  "hint": null 
}
```

## Root Cause

The `user_legal_acceptances` table has Row-Level Security (RLS) enabled, but there are no policies allowing users to INSERT their own legal acceptances. This blocks users from saving their document acceptances.

## Solution

**⚠️ IMPORTANT: You MUST run the SQL migration in Supabase to fix this error.**

The migration file has been created, but it needs to be executed in your Supabase database. The error will continue until you run the SQL commands below.

### Step 1: Run the Migration

1. **Go to your Supabase project dashboard** (https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. **Copy and paste the ENTIRE contents** of `migrations/add-legal-acceptances-rls-policy.sql` into the editor
6. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

**You should see "Success. No rows returned" or similar confirmation message.**

If you see any errors, please check:
- The table `user_legal_acceptances` exists in your database
- You have the correct permissions in Supabase

### Step 2: Verify the Policies

After running the migration, verify that the policies were created:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_legal_acceptances'
ORDER BY policyname;
```

You should see three policies:
1. `Users can view own legal acceptances` (SELECT)
2. `Users can insert own legal acceptances` (INSERT)
3. `Users can update own legal acceptances` (UPDATE)

## What This Fixes

- ✅ Users can save legal acceptances during signup
- ✅ Users can accept documents when prompted
- ✅ Users can re-accept updated documents
- ✅ Users can only view/modify their own acceptances (security maintained)

## Testing

After applying the migration:

1. Try signing up a new user and accepting legal documents
2. Try accepting documents in the Legal Acceptance Modal
3. Verify that acceptances are saved correctly in the database

## Notes

- This migration is **safe to re-run** - it drops existing policies before creating new ones
- The policies ensure users can only insert/update their own acceptances (`auth.uid() = user_id`)
- The `authenticated` role is granted SELECT, INSERT, and UPDATE permissions

