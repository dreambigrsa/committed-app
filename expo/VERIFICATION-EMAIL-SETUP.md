# Verification Email Setup

## Why you were seeing "Confirm your signup" (plain email)

You have **two** verification flows that can send emails:

1. **Supabase built-in** – When "Confirm email" is enabled in Supabase Auth, `signUp()` sends Supabase’s default email with subject "Confirm your signup". It’s plain text and not branded.
2. **Our custom flow** – When users land on the verify-email screen, we send a branded email via Resend using `verifyEmailEmail` (styled like the password reset).

If Supabase’s confirmation is enabled, users can get both emails, and the Supabase one is often received or opened first.

## Fix 1: Use only our styled verification email

1. Open **Supabase Dashboard** → **Authentication** → **Providers** → **Email**
2. Turn **off** “Confirm email”
3. Click **Save**

From then on, only our custom branded verification email will be sent (from the app’s verify-email screen).

## Fix 2: Link behavior (already implemented)

If users click Supabase’s “Confirm your signup” link, they used to land on the homepage with a hash and nothing happened.

**Changes made:**

- When someone lands on `/` with `#access_token=...&type=signup`, they are redirected to `/auth-callback` with the same hash
- `/auth-callback` handles this, shows “Email verified”, and lets them open the app

So even if Supabase’s email is still sent, the link works correctly.

## Recommendation

Disable Supabase’s “Confirm email” and rely on our custom flow so that:

- Users only get our branded email
- The link always goes through `/auth-callback`
- Design matches the password reset and other transactional emails
