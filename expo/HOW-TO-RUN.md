# 🚀 How to Run This App

## Prerequisites
✅ All dependencies are already installed (run `npm install` if needed)

## Quick Start Options

### Option 1: Run the Mobile App (Recommended)
Start the Expo development server for mobile devices:

```bash
npm start
```

Or using Bun:
```bash
bunx expo start --tunnel
```

**What this does:**
- Starts the Expo development server
- Opens a QR code in your terminal
- Use the Expo Go app on your phone to scan the QR code
- Or press `i` for iOS Simulator or `a` for Android Emulator

### Option 2: Run in Web Browser
Start the app in your web browser:

```bash
npm run start-web
```

Or:
```bash
bunx expo start --web --tunnel
```

**What this does:**
- Starts the app in your default web browser
- Great for quick testing and development
- Some native features may not be available

### Option 3: Run Backend API Server
Start the backend API server (runs on port 3000):

```bash
npm run start:api
```

Or:
```bash
tsx backend/server.ts
```

**What this does:**
- Starts the Hono/TRPC backend server
- API will be available at `http://localhost:3000`
- Required if the app needs backend API functionality

### Option 4: Run Both Frontend and Backend
Open two terminal windows:

**Terminal 1 - Frontend:**
```bash
npm start
```

**Terminal 2 - Backend:**
```bash
npm run start:api
```

## Development Commands

### Start with Debug Mode (Web)
```bash
npm run start-web-dev
```

### Lint Your Code
```bash
npm run lint
```

### Clear Cache and Restart
```bash
bunx expo start --clear
```

## Testing on Devices

### On Your Phone (Easiest)
1. Install **Expo Go** app:
   - iOS: [Download from App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Download from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Run `npm start` in your terminal
3. Scan the QR code with:
   - **iOS**: Use the Camera app
   - **Android**: Use the Expo Go app

### On iOS Simulator (Mac only)
```bash
npm start
# Then press 'i' in the terminal
```

Or directly:
```bash
bunx expo start --ios
```

### On Android Emulator
```bash
npm start
# Then press 'a' in the terminal
```

Or directly:
```bash
bunx expo start --android
```

## Environment Setup

### Supabase Configuration
The app uses Supabase for the database. Make sure you have:
- Supabase project URL and anon key set (or use the defaults in `lib/supabase.ts`)
- Database schema set up (see `QUICK-START-GUIDE.md`)

### Optional Environment Variables
You can set these before running:

**Windows PowerShell:**
```powershell
$env:EXPO_PUBLIC_SUPABASE_URL="your-url"
$env:EXPO_PUBLIC_SUPABASE_ANON_KEY="your-key"
$env:EXPO_PUBLIC_OPENAI_API_KEY="your-key"
npm start
```

**Windows CMD:**
```cmd
set EXPO_PUBLIC_SUPABASE_URL=your-url
set EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key
npm start
```

## Troubleshooting

### Port Already in Use
If port 3000 is taken by the backend:
```bash
# Change port in backend/server.ts or set:
$env:PORT=3001
npm run start:api
```

### Metro Bundler Issues
Clear cache and restart:
```bash
bunx expo start --clear
```

### Network Connection Issues
Use tunnel mode (already enabled in scripts):
```bash
npm start  # Already includes --tunnel flag
```

### Dependencies Not Found
Reinstall dependencies:
```bash
npm install
```

## Recommended Workflow

1. **First time setup:**
   ```bash
   npm install
   ```

2. **Start development:**
   ```bash
   npm start
   ```

3. **Open on device:**
   - Scan QR code with Expo Go app
   - Or press `i`/`a` for simulators

4. **For web testing:**
   ```bash
   npm run start-web
   ```

5. **If backend is needed:**
   ```bash
   # Terminal 1
   npm start
   
   # Terminal 2
   npm run start:api
   ```

## Next Steps

- See `QUICK-START-GUIDE.md` for database setup
- See `README.md` for full documentation
- Check `app.json` for app configuration

---

**Happy coding! 🎉**

