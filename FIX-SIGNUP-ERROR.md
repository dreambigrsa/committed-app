# 🔧 Fix "Database error saving new user" Error

## The Problem
You're getting `AuthApiError: Database error saving new user` when users try to sign up. This happens when the database trigger `handle_new_user()` fails during user creation.

## Common Causes
1. **Duplicate phone number** - Phone number already exists in the database
2. **Duplicate email** - Email already exists (shouldn't happen, but possible)
3. **RLS policy blocking** - Row Level Security policies preventing the insert
4. **Constraint violations** - Other database constraints failing

## The Solution

### Step 1: Run the Fix SQL Script

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on **"SQL Editor"** in the left sidebar
4. Click **"New Query"**
5. Open the file `migrations/fix-signup-database-error.sql` from your project
6. Copy the entire contents
7. Paste into the SQL Editor
8. Click **"Run"**

This script will:
- ✅ Fix the trigger to handle duplicate phone numbers gracefully
- ✅ Handle all constraint violations without failing auth creation
- ✅ Ensure RLS policies allow the trigger to work
- ✅ Generate unique phone numbers if duplicates are found
- ✅ Log warnings instead of failing the entire signup

### Step 2: Verify the Fix

After running the SQL script, check:

1. **Trigger exists:**
   ```sql
   SELECT tgname, tgrelid::regclass, proname
   FROM pg_trigger t
   JOIN pg_proc p ON t.tgfoid = p.oid
   WHERE tgname = 'on_auth_user_created';
   ```

2. **Test signup:**
   - Try creating a new user account
   - The signup should now succeed even if there are minor issues

### Step 3: Check for Existing Issues

The script will also show you if there are existing auth users without profiles:

```sql
SELECT 
  au.id,
  au.email,
  CASE WHEN u.id IS NULL THEN 'MISSING PROFILE' ELSE 'HAS PROFILE' END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL;
```

If you find users without profiles, you can manually create them or they'll be created on their next login attempt.

## What Changed

The improved trigger now:
- **Checks for duplicate phone numbers** before inserting
- **Generates unique phone numbers** if duplicates are found
- **Handles all constraint violations** gracefully (unique, foreign key, check)
- **Uses ON CONFLICT** clauses to handle conflicts
- **Logs warnings** instead of failing auth creation
- **Always returns NEW** so auth user creation succeeds

## If It Still Fails

If you still get errors after running the script:

1. **Check Supabase logs:**
   - Dashboard → Logs → Database
   - Look for the specific error message
   - Check for constraint violations

2. **Check for duplicate data:**
   ```sql
   -- Check for duplicate phone numbers
   SELECT phone_number, COUNT(*) 
   FROM users 
   GROUP BY phone_number 
   HAVING COUNT(*) > 1;
   
   -- Check for duplicate emails
   SELECT email, COUNT(*) 
   FROM users 
   GROUP BY email 
   HAVING COUNT(*) > 1;
   ```

3. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'users';
   ```

4. **Share the error details** for further debugging

## Alternative: Use the Existing Fix

If you prefer, you can also use the existing `supabase-fix-trigger.sql` file, which has been updated with similar improvements. Both files will fix the issue.

## Prevention

To prevent this issue in the future:
- ✅ Always normalize phone numbers before storing
- ✅ Check for duplicates before inserting
- ✅ Use the improved trigger that handles errors gracefully
- ✅ Monitor Supabase logs for warnings

