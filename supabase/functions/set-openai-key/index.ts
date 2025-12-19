// @ts-nocheck
// Supabase Edge Function: set-openai-key
// - Validates caller is a super_admin (using the caller JWT + public.users)
// - Stores the OpenAI key in `public.app_settings` (service role bypasses RLS)
//
// Deploy:
//   supabase functions deploy set-openai-key
//
// Env required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY (for verifying caller token via getUser)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const OPENAI_SETTINGS_KEY = 'openai_api_key';

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return json(405, { success: false, error: 'Method not allowed' });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!jwt) return json(401, { success: false, error: 'Missing Authorization bearer token' });

    // Auth client using anon key + caller JWT
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return json(401, { success: false, error: 'Invalid token' });

    const userId = userData.user.id;

    // Admin client to bypass RLS and check role
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) return json(403, { success: false, error: 'User profile not found' });
    if (profile.role !== 'super_admin') return json(403, { success: false, error: 'Only super_admin can set OpenAI key' });

    const { openaiKey } = await req.json().catch(() => ({}));
    const trimmed = typeof openaiKey === 'string' ? openaiKey.trim() : '';
    if (!trimmed) return json(400, { success: false, error: 'Missing openaiKey' });

    const { error: upsertErr } = await supabaseAdmin.from('app_settings').upsert({
      key: OPENAI_SETTINGS_KEY,
      value: trimmed,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });

    if (upsertErr) return json(500, { success: false, error: upsertErr.message });

    return json(200, { success: true });
  } catch (e: any) {
    console.error('set-openai-key fatal:', e);
    return json(500, { success: false, error: e?.message ?? 'Internal server error' });
  }
});


