# Auth + Session Smoke Test

This is the safest quick check after auth/session changes.

## What it covers

- Sign in with a real test account
- Confirm app leaves auth screen and reaches home
- Kill app process and relaunch
- Confirm session is still restored (no forced re-login)

## Prerequisites

- Installed app id: `com.committed.app`
- Maestro installed and working
- A verified test user account (email/password)

## Run

PowerShell:

```powershell
$env:MAESTRO_TEST_EMAIL="your-test-email@example.com"
$env:MAESTRO_TEST_PASSWORD="your-password"
npm run test:smoke:auth
```

Bash:

```bash
MAESTRO_TEST_EMAIL="your-test-email@example.com" \
MAESTRO_TEST_PASSWORD="your-password" \
npm run test:smoke:auth
```

## Flow file

- `maestro/auth-core-smoke.yaml`

## Notes

- The flow expects auth inputs with ids:
  - `auth-email-input`
  - `auth-password-input`
- The success marker is `Relationship Status` on home.
- If your test account is unverified or routed to onboarding, use a verified account for this smoke flow.
