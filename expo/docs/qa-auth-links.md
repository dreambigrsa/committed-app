# QA Checklist: Auth Links, Deep Links & Download Flows

Execute each scenario and check off when verified.

---

## FLOW 1: Download from website

### Desktop
- [ ] User clicks "Download App" on homepage → Opens QR modal with:
  - [ ] QR code pointing to /download
  - [ ] App Store button
  - [ ] Google Play button
  - [ ] Copy link button works
- [ ] User clicks "Download" in navbar/footer → Same modal or navigates to /download
- [ ] /download route on desktop shows store links + QR + troubleshooting

### Mobile iOS
- [ ] User clicks "Download App" → Attempts deep link (committed://download), then ~900ms fallback to App Store
- [ ] Visiting /download on iOS redirects to App Store

### Mobile Android
- [ ] User clicks "Download App" → Attempts deep link, then ~900ms fallback to Play Store
- [ ] Visiting /download on Android redirects to Play Store

---

## FLOW 2: Get Started / Sign Up

### Mobile
- [ ] User clicks "Sign Up" / "Get Started" → Attempts committed://signup, fallback to store after ~900ms
- [ ] Visiting /sign-up shows "Open App to Sign Up" + store fallback

### Desktop
- [ ] User clicks "Sign Up" / "Get Started" → Navigates to /sign-up page
- [ ] /sign-up shows "Open App to Sign Up" + QR (if applicable) + Download link

---

## FLOW 3: Email verification link

### From email (link = /auth-callback?type=verify&token=...)

### Web
- [ ] Click verification link on desktop → Shows loading, then success or error
- [ ] Success: "Email verified" + "Open in App" + QR + Download link
- [ ] Error: "Link invalid or expired" + Resend verification form (email input + Send)
- [ ] Resend form: Enter email, click Send → Shows confirmation message

### Mobile
- [ ] Click link on phone with app installed → App opens to verification flow (app handles committed://auth-callback)
- [ ] Click link on phone without app → Web opens, shows success/error, "Open in App" tries deep link

### Edge cases
- [ ] Expired token → Error state with resend option
- [ ] Invalid/missing token → "Invalid or expired link" with resend option
- [ ] Already used token → Error state
- [ ] No params → "Invalid or expired link"

---

## FLOW 4: Password reset link

### From email (link = /auth-callback?type=recovery&token=...)

### Web
- [ ] Click reset link → Redirects to /reset-password?token=...
- [ ] Reset form: Enter new password, confirm → Success
- [ ] Success: "Password updated" + "Open App to Sign In" + Download link

### No token / Error
- [ ] /reset-password with no token → "Invalid or expired link" + Request new reset form
- [ ] Form submit error (expired, used) → "Couldn't update password" + Request new reset form
- [ ] Request new reset: Enter email, Send → Confirmation message

### Mobile
- [ ] Click link with app → App opens to reset flow
- [ ] Click link without app → Web handles, user can reset password on web

---

## ROUTES

- [ ] /download — Smart redirect (iOS→App Store, Android→Play Store, Desktop→full page)
- [ ] /auth-callback — Handles type=verify (calls API, shows success/error) and type=recovery (redirects to /reset-password)
- [ ] /verify-email — Still works for legacy links with ?token=...
- [ ] /reset-password — Form for new password, request-reset on error
- [ ] /sign-up — "Continue in app" screen
- [ ] /sign-in — "Continue in app" screen
- [ ] /open?target=... — Deep link attempt + fallback UI

---

## EDGE CASES

- [ ] Expired token (verify) → Error + resend
- [ ] Expired token (reset) → Error + request new
- [ ] Invalid token → Error state, no blank screen
- [ ] Missing params on /auth-callback → Error state
- [ ] Double-click on link → No duplicate submissions
- [ ] Link opened in in-app browser → Works (web flow)

---

## CONFIGURATION

Ensure these env vars are set:
- `NEXT_PUBLIC_SITE_URL` — Web base URL
- `NEXT_PUBLIC_DEEPLINK_SCHEME` — committed://
- `NEXT_PUBLIC_APP_STORE_URL` — iOS store URL
- `NEXT_PUBLIC_PLAY_STORE_URL` — Android store URL
- `NEXT_PUBLIC_SUPABASE_FUNCTIONS_BASE` — Supabase edge functions URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

Supabase functions need:
- `APP_WEB_URL` — Same as SITE_URL
- `APP_DEEPLINK_BASE` — committed://

---

## DEEP LINK ROUTES SUPPORTED

| Route | Purpose |
|-------|---------|
| committed://signup | Sign up flow |
| committed://sign-in | Sign in |
| committed://download | Download / open app |
| committed://auth-callback?type=verify&token=... | Email verification |
| committed://auth-callback?type=recovery&token=... | Password reset |
| committed://support | Support |
| committed://register-relationship | Couples flow |
| committed://verify-profile | Profile verification |

---

## QA RESULTS SUMMARY

| Scenario | Pass | Fail | Notes |
|----------|------|------|-------|
| Download desktop | | | |
| Download iOS | | | |
| Download Android | | | |
| Sign up mobile | | | |
| Sign up desktop | | | |
| Verify email web | | | |
| Verify email mobile | | | |
| Reset password web | | | |
| Reset password mobile | | | |
| Resend verification | | | |
| Request new reset | | | |
