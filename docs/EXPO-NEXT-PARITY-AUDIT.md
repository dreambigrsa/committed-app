# Expo ↔ Next.js mirror — parity audit & remaining gaps

**Purpose:** Satisfy the “final validation” ask: same backend and behavior where implemented, renderer differs. This is a **living audit**; the mirror is advanced incrementally—**not** every Expo screen has a 1:1 Next implementation yet.

## 1. Executive summary

| Area | Status |
|------|--------|
| **Backend** | Single Supabase project + shared `backend/` tRPC router. No separate web-only API surface for core product logic. |
| **Shared logic** | `@committed/shared`: feed loaders, bootstrap bundle, conversations, comments, display name, user select strings, AI onboarding version, API base URL, public Supabase constants. |
| **Web app shell** | `MobileWebAppShell` + `ExpoMirrorRoute` + catch-all routes mirror **many** tab flows; not every Expo stack screen is duplicated. |
| **Auth** | Expo: `AuthContext` + `AppGate`. Web: Supabase browser client + `WebAppGate` + API routes for email/password helpers. Same tokens; **different modules** (see §5). |
| **True 1:1** | **Not complete** for every screen and edge case. Use §7 as the checklist for what still diverges. |

## 2. Expo app map (analysis summary)

### 2.1 Navigation

- **Root:** `app/_layout.tsx` — `AuthProvider`, `AppContext`, `AppGate`, legal/AI enforcers, deep links.
- **Tabs:** `app/(tabs)/_layout.tsx` — `home`, `feed`, `reels`, `dating`, `search`, `notifications`, `messages`, `profile`.
- **Stacks:** `post/*`, `reel/*`, `dating/*`, `admin/*`, `settings/*`, `verification/*`, `bookings/*`, `professional/*`, `relationship/*`, `status/*`, `ads/*`, auth/onboarding/legal, etc.
- **Screen count:** ~105 Expo Router `app/**/*.tsx` files (including tabs, layouts, admin).

### 2.2 State & data

| Concern | Expo |
|---------|------|
| Global app data | `contexts/AppContext.tsx` — feed, conversations, comments, notifications, dating, admin caches, realtime, AsyncStorage caches |
| Auth session | `contexts/AuthContext.tsx` — hydration, profile, `authReady` / `profileHydrated` |
| Theme | `contexts/ThemeContext.tsx` |
| Server API | `lib/trpc.ts` + React Query — `Authorization: Bearer <supabase access_token>` |
| DB | `lib/supabase.ts` — direct Supabase where not using tRPC |

### 2.3 Auth routing order (Expo `AppGate`)

Documented in `components/AppGate.tsx`: password recovery → email verify → home shell while profile loads → onboarding/legal/AI as **soft** enforcement layers (legal is **not** a hard navigation gate on native; `LegalAcceptanceEnforcer` is dismissible).

## 3. Next.js map

### 3.1 Layout & providers

- `web/app/layout.tsx` — `CommittedAppProviders` (tRPC + React Query + `AuthSessionTrpcSync`).
- `web/app/app/layout.tsx` — `WebAppGate` (verify email → required legal → AI consent → children).

### 3.2 Primary mirror entry

- `web/components/ExpoMirrorRoute.tsx` → `MobileWebAppShell` (large client bundle: feed, dating, messages, admin slices, etc.).
- Marketing/static routes: `sign-in`, `sign-up`, `post/[id]`, `reel/[id]`, `download`, legal, etc.

### 3.3 Route shape difference

- Expo uses file routes like `/post/[postId]`, `/(tabs)/home`.
- Web uses both **top-level** mirrors (`/feed`, `/messages`, …) and **`/app/*`** shell routes. Deep links in `app.json` target production web paths (`/post`, `/reel`, …). Alignment is **semantic** (same IDs, same data), not identical path strings everywhere.

## 4. Shared package inventory (`@committed/shared`)

| Module | Role |
|--------|------|
| `committed-api-base-url.ts` | tRPC base URL for Expo + Next |
| `supabase-public-config.ts` | Public URL / anon key fallbacks |
| `feed-constants.ts` | Post/reel limits, post user select |
| `feed-visibility.ts` | OR filters for moderated content |
| `feed-loaders.ts` | Feed posts/reels + likes |
| `bootstrap-parallel-loaders.ts` | Parallel bundle for `loadUserData` |
| `bootstrap-constants.ts` | Notification / conversation list limits |
| `display-name.ts` | `getDisplayName` |
| `user-identity-select.ts` | Batch user column list |
| `conversation-loaders.ts` | `fetchConversationsBootstrap` |
| `comment-loaders.ts` | Post/reel comments + likes fetch |
| `comment-tree.ts` | Thread trees + likes maps |
| `onboarding-constants.ts` | `COMMITTED_AI_ONBOARDING_VERSION` (Expo onboarding, AI enforcer, `WebAppGate`) |

## 5. Authentication & session — differences

| Topic | Expo | Web |
|-------|------|-----|
| Module | `AuthContext` | `WebAppGate` + page-level checks |
| Session storage | Supabase RN / secure persistence | Supabase JS browser persistence |
| Password sign-in | Standard Supabase | May use `web/app/api/auth/sign-in` for cookie/CORS reachability |
| Post-login gates | `AppGate` + soft legal/AI | `WebAppGate`: **hard** block until verify + **required** legal + AI consent |
| React Query | Invalidates on auth change via auth integration | `AuthSessionTrpcSync` invalidates on `SIGNED_IN` / `TOKEN_REFRESHED` / etc. |

**Gap:** Legal gating is **stricter on web** (blocking) than Expo’s documented “soft” legal UX. For a strict mirror, web would need to match native policy (product decision).

**Gap:** No shared `auth-core` package—two implementations must be kept in sync manually until extracted.

## 6. API + database consistency

- **tRPC:** Same `AppRouter` type from `backend/trpc/app-router.ts`; web uses `web/lib/trpc-react.tsx` with bearer token from `getSession()`.
- **Supabase:** Same project; web uses `getSupabaseBrowser()`; Expo uses `lib/supabase.ts`.
- **Risk:** Any feature implemented only with ad-hoc `fetch` or web-only SQL should be treated as a **parity bug** unless it is intentionally marketing-only.

## 7. Feature parity checklist (honest)

Legend: **Aligned** = same shared loaders / same tables / same intent. **Partial** = subset or different UX path. **Missing** = not on web as dedicated flow.

| Feature | Parity |
|---------|--------|
| Feed + reels bootstrap | **Aligned** (shared feed loaders; shell + AppContext) |
| Post/reel comments (data) | **Aligned** (shared comment loaders + trees; web post/reel pages + shell) |
| Conversations + messages bootstrap | **Aligned** (`fetchConversationsBootstrap` in AppContext, `MobileWebAppShell`, `WebModulePanels` messages) |
| Notifications list (basic) | **Partial** (limits shared; realtime / push differs) |
| Dating discovery / profile | **Partial** (shell mirrors much; not every `dating/*` screen) |
| Admin | **Partial** (`MobileWebAppShell` + routes; not every `admin/*` screen) |
| Professional / bookings | **Partial** |
| Verification / ID flows | **Partial** (routes exist; depth vs Expo varies) |
| Status / stories | **Partial** |
| Ads | **Partial** |
| Push notifications | **Missing** on web (browser not native push) |
| Camera / native pickers | **Different by platform** (expected) |
| Offline / AsyncStorage caches | **Expo-heavy**; web relies more on in-memory + RQ |
| Realtime subscriptions | **Expo:** full `AppContext` channels. **Web:** `subscribeMirrorCoreRealtime` + `subscribeMirrorFeedRelationshipRealtime` (messages, conversations, notifications, **posts**, **reels**, **relationship** refresh). Remaining: e.g. `relationship_requests` realtime, notification polling fallback parity. |

## 8. Performance & data

| Concern | Notes |
|---------|------|
| **Shell bundle size** | `MobileWebAppShell` is large; route-based code splitting is the main lever. |
| **Duplicate fetch** | Prefer shared loaders + React Query; avoid redundant `getSession()` in hot paths. |
| **WebAppGate** | Refetches on `visibilitychange` + auth events—intentional for freshness; can add debouncing if needed. |

## 9. Remaining work (prioritized)

1. **Auth unification** — shared session + gate ordering; align legal strictness with product.
2. **Realtime on web** — add remaining `AppContext` channels (e.g. `relationship_requests`) and optional notification polling fallback if channels fail.
3. **Screen matrix** — each `app/*.tsx` → explicit Next owner; eliminate “approximate” flows.
4. **tRPC-first** — move remaining web-only Supabase business writes to the same procedures as Expo where applicable.
5. **Testing** — automated smoke: same user, same IDs, same row counts for feed + one conversation thread.

## 10. How to use this doc

- Update **§7–§9** when a feature moves to shared code or gains a new Next route.
- Treat **§5** as the main **behavioral** risk area until auth/legal alignment is resolved.

---

*Generated as part of the mirror initiative; keep in repo for onboarding and release reviews.*
