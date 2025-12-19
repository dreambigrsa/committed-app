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

    // Check if client wants streaming (default to false - requires client-side streaming support)
    const stream = body?.stream === true; // Only stream if explicitly requested

    // Use a modern, cost-effective model. If your key lacks access, OpenAI will return a clear error.
    if (stream) {
      // Streaming mode: stream responses in real-time
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel || 'gpt-4o-mini',
          messages,
          temperature: Number.isFinite(selectedTemperature) ? selectedTemperature : 0.65,
          max_tokens: Number.isFinite(selectedMaxTokens) ? selectedMaxTokens : 200,
          stream: true, // Enable streaming
        }),
      });

      if (!openaiRes.ok) {
        const errorData = await openaiRes.json().catch(() => ({}));
        return json(502, {
          success: false,
          error: errorData?.error?.message || `OpenAI error: ${openaiRes.status}`,
        }, req);
      }

      // Stream the response back to client
      const stream = new ReadableStream({
        async start(controller) {
          const reader = openaiRes.body?.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          if (!reader) {
            controller.close();
            return;
          }

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n').filter(line => line.trim() !== '');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    // Send final message with full content
                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify({
                        type: 'done',
                        content: fullContent,
                        success: true,
                      })}\n\n`)
                    );
                    controller.close();
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullContent += delta;
                      // Stream each chunk to client
                      controller.enqueue(
                        new TextEncoder().encode(`data: ${JSON.stringify({
                          type: 'chunk',
                          content: delta,
                        })}\n\n`)
                      );
                    }
                  } catch (e) {
                    // Skip invalid JSON
                  }
                }
              }
            }
          } catch (error: any) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({
                type: 'error',
                error: error.message,
              })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders(req),
        },
      });
    }

    // Non-streaming mode (fallback) - still faster with typing indicators
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel || 'gpt-4o-mini',
        messages,
        temperature: Number.isFinite(selectedTemperature) ? selectedTemperature : 0.65,
        max_tokens: Number.isFinite(selectedMaxTokens) ? selectedMaxTokens : 200,
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

    // AI-based professional help detection - analyze conversation for emotional distress, stress, frustration, mental health needs
    let suggestProfessionalHelp = false;
    let suggestedProfessionalType: string | null = null;
    
    try {
      // Use AI to analyze the conversation for professional help needs
      const detectionPrompt = `Analyze this conversation and determine if the user needs professional help (counselor, therapist, business mentor, legal advisor, etc.).

Consider:
- Emotional distress: sadness, anxiety, depression, overwhelming feelings, frustration, anger
- Stress indicators: feeling overwhelmed, can't cope, struggling, having a hard time
- Mental health concerns: depression, anxiety, trauma, abuse, suicidal thoughts, self-harm
- Relationship issues: relationship problems, breakups, marital issues, trust issues
- Business/career needs: career guidance, business mentorship, professional development
- Legal needs: legal advice, divorce, custody, legal issues

Conversation history (last 10 messages):
${conversationHistory.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')}

Latest user message: ${userMessage}

Respond with ONLY valid JSON (no other text). Use this exact format:
{
  "needsProfessionalHelp": true,
  "professionalType": "Counselor",
  "confidence": "high",
  "reason": "brief explanation"
}

Possible professionalType values: "Counselor", "Therapist", "Business Mentor", "Legal Advisor", "Relationship Therapist", "Mental Health Professional", or null if not applicable.
Possible confidence values: "high", "medium", "low", or "none".`;

      const detectionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert at analyzing conversations to determine if users need professional help. Respond with only valid JSON.' },
            { role: 'user', content: detectionPrompt },
          ],
          temperature: 0.3, // Lower temperature for more consistent detection
          max_tokens: 200,
          response_format: { type: 'json_object' }, // Force JSON output
        }),
      });

      if (detectionRes.ok) {
        const detectionJson = await detectionRes.json().catch(() => ({}));
        const detectionContent = detectionJson?.choices?.[0]?.message?.content;
        if (detectionContent) {
          try {
            const detection = JSON.parse(detectionContent);
            // Only suggest if confidence is high or medium (not low or none)
            if (detection.needsProfessionalHelp && (detection.confidence === 'high' || detection.confidence === 'medium')) {
              suggestProfessionalHelp = true;
              suggestedProfessionalType = detection.professionalType || 'professional';
            }
          } catch (e) {
            console.error('Error parsing detection JSON:', e);
          }
        }
      }
    } catch (e) {
      console.error('Error in professional help detection:', e);
      // Continue without detection if it fails
    }

    return json(200, {
      success: true,
      message: content,
      suggestProfessionalHelp,
      suggestedProfessionalType,
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


