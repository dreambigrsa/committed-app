# Mobile-Web System Audit and Alignment

## Scope

This audit maps mobile and web data architecture to enforce one shared backend (same Supabase project, same tables, same logic).

## 1) Mobile Repository Analysis

### Database connections (mobile)

- `lib/supabase.ts`: primary mobile Supabase client (`createClient`) using:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `lib/supabase-auth-api.ts`: direct auth REST (`/auth/v1/user`) for password update.
- `lib/trpc.ts`: tRPC client wiring (`/trpc`) with Supabase access token auth header.

### Core mobile table usage (inventory by domain)

- **Identity/Auth:** `users`, `profiles`, `user_sessions`, `user_2fa`, `user_onboarding_data`, `user_settings`
- **Social graph/content:** `relationships`, `relationship_requests`, `follows`, `posts`, `post_likes`, `comments`, `comment_likes`, `reels`, `reel_likes`, `reel_comments`, `reel_comment_likes`, `statuses`, `status_views`, `status_visibility`, `status_reactions`
- **Messaging:** `conversations`, `messages`
- **Dating:** `dating_profiles`, `dating_photos`, `dating_videos`, `dating_likes`, `dating_passes`, `dating_matches`, `dating_date_requests`, `dating_interests`, `dating_usage_tracking`
- **Moderation/Admin:** `notifications`, `disputes`, `reported_content`, `ban_appeals`, `user_restrictions`, `activity_logs`, `false_relationship_reports`
- **Professional:** `professional_roles`, `professional_profiles`, `professional_sessions`, `professional_reviews`, `professional_status`, `professional_applications`
- **Ads/Payments:** `advertisements`, `advertisement_impressions`, `advertisement_clicks`, `ad_engagements`, `ad_payment_receipts`, `payment_submissions`, `payment_methods`, `ad_system_settings`
- **Legal/Verification:** `legal_documents`, `user_legal_acceptances`, `verification_codes`, `verification_documents`

### Full table inventory found in mobile/shared code scan

`activity_logs`, `ad_engagements`, `ad_payment_receipts`, `ad_system_settings`, `advertisement_clicks`, `advertisement_impressions`, `advertisements`, `ai_message_feedback`, `ai_prompt_suggestions`, `ai_prompt_versions`, `ai_user_learnings`, `anniversaries`, `app_settings`, `auth_tokens`, `avatars`, `ban_appeals`, `blocked_users`, `chat_backgrounds`, `cheating_alerts`, `comment_likes`, `comments`, `conversations`, `couple_achievements`, `couple_certificates`, `daily_questions`, `dating_compatibility_scores`, `dating_date_options`, `dating_date_requests`, `dating_feature_limits`, `dating_interests`, `dating_likes`, `dating_matches`, `dating_passes`, `dating_photos`, `dating_profiles`, `dating_usage_tracking`, `dating_videos`, `disputes`, `escalation_events`, `escalation_rules`, `face_embeddings`, `face_matching_providers`, `false_relationship_reports`, `follows`, `friends`, `infidelity_reports`, `legal_documents`, `media`, `message_warnings`, `messages`, `notifications`, `payment_methods`, `payment_submissions`, `post_likes`, `posts`, `pricing_configuration`, `professional_applications`, `professional_profiles`, `professional_reviews`, `professional_roles`, `professional_sessions`, `professional_status`, `profiles`, `push_notification_tokens`, `reel_comment_likes`, `reel_comments`, `reel_likes`, `reels`, `relationship_milestones`, `relationship_requests`, `relationships`, `reported_content`, `status_reactions`, `status_stickers`, `status_views`, `status_visibility`, `statuses`, `sticker_packs`, `stickers`, `subscription_plans`, `trigger_words`, `user_2fa`, `user_dating_badges`, `user_legal_acceptances`, `user_onboarding_data`, `user_restrictions`, `user_sessions`, `user_settings`, `user_status`, `user_subscriptions`, `users`, `verification_codes`, `verification_documents`, `verification_service_configs`, `warning_templates`.

### Schema/relationship map from SQL files

- `users.id` references `auth.users(id)` and is the root identity row for app-owned profile data.
- `profiles.id` is used for email-verification state and auth-adjacent profile status.
- `relationships.user_id`, `relationships.partner_user_id`, `relationship_requests.from_user_id`, and `relationship_requests.to_user_id` reference `users`.
- Feed content uses `posts.user_id -> users.id`, `post_likes.post_id -> posts.id`, `comments.post_id -> posts.id`, and `comments.user_id -> users.id`.
- Reels content uses `reels.user_id -> users.id`, `reel_likes.reel_id -> reels.id`, and `reel_comments.reel_id -> reels.id`.
- Messaging uses `messages.conversation_id -> conversations.id`, plus `messages.sender_id` and `messages.receiver_id` to `users.id`.
- Dating uses `dating_profiles.user_id -> users.id`; `dating_photos`, `dating_videos`, `dating_likes`, `dating_passes`, `dating_matches`, and `dating_date_requests` are user/profile interaction tables keyed back to users and matches.
- Professional flows use `professional_profiles.user_id -> users.id`, `professional_sessions.user_id/professional_id`, and reviews/applications linked to users/professionals.
- Admin/moderation flows use `notifications.user_id`, `disputes.relationship_id`, `activity_logs.user_id`, `reported_content.reporter_id/reported_user_id`, and `false_relationship_reports` against existing app tables.

### Mobile RPC/functions/endpoints

- RPCs found: `check_conversation_starter_limit`, `check_dating_feature_limit`, `check_dating_message_limit`, `check_pending_session_timeouts`, `create_ai_user`, `create_notification`, `decrement_professional_session_count`, `delete_user_account`, `get_dating_discovery`, `grant_trial_premium`, `increment_professional_session_count`, `insert_user_legal_acceptance`, `public_relationship_search`, `search_users`, `send_ai_message`, `track_dating_usage`, `update_ai_learnings`.
- Edge functions found: `admin-delete-user`, `ai-chat`, `ai-suggest-prompts`, `check-session-timeouts`, `create-sample-users`, `delete-sample-users`, `enforce-quiet-hours`, `openai-chat`, `openai-image`, `request-password-reset`, `reset-password`, `send-email`, `send-push`, `send-sms`, `send-verification`, `set-openai-key`, `status-lifecycle`, `verify-email`.
- Web API endpoints used by mobile include:
  - `/api/auth/send-verification`
  - `/api/auth/verify-email`
  - `/api/auth/request-password-reset`
  - `/api/auth/reset-password`
  - `/api/auth/send-verification-code`
  - `/trpc/*` routes for dating, relationship ending, admin, certificates, milestones, and analytics when configured through `EXPO_PUBLIC_COMMITTED_API_BASE_URL`.

### Mobile auth/session and state refresh

- `contexts/AuthContext.tsx` has robust recovery: restore, sync, refresh token handling, foreground refresh, and auth event processing.
- `contexts/AppContext.tsx` centralizes data state, cache hydration, and realtime subscriptions for key domains.
- Data patterns: authenticated reads use `supabase.auth.getSession()` or `supabase.auth.getUser()`; domain queries filter by `user.id`, relationship participant ids, moderation status, and per-feature limits. Feed/reels typically page with ordered `created_at` limits; dating discovery uses RPC/service filtering; chat loads conversation-scoped ordered messages and hides deleted-for-current-user records.

## 2) Website Audit

### Website database connection

- `web/lib/supabase-client.ts` and `web/lib/env.ts` default to the same production Supabase project as mobile (`https://dizcuexznganwgddsrfo.supabase.co`) unless explicitly overridden by `NEXT_PUBLIC_ALLOW_ALT_SUPABASE=true`.
- `web/lib/supabase-server.ts` uses service role for server route handlers.

### Web table/endpoints usage

- Web uses the same major domains/tables as mobile (users, posts/reels/messages, relationships, dating, admin/professional, legal/verification).
- Web auth routes in `web/app/api/auth/*` are actively used by web auth pages/components.
- The locally viewed website at `http://localhost:8081` is the Expo web build, so shared files under `contexts/`, `app/`, and `lib/` are part of the web runtime too. Changes in `web/` only affect the deployed Next website, not this Expo web dev surface.

### Identified parity gaps (pre-fix)

- Community feed/reels in web module panels did not enforce mobile moderation visibility filtering.
- Web messages panel did not apply mobile deleted-message visibility rules.
- Auth/session recovery depth on web is thinner than mobile.
- Duplicate web logic surfaces (`MobileWebAppShell` and `WebModulePanels`) can diverge.
- Shared post/reel preview pages still had cached-session-only interaction identity reads.
- Expo web could display stale/email-like identity values from cache or raw `users.full_name`, especially after account switching, while mobile relied more heavily on the current app context and fresh profile row.

## 3) Alignment Changes Applied (this pass)

### A) Community moderation parity

- Updated `web/components/WebModulePanels.tsx` `CommunityPanel.load`:
  - `posts` now filtered with mobile-equivalent visibility:
    - approved content or current user's content.
  - `reels` now filtered with mobile-compatible visibility:
    - `status=approved` OR `moderation_status=approved` OR current user's content.

### B) Message deletion parity

- Updated `web/components/WebModulePanels.tsx` `MessagesPanel.loadMessages`:
  - selects `deleted_for_sender` and `deleted_for_receiver`
  - filters out messages deleted for current user (matching mobile behavior)

### C) Auth/session recovery hardening parity

- Updated `web/components/WebAppGate.tsx`:
  - added retry-based auth resolution (`getUser` + `getSession` fallback)
  - added `onAuthStateChange` reload hooks (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`)
  - added `visibilitychange` reload to recover state after tab/background transitions

- Updated `web/components/MobileWebAppShell.tsx`:
  - added retry-based auth user resolution (`getUser` + `getSession` fallback)
  - added `onAuthStateChange` and `visibilitychange` reload behavior
  - aligned reels query visibility with mobile moderation behavior (`status`/`moderation_status` approved or own content)

### D) Auth identity parity for shared content previews

- Updated `web/app/post/[id]/page.tsx` and `web/app/reel/[id]/page.tsx` so likes/comments resolve the current user with validated `auth.getUser()` first and only fall back to session user id.
- Updated shared post/reel preview author/comment selects to include `username`, `email`, and `profile_picture`, then display names through one web helper instead of raw `full_name`.

### E) Expo web identity and cache parity

- Added `lib/identity.ts` for shared Expo/mobile display-name resolution:
  - prefer `username`
  - then non-email `full_name`
  - then email prefix fallback
- Updated `contexts/AppContext.tsx` so current user, cached auth shell, feed posts, reels, post comments, reel comments, conversations, share lookups, realtime inserts, and optimistic local creates all use the same display-name rule and fetch `username/email/profile_picture` where needed.
- Updated `contexts/AuthContext.tsx` so missing-auth-session refresh attempts are treated as recoverable/no-session states instead of noisy console errors on web startup.
- Updated AI quick system responses so account-name questions use the real supplied profile name/username rather than a generic fallback.

## 4) Remaining Alignment Work (next passes)

- Consolidate web data loading to one canonical path to avoid shell/panel divergence.
- Bring web auth/session sync closer to mobile recovery behavior.
- Continue field-by-field parity checks for profile/admin/dating flows and realtime update behavior.

## 5) Validation Checklist

- Signup, login, verification, session persistence across refresh/background.
- Profile identity parity (username/photo/role) across mobile and web.
- Feed/reels visibility parity for moderated/unmoderated content.
- Messages parity including deleted-message semantics.
- Dating candidate parity under same user and filter conditions.
- Admin queues and counts parity for same account and role.
