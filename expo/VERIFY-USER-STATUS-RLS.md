# ✅ Verify User Status RLS Fix

## 🔍 How to Check if Migration Worked

After running `migrations/FIX-USER-STATUS-RLS-COMPLETE.sql`, run this verification query in Supabase SQL Editor:

```sql
-- Check if policies exist
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'user_status'
ORDER BY policyname;
```

**Expected Result:** You should see 4 policies:
1. `Users can delete own status` - DELETE
2. `Users can insert own status` - INSERT
3. `Users can select statuses` - SELECT
4. `Users can update own status` - UPDATE

## ❌ If Still Getting Errors

If you're still seeing RLS errors after running the migration:

1. **Check if RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'user_status';
   ```
   Should show `rowsecurity = true`

2. **Check current policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'user_status';
   ```

3. **Manually drop and recreate (if needed):**
   ```sql
   -- Disable RLS temporarily
   ALTER TABLE user_status DISABLE ROW LEVEL SECURITY;
   
   -- Re-enable RLS
   ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;
   
   -- Then run the migration again
   ```

4. **Test with a direct query:**
   ```sql
   -- This should work if policies are correct
   -- (Replace with your actual user_id)
   SELECT * FROM user_status WHERE user_id = auth.uid();
   ```

## 🎯 Success Indicators

After the migration works, you should see:
- ✅ No more `403 Forbidden` errors for `user_status` POST requests
- ✅ No more `406 Not Acceptable` errors for `user_status` GET requests
- ✅ Status data loading correctly in the app
- ✅ `StatusStoriesBar` showing statuses (not empty)

