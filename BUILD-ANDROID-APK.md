# Build Android APK - Complete Guide

## Prerequisites

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Link your project** (if not already linked):
   ```bash
   eas build:configure
   ```

## Build Commands

### Option 1: Preview Build (Recommended for Testing)
This creates an APK that can be installed directly on Android devices:

```bash
eas build --platform android --profile preview
```

### Option 2: Production Build
This creates a production-ready APK:

```bash
eas build --platform android --profile production
```

### Option 3: Local Build (Requires Android SDK)
If you want to build locally on your machine:

```bash
eas build --platform android --profile preview --local
```

**Note:** Local builds require:
- Android SDK installed
- Java Development Kit (JDK)
- Environment variables configured

## Build Profiles

Your `eas.json` has three profiles configured:

1. **preview** - Internal distribution, APK format (best for testing)
2. **production** - Store-ready, APK format (for Play Store or direct distribution)
3. **development** - Development client build

## Quick Start (Recommended)

For a quick APK build for testing:

```bash
# 1. Make sure you're logged in
eas login

# 2. Build the APK
eas build --platform android --profile preview

# 3. Wait for build to complete (usually 10-20 minutes)
# 4. Download the APK from the provided link
```

## Environment Variables

The production profile already has these environment variables configured in `eas.json`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_COMMITTED_API_BASE_URL`

For preview builds, you may want to set these via EAS secrets:

```bash
# Set environment variables for builds
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://dizcuexznganwgddsrfo.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key-here"
```

## Check Build Status

```bash
# List all builds
eas build:list

# View specific build details
eas build:view [BUILD_ID]
```

## Download APK

After the build completes:
1. You'll get a link in the terminal
2. Or visit: https://expo.dev/accounts/[your-account]/projects/committed/builds
3. Click on the build and download the APK

## Install APK on Device

1. Transfer the APK file to your Android device
2. Enable "Install from Unknown Sources" in Android settings
3. Open the APK file and install

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
eas build --platform android --profile preview --clear-cache
```

### Check Build Logs
```bash
eas build:view [BUILD_ID] --json
```

### Update Build Configuration
```bash
eas build:configure
```

## Alternative: Using Expo Build (Legacy)

If you prefer the legacy build system:

```bash
# Install expo-cli
npm install -g expo-cli

# Build APK
expo build:android -t apk
```

**Note:** This method is deprecated. EAS Build is recommended.

## Build Time

- **Cloud Build**: 10-20 minutes (first build may take longer)
- **Local Build**: Depends on your machine (usually 5-15 minutes)

## Cost

- **EAS Build**: Free tier includes limited builds per month
- Check your quota: https://expo.dev/accounts/[your-account]/settings/billing
