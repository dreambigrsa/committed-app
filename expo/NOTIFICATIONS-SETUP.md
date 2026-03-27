# Notifications RLS Policy Setup

## Problem
When users try to end relationships, they get an RLS policy error (code 42501) and the partner doesn't receive a notification. This prevents the end relationship feature from working properly.

## Solution
This migration adds:
1. An INSERT RLS policy for the notifications table
2. A `create_notification` SECURITY DEFINER function that bypasses RLS safely

## How to Fix

### Step 1: Run the Migration
1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste the entire contents of `migrations/add-notifications-insert-policy.sql`
4. Click **Run** to execute the migration

### Step 2: Verify the Migration
After running, verify that:
- The policy was created: Check **Authentication > Policies** for the `notifications` table
- The function was created: Check **Database > Functions** for `create_notification`

### Step 3: Test
1. Try ending a relationship
2. The partner should receive a notification
3. No RLS errors should appear

## What This Migration Does

### 1. RLS Policy
Creates a policy that allows any authenticated user to insert notifications:
```sql
CREATE POLICY "Users can create notifications" ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

### 2. SECURITY DEFINER Function
Creates a function that safely creates notifications while bypassing RLS:
- Verifies the caller is authenticated
- Inserts the notification
- Returns the notification ID

This function is used by the app code as a fallback when direct INSERT fails.

## Important Notes

- **Security**: The function uses `SECURITY DEFINER` which means it runs with the privileges of the function owner (usually the postgres superuser), but it still verifies that the caller is authenticated.

- **Why Both?**: We include both the policy and the function because:
  - The policy allows direct INSERTs (simpler, faster)
  - The function provides a fallback if the policy doesn't work in certain scenarios
  - The app code tries the function first, then falls back to direct INSERT

## Troubleshooting

If you still get RLS errors after running the migration:

1. **Check if the migration ran successfully**: Look for any errors in the SQL Editor output
2. **Verify the policy exists**: 
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can create notifications';
   ```
3. **Verify the function exists**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'create_notification';
   ```
4. **Check RLS is enabled**:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'notifications';
   ```

If issues persist, you may need to:
- Drop and recreate the policy
- Grant explicit permissions to the authenticated role
- Check if there are conflicting policies

