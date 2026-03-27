# 📧 Email Verification Flow - Complete Explanation

## How Email Verification Works After Signup

### The Flow:

1. **User Signs Up** (`app/auth.tsx`)
   - User enters name, email, phone, password
   - User accepts legal documents
   - Code calls `signup()` function

2. **Supabase Creates Auth User**
   - Supabase's `auth.signUp()` creates user in `auth.users` table
   - ✅ User account is **created**
   - ❌ Email is **NOT confirmed yet** (`email_confirmed_at` is `NULL`)
   - Supabase **automatically sends verification email**

3. **User Record Created**
   - Database trigger `handle_new_user()` creates record in `public.users` table
   - This happens automatically via trigger

4. **Legal Acceptances Saved**
   - Code tries to save legal acceptances using database function
   - Function bypasses RLS (Row-Level Security) during signup

5. **Redirect to Verify Email Screen**
   - Code checks: `email_confirmed_at` is `NULL` (not confirmed)
   - Redirects to `/verify-email` screen
   - Shows instructions to check email and click verification link

6. **User Clicks Email Link**
   - Supabase sends email with verification link
   - Link looks like: `https://[project].supabase.co/auth/v1/verify?token=...&redirect_to=committed://auth-callback`
   - When clicked, Supabase confirms email (`email_confirmed_at` is set)
   - User is redirected back to app via `committed://auth-callback` URL

7. **App Receives Callback** (`app/auth-callback.tsx`)
   - App opens via deep link `committed://auth-callback`
   - Code exchanges the token for a session: `exchangeCodeForSession()`
   - Session now has confirmed email (`email_confirmed_at` is set)
   - AppContext loads user data
   - Redirects to onboarding or home based on status

8. **Verify Email Screen Checks Status** (`app/verify-email.tsx`)
   - Screen polls every 3 seconds checking `email_confirmed_at`
   - When `email_confirmed_at` is NOT NULL, email is verified
   - Automatically redirects to onboarding or home

---

## Why Email Verification When User Already Exists?

**Question:** "How will it verify email when auth user is already created?"

**Answer:** 
- The auth user **IS created** during signup ✅
- But the email is **NOT confirmed** ❌
- Email confirmation happens **after** signup, when user clicks the link

This is the **standard Supabase/Auth0 flow**:
1. Create user → User exists but email not confirmed
2. Send verification email → User receives email
3. User clicks link → Email gets confirmed (`email_confirmed_at` is set)
4. User can now use app → Email is verified

**Why this approach?**
- Prevents fake/spam accounts
- Ensures email address is valid
- User has control over when to verify
- Can resend email if needed

---

## The White Screen Issue

**Problem:** White screen appears after signup before redirecting to verify-email

**Cause:**
- `setIsLoading(false)` is called
- Then `setTimeout(100ms)` before redirect
- During that 100ms, the screen might be blank
- Or the redirect might fail silently

**Fix:**
- Keep loading indicator visible until redirect completes
- Show a loading message during transition
- Ensure redirect happens immediately

---

## Code Flow Diagram

```
Signup Form
    ↓
signup() function
    ↓
Supabase auth.signUp()
    ↓
✅ Auth user created (email_confirmed_at = NULL)
    ↓
Database trigger creates public.users record
    ↓
Save legal acceptances (via function)
    ↓
Check email_confirmed_at
    ↓
Is NULL? → Redirect to /verify-email
Is NOT NULL? → Redirect to / (home)
    ↓
User checks email
    ↓
Clicks verification link
    ↓
Supabase confirms email (sets email_confirmed_at)
    ↓
App receives callback (committed://auth-callback)
    ↓
exchangeCodeForSession()
    ↓
Session now has confirmed email
    ↓
Redirect to onboarding or home
```

---

## Key Points

1. **Auth user is created immediately** - User exists in `auth.users`
2. **Email is NOT confirmed** - `email_confirmed_at` is `NULL`
3. **Verification is separate step** - Happens when user clicks email link
4. **Session updates after verification** - `email_confirmed_at` is set in session
5. **App checks status** - Polls or checks session to see if verified
6. **Redirect happens automatically** - Once verified, user is redirected

This is the **standard flow** used by all major apps (Gmail, Facebook, etc.)

