// @ts-nocheck
// Supabase Edge Function for sending SMS via Twilio
// Deploy this function to Supabase: supabase functions deploy send-sms

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';

interface RequestBody {
  phoneNumber: string;
  code: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function corsHeaders(req?: Request) {
  // Reflect requested headers to satisfy browser preflight (Supabase clients often send x-client-info, apikey, etc).
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

async function getAppSetting(supabaseAdmin: any, key: string): Promise<string> {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', key).maybeSingle();
  return data?.value ? String(data.value).trim() : '';
}

serve(async (req: Request) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }

    const { phoneNumber, code }: RequestBody = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Prefer values stored in app_settings (editable by Super Admin). Fallback to Edge Function secrets.
    const accountSid =
      (await getAppSetting(supabaseAdmin, 'twilio_account_sid')) ||
      Deno.env.get('TWILIO_ACCOUNT_SID') ||
      '';
    const authToken =
      (await getAppSetting(supabaseAdmin, 'twilio_auth_token')) ||
      Deno.env.get('TWILIO_AUTH_TOKEN') ||
      '';
    const fromNumber =
      (await getAppSetting(supabaseAdmin, 'twilio_from_number')) ||
      Deno.env.get('TWILIO_FROM_NUMBER') ||
      '';

    if (!phoneNumber || !code || !accountSid || !authToken || !fromNumber) {
      return json(400, {
        success: false,
        error:
          'Missing required parameters. Provide phoneNumber + code, and configure Twilio in Admin Settings (or set TWILIO_* as Edge Function secrets).',
      }, req);
    }

    // Send SMS via Twilio
    const message = `Your Committed verification code is: ${code}. This code will expire in 10 minutes.`;
    const url = `${TWILIO_API_URL}/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', fromNumber);
    formData.append('To', phoneNumber);
    formData.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return json(500, { success: false, error: data.message || 'Failed to send SMS' }, req);
    }

    return json(200, { success: true, messageSid: data.sid }, req);
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return json(500, { success: false, error: error.message || 'Internal server error' }, req);
  }
});

