// @ts-nocheck
// Supabase Edge Function for sending Expo push notifications
// Deploy: supabase functions deploy send-push
//
// This function looks up Expo push tokens from `push_notification_tokens`
// and sends a push via Expo's Push API.
//
// Notes:
// - Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// - For iOS production pushes, your Expo project must be configured with APNs.
// - For Android production pushes, configure FCM in Expo/EAS.

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SEND_PUSH_SECRET = Deno.env.get('SEND_PUSH_SECRET') ?? null;

type SendPushBody = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

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
    // Optional hardening: if SEND_PUSH_SECRET is set, require callers to pass it as a header.
    if (SEND_PUSH_SECRET) {
      const provided = req.headers.get('x-send-push-secret');
      if (!provided || provided !== SEND_PUSH_SECRET) {
        return json(401, { success: false, error: 'Unauthorized' });
      }
    }

    const rawBody: any = await req.json().catch(() => ({}));
    const userId = String(rawBody?.userId ?? rawBody?.user_id ?? '').trim();
    const title = String(rawBody?.title ?? '').trim();
    const body = String(rawBody?.body ?? rawBody?.message ?? '').trim();
    const data = rawBody?.data;

    if (!userId || !title || !body) {
      return json(400, {
        success: false,
        error: 'Missing required fields: userId, title, body',
        received: {
          hasUserId: !!userId,
          hasTitle: !!title,
          hasBody: !!body,
          keys: rawBody && typeof rawBody === 'object' ? Object.keys(rawBody) : [],
        },
        hint: 'Send JSON: { "userId": "...", "title": "...", "body": "..." } (or user_id/message aliases).',
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read user notification preferences (optional; defaults to sound enabled).
    let soundEnabled = true;
    try {
      const { data: settingsRow } = await supabaseAdmin
        .from('user_settings')
        .select('notification_settings')
        .eq('user_id', userId)
        .maybeSingle();
      const raw = (settingsRow as any)?.notification_settings?.soundEnabled;
      if (typeof raw === 'boolean') soundEnabled = raw;
      else if (typeof raw === 'string') soundEnabled = raw.toLowerCase() === 'true';
      else if (raw === false || raw === 'false') soundEnabled = false;
    } catch {
      // ignore - keep defaults
    }

    const { data: tokens, error: tokenErr } = await supabaseAdmin
      .from('push_notification_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('active', true);

    if (tokenErr) {
      return json(500, { success: false, error: tokenErr.message });
    }

    const expoTokens = (tokens ?? []).map((t: any) => t.token).filter(Boolean);
    if (expoTokens.length === 0) {
      return json(200, { success: true, sent: 0, message: 'No active push tokens for user' });
    }

    // Expo push API accepts an array of messages
    const messages = expoTokens.map((to: string) => ({
      to,
      title,
      body,
      data: data ?? {},
      sound: soundEnabled ? 'default' : undefined,
      // Android: select a channel that matches user sound preference.
      // (The app creates both channels at startup; see lib/push-notifications.ts)
      channelId: soundEnabled ? 'default' : 'default-silent',
    }));

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const expoJson = await expoRes.json().catch(() => null);

    if (!expoRes.ok) {
      return json(502, {
        success: false,
        error: 'Expo push request failed',
        status: expoRes.status,
        response: expoJson,
      });
    }

    return json(200, { success: true, sent: expoTokens.length, response: expoJson });
  } catch (e: any) {
    console.error('send-push fatal error:', e);
    return json(500, { success: false, error: e?.message ?? 'Internal server error' });
  }
});


