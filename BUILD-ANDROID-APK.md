# 📱 Build Android APK - Production Mode

## Prerequisites

1. **Expo Account**: You need a free Expo account
2. **EAS CLI**: Install the Expo Application Services CLI
3. **Project Setup**: Your `eas.json` is already configured for APK builds

## Step-by-Step Instructions

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

Or using Bun:
```bash
bun add -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

This will open a browser window for you to login or create an account.

### Step 3: Build Production APK

```bash
eas build --platform android --profile production
```

**What this does:**
- Builds a production APK (not AAB)
- Uses the production profile from `eas.json`
- Automatically increments version code
- Includes all environment variables configured in `eas.json`

### Step 4: Wait for Build to Complete

The build will run on Expo's servers. You'll see:
- Build progress in the terminal
- A URL to track the build status
- Estimated completion time

**Build time:** Usually 10-20 minutes

### Step 5: Download Your APK

Once the build completes:
1. You'll get a download link in the terminal
2. Or visit: https://expo.dev/accounts/[your-account]/projects/committed/builds
3. Click on the completed build to download the APK

## Alternative: Build Locally (Faster, but requires Android SDK)

If you have Android Studio installed and want faster builds:

```bash
eas build --platform android --profile production --local
```

**Requirements:**
- Android Studio installed
- Android SDK configured
- More disk space (builds locally)

## Build Options

### Build APK (Current Configuration)
Your `eas.json` is already set to build APK:
```json
"android": {
  "buildType": "apk"
}
```

### Build AAB (for Google Play Store)
If you want to build an AAB (Android App Bundle) instead for Play Store submission:

```bash
eas build --platform android --profile production
```

Then modify `eas.json` to change buildType to "app-bundle" (or remove the buildType line, as AAB is default for production).

## Current Production Configuration

Your production build includes:
- ✅ Auto-increment version codes
- ✅ Environment variables (Supabase URL, API keys)
- ✅ APK build type (installable APK file)
- ✅ All Android permissions configured

## Environment Variables

Your production build automatically includes:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_COMMITTED_API_BASE_URL`

These are set in `eas.json` under the production profile.

## Version Management

The build will automatically increment:
- **Version Code**: Auto-incremented by EAS
- **Version Name**: From `app.json` (currently "1.0.0")

To update the version name, edit `app.json`:
```json
"version": "1.0.1"
```

## Quick Commands Reference

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build production APK
eas build --platform android --profile production

# Build locally (faster, requires Android SDK)
eas build --platform android --profile production --local

# View build status
eas build:list

# Download latest build
eas build:download
```

## Troubleshooting

### "Not logged in" error
```bash
eas login
```

### "Project not configured" error
Your project is already configured, but if you see this:
```bash
eas build:configure
```

### Build fails due to missing credentials
For production builds, you may need to set up Android credentials:
```bash
eas credentials
```

### Want to test the build before production?
Build a preview version first:
```bash
eas build --platform android --profile preview
```

## After Building

### Install APK on Device
1. Download the APK from the build page
2. Transfer to your Android device
3. Enable "Install from Unknown Sources" in Android settings
4. Tap the APK file to install

### Submit to Google Play Store
If you want to submit to Play Store, you'll need an AAB instead:
1. Change `buildType` to `"app-bundle"` in `eas.json` production profile
2. Build again: `eas build --platform android --profile production`
3. Submit: `eas submit --platform android`

## Important Notes

- **APK vs AAB**: APK is for direct installation, AAB is for Play Store
- **First build**: May take longer (20-30 minutes)
- **Subsequent builds**: Usually faster (10-15 minutes)
- **Free tier**: Expo provides free builds, but with limited monthly quota
- **Build size**: Your APK will be around 50-100MB depending on assets

## Next Steps

1. ✅ Run `eas login` to authenticate
2. ✅ Run `eas build --platform android --profile production`
3. ✅ Wait for build to complete
4. ✅ Download and test the APK
5. ✅ Distribute to users or submit to Play Store

---

**Your app is ready to build! 🚀**

