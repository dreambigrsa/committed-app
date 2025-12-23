# Deploy Sample Users Edge Function

This guide shows how to deploy the `create-sample-users` Supabase Edge Function.

## Prerequisites

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref dizcuexznganwgddsrfo
   ```

## Deploy the Functions

Deploy both functions:

```bash
# Deploy create function
supabase functions deploy create-sample-users

# Deploy delete function
supabase functions deploy delete-sample-users
```

## Verify Deployment

The functions will be available at:
```
https://dizcuexznganwgddsrfo.supabase.co/functions/v1/create-sample-users
https://dizcuexznganwgddsrfo.supabase.co/functions/v1/delete-sample-users
```

## Environment Variables

The Edge Function automatically has access to:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (automatically available)

No manual configuration needed! The service role key is automatically injected by Supabase.

## Testing

After deployment, test both functions:
- **Create**: Click "Add All" in the admin panel. It should create all 15 sample users with auth accounts automatically.
- **Delete**: Click "Delete All" in the admin panel. It should delete all sample users and their data.

## Benefits

✅ No separate backend server needed
✅ No CORS issues
✅ No connection problems
✅ Everything goes through Supabase
✅ Service role key is automatically available (secure)

