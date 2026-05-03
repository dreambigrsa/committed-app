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
- Internal web post routes now hydrate `/app/post/[id]` from `posts`, `post_likes`, `comments`, and `comment_likes`, with threaded replies, comment like/edit/delete/report actions, and an in-shell comment composer instead of sending users out to the public shared-link page.
- Internal web reel routes now hydrate `/app/reel/[id]` from `reels`, `reel_likes`, `reel_comments`, and `reel_comment_likes`, with threaded replies, comment like/edit/delete/report actions, and in-shell comments while preserving public `/reel/[id]` app-opening behavior.
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
- Web Dating Interests admin now mirrors the mobile `app/admin/dating-interests.tsx` flow by reading `dating_interests` with `display_order`, adding rows with `name`, `icon_emoji`, `category`, `created_by`, toggling `is_active`, and deleting guarded rows.
- Web Date Options admin now mirrors the mobile `app/admin/dating-date-options.tsx` flow by grouping `dating_date_options` by `option_type`, adding `option_value` / `display_label` choices, and supporting activate/deactivate/delete actions against the same table.
- Web Professional Roles admin now mirrors the mobile `app/admin/professional-roles.tsx` role editor by managing `professional_roles` fields for credentials, verification, live chat eligibility, approval requirement, disclaimers, display order, active state, create/update, and guarded delete.
- Web Payment Methods admin now mirrors `app/admin/payment-methods.tsx` / `lib/payment-admin-service.ts` by reading and writing `payment_methods` fields for `payment_type`, JSON `account_details`, `instructions`, `display_order`, `icon_emoji`, active state, create/update, and guarded delete.
- Web Trigger Words admin now mirrors `AppContext.getTriggerWords/addTriggerWord/updateTriggerWord/deleteTriggerWord` by using `trigger_words.word_phrase`, `severity`, `category`, `active`, `created_by`, and the same add/edit/toggle/delete behavior allowed for admins and moderators.
- Web Warning Templates admin now mirrors `AppContext.getWarningTemplates/updateWarningTemplate` by reading and updating `warning_templates.title_template`, `message_template`, `in_chat_warning_template`, `description`, and `active` instead of the previous generic placeholder columns.
- Concrete web route adapters now exist for Expo shortcut screens that previously relied only on the shell catch-all: `/create-post`, `/create-reel`, `/create-status`, `/post/create`, `/reel/create`, `/status/create`, `/dating-likes`, `/dating-preferences`, and `/dating-profile`. These render the mobile-style shell while leaving public shared `/post/[id]`, `/reel/[id]`, and `/dating/user-profile?userId=...` links intact.
- Web sign-in no longer waits on the legacy `profiles.is_verified` lookup. It signs in with Supabase auth, resolves the authenticated user with a bounded timeout, and redirects into `/app`; `WebAppGate` now uses the same `users.email_verified` plus Supabase `email_confirmed_at` source as the mobile identity flow.
- Web verification/password reset API routes no longer depend on the old `profiles` table. `/api/auth/send-verification`, `/api/auth/request-password-reset`, and `/api/auth/verify-email` resolve the same `users.id` used by Expo, then fall back to Supabase Auth only when needed; `/verify-email` now updates `users.email_verified` / `users.verified` so the gate and mobile app read the same verified state.
- Web ID verification now loads the latest `verification_documents` row for the signed-in user, displays pending/approved/rejected status like `app/verification/id.tsx`, blocks duplicate pending/approved submissions, and only resubmits a rejected document back to `pending`.
- Web couple-selfie verification now enforces the same ownership and verified-relationship checks as `app/verification/couple-selfie.tsx` before creating a `couple_certificates` row.
- Web certificate/anniversary routes now hydrate the requested `relationships` row by route `relationshipId` and load the matching `couple_certificates` row, so direct `/certificates/[id]` links are not dependent on the first relationship loaded in the shell.
- Web notifications now mirror the mobile notification actions more closely: tapping marks the row read, routes follow/status/dating/message/payment/relationship events to the right web target, and users can delete individual notifications or clear all rows against the same `notifications` table.
- Web settings now includes the mobile account deletion behavior through the same `delete_user_account` RPC, clears user-scoped web state, signs out of Supabase, and redirects to `/auth` instead of leaving stale session data behind.
- Web settings now reads and saves the same `user_settings.notification_settings` and `user_settings.privacy_settings` JSON used by Expo, so profile visibility, phone search visibility, and notification toggles are no longer web-only local UI.
- Web dating likes/matches now behave closer to mobile: likes open the liker dating profile and match cards start/open the direct conversation using the shared `conversations` and `messages` flow.
- Web dating date requests now use the same `dating_date_requests` field contract as `lib/dating-service.ts`: `date_location`, `date_time`, `date_duration_hours`, suggested activities, people count, gender preference, dress/budget/expense fields, ownership-checked accept/decline/cancel, notifications, and pending-request editing through `/app/dating/edit-date-request?dateRequestId=...`.
- Web status creation now writes the same `statuses.privacy_level` and `statuses.background_color` fields used by the Expo story creator instead of hardcoding followers/blue for every web status.
- `WebAppGate` now has bounded auth/onboarding loading so a slow auth/session/legal/onboarding query produces an error/retry state instead of an endless "Preparing your web app" spinner.
- Website landing page now mirrors the Expo landing screen content instead of using a separate marketing-only structure: public relationship check, dating, verified relationship registration, professional support, integrity alerts, privacy control, and unchanged app/download/auth calls to action.
- Public web relationship search now mirrors the mobile landing behavior by calling `public_relationship_search` first and falling back to verified public `relationships` rows when the RPC is unavailable. User reports do not hide records automatically; only admin relationship actions should end/remove them.
- Web in-app search now mirrors the Expo search screen more closely: text and photo search modes, relationship status filters, verified/pending/single/member chips, relationship privacy/type badges, non-registered partner results from `relationships`, and the same `get_relationships_for_face_search`/`partner_face_photo` data path for face-search candidates.
- Web Reports admin now mirrors `app/admin/reports.tsx` by reading `reported_content` with reporter/reported/content/review fields and supporting resolve, dismiss, and guarded content deletion against the same content tables.
- Web Roles admin now mirrors `app/admin/roles.tsx` by reading role-bearing `users` rows and allowing super admins to update roles while keeping normal admins/moderators read-only.
- Web Verification Services admin now reads `verification_service_configs.service_type/provider/enabled/config` and lets super admins toggle the same provider records used by mobile verification.
- Web Stickers admin now reads `sticker_packs` instead of the wrong direct `stickers` table and supports active/featured toggles for chat/comment sticker packs.
- Web Admin Settings now reads and saves `app_settings` values through the same table used by mobile operational settings, with super-admin-only writes.
- Web Disputes admin now mirrors `app/admin/disputes.tsx` by reading `disputes.relationship_id`, `dispute_type`, `auto_resolve_at`, resolution fields, and using the same confirm/reject behavior for end-relationship disputes, including ending reciprocal relationship rows when confirmed.
- Web Escalation Rules admin now reads the same `escalation_rules` timing, attempt, strategy, confirmation, priority, and active fields as mobile and supports active/inactive toggles.
- Web Face Matching admin now reads the same `face_matching_providers` provider type, threshold, max result, enabled/active fields as mobile and supports super-admin provider toggles.
- Web Logs admin now reads `activity_logs` with the linked actor from `users` and keeps the mobile super-admin-only restriction.
- Web Analytics and Professional Analytics now render dashboard summaries from the same loaded users, relationships, posts, reels, payment submissions, analytics events, and professional session tables used elsewhere in the mirror shell.
- Web ad invoices/receipts now use `ad_payment_receipts.issued_at` and joined ad placement/billing fields like the Expo invoice and receipt screens instead of relying on receipt creation time.
- Web booking reschedule now pre-fills the existing `professional_sessions.scheduled_date`, duration, location, and notes context and blocks past dates, matching the mobile reschedule validation.
- Web professional session requests now use `professional_sessions` rows with `status = pending_acceptance`, show the assigned user/role/AI summary, and support accept/decline actions that update the same status fields used by Expo. Accept also increments professional session count, sends the AI introduction message, and routes to the conversation.
- Web professional "My Bookings" now loads the signed-in professional's own `professional_sessions`, separates upcoming/past/all like the Expo professional bookings screen, and supports message, confirm, complete, reschedule, and cancel actions against the same booking status fields.
- Web professional "My Reviews" now mirrors the Expo professional reviews screen by showing rating summary cards and loading only approved `professional_reviews` rows with reviewer/session context.
- Web My Ads now mirrors the Expo ad center more closely by loading full `advertisements` rows, joining live impression/click/engagement counts from `advertisement_impressions`, `advertisement_clicks`, and `ad_engagements`, and supporting CTA open/click tracking, receipts, pause/resume, edit prefill, and guarded delete.
- Web Admin Manage Advertisements now exposes the mobile moderation and billing actions for ads: approve creative, reject with reason, mark paid with `ad_payment_receipts` creation, mark unpaid, and activate only when creative and payment are both approved.
- Web Admin Professional Sessions now mirrors the Expo queue filters with session type and status controls over `professional_sessions`, making pending, active, ended, declined, live chat, bookings, scheduled, and escalated sessions easier to audit.
- Remaining parity work should continue screen-by-screen, replacing any web placeholder with the exact Expo table/query/action for that screen.
