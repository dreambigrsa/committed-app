# 🔗 Auth Callback URL Configuration Guide

## What is the Auth Callback URL?

The auth callback URL is where Supabase redirects users after they:
- Click email verification links
- Click password reset links
- Complete OAuth authentication
- Complete any authentication flow

Your app supports **both** native (mobile) and web. The redirect URL is chosen per platform:
- **Native (iOS/Android):** `committed://auth-callback` — opens the mobile app
- **Web:** `https://committed.dreambig.org.za/auth-callback` — stays in browser

---

## Your App's Auth Callback URLs

**Scheme:** `committed`  
**Native:** `committed://auth-callback`  
**Web:** `https://committed.dreambig.org.za/auth-callback`

---

## Supabase Configuration

### Step 1: Configure Site URL

1. Go to **Supabase Dashboard**
2. Navigate to: **Authentication → URL Configuration**
3. Set **Site URL** to:
   ```
   https://committed.dreambig.org.za
   ```

### Step 2: Add Redirect URLs

In the same section, add **all** of these **Redirect URLs**:

```
committed://auth-callback
https://committed.dreambig.org.za/auth-callback
https://committed.dreambig.org.za
https://committed.dreambig.org.za/reset-password
committed://*
```

**Why multiple URLs?**
- `committed://auth-callback` - Native app deep link (email link on phone opens app)
- `https://committed.dreambig.org.za/auth-callback` - Web auth callback (verify/reset links)
- `https://committed.dreambig.org.za` - Web root
- `https://committed.dreambig.org.za/reset-password` - Web reset page
- `committed://*` - Wildcard for native app flexibility

---

## How It Works

### Email Verification Flow

1. User signs up → Supabase sends verification email
2. User clicks link in email → Link contains: `committed://auth-callback?code=...`
3. Mobile OS opens your app → Routes to `/auth-callback` screen
4. App processes the code → Exchanges code for session
5. User is logged in → Redirected to home screen

### Password Reset Flow

1. User requests password reset → Supabase sends reset email
2. User clicks link → Link contains: `committed://auth-callback?code=...` (native) or `https://.../#access_token=...&type=recovery` (web)
3. App opens / lands on web → Layout redirects recovery hash to `/auth-callback`; auth-callback or index redirects to `/reset-password`
4. User sets new password → `updateUser({ password })`; then sign out and redirect to `/auth` to sign in with new password

---

## Current Code Configuration

Your app is already configured correctly:

**File:** `app/auth-callback.tsx`
- Handles the callback URL
- Exchanges code for session
- Redirects to home on success

**Files with redirect URLs:**
- `app/verify-email.tsx` - Uses `committed://auth-callback`
- `contexts/AppContext.tsx` - Uses `committed://auth-callback` for password reset

---

## Important Notes

### Both URLs Are Required

- **Native app:** Use `committed://auth-callback` — opens the mobile app when user clicks link on phone
- **Web app:** Use `https://committed.dreambig.org.za/auth-callback` — when user clicks link on desktop, they stay in browser and get logged in

The app picks the correct URL automatically via `getAuthRedirectUrl()` in `lib/auth-redirect.ts`.

---

## Testing the Configuration

### Test Email Verification

1. Sign up with a new account
2. Check your email
3. Click the verification link
4. **Expected:** App should open automatically (not browser)
5. **Expected:** You should be logged in and redirected to home

### Test Password Reset

1. Go to login screen → "Forgot Password"
2. Enter your email
3. Check your email
4. Click the reset link
5. **Expected:** App should open
6. **Expected:** You can set a new password

---

## Troubleshooting

### Problem: Link opens in browser instead of app

**Solution:**
- Check Supabase Site URL is set to `committed://auth-callback`
- Check Redirect URLs include `committed://*`
- Rebuild the app after changing `app.json` scheme

### Problem: "Invalid redirect URL" error

**Solution:**
- Ensure `committed://auth-callback` is in Supabase Redirect URLs
- Check the URL in code matches exactly (case-sensitive)
- Clear app cache and try again

### Problem: App opens but shows error

**Solution:**
- Check `app/auth-callback.tsx` is handling the URL correctly
- Check console logs for specific error messages
- Verify the code exchange is working

---

## Summary

| Setting | Value |
|---------|-------|
| **App Scheme** | `committed` |
| **Supabase Site URL** | `https://committed.dreambig.org.za` |
| **Supabase Redirect URLs** | `committed://auth-callback`, `https://committed.dreambig.org.za/auth-callback`, `https://committed.dreambig.org.za`, `https://committed.dreambig.org.za/reset-password`, `committed://*` |

---

**Required:** Add both redirect URLs in Supabase Dashboard.  
**Native users** (phone): Link opens app via `committed://auth-callback`.  
**Web users** (desktop): Link opens web app at `/auth-callback` and auto-logs them in.

