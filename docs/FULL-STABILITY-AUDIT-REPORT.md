# Full stability, authentication & deep linking audit — completion report

**Scope:** Production Expo app (Committed).  
**Method:** Static code trace (no assumptions), targeted fixes already merged, manual verification delegated to checklist + CI.  
**Companion:** Technical delta summary in [`AUTH-STABILITY-AUDIT.md`](./AUTH-STABILITY-AUDIT.md).

This document maps **directly** to the audit prompt (Tasks 1–5) and the required **output format** (issues, root cause, impact, fix, verification).

---

## Prompt alignment

| Prompt section | Completed as |
|----------------|--------------|
| **Objectives** — stability, deep links, unexpected logout | Root causes identified in code; client fixes in `AuthContext`, `AppGate`, `deep-link-service`; infra steps in `UNIVERSAL-LINKS-SETUP.md`. |
| **TASK 1** — Regression | Code review of auth, session, navigation, deep links; [`MANUAL-REGRESSION-CHECKLIST.md`](./MANUAL-REGRESSION-CHECKLIST.md) for human/device runs; CI lint in `.github/workflows/ci.yml`. |
| **TASK 2** — Deep linking | End-to-end trace: `_layout.tsx` → `deep-link-service` → `AppGate` → `auth-callback`; edge-case matrix below; https→app requires host + native config (documented). |
| **TASK 3** — Auth debugging | Storage, lifecycle, init, logout triggers, refresh, state — answered in **§ Issues found** and **§ Reference answers**. |
| **TASK 4** — Edge cases | Checklist in `MANUAL-REGRESSION-CHECKLIST.md`; Maestro smoke in `maestro/`; cannot automate device reboot in-repo. |
| **TASK 5** — Fixes | Session persistence + listener behaviour fixed; refresh hardened; telemetry added; features preserved. |
| **Security** — “secure and persistent” | **Persistent:** AsyncStorage + Supabase `persistSession`. **Hardware-backed:** not implemented (session blob size vs SecureStore limits) — documented as future work in `AUTH-STABILITY-AUDIT.md`. |

---

## Issues found (structured)

### Issue 1 — User appears logged out after cold start / reopen / slow network

| Field | Detail |
|--------|--------|
| **Explanation** | After `getSession()` returned a valid session, React `user` stayed `null` until `hydrateFromSession` finished (multiple DB calls). `isAuthenticated` is `user !== null`, so `AppGate` routed as **guest**. |
| **Root cause** | Session and user hydration were **sequential** from the router’s perspective; UI logic keyed on `user`, not only on Supabase session. |
| **Impact** | Unexpected redirect to `/` or marketing home; “logged out” despite tokens still in AsyncStorage. |
| **How it affects users** | Especially on **slow devices/networks** after kill or reboot. |
| **Fix** | On restore (and on `onAuthStateChange` when `newSession` exists): **`setUser(getMinimalUserFromSession(...))` immediately** after setting tokens; run full `hydrateFromSession` in background with `clearOnError: false`. Same pattern for sign-up when `data.session` exists. |
| **Code** | `contexts/AuthContext.tsx` — `restoreSession`, `onAuthStateChange`, `signUp`. |
| **Verification** | Manual: sign in → force-stop → reopen → must **not** flash guest home before main app. See checklist §1–3. |

---

### Issue 2 — Splash / “auth ready” before `getSession()` completed

| Field | Detail |
|--------|--------|
| **Explanation** | A **4s timeout** called `setAuthLoading(false)` while `getSession()` could still be in flight. |
| **Root cause** | Intended to avoid infinite splash; timed **wall clock** instead of **session read completion**. |
| **Impact** | Brief (or long) window where app rendered with **no session in state** yet. |
| **How it affects users** | Same as Issue 1; worse on slow storage/network. |
| **Fix** | Remove premature unlock; **`finishLoading()` only in `finally`** after the `getSession` retry loop. Optional **25s** hang guard logs only / unblocks extreme hangs. |
| **Code** | `contexts/AuthContext.tsx` — `restoreSession`. |
| **Verification** | Throttle network in dev tools or use poor connectivity; cold start should not show authenticated tabs before session resolves (or should show consistent loading). |

---

### Issue 3 — Spurious clearing of auth state from `onAuthStateChange`

| Field | Detail |
|--------|--------|
| **Explanation** | A broad **`else { clear user/session }`** ran whenever `newSession` was falsy, not only on real sign-out. |
| **Root cause** | Over-defensive sync between listener and React state. |
| **Impact** | Rare races could **wipe** in-memory auth while storage still held tokens. |
| **How it affects users** | Intermittent “logged out until restart” or confusing navigation. |
| **Fix** | Clear only on **`SIGNED_OUT`** or **`TOKEN_REFRESHED` with no session**; **no** generic else-clear. Cold empty session handled by **`restoreSession`**. |
| **Code** | `contexts/AuthContext.tsx` — `onAuthStateChange`. |
| **Verification** | Background app 30+ min; token refresh should not log user out on transient failures (see Issue 4). |

---

### Issue 4 — Token refresh failure treated as always fatal

| Field | Detail |
|--------|--------|
| **Explanation** | Earlier logic cleared session on **any** refresh error (except abort). |
| **Root cause** | No distinction between **invalid refresh token** vs **network/transient** errors. |
| **Impact** | Temporary connectivity blips could log users out. |
| **Fix** | Clear state only when error message indicates **invalid/expired refresh**; otherwise **warn** and keep session. |
| **Code** | `contexts/AuthContext.tsx` — `refreshSession`. |
| **Verification** | Airplane mode toggle during session; user should remain logged in when network returns (unless token truly invalid). |

---

### Issue 5 — Sign-up hydration could clear React auth on DB error

| Field | Detail |
|--------|--------|
| **Explanation** | `hydrateFromSession` defaulted to **`clearOnError: true`**. |
| **Root cause** | Same helper used for paths where clearing is wrong after signup. |
| **Impact** | UI showed logged out while storage might still hold session. |
| **Fix** | Sign-up path: set session + minimal user; **`hydrateFromSession(..., { clearOnError: false })`**. |
| **Code** | `contexts/AuthContext.tsx` — `signUp`. |
| **Verification** | Complete signup with email confirmation flow; no spurious logout on first hydrate failure. |

---

### Issue 6 — Full-app splash during sign-in (mobile)

| Field | Detail |
|--------|--------|
| **Explanation** | `signIn`/`signUp` set **`authLoading` true**; `AppGate` shows **full splash** when `authLoading` is true. |
| **Root cause** | Overloaded meaning of `authLoading` (cold restore vs in-form submit). |
| **Impact** | On slow mobile networks, auth screen disappeared during sign-in; felt broken. |
| **Fix** | Do **not** toggle `authLoading` during `signIn`/`signUp`; keep it for **cold `restoreSession`** and **`signOut`**. |
| **Code** | `contexts/AuthContext.tsx`; `components/AppGate.tsx` (behaviour unchanged, but trigger removed). |
| **Verification** | Sign in on device with throttled network; auth form stays visible with button spinner. |

---

### Issue 7 — https website links not opening installed app (product/infra)

| Field | Detail |
|--------|--------|
| **Explanation** | **Custom scheme** `committed://` works when links use it. **https://** open-in-app requires OS verification. |
| **Root cause** | Missing or incomplete **Universal Links (iOS)** / **App Links (Android)** + hosted `AASA` / `assetlinks.json`. |
| **Impact** | Users stay in browser instead of app when tapping marketing URLs. |
| **Fix** | Follow [`UNIVERSAL-LINKS-SETUP.md`](./UNIVERSAL-LINKS-SETUP.md); add `associatedDomains` / `intentFilters`; host well-known files. |
| **Verification** | Tap https link on device with app installed → app opens to correct path. |

---

## TASK 2 — Deep linking matrix (code-verified)

| Scenario | Behaviour |
|----------|-----------|
| App **closed** → open `committed://` or initial URL | `Linking.getInitialURL()` (+ native retries in `_layout.tsx`); auth → `auth-callback` / custom verify-reset; content → `setPendingDeepLink`. |
| App **open** → link | `Linking.addEventListener('url')`; same routing; `subscribePendingDeepLink` bumps `AppGate` to re-read pending. |
| **Logged out** + post/reel | `AppGate` sets target `/post/:id` or `/reel/:id`; screens use `LoginPromptModal` where needed (e.g. `app/post/[postId].tsx`). |
| **Logged in** + post/reel | Intended route stored; after main app, `getIntendedRoute()` + `router.push`. |
| **Auth** callbacks | `isAuthLink` vs `getCustomVerifyOrResetRoute` separates token-in-query flows from OAuth-style callbacks; `auth-callback.tsx` exchanges session. |
| **Risk** | `setPendingDeepLink` **ignores** `auth-callback` / `verify-email` types so they are not consumed as “content” pending — avoids wrong `AppGate` handling. |

---

## TASK 3 — Reference answers (checklist)

1. **Token storage:** `lib/supabase.ts` — **AsyncStorage**, `persistSession: true`, `autoRefreshToken: true`. Persists across process kill and reboot until app data cleared / uninstall.  
2. **Not cleared on normal app close** by application code; only explicit `signOut`, invalid refresh, or failed restore with no session.  
3. **Init:** `restoreSession` + `onAuthStateChange`; **retries** on `getSession` errors; **minimal user** set immediately when session exists.  
4. **Logout triggers traced:** `AuthContext` (signOut, listener, restore error, hydrate with `clearOnError`, invalid refresh); `AppContext` **only** on explicit logout / delete account (calls `supabase.auth.signOut`). **No** tRPC client sign-out on 401 (`lib/trpc.ts` only attaches Bearer).  
5. **Refresh:** SDK auto-refresh + `refreshSession()` with selective clear.  
6. **State:** Single **AuthContext**; persistence is **Supabase → AsyncStorage**, not a separate Redux/Zustand auth slice.

---

## TASK 4 & 5 — Verification & ongoing quality

- **Manual:** [`MANUAL-REGRESSION-CHECKLIST.md`](./MANUAL-REGRESSION-CHECKLIST.md)  
- **Automated lint:** `bun run lint:ci` / GitHub Actions  
- **Smoke E2E:** `maestro/` + [`E2E-MAESTRO.md`](./E2E-MAESTRO.md)  
- **Telemetry (no PII):** `lib/auth-telemetry.ts`, `EXPO_PUBLIC_AUTH_TELEMETRY=1` for staged prod debugging  

---

## Rules compliance

| Rule | Status |
|------|--------|
| Do not assume — trace step by step | Issues above tied to specific files and data flow. |
| Do not remove features unnecessarily | Only behavioural fixes; logout/delete-account flows preserved. |
| Preserve deep linking / navigation | Pending link subscription + `AppGate` logic retained/enhanced. |
| Production mindset | Retries, selective refresh handling, telemetry, CI, QA checklists. |

---

## Sign-off

- **Code remediation:** Complete for **client-side** causes of unexpected logout and routing races.  
- **Infra:** Universal/App Links require **your** domain + rebuild (documented).  
- **Device proof:** Requires executing **MANUAL-REGRESSION-CHECKLIST** (and optional Maestro) on real builds — cannot be substituted by static analysis alone.
