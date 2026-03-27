# Deep Linking Setup

Deep links for posts, reels, referrals, and auth work across the app and website.

## Supported Link Types

| Type    | App URL                  | Web URL                           |
|---------|--------------------------|-----------------------------------|
| Post    | `committed://post/{id}`  | `https://.../post/{id}`           |
| Reel    | `committed://reel/{id}`  | `https://.../reel/{id}`           |
| Referral| `committed://referral?ref={code}` | `https://.../referral/{code}` |
| Verify  | `committed://verify-email?token=...` | `/verify-email?token=...` |
| Reset   | `committed://reset-password?token=...` | `/reset-password?token=...` |

## Environment Variables

**App (Expo)** – in `.env` or `app.config.ts`:

- `EXPO_PUBLIC_SITE_URL` or `EXPO_PUBLIC_APP_WEB_URL` – Web base URL for share links (e.g. `https://committed.dreambig.org.za`)
- `EXPO_PUBLIC_DEEPLINK_SCHEME` – App scheme (default `committed://`)

**Website (Next.js)** – in Vercel / `.env.local`:

- `NEXT_PUBLIC_SITE_URL` – Same as above (e.g. `https://committed.dreambig.org.za`)
- `NEXT_PUBLIC_DEEPLINK_SCHEME` – Same scheme (default `committed://`)

## Flow

1. **Web → App**: User opens a web link (e.g. `/post/123`). Page tries the app scheme first, then shows an “Open in App” fallback with download links.
2. **App cold start**: `Linking.getInitialURL()` reads the opening URL; auth links go to the right screen, content links are stored and used after auth.
3. **App warm start**: `Linking.addEventListener('url')` handles links while the app is open.
4. **Intended route**: For post/reel when not logged in, the route is saved and navigated to after sign-in.

## App Configuration

In `app.json` / `app.config.ts`, ensure:

- `scheme: "committed"` for custom URL scheme (already set in app.json)
- **expo-router `origin`**: Update to your production site (e.g. `https://committed.dreambig.org.za`) in `app.json` under `plugins` → `expo-router` → `origin`, and `extra.router.origin`
- iOS: `associatedDomains` for universal links (optional)
- Android: `intentFilters` for app links (optional)

## Troubleshooting

- **Links open web instead of app**: Confirm app scheme and store install.
- **Post/Reel link shows nothing**: Check auth state; intended route runs after login.
- **Referral not applied**: Referral is stored when link is opened and applied on signup.
- **Hash params ignored**: `AuthHashRedirect` sends Supabase `#access_token` URLs to `/auth-callback`.
