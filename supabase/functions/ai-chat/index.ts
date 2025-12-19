// @ts-nocheck
// Supabase Edge Function: ai-chat
// Calls OpenAI server-side using an API key stored in `public.app_settings` (key = 'openai_api_key').
// Also supports prompt versioning + rollout via `public.ai_prompt_versions`.
// Deploy: supabase functions deploy ai-chat

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

    const body = await req.json().catch(() => ({}));
    const userMessage = String(body?.userMessage ?? '').trim();
    const conversationHistory = Array.isArray(body?.conversationHistory) ? body.conversationHistory : [];
    const userId = body?.userId ? String(body.userId) : null;
    const fallbackSystemPrompt = body?.systemPrompt ? String(body.systemPrompt) : null;

    if (!userMessage) {
      return json(400, { success: false, error: 'Missing userMessage' }, req);
    }

    // Pick an active prompt version (supports rollout via hashing userId).
    let selectedPrompt: string | null = null;
    let selectedPromptId: string | null = null;
    let selectedModel: string | null = null;
    let selectedTemperature: number | null = null;
    let selectedMaxTokens: number | null = null;

    try {
      const { data: versions } = await supabaseAdmin
        .from('ai_prompt_versions')
        .select('id, prompt, model, temperature, max_tokens, rollout_percent, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (versions && versions.length > 0) {
        const v = versions[0];
        const rollout = typeof v.rollout_percent === 'number' ? v.rollout_percent : 100;
        let inRollout = true;
        if (userId && rollout < 100) {
          // Simple stable hash: sum char codes mod 100
          let sum = 0;
          for (let i = 0; i < userId.length; i++) sum = (sum + userId.charCodeAt(i)) % 100;
          inRollout = sum < rollout;
        }
        if (inRollout) {
          selectedPrompt = String(v.prompt ?? '');
          selectedPromptId = String(v.id ?? '');
          selectedModel = String(v.model ?? 'gpt-4o-mini');
          selectedTemperature = Number(v.temperature ?? 0.8);
          selectedMaxTokens = Number(v.max_tokens ?? 600);
        }
      }
    } catch {
      // If the table isn't installed yet, just continue with fallback prompt.
    }

    const { data: keyRow, error: keyErr } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .maybeSingle();

    if (keyErr) return json(500, { success: false, error: keyErr.message }, req);
    const apiKey = keyRow?.value ? String(keyRow.value).trim() : '';
    if (!apiKey) return json(400, { success: false, error: 'OpenAI API key not configured' }, req);

    // Keep history shorter for latency/cost. The system prompt already carries global context.
    const messages = [
      ...((selectedPrompt || fallbackSystemPrompt) ? [{ role: 'system', content: selectedPrompt || fallbackSystemPrompt }] : []),
      ...conversationHistory.slice(-6), // Optimized to 6 messages for speed
      { role: 'user', content: userMessage },
    ];

    // Use a modern, cost-effective model. If your key lacks access, OpenAI will return a clear error.
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel || 'gpt-4o-mini',
        messages,
        temperature: Number.isFinite(selectedTemperature) ? selectedTemperature : 0.65, // Optimized for speed
        max_tokens: Number.isFinite(selectedMaxTokens) ? selectedMaxTokens : 200, // Optimized for faster responses
      }),
    });

    const openaiJson = await openaiRes.json().catch(() => ({}));
    if (!openaiRes.ok) {
      return json(502, {
        success: false,
        error: openaiJson?.error?.message || `OpenAI error: ${openaiRes.status}`,
      }, req);
    }

    const content = openaiJson?.choices?.[0]?.message?.content;
    if (!content) return json(502, { success: false, error: 'No content returned from OpenAI' }, req);

    return json(200, {
      success: true,
      message: content,
      meta: {
        promptVersionId: selectedPromptId,
        model: selectedModel || 'gpt-4o-mini',
      },
    }, req);
  } catch (e: any) {
    console.error('ai-chat fatal error:', e);
    return json(500, { success: false, error: e?.message ?? 'Internal server error' }, req);
  }
});


