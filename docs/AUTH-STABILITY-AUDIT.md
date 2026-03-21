# Auth, Session & Deep Linking Audit (2025-02)

> **Prompt-complete report (Issues / Root cause / Impact / Fix / Verification):** see **[FULL-STABILITY-AUDIT-REPORT.md](./FULL-STABILITY-AUDIT-REPORT.md)**.  
> **Device QA steps:** **[MANUAL-REGRESSION-CHECKLIST.md](./MANUAL-REGRESSION-CHECKLIST.md)**.

## Summary

Recent fixes target **spurious “logged out”** behaviour on cold start / restart by:

1. **Eliminating a race** where `session` existed in memory but `user` stayed `null` until slow DB hydration finished → `AppGate` treated the user as logged out.
2. **Removing a 4s splash timeout** that set `authLoading === false` **before** `getSession()` finished on slow devices.
3. **Stopping broad logout in `onAuthStateChange`** when `newSession` was null (except `SIGNED_OUT` / failed refresh).
4. **Sign-up path**: `hydrateFromSession` now uses `clearOnError: false` and sets minimal user + tokens before awaiting hydration.

---

## Issues Found (before fixes)

| Issue | Root cause | User impact |
|--------|------------|-------------|
| Logged out after reopen / restart (intermittent) | `isAuthenticated` is `user !== null`. After restore, `setSession(s)` ran but `user` was only set **after** `hydrateFromSession` (several DB round-trips). `AppGate` ran while `user === null` → routes for guests. | Sent to `/` or auth flow despite valid tokens in AsyncStorage. |
| Same symptom on slow networks | `restoreSession` used `setTimeout(..., 4000)` to force `authLoading` false **while** `getSession()` could still be pending. | Splash dismissed; app rendered as logged out until `getSession` eventually completed. |
| Spurious logout on auth events | `onAuthStateChange` had `else { clear all state }` for **any** event with falsy `newSession`. | Rare client/event ordering could clear a valid session from React state. |
| Sign-up then odd auth state | `hydrateFromSession` defaults `clearOnError: true`; transient DB/RLS errors cleared **React** session state (tokens could remain in storage, UI inconsistent). | Confusing “logged out” or mismatched UI after signup. |

---

## Fixes Applied (code)

- **`contexts/AuthContext.tsx` – `restoreSession`**
  - Retry `getSession()` up to 3 times with backoff on transient errors.
  - On success with session: `setSession`, `setAccessToken`, `setRefreshToken`, **`setUser(getMinimalUserFromSession(...))` immediately**, then `hydrateFromSession` in background with `clearOnError: false`.
  - Replaced 4s “force stop” with **25s hang guard** only (logs in dev); **`finishLoading()` only in `finally`** after `getSession` path completes.

- **`contexts/AuthContext.tsx` – `onAuthStateChange`**
  - When `newSession` is present: set tokens + **minimal user** before `await hydrateFromSession`.
  - Removed generic `else { clear }`; rely on `restoreSession` for empty cold start and `SIGNED_OUT` / `TOKEN_REFRESHED && !newSession` for logout.

- **`contexts/AuthContext.tsx` – `signUp`**
  - On `data.session`: set session tokens + minimal user, then `hydrateFromSession(..., { clearOnError: false })`.

---

## Deep linking (validated in code)

| Layer | Behaviour |
|--------|-----------|
| **Scheme** | `committed` (`app.json`); `expo-router` `origin`: `https://committed.dreambig.org.za`. |
| **Entry** | `app/_layout.tsx`: cold start `Linking.getInitialURL()` (native retries), warm `Linking.addEventListener('url')`. Auth URLs → `auth-callback` or custom verify/reset routes; content → `setPendingDeepLink`. |
| **Queue** | `lib/deep-link-service.ts`: parse web + `committed://`, normalize `exp://` in dev. |
| **After auth ready** | `AppGate`: `getAndClearPendingDeepLink`, `subscribePendingDeepLink` for warm links; referral/post/reel → `setIntendedRoute` / storage; authenticated users routed to home/onboarding with intended route applied once. |
| **OAuth / magic links** | `app/auth-callback.tsx`: exchange code / tokens, poll session, navigate once. |

**Recommendation (product / infra):** For **https://** links to open the installed app (not browser), configure **Android App Links** + **iOS Universal Links** in the Expo/EAS project and host `assetlinks.json` / `apple-app-site-association` on the marketing domain. Custom scheme `committed://` works when the site uses that scheme in links.

---

## Token storage & lifecycle

| Topic | Current implementation |
|--------|-------------------------|
| **Storage** | `@react-native-async-storage/async-storage` via Supabase client (`lib/supabase.ts`). Persists across process kill and reboot until app data cleared or uninstall. |
| **Refresh** | `autoRefreshToken: true`, `persistSession: true`. |
| **Manual refresh** | `refreshSession()` in context: clears state only on **invalid** refresh token messages; transient errors keep session. |
| **Security note** | AsyncStorage is not hardware-backed. For higher sensitivity, consider an `expo-secure-store` adapter for refresh token only (Supabase custom storage pattern). |

---

## Verification checklist

1. **Login → kill app → reopen**  
   Should land in app (home/onboarding/verify as appropriate), not guest `/`.

2. **Login → reboot device → open app**  
   Same as above.

3. **Login → background 5+ min → foreground**  
   Session should refresh; no unexpected logout.

4. **Logged out → open `committed://...` post/reel link**  
   Public paths allow content; after login, intended route applies when on main app.

5. **Logged in → tap email verify link**  
   `auth-callback` completes; no duplicate logout from auth listener.

6. **Airplane mode on cold start**  
   After retries, user may see logged out if `getSession` truly fails; reconnect and reopen should restore (tokens still on disk).

---

## Follow-ups implemented (post-audit)

| Item | What was done |
|------|----------------|
| **Monitoring / logging** | `lib/auth-telemetry.ts` — `logAuthEvent()` (no PII/tokens). Wired in `AuthContext` (restore, listener, refresh, hydrate, sign-in/up/out). **Dev:** always on. **Production:** set `EXPO_PUBLIC_AUTH_TELEMETRY=1` for staged debugging. Use `setAuthTelemetrySink()` to forward to Sentry/etc. |
| **E2E** | `maestro/app-launch.yaml`, `maestro/auth-sign-in-smoke.yaml` + `docs/E2E-MAESTRO.md`. `package.json` script `test:e2e:maestro`. `auth.tsx` `testID`s: `auth-email-input`, `auth-password-input`. |
| **Universal Links / App Links** | `docs/UNIVERSAL-LINKS-SETUP.md` — AASA, `assetlinks.json`, `ios.associatedDomains`, `android.intentFilters` (apply in `app.json` + rebuild when ready). |
| **CI regression gate** | `.github/workflows/ci.yml` — `bun install --frozen-lockfile` + `expo lint --no-cache` on push/PR. |

---

## Original audit scope — honesty checklist

| Prompt area | Status |
|-------------|--------|
| Task 1 regression (auth, nav, deep links) | **Code review** completed; automated **device** runs are manual or Maestro. |
| Task 2 deep linking end-to-end | **Code paths** documented; **https → app** requires **host files** + native config (guide added). |
| Task 3 token storage / lifecycle / init / logout triggers | **Traced and fixed** in client; **tRPC** does not sign out on 401. **Backend** edge functions return 401 as expected for bad tokens — no client change needed. |
| Task 4 edge cases | **Documented** expectations; not executed as automated suite except Maestro launch smoke. |
| Task 5 fixes | **Done** in `AuthContext` + related files (see above). |
| Secure hardware-backed token storage | **Not implemented** — full Supabase session JSON often **exceeds** SecureStore single-item limits; would need **chunked** or vendor-specific encrypted storage. Documented as future option. |

---

## Remaining optional improvements

- **Encrypted / SecureStore session storage** with chunking or MMKV encryption (larger change).
- **Maestro** full auth + cold-start session flow in CI (macOS + emulator).
- **Sentry** (or similar): `setAuthTelemetrySink((event, payload) => Sentry.addBreadcrumb({ category: 'auth', message: event, data: payload }))` in a small `app/_layout` or provider init.
