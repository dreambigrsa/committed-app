// @ts-nocheck
// Supabase Edge Function for creating sample users with auth accounts
// Deploy: supabase functions deploy create-sample-users
//
// This function creates auth users, user records, and dating profiles automatically.
// Requires admin authentication.

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SAMPLE_USERS = [
  // Kwekwe Users
  { fullName: 'Sarah Moyo', email: 'sarah.moyo@sample.com', phone: '+263771234501', city: 'Kwekwe', country: 'Zimbabwe', age: 28 },
  { fullName: 'Tendai Ndlovu', email: 'tendai.ndlovu@sample.com', phone: '+263771234502', city: 'Kwekwe', country: 'Zimbabwe', age: 32 },
  { fullName: 'Blessing Sibanda', email: 'blessing.sibanda@sample.com', phone: '+263771234503', city: 'Kwekwe', country: 'Zimbabwe', age: 26 },
  { fullName: 'Grace Chidziva', email: 'grace.chidziva@sample.com', phone: '+263771234504', city: 'Kwekwe', country: 'Zimbabwe', age: 29 },
  { fullName: 'John Maphosa', email: 'john.maphosa@sample.com', phone: '+263771234505', city: 'Kwekwe', country: 'Zimbabwe', age: 31 },
  // Harare Users
  { fullName: 'Linda Chiwenga', email: 'linda.chiwenga@sample.com', phone: '+263771234506', city: 'Harare', country: 'Zimbabwe', age: 27 },
  { fullName: 'David Mutasa', email: 'david.mutasa@sample.com', phone: '+263771234507', city: 'Harare', country: 'Zimbabwe', age: 33 },
  { fullName: 'Ruth Makoni', email: 'ruth.makoni@sample.com', phone: '+263771234508', city: 'Harare', country: 'Zimbabwe', age: 25 },
  { fullName: 'Peter Muzenda', email: 'peter.muzenda@sample.com', phone: '+263771234509', city: 'Harare', country: 'Zimbabwe', age: 30 },
  { fullName: 'Faith Nyathi', email: 'faith.nyathi@sample.com', phone: '+263771234510', city: 'Harare', country: 'Zimbabwe', age: 28 },
  // Bulawayo Users
  { fullName: 'Thabo Nkomo', email: 'thabo.nkomo@sample.com', phone: '+263771234511', city: 'Bulawayo', country: 'Zimbabwe', age: 29 },
  { fullName: 'Nomsa Dube', email: 'nomsa.dube@sample.com', phone: '+263771234512', city: 'Bulawayo', country: 'Zimbabwe', age: 26 },
  { fullName: 'Sipho Moyo', email: 'sipho.moyo@sample.com', phone: '+263771234513', city: 'Bulawayo', country: 'Zimbabwe', age: 31 },
  { fullName: 'Zanele Khumalo', email: 'zanele.khumalo@sample.com', phone: '+263771234514', city: 'Bulawayo', country: 'Zimbabwe', age: 27 },
  { fullName: 'Lungile Ncube', email: 'lungile.ncube@sample.com', phone: '+263771234515', city: 'Bulawayo', country: 'Zimbabwe', age: 30 },
];

const DEFAULT_PASSWORD = 'Test123456!';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { success: false, error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user's token to verify they're admin
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify user is admin
    const { data: { user: authUser } } = await supabaseUser.auth.getUser();
    if (!authUser) {
      return json(401, { success: false, error: 'Unauthorized' });
    }

    // Check if user is admin
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return json(403, { success: false, error: 'Only admins can create sample users' });
    }

    // Create admin client for operations
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];

    for (const userData of SAMPLE_USERS) {
      let authUserId: string | undefined = undefined;
      try {
        // Try to create auth user
        // Note: The database trigger will attempt to create the user record
        // We provide phone_number in metadata so the trigger has it available
        const { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
          email: userData.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            full_name: userData.fullName,
            phone_number: userData.phone,
          },
          phone: userData.phone, // Also set phone directly in case trigger uses NEW.phone
        });

        if (authError) {
          // If user already exists, get the user ID from the users table
          const isUserExistsError = authError.message?.includes('already registered') || 
              authError.message?.includes('already exists') ||
              authError.message?.includes('User already registered') ||
              authError.status === 422;
              
          if (isUserExistsError) {
            console.log(`Auth user already exists for ${userData.email}, checking users table...`);
            
            // Get user ID from users table (fast and reliable)
            const { data: dbUser, error: dbError } = await adminClient
              .from('users')
              .select('id')
              .eq('email', userData.email)
              .maybeSingle();
            
            if (dbUser?.id) {
              authUserId = dbUser.id;
              console.log(`Found existing user ID from users table: ${authUserId}`);
            } else if (dbError) {
              throw new Error(`Failed to find existing user in database: ${dbError.message}`);
            } else {
              // User exists in auth but not in users table - skip with clear error
              throw new Error(`Auth user exists for ${userData.email} but not found in users table. Please run the database migration to sync auth users with users table.`);
            }
          } else {
            // Log the full error for debugging - this might be a database/trigger error
            console.error(`Auth error for ${userData.email}:`, JSON.stringify(authError, null, 2));
            const errorMsg = authError.message || JSON.stringify(authError) || 'Failed to create auth user';
            // Provide more helpful error message if it's a database error
            if (errorMsg.includes('Database error') || errorMsg.includes('database')) {
              throw new Error(`Database error creating auth user for ${userData.email}. This might be due to a failing database trigger. Check Supabase logs for details: ${errorMsg}`);
            }
            throw new Error(`Auth error: ${errorMsg}`);
          }
        } else if (newAuthUser?.user?.id) {
          authUserId = newAuthUser.user.id;
          console.log(`Created new auth user: ${authUserId} for ${userData.email}`);
        } else {
          throw new Error('Failed to create auth user: No user returned');
        }

        // Ensure authUserId is set before proceeding
        if (!authUserId) {
          throw new Error('Failed to obtain user ID for user creation');
        }

        // authUserId is guaranteed to be defined here
        const userId = authUserId;

        // Wait a moment for the trigger to potentially create the user record
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if user record exists (may have been created by trigger)
        const { data: existingUser } = await adminClient
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (existingUser) {
          // Update existing user
          const { error: updateError } = await adminClient
            .from('users')
            .update({
              full_name: userData.fullName,
              phone_number: userData.phone,
              is_sample_user: true,
              phone_verified: true,
              email_verified: true,
            })
            .eq('id', userId);

          if (updateError) throw updateError;

          // Create or update dating profile (non-blocking - user is already created)
          try {
            const { error: profileError } = await adminClient
              .from('dating_profiles')
              .upsert({
                user_id: userId,
                bio: `Looking for meaningful connections in ${userData.city}. Love good conversations and authentic people.`,
                age: userData.age,
                location_city: userData.city,
                location_country: userData.country,
                interests: ['Music', 'Travel', 'Food', 'Family', 'Faith'],
                looking_for: 'everyone',
                age_range_min: 22,
                age_range_max: 40,
                max_distance_km: 50,
                is_active: true,
                show_me: true,
                last_active_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id',
              });

            if (profileError) {
              console.warn(`Warning: Failed to create/update dating profile for ${userData.email}: ${profileError.message}`);
              // Continue anyway - user is created successfully
            }
          } catch (profileErr: any) {
            console.warn(`Warning: Exception creating/updating dating profile for ${userData.email}: ${profileErr.message}`);
            // Continue anyway - user is created successfully
          }

          results.push({ email: userData.email, status: 'updated', userId: userId });
        } else {
          // Create new user record
          const { error: insertError } = await adminClient
            .from('users')
            .insert({
              id: userId,
              full_name: userData.fullName,
              email: userData.email,
              phone_number: userData.phone,
              role: 'user',
              is_sample_user: true,
              phone_verified: true,
              email_verified: true,
              id_verified: false,
            });

          if (insertError) {
            // If it's a duplicate key error, the user was created by trigger in the meantime
            if (insertError.code === '23505') {
              console.log(`User record for ${userData.email} was created by trigger, updating...`);
              const { error: updateError } = await adminClient
                .from('users')
                .update({
                  full_name: userData.fullName,
                  phone_number: userData.phone,
                  is_sample_user: true,
                  phone_verified: true,
                  email_verified: true,
                })
                .eq('id', userId);
              if (updateError) throw updateError;
            } else {
              throw insertError;
            }
          }

          // Create dating profile (non-blocking - user is already created)
          try {
            const { error: profileInsertError } = await adminClient
              .from('dating_profiles')
              .insert({
                user_id: userId,
                bio: `Looking for meaningful connections in ${userData.city}. Love good conversations and authentic people.`,
                age: userData.age,
                location_city: userData.city,
                location_country: userData.country,
                interests: ['Music', 'Travel', 'Food', 'Family', 'Faith'],
                looking_for: 'everyone',
                age_range_min: 22,
                age_range_max: 40,
                max_distance_km: 50,
                is_active: true,
                show_me: true,
                last_active_at: new Date().toISOString(),
              });

            if (profileInsertError) {
              console.warn(`Warning: Failed to create dating profile for ${userData.email}: ${profileInsertError.message}`);
              // Continue anyway - user is created successfully
            }
          } catch (profileErr: any) {
            console.warn(`Warning: Exception creating dating profile for ${userData.email}: ${profileErr.message}`);
            // Continue anyway - user is created successfully
          }

          results.push({ email: userData.email, status: 'created', userId: userId });
        }
      } catch (userError: any) {
        console.error(`Error processing user ${userData.email}:`, userError);
        console.error(`Error details:`, JSON.stringify(userError, null, 2));
        if (userError.stack) {
          console.error(`Error stack:`, userError.stack);
        }
        const errorMessage = userError.message || userError.error?.message || userError.toString() || 'Unknown error';
        results.push({
          email: userData.email,
          status: 'error',
          error: errorMessage,
          userId: authUserId || undefined,
        });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const updated = results.filter(r => r.status === 'updated').length;
    const errors = results.filter(r => r.status === 'error').length;

    const errorDetails = results
      .filter(r => r.status === 'error')
      .map(r => `${r.email}: ${r.error}`)
      .join('; ');

    // Log summary for debugging
    console.log(`Sample users creation summary: ${created} created, ${updated} updated, ${errors} errors`);
    if (errors > 0) {
      console.error('Error details:', errorDetails);
      results.filter(r => r.status === 'error').forEach((r: any) => {
        console.error(`- ${r.email}: ${r.error}`);
      });
    }

    return json(200, {
      success: errors === 0,
      message: `Processed ${results.length} users: ${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''}`,
      results,
      errorDetails: errors > 0 ? errorDetails : undefined,
      errorCount: errors,
      createdCount: created,
      updatedCount: updated,
    });
  } catch (error: any) {
    console.error('Error creating sample users:', error);
    return json(500, {
      success: false,
      message: error.message || 'Failed to create sample users',
      error: error.message,
    });
  }
});
