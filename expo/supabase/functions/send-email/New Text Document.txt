// @ts-nocheck
// Supabase Edge Function for sending Email via Resend
// Deploy this function to Supabase: supabase functions deploy send-email

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface RequestBody {
  email: string;
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

    const { email, code }: RequestBody = await req.json();

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Prefer values stored in app_settings (editable by Super Admin). Fallback to Edge Function secrets.
    const apiKey =
      (await getAppSetting(supabaseAdmin, 'resend_api_key')) ||
      Deno.env.get('RESEND_API_KEY') ||
      '';
    const fromEmail =
      (await getAppSetting(supabaseAdmin, 'resend_from_email')) ||
      Deno.env.get('RESEND_FROM_EMAIL') ||
      '';
    const fromName =
      (await getAppSetting(supabaseAdmin, 'resend_from_name')) ||
      Deno.env.get('RESEND_FROM_NAME') ||
      'Committed';

    if (!email || !code || !apiKey || !fromEmail) {
      return json(400, {
        success: false,
        error: 'Missing required parameters. Provide email + code, and configure Resend in Admin Settings (or set RESEND_* as Edge Function secrets).',
      }, req);
    }

    // Send Email via Resend
    const emailBody = {
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject: 'Your Committed Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Committed</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">Verification Code</h2>
              <p>Your verification code is:</p>
              <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px;">${code}</span>
              </div>
              <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} Committed. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      text: `Your Committed verification code is: ${code}. This code will expire in 10 minutes.`,
    };

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return json(500, { success: false, error: data.message || 'Failed to send email' }, req);
    }

    return json(200, { success: true, emailId: data.id }, req);
  } catch (error: any) {
    console.error('Error sending email:', error);
    return json(500, { success: false, error: error.message || 'Internal server error' }, req);
  }
});

