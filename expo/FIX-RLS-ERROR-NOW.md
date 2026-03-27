# ⚠️ URGENT: Fix RLS Error - Step by Step Instructions

## The Error You're Seeing

```
Error saving legal acceptances: { 
  "message": "new row violates row-level security policy for table \"user_legal_acceptances\"", 
  "code": "42501" 
}
```

## Why This Happens

The database table `user_legal_acceptances` has Row-Level Security (RLS) enabled, but the policies that allow users to insert their own records are **missing**. This must be fixed in Supabase.

## ✅ SOLUTION - Follow These Steps EXACTLY

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. **Log in** if needed
3. **Click on your project**

### Step 2: Open SQL Editor
1. In the left sidebar, click **"SQL Editor"**
2. Click **"New Query"** button (top right)

### Step 3: Copy the SQL Fix
1. **Open this file in your code editor:** `migrations/fix-legal-acceptances-rls-quick.sql`
2. **Select ALL the text** (Ctrl+A / Cmd+A)
3. **Copy it** (Ctrl+C / Cmd+C)

### Step 4: Paste and Run
1. **Paste into the Supabase SQL Editor** (Ctrl+V / Cmd+V)
2. **Click the green "Run" button** (or press Ctrl+Enter)
3. **Wait for it to complete** - you should see a table showing 3 policies

### Step 5: Verify It Worked
After running, you should see output like:
```
policyname                           | cmd    | ...
Users can insert own legal acceptances | INSERT | ...
Users can update own legal acceptances | UPDATE | ...
Users can view own legal acceptances   | SELECT | ...
```

If you see **3 policies**, it worked! ✅

### Step 6: Test Your App
1. Try signing up a new user
2. Accept the legal documents
3. The error should be **gone**

---

## ❌ If You Get Errors

### Error: "Table does not exist"
- Make sure you're connected to the correct Supabase project
- Check that the table `user_legal_acceptances` exists in your database

### Error: "Permission denied"
- Make sure you're logged into Supabase as a project owner/admin
- You need admin privileges to create RLS policies

### Still seeing the error after running SQL?
1. **Run the verification script:**
   - Open `migrations/verify-legal-acceptances-rls.sql`
   - Copy and run it in Supabase SQL Editor
   - Share the output if you need help

---

## 📝 What This Fix Does

The SQL creates 3 security policies:
1. **SELECT** - Users can view their own legal acceptances
2. **INSERT** - Users can save their own legal acceptances (this fixes your error!)
3. **UPDATE** - Users can update their own legal acceptances

These policies ensure:
- ✅ Users can save legal acceptances during signup
- ✅ Security is maintained (users can only modify their own records)
- ✅ No one else can see or modify your legal acceptances

---

## 🚨 IMPORTANT NOTE

**This error CANNOT be fixed by code changes alone.** The RLS policies are database-level security rules that MUST be created in Supabase. The code changes I made will help with error handling and authentication, but you MUST run the SQL migration to fix the actual error.

