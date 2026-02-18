// @ts-nocheck
// Supabase Edge Function: Admin Delete User
// Deploy: supabase functions deploy admin-delete-user
//
// Permanently deletes a user by removing the auth account. Because public.users.id
// REFERENCES auth.users(id) ON DELETE CASCADE, deleting the auth user cascades
// to delete public.users and all tables that reference users(id) with ON DELETE CASCADE.
// Requires admin or super_admin role.

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
    const body = await req.json().catch(() => ({}));
    const targetUserId = body?.userId ?? body?.user_id;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return json(400, { success: false, error: 'Missing or invalid userId' });
    }

    const supabaseWithUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user: authUser } } = await supabaseWithUser.auth.getUser();
    if (!authUser) {
      return json(401, { success: false, error: 'Unauthorized' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (authUser.id === targetUserId) {
      return json(400, { success: false, error: 'Cannot delete your own account from this screen' });
    }

    const { data: callerRow, error: callerError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (callerError || !callerRow || (callerRow.role !== 'admin' && callerRow.role !== 'super_admin')) {
      return json(403, { success: false, error: 'Admin access required' });
    }

    const { data: targetRow } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('id', targetUserId)
      .single();

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error('[admin-delete-user] deleteUser failed', { targetUserId, error: deleteError.message });
      return json(500, {
        success: false,
        error: deleteError.message || 'Failed to delete user',
      });
    }

    console.log('[admin-delete-user] Deleted user', {
      targetUserId,
      targetEmail: targetRow?.email,
      deletedBy: authUser.id,
      deletedAt: new Date().toISOString(),
    });

    return json(200, {
      success: true,
      message: 'User permanently deleted',
      deletedUserId: targetUserId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[admin-delete-user] Error', error);
    return json(500, {
      success: false,
      error: message,
    });
  }
});
