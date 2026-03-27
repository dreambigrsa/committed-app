# Connect Safely Section — Custom Avatars

Add your own profile pictures for the "Connect Safely" circles in the How It Works section.

**Files:** `1.jpg`, `2.jpg`, `3.jpg` (or .png, .webp)

Then set environment variables:
- `NEXT_PUBLIC_CONNECT_SAFELY_1` = `/images/connect-safely/1.jpg`
- `NEXT_PUBLIC_CONNECT_SAFELY_2` = `/images/connect-safely/2.jpg`
- `NEXT_PUBLIC_CONNECT_SAFELY_3` = `/images/connect-safely/3.jpg`

Or edit `web/lib/stock-images.ts` and replace the default URLs in `connectSafelyAvatars`.
