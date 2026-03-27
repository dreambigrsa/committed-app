# E2E smoke tests (Maestro)

[Maestro](https://maestro.mobile.dev/) drives the app on **simulator / device** with YAML flows. Use it for regression on auth + cold start (complement to manual QA).

## Install

- **macOS:** `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Or see [official docs](https://maestro.mobile.dev/getting-started/installing-maestro) for Windows/Linux.

## Prerequisites

- Android emulator **or** iOS simulator with a **development/production build** installed (`com.committed.app` from `app.json`).
- For flows that need login, set env vars (never commit real passwords):

```bash
export MAESTRO_TEST_EMAIL="you+test@example.com"
export MAESTRO_TEST_PASSWORD="***"
```

## Commands

From repo root:

```bash
# Run all flows in maestro/
maestro test maestro/

# Single flow
maestro test maestro/app-launch.yaml
```

npm script (after Maestro is on PATH):

```bash
bun run test:e2e:maestro
```

## Flows in this repo

| File | Purpose |
|------|---------|
| `app-launch.yaml` | App opens without crashing (adjust assertions to match your first screen). |
| `auth-sign-in-smoke.yaml` | Minimal launch; extend with `id: auth-email-input` / `id: auth-password-input` (see `app/auth.tsx`). |

**Note:** Auth screen exposes `testID`s `auth-email-input` and `auth-password-input` for stable Maestro selectors.

## CI

Maestro is best run on **macOS runners** with an emulator, or on **device farms**. A minimal approach is to keep flows in-repo and run them manually before releases; full CI is optional.
