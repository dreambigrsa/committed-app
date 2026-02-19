// @ts-nocheck
// Supabase Edge Function: Admin delete a single user (hard delete).
// Deploy: supabase functions deploy admin-delete-user
//
// 1. Validates caller is admin via service role + users.role
// 2. Deletes auth user via auth.admin.deleteUser(userId)
// 3. public.users is CASCADE deleted (id REFERENCES auth.users(id) ON DELETE CASCADE)
// 4. All related data cascades from public.users
// Returns success only after DB/auth confirms deletion.

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json(401, { success: false, error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT and get user id (use service role client with user's token in header)
    const supabaseWithToken = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: authUser }, error: authError } = await supabaseWithToken.auth.getUser(token);
    if (authError || !authUser) {
      return json(401, { success: false, error: 'Unauthorized' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: callerRow, error: callerError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (callerError || !callerRow || (callerRow.role !== 'admin' && callerRow.role !== 'super_admin')) {
      return json(403, { success: false, error: 'Admin access required' });
    }

    let body: { userId?: string };
    try {
      body = await req.json();
    } catch {
      return json(400, { success: false, error: 'Invalid JSON body' });
    }

    const userId = body.userId;
    if (!userId || typeof userId !== 'string') {
      return json(400, { success: false, error: 'Missing or invalid userId' });
    }

    // Prevent admin from deleting themselves
    if (userId === authUser.id) {
      return json(400, { success: false, error: 'Cannot delete your own account' });
    }

    // Ensure target user exists in public.users before deleting auth (so we don't orphan)
    const { data: targetUser, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (fetchErr || !targetUser) {
      return json(404, { success: false, error: 'User not found' });
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('admin-delete-user: deleteUser failed', deleteError);
      return json(500, {
        success: false,
        error: deleteError.message || 'Failed to delete user',
      });
    }

    return json(200, {
      success: true,
      message: 'User permanently deleted',
      deletedUserId: userId,
    });
  } catch (error: any) {
    console.error('admin-delete-user error:', error);
    return json(500, {
      success: false,
      error: error?.message || 'Internal server error',
    });
  }
});
