// @ts-nocheck
// Supabase Edge Function: ai-suggest-prompts
// Generates prompt improvement suggestions based on recent ai_message_feedback.
// Stores suggestions in public.ai_prompt_suggestions for super_admin review.
//
// Deploy: supabase functions deploy ai-suggest-prompts
//
// Env required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(405, { success: false, error: 'Method not allowed' }, req);

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Current active prompt (latest)
    const { data: promptVersions } = await supabaseAdmin
      .from('ai_prompt_versions')
      .select('id, prompt, model, temperature, max_tokens, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const base = promptVersions && promptVersions.length ? promptVersions[0] : null;
    if (!base) {
      return json(400, { success: false, error: 'No active ai_prompt_versions found' });
    }

    // Pull recent feedback (last 7 days, max 200)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: feedback } = await supabaseAdmin
      .from('ai_message_feedback')
      .select('rating, comment, created_at, prompt_version_id')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    const total = feedback?.length ?? 0;
    const up = feedback?.filter((f: any) => f.rating === 1).length ?? 0;
    const down = feedback?.filter((f: any) => f.rating === -1).length ?? 0;
    const sampleComments = (feedback ?? [])
      .map((f: any) => (f.comment ? String(f.comment) : ''))
      .filter(Boolean)
      .slice(0, 25);

    // Read OpenAI key from app_settings (server-side).
    const { data: keyRow, error: keyErr } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .maybeSingle();

    if (keyErr) return json(500, { success: false, error: keyErr.message }, req);
    const apiKey = keyRow?.value ? String(keyRow.value).trim() : '';
    if (!apiKey) return json(400, { success: false, error: 'OpenAI API key not configured' }, req);

    // Call OpenAI directly (avoid depending on another Edge Function).
    const messages = [
      {
        role: 'system',
        content:
          'You are an expert prompt engineer improving an in-app assistant for a mobile app called Committed. ' +
          'Produce one improved SYSTEM PROMPT. Keep it concise, action-oriented, and focused on helping users use the app and troubleshoot. ' +
          'Do NOT include secrets. Output ONLY the prompt text, nothing else.',
      },
      {
        role: 'user',
        content:
          `Current system prompt:\n\n${base.prompt}\n\n` +
          `Recent feedback stats (last 7 days): total=${total}, up=${up}, down=${down}\n\n` +
          `Sample user comments:\n- ${sampleComments.join('\n- ') || '(none)'}\n\n` +
          `Return an improved system prompt now.`,
      },
    ];

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    const openaiJson = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      return json(
        502,
        {
          success: false,
          error: openaiJson?.error?.message || `OpenAI error: ${openaiRes.status}`,
          details: openaiJson,
        },
        req
      );
    }

    const suggestedPrompt = String(openaiJson?.choices?.[0]?.message?.content ?? '').trim();
    if (!suggestedPrompt) return json(502, { success: false, error: 'Empty suggestion from OpenAI' });

    const { error: insertErr } = await supabaseAdmin.from('ai_prompt_suggestions').insert({
      base_prompt_version_id: base.id,
      suggested_prompt: suggestedPrompt,
      rationale: 'Generated from recent thumbs up/down feedback and comments.',
      stats: { since, total, up, down },
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertErr) return json(500, { success: false, error: insertErr.message }, req);

    return json(200, { success: true, suggestedPrompt }, req);
  } catch (e: any) {
    console.error('ai-suggest-prompts fatal:', e);
    return json(500, { success: false, error: e?.message ?? 'Internal server error' }, req);
  }
});


