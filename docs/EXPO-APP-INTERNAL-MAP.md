# Expo app — internal map (living)

**Purpose:** Section **1** of the mirror program — how the native app is structured before changing web. Update this file when routes or architecture change.

## Navigation

### Root stack (`app/_layout.tsx`)

| Route segment | Notes |
|---------------|--------|
| `index` | Entry / redirect |
| `auth`, `sign-in`, `sign-up`, `signup`, `auth-callback` | Auth |
| `onboarding` | Full-screen modal |
| `verify-email`, `reset-password` | Account recovery / verify |
| `legal/[slug]` | Legal document reader |
| `(tabs)` | Main tab shell (see below) |
| `profile/[userId]` | User profile |
| `relationship/register` | Modal |
| `messages/[conversationId]` | Chat |
| `admin/*` | Many admin screens (see file list) |
| `settings`, `settings/*` | Settings subtree |
| `professional/session-requests` | Pro flow |
| `dating` | Stack (`dating/_layout.tsx` + screens) |
| `+not-found` | 404 |

Additional stack screens exist beyond the excerpt in `_layout.tsx`; **source of truth** = `app/_layout.tsx` full `Stack.Screen` list + nested layouts.

### Tabs (`app/(tabs)/_layout.tsx`)

| Tab | File |
|-----|------|
| Home | `(tabs)/home.tsx` |
| Feed | `(tabs)/feed.tsx` |
| Reels | `(tabs)/reels.tsx` |
| Dating | `(tabs)/dating.tsx` |
| Search | `(tabs)/search.tsx` |
| Notifications | `(tabs)/notifications.tsx` |
| Messages | `(tabs)/messages.tsx` |
| Profile | `(tabs)/profile.tsx` |

## Global state & providers (`app/_layout.tsx`)

| Layer | Location |
|-------|----------|
| Auth session + hydration | `contexts/AuthContext.tsx` |
| App data, realtime, caches | `contexts/AppContext.tsx` |
| Theme | `contexts/ThemeContext.tsx` |
| Route gating / deep links | `components/AppGate.tsx`, `lib/deep-link-service.ts` |
| Legal (soft) | `components/LegalAcceptanceEnforcer.tsx` |
| Committed AI (soft) | `components/CommittedAIConsentEnforcer.tsx` |

## API & data access

| Mechanism | Location |
|-----------|----------|
| Supabase client | `lib/supabase.ts` |
| tRPC client + React Query | `lib/trpc.ts` |
| Shared loaders / constants | `packages/shared` (`@committed/shared`) |
| Backend procedures | `backend/trpc/app-router.ts` (and related) |

**Auth header:** `Authorization: Bearer <supabase access_token>` on tRPC (same contract web must use).

## Screen inventory (Expo Router files)

**Count:** 106 `app/**/*.tsx` files (includes layouts, duplicates in listing).

**Groupings (non-exhaustive):**

- **Tabs:** `home`, `feed`, `reels`, `dating`, `search`, `notifications`, `messages`, `profile`
- **Posts / reels:** `post/[postId]`, `post/create`, `reel/[reelId]`, `reel/create`
- **Dating stack:** `dating/dashboard`, `filters`, `matches`, `likes-received`, `user-profile`, `date-requests`, `create-date-request`, `edit-date-request`, `profile-setup`, `profile-preview`, `photo-gallery`, `video-player`, `premium`, `payment-submit`, …
- **Bookings / pro:** `bookings/*`, `professional/*`, `settings/become-professional`, `settings/professional-availability`, `professional/session-requests`
- **Relationship / certs:** `relationship/register`, `anniversary/[relationshipId]`, `certificates/[relationshipId]`
- **Status:** `status/*`, `status-item/[statusId]`, `status/create`
- **Verification:** `verification/*`
- **Ads:** `ads/*`
- **Admin:** `admin/*` (analytics, users, dating, reels-review, posts-review, …)
- **Settings:** `settings`, `settings/2fa`, `sessions`, `blocked-users`, …
- **Auth / legal:** `auth`, `sign-in`, `sign-up`, `legal/[slug]`, etc.

**Automated refresh:** run from repo root  
`Get-ChildItem -Recurse app\*.tsx | Select-Object -ExpandProperty FullName` (PowerShell) or `find app -name '*.tsx'` (Unix).

## Database touchpoints

There is **no single generated table list** in-repo. Practical approach:

1. Grep Expo + web + `backend/` for `.from('` and Supabase RPC names.
2. Treat **migrations** under `supabase/migrations/` as schema source of truth.
3. When adding a mirror screen, **copy the same `.from()` / tRPC procedure** as Expo — do not invent parallel tables.

## Data fetching patterns (Expo)

| Pattern | Where |
|---------|--------|
| Initial user bootstrap | `AppContext.loadUserData` (+ shared `fetchLoadUserDataParallelBundle`, feed loaders, `fetchConversationsBootstrap`, comment loaders) |
| Pagination | Per-feature (posts, lists); audit each screen |
| Caching | AsyncStorage writes in `AppContext` (`writeCache` / read paths) |
| Realtime | `setupRealtimeSubscriptions` in `AppContext` |
| Refresh | Pull-to-refresh / `loadUserData` retries per feature |

## Related docs

- Mirror architecture & shared modules: [`EXPO-NEXT-MIRROR-ARCHITECTURE.md`](./EXPO-NEXT-MIRROR-ARCHITECTURE.md)
- Honest parity + gaps: [`EXPO-NEXT-PARITY-AUDIT.md`](./EXPO-NEXT-PARITY-AUDIT.md)
- **Execution checklist:** [`EXPO-NEXT-MIRROR-MASTER-TODO.md`](./EXPO-NEXT-MIRROR-MASTER-TODO.md)
