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

**Option A: Quick Fix (Recommended)**
1. **Go to your Supabase project dashboard** (https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. **Open the file:** `migrations/fix-legal-acceptances-rls-quick.sql`
6. **Copy ALL the SQL** (from `-- ============================================` to the end)
7. **Paste into Supabase SQL Editor**
8. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
9. You should see a table with 3 policies listed

**Option B: Full Migration**
1. Follow the same steps but use `migrations/add-legal-acceptances-rls-policy.sql` instead

### Step 2: Verify It Worked

Run this in Supabase SQL Editor to verify:

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'user_legal_acceptances';
```

You should see 3 policies:
- `Users can view own legal acceptances` (SELECT)
- `Users can insert own legal acceptances` (INSERT) 
- `Users can update own legal acceptances` (UPDATE)

If you see any errors when running the migration:
- Make sure you copied the ENTIRE SQL (all lines)
- Check that the table `user_legal_acceptances` exists
- Try the quick fix version first

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

