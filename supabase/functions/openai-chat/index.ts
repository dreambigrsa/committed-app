// @ts-nocheck
// Supabase Edge Function: openai-chat
// - Reads OpenAI API key from `public.app_settings` using service role
// - Calls OpenAI server-side so the API key is never exposed to the client
//
// Deploy:
//   supabase functions deploy openai-chat
//
// Env required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Optional:
//   OPENAI_MODEL (default: gpt-4o-mini)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

const OPENAI_SETTINGS_KEY = 'openai_api_key';

function corsHeaders(req?: Request) {
  const requested = req?.headers?.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requested || 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin, Access-Control-Request-Headers',
  };
}

function json(status: number, payload: unknown, req?: Request) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

async function getOpenAIKey(supabaseAdmin: any): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', OPENAI_SETTINGS_KEY)
    .maybeSingle();

  if (error) return null;
  const key = data?.value ? String(data.value).trim() : '';
  return key ? key : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(405, { success: false, error: 'Method not allowed' }, req);

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { messages, temperature, max_tokens } = await req.json().catch(() => ({}));
    if (!Array.isArray(messages) || messages.length === 0) {
      return json(400, { success: false, error: 'Missing messages[]' }, req);
    }

    const openaiKey = await getOpenAIKey(supabaseAdmin);
    if (!openaiKey) {
      return json(400, { success: false, error: 'OpenAI key not configured. Set it in Admin Settings.' }, req);
    }

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.8,
        max_tokens: typeof max_tokens === 'number' ? max_tokens : 500,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return json(502, { success: false, error: data?.error?.message || `OpenAI error: ${resp.status}`, details: data }, req);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return json(502, { success: false, error: 'No message content returned from OpenAI', details: data }, req);

    return json(200, { success: true, message: content }, req);
  } catch (e: any) {
    console.error('openai-chat fatal:', e);
    return json(500, { success: false, error: e?.message ?? 'Internal server error' }, req);
  }
});


