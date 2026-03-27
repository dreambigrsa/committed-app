# 🚨 CRITICAL: Fix Database Errors - Step by Step Guide

Your app is showing these errors because the database needs to be configured. Follow these steps **exactly** to fix it.

---

## ⚡ Quick Fix (5 minutes)

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Click on your project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Run the RLS Fix Script
1. Click **"New Query"**
2. Open the file `supabase-fix-rls.sql` from your project
3. **Copy everything** from that file
4. **Paste** it into the Supabase SQL editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Wait for "Success. No rows returned"

✅ This fixes the "Cannot coerce the result" error

### Step 3: Create Super Admin Account
#### Option A: Create via Supabase Dashboard (Recommended)
1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **"Add user"**
3. Fill in:
   - **Email:** `nashiezw@gmail.com`
   - **Password:** `@12345678`
   - Check **"Auto Confirm User"**
4. Click **"Create user"**
5. The trigger will automatically create your super admin profile

#### Option B: Run SQL Script
1. Click **"New Query"** in SQL Editor
2. Open the file `supabase-create-super-admin.sql`
3. Copy and paste the content
4. Click **"Run"**

### Step 4: Update Super Admin Role (if needed)
If the auto-trigger didn't set the role correctly:
1. Open SQL Editor
2. Run this query:
```sql
UPDATE public.users 
SET role = 'super_admin',
    phone_verified = true,
    email_verified = true,
    id_verified = true
WHERE email = 'nashiezw@gmail.com';
```

### Step 5: Test the Fix
1. **Refresh your app**
2. **Sign in** with:
   - Email: `nashiezw@gmail.com`
   - Password: `@12345678`
3. All pages should now load correctly! ✨

---

## 🔍 What These Scripts Do

**supabase-fix-rls.sql:**
- Fixes Row Level Security policies
- Creates automatic user profile creation
- Migrates existing users

**supabase-create-super-admin.sql:**
- Creates your admin account
- Sets up super admin privileges

---

## ❌ Still Getting Errors?

### Error: "Cannot coerce the result to a single JSON object"
**Solution:** Run `supabase-fix-rls.sql` again

### Error: "Failed to create user record"
**Solution:** 
1. Check if the trigger exists: Database → Functions → look for `handle_new_user`
2. If missing, run `supabase-fix-rls.sql` again

### Error: "User not found in database"
**Solution:**
1. Sign out completely
2. Create the super admin account via Dashboard (Step 3, Option A)
3. Sign in again

### Error: "RLS policy error"
**Solution:**
1. The policies weren't created
2. Re-run `supabase-fix-rls.sql`
3. Verify in: Database → Tables → users → Policies tab

---

## ✅ How to Verify Everything Works

1. **Check Policies:**
   - Go to: Database → Tables → `users` → Policies
   - You should see 3 policies:
     - ✓ Users can view all users
     - ✓ Users can insert own profile
     - ✓ Users can update own profile

2. **Check Trigger:**
   - Go to: Database → Functions
   - You should see: `handle_new_user`

3. **Check Super Admin:**
   - Go to: Authentication → Users
   - Find: `nashiezw@gmail.com`
   - Should show: Confirmed

4. **Test App:**
   - Sign in with super admin
   - Check console - should be no errors
   - All pages should load

---

## 📝 Need More Help?

If you still have issues after following all steps:
1. Check browser console (F12) for detailed errors
2. Check Supabase logs: Dashboard → Logs → Database
3. Verify credentials in `lib/supabase.ts` are correct

---

## 🎯 Summary

1. ✅ Run `supabase-fix-rls.sql` in SQL Editor
2. ✅ Create super admin via Dashboard or SQL
3. ✅ Verify trigger and policies exist
4. ✅ Sign in and test

That's it! Your app should work perfectly now. 🚀
