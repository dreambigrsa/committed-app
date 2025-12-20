# 🔗 Auth Callback URL Configuration Guide

## What is the Auth Callback URL?

The auth callback URL is where Supabase redirects users after they:
- Click email verification links
- Click password reset links
- Complete OAuth authentication
- Complete any authentication flow

For mobile apps, this should be a **deep link** that opens your app, not a web URL.

---

## Your App's Auth Callback URL

Based on your `app.json` configuration:

**Scheme:** `committed`  
**Auth Callback URL:** `committed://auth-callback`

---

## Supabase Configuration

### Step 1: Configure Site URL

1. Go to **Supabase Dashboard**
2. Navigate to: **Authentication → URL Configuration**
3. Set **Site URL** to:
   ```
   committed://auth-callback
   ```

### Step 2: Add Redirect URLs

In the same section, add these **Redirect URLs**:

```
committed://auth-callback
committed://verify-email
committed://*
```

**Why multiple URLs?**
- `committed://auth-callback` - Main auth callback (email verification, password reset, OAuth)
- `committed://verify-email` - Specific email verification redirect
- `committed://*` - Wildcard to allow any route in your app (for flexibility)

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
2. User clicks link → Link contains: `committed://auth-callback?code=...`
3. App opens → Processes reset token
4. User sets new password → Completes reset

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

### ❌ Don't Use Backend URL

**Wrong:**
```
https://committed-5mxf.onrender.com/auth-callback
```

**Why?** This is your backend API URL. It's for:
- API endpoints
- Webhooks
- Server-to-server communication

**It won't open your mobile app!**

### ✅ Use Deep Link URL

**Correct:**
```
committed://auth-callback
```

**Why?** This is your app's deep link scheme. It:
- Opens your mobile app
- Routes to the correct screen
- Handles authentication automatically

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
| **Auth Callback URL** | `committed://auth-callback` |
| **Supabase Site URL** | `committed://auth-callback` |
| **Supabase Redirect URLs** | `committed://auth-callback`, `committed://verify-email`, `committed://*` |

---

**Your code is already correct!** ✅  
**Just configure Supabase Dashboard with the URLs above.** ⚙️

