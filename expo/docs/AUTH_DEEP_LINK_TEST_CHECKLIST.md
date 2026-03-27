# Auth Deep Link – Manual Test Checklist

Use this after deploying the auth callback / redirect URL fixes to verify Email Verification and Reset Password on Web and Mobile.

## Prerequisites

- **Web**: Supabase project URL redirect allowlist includes your web origin (e.g. `http://localhost:8081`, or production origin).
- **Mobile**: Supabase allowlist includes `committed://auth-callback` (and `committed://auth-callback?type=recovery` if required).
- **Dev**: In dev, use `getAuthRedirectUrl('verify')` / `getAuthRedirectUrl('recovery')` so web uses `origin/auth-callback` and native uses `committed://auth-callback`.

---

## 1. Web – Email verification link

1. Sign up with a new email on web (e.g. `http://localhost:8081`).
2. Open the verification email and click the link.
3. **Expected**: Browser opens your app at `/auth-callback`, then redirects to `/verify-email`. After email is confirmed (or already confirmed), app routes to onboarding/home.
4. **Failure**: Stuck on blue loader, or routed to `/auth` (sign up).

---

## 2. Web – Reset password link

1. On web, request “Forgot password” with an existing email.
2. Open the reset email and click the link.
3. **Expected**: Browser opens app at `/auth-callback`, then redirects to `/reset-password`. User can set new password, then is sent to sign in.
4. **Failure**: Lands on Sign Up or generic auth screen instead of Reset Password.

---

## 3. Mobile – Email verification (cold start)

1. Fully close the app.
2. Sign up with a new email on the same device (or use a verification link sent to that device).
3. Open the verification link from the email app (cold start).
4. **Expected**: App opens, shows auth callback briefly, then `/verify-email`, then onboarding/home when verified.
5. **Failure**: App opens then routes to `/auth` or spins forever.

---

## 4. Mobile – Email verification (warm start)

1. Keep the app open (e.g. on home or auth).
2. Open the verification link from the email app (same or other device; use a link that targets the app if applicable).
3. **Expected**: App comes to foreground, handles link, navigates to `/verify-email` (then onboarding/home when verified).
4. **Failure**: Link ignored or user sent to `/auth`.

---

## 5. Mobile – Reset password (cold start)

1. Fully close the app.
2. Request “Forgot password” from web or another device; receive reset email on the test device.
3. Open the reset link from the email app (cold start).
4. **Expected**: App opens, handles callback, then shows `/reset-password`. User sets new password and is redirected to sign in.
5. **Failure**: App opens then shows Sign Up or infinite loader.

---

## 6. Mobile – Reset password (warm start)

1. Keep the app open.
2. Open the reset link from the email app (warm start).
3. **Expected**: App handles link and shows `/reset-password`; user can complete flow.
4. **Failure**: Link ignored or user sent to `/auth`.

---

## 7. Expired / invalid link

1. Use an expired or invalid auth link (e.g. verification or reset already used, or bogus token).
2. **Expected**: Within ~12s max, user sees “Link expired or invalid” (or similar) with actions like “Request new link” and “Back to Sign In”. No infinite blue loader.
3. **Failure**: Loader spins forever.

---

## 8. Reset password – paste link (web)

1. On web, request "Forgot password", then copy the recovery link from the email.
2. Paste the link into the browser address bar and open it.
3. **Expected**: App opens at `/auth-callback`, then goes **directly** to `/reset-password` (no "Link expired or invalid" or "Recovery session expired" first). User may see a brief "Preparing reset…" loader, then the Set new password form.
4. **Failure**: "Link expired or invalid" or "Recovery session expired" appears before the reset form.

---

## 9. Reset password – tap link (mobile cold/warm)

1. Request reset, then on device open the reset link from the email (cold: app closed; warm: app open).
2. **Expected**: App opens or comes to foreground, handles callback, then shows `/reset-password` directly (brief "Preparing reset…" allowed). User can set new password.
3. **Failure**: "Recovery session expired" or error screen first; or link ignored.

---

## 10. Slow network

1. Throttle network (e.g. DevTools Slow 3G) and open a **valid** recovery link (web or mobile).
2. **Expected**: Brief loader, then "Preparing reset…" (up to ~3s), then reset password form. No "expired" screen.
3. **Failure**: "Link expired or invalid" or "Recovery session expired" while exchange is still in progress.

---

## Dev-only logs to trace

In dev, console should show:

- **Incoming URL**: `[AUTH_CALLBACK] url: ...` (redacted).
- **Parsed params**: `[AUTH_CALLBACK] parsed params: type=recovery|verify, code=..., token=...`.
- **Intent**: Implied by `type=recovery` vs `type=verify`.
- **Exchange method**: `[AUTH_CALLBACK] exchangeCodeForSession: ok` or `setSession: ok` (or error).
- **Final navigation**: `[AUTH_CALLBACK] final navigation target: /reset-password` or `/verify-email`.

Use these to confirm the correct URL is received, intent is recovery vs verify, and the right route is used after exchange.

- **Full URL (redacted)**: `[AUTH_CALLBACK] full URL received (redacted): ...`
- **Exchange path**: `[AUTH_CALLBACK] exchange path chosen: code | tokens | code-fallback`
- **Session before/after**: `[AUTH_CALLBACK] session state before exchange: ...` and `session after exchange: exists | missing after poll`
- **Navigation**: `[AUTH_CALLBACK] final navigation target: /reset-password` or `/verify-email`
