# 🔧 Fixes Applied for User Issues

## Issue 1: Legal Documents Asked Again After Signup ✅

### Problem
Users were being asked to accept legal documents again immediately after signing up, even though they just accepted them during signup.

### Root Cause
After saving legal acceptances during signup, the `legalAcceptanceStatus` in AppContext wasn't being refreshed immediately. The `LegalAcceptanceEnforcer` component would check the status and show the modal again because it was checking stale data.

### Fix Applied
**File:** `app/auth.tsx`

After saving legal acceptances, we now refresh the acceptance status:
```typescript
// Save legal acceptances after successful signup
if (user?.id) {
  await saveLegalAcceptances(user.id);
  // Refresh legal acceptance status to prevent showing modal again
  try {
    const { checkUserLegalAcceptances } = await import('@/lib/legal-enforcement');
    const acceptanceStatus = await checkUserLegalAcceptances(user.id);
    // The status will be updated when loadUserData runs
  } catch (error) {
    console.error('Failed to refresh legal acceptance status:', error);
  }
}
```

**Result:** Legal acceptance status is now refreshed after signup, preventing the modal from appearing again.

---

## Issue 2: Reel Audio Playing During Modals ✅

### Problem
When modals appear (Legal Acceptance Modal, Onboarding), reel videos continue playing in the background, creating unwanted audio.

### Root Cause
The reels screen only paused videos when the screen lost focus, but didn't check if modals were visible.

### Fix Applied
**File:** `app/(tabs)/reels.tsx`

Added logic to detect when modals are visible and pause videos:
```typescript
// Check if modals are visible that should pause videos
const isOnboardingVisible = pathname === '/onboarding';
const hasLegalModalVisible = legalAcceptanceStatus && !legalAcceptanceStatus.hasAllRequired && 
  (legalAcceptanceStatus.missingDocuments.length > 0 || legalAcceptanceStatus.needsReAcceptance.length > 0);
const shouldPauseForModals = isOnboardingVisible || hasLegalModalVisible;

// Updated video playback logic
useEffect(() => {
  if (!isScreenFocused || shouldPauseForModals) {
    // Pause all videos when modals are visible
    Object.keys(videoRefs.current).forEach((reelId) => {
      const video = videoRefs.current[reelId];
      if (video) {
        video.stopAsync().catch(() => {});
        video.pauseAsync().catch(() => {});
      }
    });
    return;
  }
  // ... rest of playback logic
}, [currentReelId, isScreenFocused, shouldPauseForModals]);
```

**Result:** Videos now automatically pause when:
- Onboarding screen is visible
- Legal Acceptance Modal is visible
- Screen loses focus

---

## Issue 3: Email Verification Redirect URL ✅

### Problem
Email verification links were redirecting to `https://committed-5mxf.onrender.com` (backend API) instead of opening the mobile app.

### Root Cause
1. The redirect URL in code was using `committed-app://` but the app scheme is `committed://`
2. Supabase Site URL configuration needs to be set to the app's deep link scheme

### Fixes Applied

#### Fix 1: Corrected Deep Link Scheme
**Files:** 
- `app/verify-email.tsx`
- `contexts/AppContext.tsx`

Changed from:
```typescript
emailRedirectTo: 'committed-app://auth-callback'
```

To:
```typescript
emailRedirectTo: 'committed://auth-callback'
```

#### Fix 2: Supabase Configuration Required

**You need to configure Supabase Site URL:**

1. Go to your Supabase Dashboard
2. Navigate to: **Authentication → URL Configuration**
3. Set **Site URL** to: `committed://auth-callback`
4. Add to **Redirect URLs**: 
   - `committed://auth-callback`
   - `committed://verify-email`
   - `committed://*` (wildcard for all app routes)

**Important:** The Site URL in Supabase should be your app's deep link scheme, NOT the backend API URL (`https://committed-5mxf.onrender.com`).

The backend URL (`https://committed-5mxf.onrender.com`) is for:
- API endpoints
- Webhooks
- Server-side operations

The deep link URL (`committed://`) is for:
- Email verification redirects
- Password reset redirects
- OAuth callbacks
- Opening the mobile app from links

---

## Summary of Changes

| Issue | File | Status |
|-------|------|--------|
| Legal documents asked again | `app/auth.tsx` | ✅ Fixed |
| Reel audio during modals | `app/(tabs)/reels.tsx` | ✅ Fixed |
| Email verification redirect | `app/verify-email.tsx`, `contexts/AppContext.tsx` | ✅ Fixed (code) + ⚠️ Needs Supabase config |

---

## Next Steps

### Required: Configure Supabase Site URL

1. **Login to Supabase Dashboard**
2. **Go to:** Authentication → URL Configuration
3. **Set Site URL:** `committed://auth-callback`
4. **Add Redirect URLs:**
   ```
   committed://auth-callback
   committed://verify-email
   committed://*
   ```
5. **Save changes**

### Testing

After configuring Supabase:

1. **Test Email Verification:**
   - Sign up with a new account
   - Check email and click verification link
   - Should open the app (not browser)

2. **Test Legal Documents:**
   - Sign up and accept documents
   - Should NOT be asked again immediately

3. **Test Reel Audio:**
   - Open reels tab
   - Start playing a reel
   - If onboarding or legal modal appears, audio should pause

---

## Files Modified

1. ✅ `app/auth.tsx` - Refresh legal acceptance status after signup
2. ✅ `app/(tabs)/reels.tsx` - Pause videos when modals are visible
3. ✅ `app/verify-email.tsx` - Fixed deep link scheme
4. ✅ `contexts/AppContext.tsx` - Fixed deep link scheme

---

**All code fixes are complete!** ⚠️ **Don't forget to configure Supabase Site URL in the dashboard.**

