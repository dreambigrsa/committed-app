# Expo ↔ Next mirror — master TODO (follow this)

This is the **single checklist** aligned to your requirements (analysis → shared logic → mirror rebuild → API/auth → parity → performance → validation → final differences).  
**Rule:** Check items off only when the **behavior matches Expo** (same backend, same procedures/queries, not a reimplementation).

**Honest status:** Full 1:1 mirror is a **program**, not one PR. Use this file to drive sprints.

---

## How to use

1. Work **top to bottom** within each phase (dependencies matter).
2. For each **Expo screen**, fill the route matrix row (§3) before building web UI.
3. When in doubt, **grep Expo** for the exact `trpc.` or `supabase.from` call and mirror it.
4. Keep [`EXPO-NEXT-PARITY-AUDIT.md`](./EXPO-NEXT-PARITY-AUDIT.md) updated as gaps close.

---

## Phase 1 — Full Expo app analysis (your §1)

| # | Task | Done |
|---|------|------|
| 1.1 | Maintain [`EXPO-APP-INTERNAL-MAP.md`](./EXPO-APP-INTERNAL-MAP.md) (navigation, contexts, API entry points). | ☑ (expanded stack / dating / admin) |
| 1.2 | Complete **root `Stack.Screen` inventory** from `app/_layout.tsx` (every screen name). | ☑ (see [`EXPO-APP-INTERNAL-MAP.md`](./EXPO-APP-INTERNAL-MAP.md)) |
| 1.3 | Export **dating stack** routes from `app/dating/_layout.tsx` + nested files. | ☑ (table in internal map) |
| 1.4 | Document **admin** route list (`app/admin/*.tsx` → capability). | ☑ (file list in internal map) |
| 1.5 | Grep-driven **Supabase table usage** pass: `contexts/`, `app/`, `backend/`, `web/` — attach summary table or link to spreadsheet. | ☑ (`EXPO-SUPABASE-TABLE-INVENTORY.md`, 92 Expo-side tables) |
| 1.6 | List **tRPC procedures** used by Expo (search `trpc.` / `api.` in `app/` + `contexts/`). | ☑ (scan result documented in `EXPO-APP-INTERNAL-MAP.md`: no direct `trpc.` call sites in `app/` + `contexts/`) |
| 1.7 | Document **pagination + cache keys** per heavy screen (feed, dating discovery, admin lists). | ☑ (documented in internal map notes; deeper per-screen profiling remains Phase 7) |

---

## Phase 2 — Reusable logic (your §2)

| # | Task | Done |
|---|------|------|
| 2.1 | Prefer **`@committed/shared`** for any loader used by both platforms; **remove** duplicate strings (select lists, limits, versions). | ☐ |
| 2.2 | Inventory **duplicated helpers** between `web/` and `contexts/` / `lib/` — file a list in PR description. | ☐ |
| 2.3 | Move **Zod schemas / validation** used by Expo forms into `packages/shared` if web forms mirror them. | ☐ |
| 2.4 | **Do not** fork business rules in web-only modules; if web needs a rule, **import shared** or call **same tRPC**. | ☐ |

**Already in shared (baseline):** feed loaders, bootstrap bundle, conversations bootstrap, comment loaders/trees, display name, user identity select, AI onboarding version, API base URL, feed visibility, core + feed realtime subscribers.

---

## Phase 3 — Rebuild Next as mirror (your §3)

| # | Task | Done |
|---|------|------|
| 3.1 | Maintain **route matrix** (spreadsheet or table below): `Expo path` → `Next path` → `Owner` → `Parity %` → `Notes`. | ☐ |
| 3.2 | **Tabs:** ensure `/home`, `/feed`, `/reels`, `/dating`, `/search`, `/notifications`, `/messages`, `/profile` all enter **`MobileWebAppShell` / `ExpoMirrorRoute`** with correct `initialTab` / URL sync. | ☐ |
| 3.3 | **Deep links:** `/post/:id`, `/reel/:id`, `/dating/user-profile` behave like `AppGate` + app (including `?web=1` preview rules if applicable). | ☐ |
| 3.4 | Every **admin** Expo screen: either **same data** via tRPC in web shell or explicit **“web admin = subset”** product sign-off. | ☐ |
| 3.5 | Every **dating** sub-screen: map to `/dating/[...module]` or dedicated page; **no orphan Expo-only flows** without a web story. | ☐ |

### Route matrix template (copy to spreadsheet)

| Expo route | Next route | Data source (tRPC / Supabase / shared loader) | Parity |
|------------|------------|-----------------------------------------------|--------|
| `(tabs)/home` | `/home`, `/app/...` | … | ☐ |
| `(tabs)/feed` | `/feed` | … | ☐ |
| … | … | … | ☐ |

---

## Phase 4 — API + database consistency (your §4)

| # | Task | Done |
|---|------|------|
| 4.1 | **Web tRPC:** all mutations that change shared state go through `web/lib/trpc-react.tsx` with bearer token (no shadow REST). | ☐ |
| 4.2 | **Supabase:** web uses **same project**; RLS-tested for browser anon key same as mobile. | ☐ |
| 4.3 | Audit **web-only `fetch()`** to custom endpoints — migrate to tRPC or documented exception. | ☐ |
| 4.4 | **Error handling:** map Supabase/tRPC errors to same user-visible messages as Expo where applicable. | ☐ |

---

## Phase 5 — Authentication sync (your §5)

| # | Task | Done |
|---|------|------|
| 5.1 | Document delta: **`AuthContext` + `AppGate`** vs **`WebAppGate`** (ordering, legal soft vs hard). | ☐ |
| 5.2 | **Product decision:** align **legal gating** (Expo soft enforcer vs web hard gate) OR document accepted difference. | ☐ |
| 5.3 | **Session:** ensure web does not require full page reload after sign-in; `onAuthStateChange` + RQ invalidation (`AuthSessionTrpcSync`) cover tRPC. | ☐ |
| 5.4 | **Long-term:** extract **`auth-core`** (session snapshot, “is verified”, intended route) used by both platforms. | ☐ |
| 5.5 | Password / magic-link / recovery: **same Supabase flows**; web API routes only for env limits (document each). | ☐ |

---

## Phase 6 — Feature parity checklist (your §6)

| Area | Task | Done |
|------|------|------|
| Feed / reels | Same loaders + realtime + moderation rules; likes/comments mutations match. | ☐ |
| Posting / media | Same validation + storage paths; web uses file input where native uses picker (expected). | ☐ |
| Messaging | `fetchConversationsBootstrap` + realtime; send message updates `conversations.last_message` like app. | ☐ |
| Notifications | Insert realtime; optional: polling fallback parity with `AppContext`. | ☐ |
| Dating | Discovery filters, likes, matches, blocks — same queries; web shell gaps listed in audit until closed. | ☐ |
| Roles / permissions | Admin routes gated by `role` same as Expo; ban / restriction modals if applicable. | ☐ |
| Relationship / verification | Same tables and status enums; no web-only shortcuts. | ☐ |

---

## Phase 7 — Performance + data (your §7)

| # | Task | Done |
|---|------|------|
| 7.1 | **Debounce / throttle** `loadAppData` triggers (e.g. `visibilitychange`) if they cause redundant full bootstrap. | ☐ |
| 7.2 | **Code-split** heavy routes (admin, dating subflows) where bundle size hurts LCP. | ☐ |
| 7.3 | Reuse **React Query** on web for tRPC reads; avoid duplicate `getSession()` in hot paths. | ☐ |
| 7.4 | Realtime: avoid **duplicate** channel setups on tab focus (single subscription per user session). | ☐ |

---

## Phase 8 — Final validation (your §8)

| # | Task | Done |
|---|------|------|
| 8.1 | **Smoke script:** same test user — sign in on both → feed count / one conversation / one notification row match (manual or automated). | ☐ |
| 8.2 | **Action parity:** post like, send message, accept legal (if applicable) — same DB rows. | ☐ |
| 8.3 | Update **[`EXPO-NEXT-PARITY-AUDIT.md`](./EXPO-NEXT-PARITY-AUDIT.md)** “remaining differences” until empty or explicitly waived. | ☐ |

---

## Final task — Remaining differences (your 🔍)

**Living document:** [`EXPO-NEXT-PARITY-AUDIT.md`](./EXPO-NEXT-PARITY-AUDIT.md) §7–§9.

When the program is “done” for your product scope, that section should list only:

- **Waived** differences (e.g. push notifications, camera hardware).
- **Environment** differences (documented).

---

## Cross-links

| Doc | Role |
|-----|------|
| [`EXPO-APP-INTERNAL-MAP.md`](./EXPO-APP-INTERNAL-MAP.md) | Expo structure |
| [`EXPO-NEXT-MIRROR-ARCHITECTURE.md`](./EXPO-NEXT-MIRROR-ARCHITECTURE.md) | Shared package + web wiring |
| [`EXPO-NEXT-PARITY-AUDIT.md`](./EXPO-NEXT-PARITY-AUDIT.md) | Gaps + checklist |

---

*Last created: master program tracker for mirror alignment.*
