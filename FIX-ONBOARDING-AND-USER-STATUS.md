# 🔧 Fix Onboarding Blink & User Status RLS Errors

## 🐛 Issues Fixed

### 1. Onboarding Screen Blinking/Disappearing
**Problem:** Onboarding screen shows briefly then immediately disappears (blinks)

**Root Cause:** Multiple components checking `hasCompletedOnboarding` status and redirecting, causing race condition

**Fix:**
- Added immediate check on `onboarding.tsx` mount
- If onboarding already completed, redirect immediately without showing screen
- Checks both context state and database directly for accuracy

### 2. User Status RLS Errors
**Problem:** 
- `GET` requests to `user_status` failing with `406 (Not Acceptable)`
- `POST` requests to `user_status` failing with `403 (Forbidden)`
- Error: "new row violates row-level security policy for table 'user_status'"

**Root Cause:** Missing or incorrect RLS policies for `user_status` table, especially for UPSERT operations

**Fix:**
- Created comprehensive RLS policy migration: `migrations/FIX-USER-STATUS-RLS-WITH-UPSERT.sql`
- Policies for INSERT, SELECT, UPDATE, DELETE operations
- Supports UPSERT operations (critical for `on conflict=user_id`)
- Ensures users can only manage their own status
- Allows viewing other users' statuses based on visibility settings

---

## 📋 SQL Migration Required

Run this SQL in Supabase SQL Editor:

**File:** `migrations/FIX-USER-STATUS-RLS-WITH-UPSERT.sql`

This will:
1. Enable RLS on `user_status` table
2. Drop existing policies (if any)
3. Create proper policies for:
   - INSERT (users can insert own status)
   - SELECT (users can view own + others based on visibility)
   - UPDATE (users can update own status)
   - DELETE (users can delete own status)
4. Grant necessary permissions
5. Verify policies were created

---

## ✅ Testing

After running the migration:

1. **Onboarding:**
   - Sign up → Should go to verify-email (if email not verified)
   - After verification → Should show onboarding (not blink)
   - Complete onboarding → Should redirect to home
   - Navigate to `/onboarding` manually → Should redirect immediately if already completed

2. **User Status:**
   - Check console - no more 406/403 errors for `user_status`
   - User status should load correctly
   - Status updates should work without RLS errors

---

## 📝 Files Changed

- `app/onboarding.tsx` - Added redirect check on mount
- `migrations/FIX-USER-STATUS-RLS-WITH-UPSERT.sql` - New RLS policy migration

