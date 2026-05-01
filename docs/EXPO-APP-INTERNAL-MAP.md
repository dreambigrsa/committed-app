# Expo app — internal map (living)

**Purpose:** Section **1** of the mirror program — how the native app is structured before changing web. Update this file when routes or architecture change.

## Navigation

### Root stack (`app/_layout.tsx`)

**Explicit `Stack.Screen` registrations** (Expo Router still discovers other file-based routes; this is what the root layout names):

| `Stack.Screen` name | Header / notes |
|---------------------|----------------|
| `index` | `headerShown: false` |
| `auth` | `headerShown: false` |
| `sign-in` | `headerShown: false` |
| `sign-up` | `headerShown: false` |
| `signup` | `headerShown: false` |
| `auth-callback` | `headerShown: false` |
| `onboarding` | `headerShown: false`, `presentation: fullScreenModal` |
| `verify-email` | `headerShown: false` |
| `reset-password` | `headerShown: false` |
| `legal/[slug]` | Title: Legal Document |
| `(tabs)` | `headerShown: false` |
| `profile/[userId]` | Title: Profile |
| `relationship/register` | Modal, Register Relationship |
| `messages/[conversationId]` | Title: Chat |
| `admin/index` | Admin Dashboard |
| `admin/advertisements` | Advertisements |
| `admin/stickers` | Sticker Management |
| `settings` | Settings |
| `settings/2fa` | Two-Factor Authentication |
| `settings/sessions` | Active Sessions |
| `settings/blocked-users` | Blocked Users |
| `settings/become-professional` | Become a Professional |
| `settings/professional-availability` | Professional Availability |
| `professional/session-requests` | Session Requests |
| `dating` | `headerShown: false` (stack of dating screens) |
| `dating/premium` | `headerShown: false` |
| `dating/payment-submit` | `headerShown: false` |
| `+not-found` | 404 |

**File-based routes not repeated above** still resolve (e.g. `admin/users.tsx` → `/admin/users`). Inventory: **35** files under `app/admin/*.tsx`, plus other top-level folders (`post/`, `reel/`, `bookings/`, `verification/`, `status/`, `ads/`, `certificates/`, `anniversary/`, etc.).

### Dating stack (`app/dating/*.tsx`)

| File | Typical path |
|------|----------------|
| `_layout.tsx` | Stack wrapper + back to dating home |
| `dashboard.tsx` | `/dating/dashboard` |
| `filters.tsx` | `/dating/filters` |
| `matches.tsx` | `/dating/matches` |
| `likes-received.tsx` | `/dating/likes-received` |
| `user-profile.tsx` | `/dating/user-profile` |
| `profile-setup.tsx` | `/dating/profile-setup` |
| `profile-preview.tsx` | `/dating/profile-preview` |
| `photo-gallery.tsx` | `/dating/photo-gallery` |
| `video-player.tsx` | `/dating/video-player` |
| `date-requests.tsx` | `/dating/date-requests` |
| `create-date-request.tsx` | `/dating/create-date-request` |
| `edit-date-request.tsx` | `/dating/edit-date-request` |
| `premium.tsx` | `/dating/premium` |
| `payment-submit.tsx` | `/dating/payment-submit` |

### Admin screens (`app/admin/*.tsx`)

`index`, `advertisements`, `analytics`, `ban-appeals`, `dating`, `dating-date-options`, `dating-interests`, `disputes`, `escalation-rules`, `escalation-rules-fixed`, `face-matching`, `false-relationship-reports`, `id-verifications`, `legal-policies`, `logs`, `payment-methods`, `payment-proof-viewer`, `payment-verifications`, `posts-review`, `pricing`, `professional-analytics`, `professional-profiles`, `professional-reviews`, `professional-roles`, `professional-sessions`, `relationships`, `reports`, `reels-review`, `roles`, `settings`, `stickers`, `trigger-words`, `users`, `verification-services`, `warning-templates`.

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
