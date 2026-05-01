# Expo Source Of Truth Audit

This document tracks the rebuild rule for the Next.js website: the Expo app is the source of truth, existing public URLs stay unchanged, and web routes must use the same Supabase tables and flow decisions.

## Expo Navigation Map

- Root/auth: `app/index.tsx`, `app/auth.tsx`, `app/sign-in.tsx`, `app/sign-up.tsx`, `app/signup.tsx`, `app/verify-email.tsx`, `app/reset-password.tsx`, `app/auth-callback.tsx`, `app/onboarding.tsx`
- Tabs: `home`, `feed`, `reels`, `dating`, `search`, `notifications`, `messages`, `profile`
- Content flows: `post/create`, `post/[postId]`, `reel/create`, `reel/[reelId]`, `status/create`, `status/[userId]`, `status-item/[statusId]`
- Relationship flows: `relationship/register`, `certificates/[relationshipId]`, `anniversary/[relationshipId]`, `legal/[slug]`
- Dating flows: `dating/profile-setup`, `dating/profile-preview`, `dating/filters`, `dating/likes-received`, `dating/matches`, `dating/date-requests`, `dating/create-date-request`, `dating/edit-date-request`, `dating/payment-submit`, `dating/premium`, `dating/user-profile`, `dating/photo-gallery`, `dating/video-player`
- Communication: `messages/[conversationId]`
- Settings/security: `settings/2fa`, `settings/blocked-users`, `settings/sessions`, `settings/become-professional`, `settings/professional-availability`
- Professional flows: `bookings/index`, `bookings/create`, `bookings/reschedule`, `professional/bookings`, `professional/reviews`, `professional/session-requests`
- Ads: `ads/index`, `ads/promote`, `ads/invoices`, `ads/receipt`
- Verification: `verification/index`, `verification/email`, `verification/phone`, `verification/id`, `verification/couple-selfie`
- Admin: all `app/admin/*` routes including users, relationships, dating, posts/reels review, professional profiles/sessions/reviews, pricing, legal policies, payments, reports, roles, settings, and safety tools

## Preserved Public Deep Links

These must keep the same URL structure:

- `/verify-email?token=...&email=...`
- `/reset-password`
- `/auth-callback`
- `/profile/[username-or-id]`
- `/post/[id]`
- `/reel/[id]`
- `/dating/user-profile?userId=...`
- `/referral/[code]`
- `/open`
- `/download`
- `/privacy`
- `/terms`

Internal web mirror navigation can use `/app/*`, `/home`, `/feed`, `/dating`, etc., but those public routes must continue to work directly from old shared links and email links.

## Supabase Tables Used By Expo

Core identity and auth-adjacent tables:

- `users`, `user_sessions`, `user_2fa`, `user_restrictions`, `blocked_users`, `follows`, `user_status`
- `verification_codes`, `verification_documents`, `verification_services`, `verification_service_configs`
- `legal_documents`, `user_legal_acceptances`

Social/content tables:

- `posts`, `post_likes`, `comments`, `comment_likes`
- `reels`, `reel_likes`, `reel_comments`
- `statuses`, `media`, `avatars`
- `notifications`, `messages`, `conversations`
- `reports`, `reported_content`, `activity_logs`

Relationship tables:

- `relationships`, `false_relationship_reports`, `disputes`, `couple_certificates`, `anniversaries`

Dating tables:

- `dating_profiles`, `dating_photos`, `dating_videos`, `dating_likes`, `dating_matches`, `dating_usage_tracking`
- `dating_date_requests`, `dating_date_options`, `dating_interests`, `user_dating_badges`, `user_subscriptions`
- `subscription_plans`, `dating_feature_limits`, `pricing_configuration`, `payment_methods`, `payment_submissions`

Professional tables:

- `professional_roles`, `professional_profiles`, `professional_applications`, `professional_status`
- `professional_sessions`, `professional_reviews`, `escalation_rules`, `escalation_events`

Ads/admin tables:

- `advertisements`, `advertisement_impressions`, `advertisement_clicks`, `ad_engagements`, `ad_payment_receipts`, `ad_system_settings`
- `admin_logs`, `app_settings`, `analytics_events`, `ban_appeals`, `roles`, `sticker_packs`, `stickers`, `trigger_words`, `warning_templates`
- `ai_prompt_versions`, `ai_prompt_suggestions`, `ai_message_feedback`, `face_matching_providers`, `face_verification_results`

Storage buckets referenced by Expo:

- `media`, `avatars`, `professional-credentials`

## Alignment Rules For Next.js

- Use `getSupabaseBrowser()` and the same Supabase project environment values as Expo.
- Use authenticated `auth.user.id` for all user-owned reads/writes; never hardcode or fall back to mock users.
- Preserve the app-opening public pages for shared `post`, `reel`, and `dating/user-profile` links; use `?web=1` or `/app/*` for internal web-only navigation.
- Public `/dating/user-profile?userId=...` remains an app-opening shared link; internal `/app/dating/user-profile?userId=...` and optional `?web=1` render the browser mirror without changing the public URL contract.
- Admin pages must remain role gated by `admin`, `super_admin`, or `moderator`.
- Settings `2fa` and `sessions` must read/write `user_2fa` and `user_sessions`, matching Expo screens.
- Settings `professional-availability` must read/write `professional_profiles` and `professional_status`, including session limits, quiet hours, service mode, pricing, and current status.
- Booking creation must select approved active `professional_profiles` instead of asking for raw IDs.

## Current Web Rebuild Status

- Mirror route coverage exists for the Expo top-level and nested route families.
- Public deep link routes remain concrete pages, not catch-all redirects.
- Web auth state resolves only from Supabase session/user and reloads the matching `users` row.
- Feed, reels, statuses, profile, dating, messaging, relationship registration, verification, ads, professional booking, settings, and admin route families are mounted in the mobile-style shell.
- Dating profile detail now loads the requested `dating_profiles`, `dating_photos`, `dating_videos`, `users`, reaction state, badges, and conversation starters by `userId`, matching the mobile detail flow instead of relying on the current discovery card.
- Messages now support direct `/app/messages/[conversationId]` hydration, image/document attachments, and the same `messages.media_url`, `messages.document_url`, and `messages.message_type` fields used by Expo.
- Notifications resolve to the corresponding mirror route for posts, reels, statuses, conversations, dating likes/matches/date requests, bookings, payments, relationships, and profiles.
- Internal web post routes now hydrate `/app/post/[id]` from `posts`, `post_likes`, `comments`, and `comment_likes`, with threaded replies and an in-shell comment composer instead of sending users out to the public shared-link page.
- Internal web reel routes now hydrate `/app/reel/[id]` from `reels`, `reel_likes`, `reel_comments`, and `reel_comment_likes`, with threaded replies and in-shell comments while preserving public `/reel/[id]` app-opening behavior.
- Internal web profile routes now resolve by user ID or username and load visible profile posts using the same `posts` visibility helper as the feed.
- Internal status routes now hydrate direct `/app/status/[userId]` and `/app/status-item/[statusId]` targets from `statuses` when they are not already present in the shell status strip.
- Admin hub coverage now includes the Expo admin sections for users, reports, roles, relationship reports, verification services, professional sessions/reviews, pricing/payments, stickers, warnings, logs, and safety tools, with role gating kept in place.
- Web admin ID approval now mirrors the mobile verification behavior by approving `verification_documents` and updating the matching `users.id_verified` / `users.verified` flags, so the admin card cannot appear approved while the user remains unverified.
- Web admin payment approval now selects the updated `payment_submissions` row, fails if no row was changed, lets the existing database trigger activate subscription payments, and mirrors the mobile ad flow by updating `advertisements`, creating `ad_payment_receipts`, and notifying the user.
- Ad invoices now query only columns that exist on `ad_payment_receipts`; the UI displays missing receipt status as `issued` instead of selecting a non-existent `status` column.
- Web false relationship reports now mirror the mobile safety flow: review/dismiss actions keep the relationship visible, while the explicit end action ends the related active relationship rows, resolves matching open reports, and notifies affected users.
- Web ban appeals now mirror mobile behavior by updating `ban_appeals`, lifting the linked restriction or full ban on approval, leaving restrictions active on rejection, and notifying the user.
- Web Dating Admin now mirrors the mobile management actions for `dating_profiles`: suspend/unsuspend, limit/unlimit, guarded delete, 7-day premium trial via `grant_trial_premium`, and verified/premium badge grants through `user_dating_badges`.
- Web Professional Reviews admin now mirrors mobile moderation by updating `professional_reviews.moderation_status`, moderation metadata, and visible review state for approve, flag, and reject actions.
- Remaining parity work should continue screen-by-screen, replacing any web placeholder with the exact Expo table/query/action for that screen.
