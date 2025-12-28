# Permanent Fix for Notification Errors

## Problems Fixed

### 1. RLS Policy Errors (Code 42501)
Users were getting RLS (Row Level Security) policy errors when trying to end relationships:
```
"new row violates row-level security policy for table \"notifications\""
```

### 2. CHECK CONSTRAINT Violations (Code 23514)
Users were getting CHECK CONSTRAINT violations when trying to create notifications:
```
"new row for relation \"notifications\" violates check constraint \"notifications_type_check\""
```

This happened because notification types like `relationship_end_request` and `false_relationship_resolved` were not included in the database constraint.

## Root Cause
The code was falling back to direct INSERT when the RPC function failed, which always fails due to RLS policies. The RPC function (`create_notification`) must exist and be used exclusively.

## Permanent Solution

### 1. Updated Migration (`migrations/add-notifications-insert-policy.sql`)
- **Drops and recreates** the function to ensure it exists
- **Adds GRANT permissions** to authenticated role
- **Validates all parameters** before inserting
- **Uses SECURITY DEFINER** to bypass RLS safely
- **Updates CHECK CONSTRAINT** to include ALL notification types used in the app:
  - `relationship_end_request` (for end relationship feature)
  - `false_relationship_resolved` (for false relationship reports)
  - All other notification types from the TypeScript definition

### 2. Updated Code (`contexts/AppContext.tsx`)
- **Removed fallback to direct INSERT** - this was causing the RLS errors
- **Always uses RPC function** - the only reliable way to create notifications
- **Better error messages** - tells users exactly what to do if migration isn't run
- **Proper error handling** - distinguishes between function missing vs RLS errors vs CHECK constraint errors

## How to Fix (ONE TIME SETUP)

### Step 1: Run the Migration
1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy the **ENTIRE** contents of `migrations/add-notifications-insert-policy.sql`
4. Paste into SQL Editor
5. Click **Run**
6. Verify no errors occurred

### Step 2: Verify It Worked
Run this query in SQL Editor:
```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'create_notification';

-- Check if policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'notifications' 
AND policyname = 'Users can create notifications';
```

Both should return results.

## Why This Works

1. **SECURITY DEFINER Function**: The `create_notification` function runs with elevated privileges, bypassing RLS
2. **No Fallback**: Code no longer tries direct INSERT which always fails
3. **Clear Errors**: If migration isn't run, users get a clear message telling them what to do
4. **Validated Parameters**: Function validates all inputs before inserting

## Testing

After running the migration:
1. Try ending a relationship
2. Partner should receive notification
3. No RLS errors should appear
4. Console should show: "✅ Notification created successfully"

## If Errors Persist

1. **Check migration ran**: Verify function exists (see Step 2 above)
2. **Check permissions**: Ensure authenticated role has EXECUTE permission on function
3. **Re-run migration**: Drop and recreate the function
4. **Check RLS is enabled**: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'notifications';`

## Important Notes

- **This is a ONE-TIME setup** - once the migration is run, it works forever
- **The function MUST exist** - code will fail with clear error if it doesn't
- **No more fallbacks** - code only uses the RPC function, which is reliable
- **Migration is idempotent** - safe to run multiple times

