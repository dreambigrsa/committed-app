# Expo ↔ Next.js mirror — architecture map

This document is the **internal map** requested for system alignment: same backend, same API contracts, web is a different renderer.

## 0. Shared package (`@committed/shared`)

| Module | Role |
|--------|------|
| `packages/shared/src/committed-api-base-url.ts` | One resolver for tRPC base URL (Expo + Next env names). |
| `packages/shared/src/supabase-public-config.ts` | Production Supabase URL + anon key fallbacks (public). |
| `packages/shared/src/feed-visibility.ts` | Post/reel OR filters — **same strings** as `AppContext` / web shell. |
| `packages/shared/src/feed-constants.ts` | Feed limits (50) + `APP_POST_USER_SELECT` aligned with Expo. |
| `packages/shared/src/feed-loaders.ts` | `fetchFeedPostsWithLikes` / `fetchFeedReelsWithLikes` — **same** Supabase chains as `loadUserData` (used by Expo + `MobileWebAppShell`). |
| `packages/shared/src/bootstrap-parallel-loaders.ts` | `fetchLoadUserDataParallelBundle` — ads, relationships, requests, notifications, alerts, blocks, follows, disputes (used by `AppContext`). |
| `packages/shared/src/bootstrap-constants.ts` | Shared bootstrap limits (notifications 50, conversations list 50) — `MobileWebAppShell` aligned with `AppContext`. |
| `packages/shared/src/display-name.ts` | `getDisplayName` — **only** implementation; `lib/identity.ts` (Expo) and `web/lib/identity.ts` re-export it. |
| `packages/shared/src/user-identity-select.ts` | `APP_USER_IDENTITY_SELECT` for batch user lookups. |
| `packages/shared/src/conversation-loaders.ts` | `fetchConversationsBootstrap` — same conversation + message load as `AppContext` (dedupe, limits, deleted-for-me filter). |
| `packages/shared/src/comment-loaders.ts` | `fetchPostCommentsAndLikes` / `fetchReelCommentsAndLikes`. |
| `packages/shared/src/comment-tree.ts` | `buildPostCommentsByPostId` / `buildReelCommentsByReelId` (threaded trees + likes). |

**Consumers:** `lib/supabase.ts`, `lib/trpc.ts`, `contexts/AppContext.tsx`, `web/lib/supabase-client.ts`, `web/lib/trpc-react.tsx` (+ `AuthSessionTrpcSync` for session-driven query invalidation), `web/lib/content-visibility.ts`, `web/components/MobileWebAppShell.tsx`.

## 1. Expo app — data & API layer

| Layer | Location | Role |
|--------|-----------|------|
| **Supabase** | `lib/supabase.ts` | Auth session, direct DB where used |
| **tRPC API** | `lib/trpc.ts` → `https://…/trpc` | Business procedures (`backend/trpc/app-router.ts`) |
| **React Query** | `@tanstack/react-query` | Caching; driven by tRPC hooks |
| **Env (API base)** | `EXPO_PUBLIC_COMMITTED_API_BASE_URL` | Falls back to `https://committed-5mxf.onrender.com` in prod |

tRPC requests attach `Authorization: Bearer <supabase access_token>` (same as web must do).

## 2. Expo — auth & app shell

| Piece | Location |
|--------|-----------|
| Session + hydration | `contexts/AuthContext.tsx` |
| Route gating / deep links | `components/AppGate.tsx`, `lib/deep-link-service.ts` |
| Legal / AI soft enforcement | `lib/legal-enforcement.ts`, onboarding flows |

**Web today:** `WebAuthForm`, `WebAppGate`, `getSupabaseBrowser` — similar responsibilities but **not** the same code path as `AuthContext`.

## 3. Expo Router — screen inventory (canonical routes)

**Root stack** (`app/_layout.tsx`): `index`, `auth`, `sign-in`, `sign-up`, `signup`, `auth-callback`, `onboarding`, `verify-email`, `reset-password`, `legal/[slug]`, `(tabs)`, `profile/[userId]`, `relationship/register`, `messages/[conversationId]`, admin + settings stacks, `dating` stack, etc.

**Tabs** (`app/(tabs)/_layout.tsx`): `home`, `feed`, `reels`, `dating`, `search`, `notifications`, `messages`, `profile`.

**Representative feature screens** (non-exhaustive list from `app/`):

- **Tabs:** `home`, `feed`, `reels`, `dating`, `search`, `notifications`, `messages`, `profile`
- **Posts / media:** `post/[postId]`, `post/create`, `reel/[reelId]`, `reel/create`
- **Dating:** `dating/*` (dashboard, filters, matches, likes, profile setup, user-profile, date requests, payment, premium, video-player, etc.)
- **Bookings / professional:** `bookings/*`, `professional/*`, `settings/become-professional`, `settings/professional-availability`, `professional/session-requests`
- **Relationship / certs:** `relationship/register`, `anniversary/[relationshipId]`, `certificates/[relationshipId]`
- **Status:** `status/*`, `status-item/[statusId]`, `status/create`
- **Verification:** `verification/*`
- **Ads:** `ads/*`
- **Admin:** `admin/*` (many modules)
- **Settings:** `settings`, `settings/2fa`, `settings/sessions`, `settings/blocked-users`, …

**Next.js** should expose **the same URL semantics** where marketing/share links matter (`/post/:id`, `/reel/:id`, `/dating/user-profile`, etc.) and the same **feature coverage** inside the authenticated shell.

## 4. Next.js — current mirror status

| Area | Status |
|------|--------|
| **tRPC + React Query** | ✅ Root `CommittedAppProviders` in `web/app/layout.tsx`; client in `web/lib/trpc-react.tsx` (typed `AppRouter`, same superjson + bearer token pattern as Expo). |
| **API base URL** | Set `NEXT_PUBLIC_COMMITTED_API_BASE_URL` (see `web/.env.example`). |
| **Supabase auth** | Partially aligned (e.g. password sign-in via `web/app/api/auth/sign-in` for browser reachability). |
| **Screen parity** | `ExpoMirrorRoute` + `MobileWebAppShell` mirror **some** flows; large surface still split vs Expo `app/*` screens. |
| **Shared TS modules** | ✅ `packages/shared` (`@committed/shared`) for API URL, Supabase public fallbacks, feed visibility + limits. Further extraction of `AppContext` loaders = next phase. |

## 5. Strict alignment rules (for ongoing work)

1. **No duplicate business rules** — prefer calling the same tRPC procedure or the same shared function as Expo.
2. **No “web-only” Supabase queries** for behaviour that Expo implements via tRPC unless the procedure is proven server-only.
3. **Auth**: eventual goal is one conceptual model (session + hydration) — either port `AuthContext` patterns to web or extract shared `auth-core` used by both.
4. **Performance**: prefer React Query + tRPC cache; avoid redundant `getSession()` storms (mirror Expo’s `AuthContext` discipline).

## 6. Suggested phases (execution order)

1. **Foundation** — tRPC provider on web (done), env documented, smoke test `trpc.example.hi` or a real read-only query from a shell screen.
2. **Route matrix** — spreadsheet: each `app/*.tsx` → Next route + owner; eliminate dead or mismatched paths.
3. **Extract shared** — move pure utilities + Zod schemas + types into `packages/shared` (workspace); point Expo and Next at it.
4. **Replace ad-hoc web fetches** — any feature still using one-off `fetch` to custom endpoints should converge on tRPC + Supabase patterns from Expo.
5. **Auth unification** — align `WebAppGate` with `AppGate` ordering (verify → legal → onboarding → app).

## 7. Known gaps (living list)

- **Auth**: Web uses `WebAppGate` / marketing layouts; Expo uses `AuthContext` + `AppGate` — behaviour is similar but **not one shared module**.
- **Push / native**: Expo-only; web uses browser notifications only if explicitly implemented.
- **Media capture**: Expo modules (camera, image picker); web uses file input / different constraints — **flow parity**, not pixel parity.
- **Admin**: Many Expo `admin/*` screens; Next must match capabilities procedure-by-procedure via tRPC `admin.*`.
- **Bundle**: `MobileWebAppShell` is a large client bundle; mirror growth should track code-splitting by route.

Update this section as screens are ported.
