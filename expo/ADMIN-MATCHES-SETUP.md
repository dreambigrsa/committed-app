# Admin Access to Dating Matches - Setup Instructions

## Problem
Admin users cannot see matches in the Dating Management panel even though matches exist in the database.

## Solution
You need to run a SQL migration in Supabase to grant admin users permission to view all matches.

## Steps to Fix

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the **SQL Editor**

2. **Run the Migration**
   - Open the file: `migrations/add-admin-dating-matches-access.sql`
   - Copy the entire contents of the file
   - Paste it into the Supabase SQL Editor
   - Click **Run** to execute the SQL

3. **Verify It Worked**
   - Go back to your app
   - Navigate to Admin > Dating Management > Matches tab
   - You should now see all matches

## What the Migration Does

The migration creates Row Level Security (RLS) policies that allow:
- Admins to view all dating matches
- Admins to view all dating likes  
- Admins to view all dating passes

## Troubleshooting

If you still see "No matches found" after running the migration:

1. **Check your user role**: Make sure your user account has `role = 'admin'` or `role = 'super_admin'` in the `users` table
2. **Check the console**: Look for error messages in the browser/app console
3. **Verify the policy exists**: In Supabase, go to Authentication > Policies and check if "Admins can view all matches" policy exists on the `dating_matches` table

