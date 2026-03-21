# Manual regression checklist — auth, session, deep links

Use a **production or preview build** (`com.committed.app`) when possible; Expo Go is acceptable for most flows but custom URL schemes may differ.

**Pass criteria:** No unexpected full logout (session lost without user tapping Sign out) and deep links reach the correct screen without broken redirect loops.

---

## Environment

- [ ] Note build: `____________` (EAS profile / dev client / Expo Go)
- [ ] Note device: iOS `___` / Android `___`, OS version `___`

---

## 1. Session persistence (prompt: close app / reboot)

| # | Steps | Expected |
|---|--------|----------|
| 1.1 | Sign in with a verified account → land on home or onboarding | Authenticated UI |
| 1.2 | Force-stop app (not just home button) → reopen | Still authenticated; **not** stuck on marketing `/` as guest |
| 1.3 | Sign in → power off device → power on → open app | Still authenticated |
| 1.4 | Sign in → background 2 min → foreground | Still authenticated |

---

## 2. Poor network (prompt: edge cases)

| # | Steps | Expected |
|---|--------|----------|
| 2.1 | Enable airplane mode → cold start app | May show logged out **only if** `getSession` truly fails after retries; reconnect and reopen → session restored if tokens on disk |
| 2.2 | Sign in with throttled network (Chrome devtools / Charles / OS throttle) | Auth screen stays visible (no full-app splash); eventual success or clear error |
| 2.3 | Mid-session: airplane mode 30s → restore network | Remain logged in; refresh may log `refresh_transient` in telemetry if enabled |

---

## 3. Deep links — custom scheme `committed://`

| # | Steps | Expected |
|---|--------|----------|
| 3.1 | **Logged out**, app killed → open link to a post (e.g. web path `/post/TEST_ID` adapted to app URL) | Opens post route; login prompt if interaction requires auth |
| 3.2 | **Logged in**, app open → same link (warm) | Navigates to post / intended content |
| 3.3 | **Logged out**, referral link | Referral code stored; signup/signin flow still works |

---

## 4. Deep links — https (marketing site)

| # | Steps | Expected |
|---|--------|----------|
| 4.1 | After **Universal Links / App Links** configured per `docs/UNIVERSAL-LINKS-SETUP.md`, tap https URL on device | Opens **app**, not only browser |
| 4.2 | Before infra done | Link opens browser — **expected** until AASA/assetlinks deployed |

---

## 5. Auth email / recovery (prompt: navigation + auth)

| # | Steps | Expected |
|---|--------|----------|
| 5.1 | Open password reset link from email (app installed) | `reset-password` or `auth-callback` completes; no false “expired” loop |
| 5.2 | Open verify-email link | `verify-email` or auth flow; user not randomly signed out after verify |

---

## 6. Explicit logout (sanity)

| # | Steps | Expected |
|---|--------|----------|
| 6.1 | Settings (or equivalent) → Sign out | Session cleared; next open is guest |
| 6.2 | Banned user modal (if applicable) | Behaviour per product; session cleared only if designed |

---

## 7. Telemetry (optional)

- [ ] With `EXPO_PUBLIC_AUTH_TELEMETRY=1`, cold start shows `[AuthTelemetry] restore_complete` with `hasSession` true/false (no emails/tokens in logs)

---

## Sign-off

- Tester: `____________`  
- Date: `____________`  
- Result: Pass / Fail (notes):  
