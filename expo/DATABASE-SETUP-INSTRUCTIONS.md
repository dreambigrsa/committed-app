# Database Setup Instructions

## Critical: You must run these SQL scripts in your Supabase SQL Editor

The app is experiencing errors because the database needs proper configuration for Row Level Security (RLS) and automatic user profile creation.

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: `dizcuexznganwgddsrfo`
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Run the RLS Fix Script

Copy and paste the entire contents of `supabase-fix-rls.sql` into the SQL editor and click "Run"

This script will:
- ✅ Fix RLS policies to allow users to create their own profiles
- ✅ Create a trigger to automatically create user profiles when someone signs up
- ✅ Migrate any existing auth users without profiles

### Step 3: Create Super Admin Account

Copy and paste the entire contents of `supabase-create-super-admin.sql` into the SQL editor and click "Run"

This will create a super admin account with:
- Email: `nashiezw@gmail.com`
- Password: `@12345678`
- Role: `super_admin`

### Step 4: Verify Setup

1. **Check if the trigger was created:**
   - Go to "Database" → "Functions" in Supabase
   - You should see `handle_new_user` function listed

2. **Check if policies exist:**
   - Go to "Database" → "Tables" → "users"
   - Click on "Policies" tab
   - You should see these policies:
     - "Users can view all users"
     - "Users can insert own profile"
     - "Users can update own profile"

3. **Test the super admin login:**
   - Try logging in with:
     - Email: `nashiezw@gmail.com`
     - Password: `@12345678`
   - You should be able to log in successfully

### Troubleshooting

**If you still see "Cannot coerce the result to a single JSON object" error:**
1. Make sure you ran BOTH SQL scripts
2. Try signing out and signing back in
3. Check the browser console for detailed error messages

**If you see "RLS policy error" in console:**
- The RLS policies were not applied correctly
- Re-run the `supabase-fix-rls.sql` script
- Make sure you're connected to the correct project

**If signup/login doesn't work:**
1. Check if the `handle_new_user` function exists in Supabase Functions
2. Check if the trigger `on_auth_user_created` is active
3. Try creating a new account - the trigger will auto-create the profile

### What These Scripts Do

**supabase-fix-rls.sql:**
- Drops and recreates RLS policies for the `users` table
- Creates a PostgreSQL function that automatically creates user profiles
- Creates a trigger that fires when a new user signs up via Supabase Auth
- Migrates existing auth users without profiles to the `users` table

**supabase-create-super-admin.sql:**
- Creates an auth user with super admin privileges
- Creates the corresponding profile in the `users` table
- Sets up the account with the specified credentials

### After Setup

Once both scripts are run successfully:
1. ✅ New user signups will automatically create profiles
2. ✅ Users can login without errors
3. ✅ The super admin account will have full access
4. ✅ All pages will load with user data
5. ✅ The app will work as expected

### Need Help?

If you encounter any issues:
1. Check the Supabase logs: Dashboard → Logs → Database
2. Look at the browser console for detailed error messages
3. Verify your Supabase URL and keys are correct in `lib/supabase.ts`
