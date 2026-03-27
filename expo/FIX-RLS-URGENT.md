# 🚨 URGENT: Fix RLS Error - Step by Step

## The Error
```
Error saving legal acceptances: { 
  "message": "new row violates row-level security policy for table \"user_legal_acceptances\"", 
  "code": "42501" 
}
```

## ⚠️ This MUST be fixed in Supabase - Cannot be fixed from code

This is a **database configuration issue**. The RLS (Row-Level Security) policies are missing. You **MUST** run SQL in your Supabase dashboard.

---

## ✅ FIX IT NOW - 5 Simple Steps

### Step 1: Open Supabase
1. Go to **https://supabase.com/dashboard**
2. **Log in** to your account
3. **Click on your project** (the one for this app)

### Step 2: Open SQL Editor
1. In the **left sidebar**, click **"SQL Editor"**
2. Click the **"New Query"** button (top right, green button)

### Step 3: Copy the SQL
1. **Open this file:** `migrations/FIX-RLS-NOW.sql`
2. **Select ALL text** (Ctrl+A or Cmd+A)
3. **Copy it** (Ctrl+C or Cmd+C)

### Step 4: Paste and Run
1. **Paste** into the Supabase SQL Editor (Ctrl+V or Cmd+V)
2. Click the **green "Run" button** (or press `Ctrl+Enter` / `Cmd+Enter`)
3. **Wait** for it to complete (should take 1-2 seconds)

### Step 5: Verify It Worked
After running, you should see a **table with 3 rows**:
```
policyname                           | cmd
Users can insert own legal acceptances | INSERT
Users can update own legal acceptances | UPDATE
Users can view own legal acceptances   | SELECT
```

**If you see 3 policies listed = ✅ IT WORKED!**

---

## 🧪 Test It
1. Try signing up a new user in your app
2. Accept the legal documents
3. The error should be **GONE** ✅

---

## ❌ If You Get Errors

### "Table does not exist"
- Make sure you're in the **correct Supabase project**
- Check that `user_legal_acceptances` table exists

### "Permission denied"
- Make sure you're logged in as **project owner/admin**
- You need admin privileges to create RLS policies

### "Policy already exists"
- This is OK! The SQL uses `DROP POLICY IF EXISTS` so it's safe to run multiple times
- Just run it again

---

## 📁 Files
- **Simple fix:** `migrations/FIX-RLS-NOW.sql` ← **USE THIS ONE**
- Alternative: `migrations/fix-legal-acceptances-rls-quick.sql`
- Full migration: `migrations/add-legal-acceptances-rls-policy.sql`

---

## ⏱️ Time Required
- **2 minutes** to fix
- **One-time setup** - never need to do this again

---

## 💡 Why This Happens
Supabase uses Row-Level Security (RLS) to protect your data. The `user_legal_acceptances` table has RLS enabled, but the policies that allow users to insert their own records are missing. This SQL creates those policies.

---

**Once you run the SQL, the error will be completely fixed!** ✅

