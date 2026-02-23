# Committed website – deployment & QA

## 1. Supabase setup

### Secrets (Dashboard → Project → Settings → Edge Functions → Secrets)

Set these so Edge Functions can send email and call the Admin API:

- `RESEND_API_KEY` – your Resend API key
- `APP_WEB_URL` – production: `https://committed.dreambig.org.za`
- `APP_WEB_DEV_URL` – dev: `http://localhost:3000`
- `APP_DEEPLINK_BASE` – `committed://`
- `SUPABASE_SERVICE_ROLE_KEY` – (usually set automatically; ensure it’s present for Edge Functions)

### Deploy Edge Functions

From repo root:

```bash
npx supabase functions deploy send-verification
npx supabase functions deploy verify-email
npx supabase functions deploy request-password-reset
npx supabase functions deploy reset-password
```

### Database

Run migrations so `profiles` and `auth_tokens` (and RLS) exist:

```bash
npx supabase db push
```

Or apply `supabase/migrations/20250218000000_add_profiles_auth_tokens.sql` manually in the SQL editor.

---

## 2. Next.js website (Vercel)

### Env vars (Vercel project → Settings → Environment Variables)

- `NEXT_PUBLIC_SITE_URL` = `https://committed.dreambig.org.za`
- `NEXT_PUBLIC_SUPABASE_FUNCTIONS_BASE` = `https://<PROJECT_REF>.functions.supabase.co/functions/v1`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
- `SUPABASE_URL` = your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service role key (for auth API routes)
- `RESEND_API_KEY` = your Resend API key (required for password reset & verification emails)
- `RESEND_FROM_EMAIL` = **Must match your verified Resend domain.** For `dreambig.org.za` use `Committed <noreply@dreambig.org.za>`. Subdomains like `committed.dreambig.org.za` need separate verification. `noreply@resend.dev` is for testing only and may not deliver.
- `NEXT_PUBLIC_DEEPLINK_SCHEME` = `committed://`
- `NEXT_PUBLIC_PLAY_STORE_URL` = (optional) Google Play app URL
- `NEXT_PUBLIC_APP_STORE_URL` = (optional) App Store URL
- `NEXT_PUBLIC_SUPPORT_EMAIL` = e.g. `support@dreambig.org.za`

### Deploy

- Connect the repo to Vercel.
- Set **Root Directory** to `web`.
- Build command: `npm run build` (or `npm ci && npm run build`).
- Output directory: `.next` (default for Next.js).

### DNS (committed.dreambig.org.za)

- Add a CNAME (or A/AAAA as per Vercel) for `committed.dreambig.org.za` pointing to Vercel (e.g. `cname.vercel-dns.com` or the project’s Vercel domain).
- In Vercel, add the domain `committed.dreambig.org.za` to the project so SSL is issued.

---

## 3. QA checklist

### Custom auth – verification

- [ ] **Sign up (app)** → VerifyEmail screen → “Resend” sends email from our backend (Resend).
- [ ] Email contains **web link**: `https://committed.dreambig.org.za/verify-email?token=...` and **app link**: `committed://verify-email?token=...`.
- [ ] **Click web link** → website verify-email page → loading → “Email verified” + “Open App”.
- [ ] **Click app link** (with app installed) → app opens to verify-email with token → API called → success → redirect to home or auth.
- [ ] After verification, app no longer blocks on “verify email”; user can reach onboarding/home.
- [ ] Token **single-use**: using the same link again shows invalid/expired.
- [ ] Token **expiry**: after 24h link shows invalid/expired (or backend returns error).

### Custom auth – password reset

- [ ] **Forgot password (app)** → request reset → email sent by our backend (no Supabase reset email).
- [ ] Email contains **web link**: `https://committed.dreambig.org.za/reset-password?token=...` and **app link**: `committed://reset-password?token=...`.
- [ ] **Click web link** → website reset-password page → enter new password + confirm → submit → “Password updated” → “Open App to Sign In”.
- [ ] **Click app link** (with app installed) → app reset-password screen with token → submit new password → success → redirect to sign-in; login with new password works.
- [ ] Token **single-use**: using same link again shows invalid/expired.
- [ ] Token **expiry**: after 30 min link shows invalid/expired (or backend returns error).

### Rate limiting & security

- [ ] **Resend throttling**: multiple “resend verification” in short time return a generic or rate-limit message (no leak of account existence).
- [ ] **Request reset** multiple times for same email: generic success; no raw tokens in logs.

### Website

- [ ] **Home** (/) – hero, features, how it works, testimonials, FAQ, footer (Terms, Privacy, Contact).
- [ ] **Download** (/download) – “Open App”, store buttons, QR code, troubleshooting.
- [ ] **Sign-in** (/sign-in) – “Open App to Sign In” deep link + download fallback.
- [ ] **Sign-up** (/sign-up) – “Open App to Sign Up” deep link + download fallback.
- [ ] **Verify-email** (/verify-email?token=...) – loading → success or error; success shows “Open App”.
- [ ] **Reset-password** (/reset-password?token=...) – form → success or error; success shows “Open App to Sign In”.
- [ ] **Open** (/open?target=...) – attempts deep link then fallback (QR + store links).
- [ ] **Terms** (/terms) and **Privacy** (/privacy) – placeholder content and back link.
- [ ] Mobile responsive; focus states and links work.

### Deep links (app)

- [ ] `committed://verify-email?token=...` opens app → verify-email screen with token → API called.
- [ ] `committed://reset-password?token=...` opens app → reset-password screen with token.
- [ ] No Supabase `/auth/v1/verify` or recovery links used; no auth-callback for these token links.

---

## 4. File list (changes/additions)

### Supabase

- `supabase/migrations/20250218000000_add_profiles_auth_tokens.sql`
- `supabase/functions/send-verification/index.ts` (+ config.toml)
- `supabase/functions/verify-email/index.ts` (+ config.toml)
- `supabase/functions/request-password-reset/index.ts` (+ config.toml)
- `supabase/functions/reset-password/index.ts` (+ config.toml)

### Expo app

- `lib/auth-functions.ts`
- `lib/deep-link-service.ts` (getCustomVerifyOrResetRoute, isAuthLink)
- `app/_layout.tsx` (custom verify/reset route handling)
- `app/verify-email.tsx` (token-from-URL flow)
- `app/reset-password.tsx` (token-only flow)
- `contexts/AuthContext.tsx` (emailVerified from profiles, reset via auth-functions)
- `contexts/AppContext.tsx` (signUp without redirectTo, reset via auth-functions)

### Next.js website (`/web`)

- `package.json`, `tsconfig.json`, `next.config.js`, `postcss.config.js`, `tailwind.config.ts`
- `app/layout.tsx`, `app/globals.css`
- `app/page.tsx` (home)
- `app/download/page.tsx`
- `app/sign-in/page.tsx`, `app/sign-up/page.tsx`
- `app/verify-email/page.tsx`, `app/reset-password/page.tsx`
- `app/open/page.tsx`
- `app/terms/page.tsx`, `app/privacy/page.tsx`
- `lib/env.ts`
- `components/Navbar.tsx`, `components/Footer.tsx`, `components/OpenAppButton.tsx`
- `.env.example`, `DEPLOYMENT.md`
