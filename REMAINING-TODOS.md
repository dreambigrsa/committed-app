# Remaining TODOs

## ✅ Completed (codebase)

- **Admin Delete User** – Edge Function `admin-delete-user`, frontend calls it and refetches; URL fallback so no 404.
- **Refresh token handling** – Safe hydration, `clearSession()`, invalid refresh token → clear and redirect; no infinite retry.
- **Splash / loading screen** – Single container, theme background, logo animation; no blue/red split.
- **Search screen** – All text wrapped in `<Text>`; no "text node in View" crash when typing.
- **Receipt PDF** – `encoding: 'base64'` for expo-file-system (safe on web and mobile).
- **Lint** – Unused imports/vars removed, `_` prefix for ignored args, exhaustive-deps/import as warn; `expo lint` passes.
- **Expo 17 checks** – `expo-doctor` 17/17; TypeScript and web export succeed.

## ⚠️ Remaining (manual)

### 1. Run migrations in Supabase (if not already run)

In **Supabase Dashboard → SQL Editor**, run in this order:

1. **`migrations/FIX-RLS-WITH-FUNCTION.sql`** – Legal acceptances RLS / signup.
2. **`migrations/FIX-USER-STATUS-RLS-COMPLETE.sql`** – user_status RLS (403/406).

### 2. Deploy Edge Function (if not already deployed)

```bash
npx supabase functions deploy admin-delete-user
```

### 3. Optional: manual testing

Use the **Testing Checklist** in `PRODUCTION-READY-CHECKLIST.md` (signup, media, errors, database) and tick off as you test.

### 4. New Expo account

Expo/EAS project ID and account-specific values have been removed so the app builds with a new Expo account. After cloning or switching accounts:

1. Log in with the new account: `npx eas login`
2. Link the project (creates/assigns a new EAS project): `npx eas init` or run your first `npx eas build` and follow the prompts.

Set `EXPO_PUBLIC_EAS_PROJECT_ID` in env (or in EAS secrets) only if you need it for push notifications before the first build; after linking, the project ID is set automatically.

---

**Summary:** All code-side TODOs from recent work are done. What’s left is running the two SQL migrations in Supabase (and optionally deploying the Edge Function and doing manual tests).
