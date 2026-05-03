# Next Web Screen Coverage

This file tracks Expo screen coverage in the Next.js web mirror. Public shared/deep-link routes are kept as stable public URLs, while authenticated in-app web screens are available through either the same route family or `/app/*` shell routes.

## Public Deep Links Preserved

- `/post/[id]` opens the existing public shared post experience; `/post/create` is a concrete create-post mirror route.
- `/reel/[id]` opens the existing public shared reel experience; `/reel/create` is a concrete create-reel mirror route.
- `/dating/user-profile?userId=...` remains the public app-opening dating profile share route; `/app/dating/user-profile?userId=...` renders the browser mirror.
- `/profile/[userId-or-username]` remains the public profile route.
- `/verify-email`, `/reset-password`, `/auth-callback`, `/download`, `/privacy`, and `/terms` remain public routes.

## Tab Screens

- `app/(tabs)/home.tsx` -> `/home`, `/app/home`
- `app/(tabs)/feed.tsx` -> `/feed`, `/app/feed`
- `app/(tabs)/reels.tsx` -> `/reels`, `/app/reels`
- `app/(tabs)/dating.tsx` -> `/dating`, `/app/dating`
- `app/(tabs)/search.tsx` -> `/search`, `/app/search`
- Search now includes the mobile-style text/photo mode switch, result filter chips, richer relationship cards, registered/non-registered partner handling, and the existing relationship face-photo candidate path without changing public URLs.
- `app/(tabs)/notifications.tsx` -> `/notifications`, `/app/notifications`
- Notification actions now mark read, delete, clear all, and route message, post, reel, status, dating, payment, profile, and relationship request events to their matching web screens.
- `app/(tabs)/messages.tsx` -> `/messages`, `/app/messages`
- `app/(tabs)/profile.tsx` -> `/profile`, `/app/profile`

## Content Screens

- `app/post/create.tsx` -> `/post/create`, `/create-post`, `/app/post/create`
- `app/post/[postId].tsx` -> `/post/[id]` public, `/app/post/[id]` internal mirror
- Internal post and reel comment threads support the same core mobile actions: add replies, like/unlike comments, edit/delete own comments, and report other users' comments through `reported_content`.
- `app/reel/create.tsx` -> `/reel/create`, `/create-reel`, `/app/reel/create`
- `app/reel/[reelId].tsx` -> `/reel/[id]` public, `/app/reel/[id]` internal mirror
- `app/status/create.tsx` -> `/status/create`, `/create-status`, `/app/status/create`
- Web status create writes text/media, privacy level, background color, 24-hour expiry, and archive state to the same `statuses` table fields.
- `app/status/[userId].tsx` -> `/status/[userId]`, `/app/status/[userId]`
- `app/status-item/[statusId].tsx` -> `/status-item/[statusId]`, `/app/status-item/[statusId]`
- `app/profile/[userId].tsx` -> `/profile/[userId]` public, `/app/profile/[userId]` internal mirror

## Dating Screens

- `app/dating/dashboard.tsx` -> `/dating/dashboard`, `/app/dating/dashboard`
- `app/dating/likes-received.tsx` -> `/dating/likes-received`, `/dating-likes`, `/app/dating/likes-received`
- `app/dating/matches.tsx` -> `/dating/matches`, `/app/dating/matches`
- Web likes open the sender dating profile and matches open/create the direct conversation through the same `conversations` table flow.
- `app/dating/date-requests.tsx` -> `/dating/date-requests`, `/app/dating/date-requests`
- `app/dating/create-date-request.tsx` -> `/dating/create-date-request`, `/app/dating/create-date-request`
- `app/dating/edit-date-request.tsx` -> `/dating/edit-date-request`, `/app/dating/edit-date-request`
- Web date requests now read/write the same `date_location`, `date_time`, `date_duration_hours`, suggested activities, people count, gender preference, budget, dress, expense, response, and notification fields used by `lib/dating-service.ts`; pending sent requests can be edited at `/app/dating/edit-date-request?dateRequestId=...`.
- `app/dating/filters.tsx` -> `/dating/filters`, `/dating-preferences`, `/app/dating/filters`
- `app/dating/profile-setup.tsx` -> `/dating/profile-setup`, `/dating-profile`, `/app/dating/profile-setup`
- `app/dating/profile-preview.tsx` -> `/dating/profile-preview`, `/app/dating/profile-preview`
- `app/dating/photo-gallery.tsx` -> `/dating/photo-gallery`, `/app/dating/photo-gallery`
- `app/dating/payment-submit.tsx` -> `/dating/payment-submit`, `/app/dating/payment-submit`
- `app/dating/premium.tsx` -> `/dating/premium`, `/app/dating/premium`
- `app/dating/user-profile.tsx` -> `/dating/user-profile?userId=...` public, `/app/dating/user-profile?userId=...` internal mirror
- `app/dating/video-player.tsx` -> `/dating/video-player`, `/app/dating/video-player`

## Account, Settings, Verification

- `app/auth.tsx`, `app/sign-in.tsx`, `app/sign-up.tsx`, `app/signup.tsx` -> `/auth`, `/sign-in`, `/sign-up`, `/signup`
- `app/onboarding.tsx` -> `/onboarding`
- `app/settings.tsx` -> `/settings`, `/app/settings`
- `app/settings/2fa.tsx` -> `/settings/2fa`, `/app/settings/2fa`
- `app/settings/blocked-users.tsx` -> `/settings/blocked-users`, `/app/settings/blocked-users`
- `app/settings/sessions.tsx` -> `/settings/sessions`, `/app/settings/sessions`
- `app/settings/become-professional.tsx` -> `/settings/become-professional`, `/app/settings/become-professional`
- `app/settings/professional-availability.tsx` -> `/settings/professional-availability`, `/app/settings/professional-availability`
- Web settings sign-out and account deletion now clear user-scoped state and use the same Supabase sign-out / `delete_user_account` RPC path as mobile.
- Web settings now persists privacy and notification controls through `user_settings`, matching the mobile Settings source of truth for profile visibility, phone search, and notification preferences.
- `app/verification/index.tsx` -> `/verification`, `/app/verification`
- `app/verification/email.tsx` -> `/verification/email`, `/app/verification/email`
- `app/verification/phone.tsx` -> `/verification/phone`, `/app/verification/phone`
- `app/verification/id.tsx` -> `/verification/id`, `/app/verification/id` with latest `verification_documents` status, duplicate-submit protection, and rejected-document resubmission
- `app/verification/couple-selfie.tsx` -> `/verification/couple-selfie`, `/app/verification/couple-selfie` with verified relationship ownership checks before certificate creation
- `app/legal/[slug].tsx` -> `/legal/[slug]`, `/app/legal/[slug]`

## Relationship, Ads, Bookings, Professionals

- `app/relationship/register.tsx` -> `/relationship/register`, `/app/relationship/register`
- `app/certificates/[relationshipId].tsx` -> `/certificates/[relationshipId]`, `/app/certificates/[relationshipId]`
- `app/anniversary/[relationshipId].tsx` -> `/anniversary/[relationshipId]`, `/app/anniversary/[relationshipId]`
- `app/ads/index.tsx` -> `/ads`, `/app/ads`
- Web My Ads now loads the same campaign fields and ad performance tables as Expo, including impressions, clicks, engagement counts, receipts, CTA click/open, pause/resume, edit, and delete actions.
- `app/ads/promote.tsx` -> `/ads/promote`, `/app/ads/promote`
- `app/ads/invoices.tsx` -> `/ads/invoices`, `/app/ads/invoices`
- `app/ads/receipt.tsx` -> `/ads/receipt`, `/app/ads/receipt`
- `app/bookings/index.tsx` -> `/bookings`, `/app/bookings`
- `app/bookings/create.tsx` -> `/bookings/create`, `/app/bookings/create`
- `app/bookings/reschedule.tsx` -> `/bookings/reschedule`, `/app/bookings/reschedule`
- `app/professional/bookings.tsx` -> `/professional/bookings`, `/app/professional/bookings`
- Web professional bookings now use the signed-in professional's `professional_sessions` rows, with upcoming/past/all filters and the mobile actions for message, confirm, complete, reschedule, and cancel.
- `app/professional/reviews.tsx` -> `/professional/reviews`, `/app/professional/reviews`; web shows the mobile rating summary and only approved `professional_reviews` rows with reviewer/session context.
- `app/professional/session-requests.tsx` -> `/professional/session-requests`, `/app/professional/session-requests`; web now loads `pending_acceptance` sessions for the approved professional profile and supports accept/decline actions.

## Admin Screens

Every file in `app/admin/*.tsx` has a matching `/admin/*` and `/app/admin/*` route. Screen-specific web implementations currently exist for users, roles, reports, relationships, disputes, posts/reels review, professional profiles/sessions/reviews/roles/analytics, false relationship reports, payment methods/verifications/proof viewer, ban appeals, dating admin/interests/date options, ID verifications, advertisements, legal policies, pricing, stickers, verification services, app settings, escalation rules, face matching, analytics, logs, trigger words, and warning templates. Admin advertisements now include creative approval/rejection and paid/unpaid billing actions with receipt creation. Admin professional sessions now include mobile-style status and type filters.

## Validation

- `npx.cmd tsc -p web\tsconfig.json --noEmit`
- `npm.cmd run lint:ci`
- `npm.cmd run build`
