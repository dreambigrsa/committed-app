// @ts-nocheck
// Supabase Edge Function for deleting all sample users
// Deploy: supabase functions deploy delete-sample-users
//
// This function deletes all sample users (auth users, user records, and dating profiles).
// Requires admin authentication.

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (userError || !userData || (userData.role !== 'admin' && userData.role !== 'super_admin')) {
      return json(403, { success: false, error: 'Admin access required' });
    }

    // Get all sample users
    const { data: sampleUsers, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('is_sample_user', true);

    if (fetchError) {
      throw new Error(fetchError.message || 'Failed to fetch sample users');
    }

    if (!sampleUsers || sampleUsers.length === 0) {
      return json(200, {
        success: true,
        message: 'No sample users found to delete',
        deletedCount: 0,
      });
    }

    // Delete auth users (this will cascade to user records and dating profiles)
    let deletedCount = 0;
    const errors: string[] = [];

    for (const user of sampleUsers) {
      try {
        // Delete from auth.users (this cascades to public.users and dating_profiles)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`Error deleting user ${user.email}:`, deleteError);
          errors.push(`${user.email}: ${deleteError.message}`);
        } else {
          deletedCount++;
        }
      } catch (error: any) {
        console.error(`Error deleting user ${user.email}:`, error);
        errors.push(`${user.email}: ${error.message || 'Unknown error'}`);
      }
    }

    return json(200, {
      success: errors.length === 0,
      message: `Deleted ${deletedCount} sample users${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error deleting sample users:', error);
    return json(500, {
      success: false,
      message: error.message || 'Failed to delete sample users',
      error: error.message,
    });
  }
});

