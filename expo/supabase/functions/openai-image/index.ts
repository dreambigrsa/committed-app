// @ts-nocheck
// Supabase Edge Function: openai-image
// - Reads OpenAI API key from `public.app_settings` using service role
// - Calls OpenAI server-side so the API key is never exposed to the client
//
// Deploy:
//   supabase functions deploy openai-image
//
// Env required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Optional:
//   OPENAI_IMAGE_MODEL (default: dall-e-3)
//
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_IMAGE_MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') || 'dall-e-3';

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
    const { prompt, size, quality, n, model } = await req.json().catch(() => ({}));

    const p = String(prompt ?? '').trim();
    if (!p) return json(400, { success: false, error: 'Missing prompt' }, req);

    const openaiKey = await getOpenAIKey(supabaseAdmin);
    if (!openaiKey) {
      return json(400, { success: false, error: 'OpenAI key not configured. Set it in Admin Settings.' }, req);
    }

    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: String(model || OPENAI_IMAGE_MODEL),
        prompt: p,
        n: typeof n === 'number' ? n : 1,
        size: typeof size === 'string' ? size : '1024x1024',
        quality: typeof quality === 'string' ? quality : 'standard',
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return json(502, { success: false, error: data?.error?.message || `OpenAI error: ${resp.status}`, details: data }, req);
    }

    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) return json(502, { success: false, error: 'No image URL returned from OpenAI', details: data }, req);

    return json(200, { success: true, imageUrl }, req);
  } catch (e: any) {
    console.error('openai-image fatal:', e);
    return json(500, { success: false, error: e?.message ?? 'Internal server error' }, req);
  }
});


