# Next Expo Mirror Routing Audit

## Protected routes that must not change

These routes are public/deep-link entry points and must keep their current URL structure and query parameters:

- `/verify-email?token=...&email=...`
- `/reset-password`
- `/auth-callback`
- `/post/[id]`
- `/reel/[id]`
- `/dating/user-profile?userId=...`
- `/referral/[code]`
- `/open`
- `/download`
- `/privacy`
- `/terms`
- `/api/auth/send-verification`
- `/api/auth/verify-email`
- `/api/auth/request-password-reset`
- `/api/auth/reset-password`
- `/api/auth/send-verification-code`

## Expo route mirror coverage added in Next

These routes now mount the shared web app shell so direct browser access follows the same top-level path shape as Expo Router without redirecting away from the URL:

- `/home`
- `/onboarding`
- `/signup`
- `/feed`
- `/reels`
- `/search`
- `/notifications`
- `/messages`
- `/messages/[conversationId]`
- `/profile`
- `/profile/[userId]`
- `/dating`
- `/dating/*` except protected `/dating/user-profile`
- `/settings`
- `/settings/*`
- `/admin`
- `/admin/*`
- `/relationship`
- `/relationship/*`
- `/verification`
- `/verification/*`
- `/ads`
- `/ads/*`
- `/bookings`
- `/bookings/*`
- `/professional`
- `/professional/*`
- `/professionals`
- `/professionals/*`
- `/status`
- `/status/*`
- `/status-item/*`
- `/legal/*`
- `/certificates/*`
- `/anniversary/*`

## Collision handling

- `/dating/user-profile?userId=...` remains the existing public app-opening bridge. The new dating catch-all route is lower priority than this concrete route.
- `/post/[id]` and `/reel/[id]` remain the public shared-content pages for existing links. The special app routes `/post/create` and `/reel/create` are handled inside those existing pages, so the URL pattern is preserved instead of adding a competing catch-all route.
- `/app/*` remains supported as the logged-in web app namespace. The web shell now parses both `/app/dating/filters` and `/dating/filters`.
- Internal web navigation that should stay on the website uses `/app/dating/user-profile` and `?web=1` for post/reel detail pages. Public shared links without `?web=1` keep attempting to open the mobile app first, then show the web fallback.

## Remaining deep-link edge cases to validate manually

- Auth links with expired or malformed tokens should continue to land on the existing friendly error states.
- Mobile app-open attempts from `/post/[id]`, `/reel/[id]`, and `/dating/user-profile` depend on the browser/device allowing custom scheme navigation. The web fallback remains in place.
- Admin mirror routes still depend on authenticated role data loading correctly before showing privileged content.
