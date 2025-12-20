# 🔧 Fix Build Permissions Issue

## Problem
You're getting: `Entity not authorized: AppEntity [1ce53350-c138-459b-b181-9a1a06406108]`

This means you're logged into a different Expo account than the project owner.

## Solutions

### Option 1: Login as the Project Owner (Recommended)

The project owner is **"committed"**. You need to login with that account:

```bash
eas logout
eas login
```

Then enter the credentials for the "committed" Expo account.

### Option 2: Create Your Own Project

If you don't have access to the "committed" account, create your own project:

```bash
eas init
```

This will:
- Create a new Expo project
- Generate a new project ID
- Update your `app.json` with the new project ID

**Note:** You'll need to update the `owner` field in `app.json` to your Expo username.

### Option 3: Get Added as Collaborator

Ask the owner of the "committed" account to:
1. Go to https://expo.dev/accounts/committed/projects/committed
2. Add you as a collaborator with build permissions

## After Fixing Permissions

Once you have the correct permissions, build the APK:

```bash
eas build --platform android --profile production
```

**Remember:** Local builds (`--local`) won't work on Windows. You must use remote builds.

## Check Your Login Status

```bash
eas whoami
```

This shows which account you're currently logged in as.

