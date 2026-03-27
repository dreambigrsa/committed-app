# 🔧 Fixing Dating Profile Photo Upload & Network Errors

## Issues Fixed

### 1. **Photo Upload Not Working**
- **Problem**: Photos were trying to use local URIs directly instead of uploading to Supabase Storage
- **Fix**: Now uploads to Supabase Storage first, then saves the public URL to database

### 2. **Network Errors**
- **Problem**: Backend server not running, causing all tRPC calls to fail
- **Solution**: Need to start the backend server

## ✅ What Was Fixed

### Photo Upload Implementation
- Added proper Supabase Storage upload
- Converts local file URIs to Uint8Array
- Uploads to `media/dating/{userId}/` bucket
- Gets public URL and saves to database

### Error Handling
- Better error messages
- Checks for backend server
- Proper error logging

## 🚀 How to Fix Network Errors

### Step 1: Start the Backend Server

The backend server must be running for dating features to work. Run this in a **separate terminal**:

```bash
# Option 1: Using npm/bun
bun run start:api

# Option 2: Directly
tsx backend/server.ts

# Option 3: Using node
node --loader tsx backend/server.ts
```

The server should start on `http://localhost:3000` and you should see:
```
[API] listening on http://localhost:3000
```

### Step 2: Verify Backend is Running

Open your browser and go to:
```
http://localhost:3000
```

You should see:
```json
{"status":"ok","message":"API is running"}
```

### Step 3: Check Environment Variables

Make sure your `.env` file (if you have one) has the correct Supabase credentials, or they're set in your Supabase client configuration.

### Step 4: Test Photo Upload

1. Go to Dating tab
2. Tap Settings icon
3. Try uploading a photo
4. Should now work!

## 🔍 Troubleshooting

### Error: "Network request failed"
- **Cause**: Backend server not running
- **Fix**: Start backend with `bun run start:api`

### Error: "Failed to upload image"
- **Cause**: Supabase Storage bucket not configured or permissions issue
- **Fix**: 
  1. Go to Supabase Dashboard → Storage
  2. Create bucket named `media` if it doesn't exist
  3. Set bucket to public
  4. Add RLS policy to allow authenticated users to upload

### Error: "Dating profile not found"
- **Cause**: User hasn't created a dating profile yet
- **Fix**: Create profile first (should happen automatically when you open dating tab)

### Error: "Cannot connect to backend"
- **Cause**: Backend URL incorrect or server not accessible
- **Fix**: 
  1. Check `lib/trpc.ts` - should use `http://localhost:3000` for local dev
  2. For production, set `EXPO_PUBLIC_COMMITTED_API_BASE_URL` environment variable

## 📝 Supabase Storage Setup

If you haven't set up the storage bucket yet:

1. **Go to Supabase Dashboard** → Storage
2. **Create bucket** named `media`
3. **Set to Public** (or configure RLS policies)
4. **Add RLS Policy** for authenticated uploads:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'media');
```

## 🎯 Quick Test

1. **Start backend**: `bun run start:api` (in separate terminal)
2. **Start app**: `bun run start` (in another terminal)
3. **Open dating tab**
4. **Create profile** (if needed)
5. **Upload photo** - should work now!

## ✅ Summary

- ✅ Photo upload now uses Supabase Storage
- ✅ Proper error handling added
- ✅ Backend server must be running
- ✅ Storage bucket needs to be configured

The main issue was that photos weren't being uploaded to storage, and the backend server needs to be running for tRPC calls to work!

