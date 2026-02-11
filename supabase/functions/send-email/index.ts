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

    // Send Email via Resend - Premium design with app branding
    const emailBody = {
      from: `${fromName} <${fromEmail}>`,
      to: [email],
      subject: 'Your Committed Verification Code',
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; max-height: 0; overflow: hidden; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .code-box { padding: 24px 16px !important; }
      .code-digits { font-size: 28px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #F1F5F9; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <!-- Preheader: visible in inbox preview -->
  <div class="preheader" style="display: none; max-height: 0; overflow: hidden;">
    Your verification code is ${code}. Valid for 10 minutes. — Committed
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F1F5F9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A73E8 0%, #1557B0 100%); padding: 36px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">Committed</h1>
                    <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500;">Trust · Love · Commitment</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: #E8F0FE; color: #1A73E8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 24px;">Verification Code</div>
                    <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1F2937;">Welcome back</h2>
                    <p style="margin: 0; font-size: 16px; color: #6B7280; line-height: 1.6;">Use the code below to verify your email address and continue.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="background: linear-gradient(145deg, #F8FAFC 0%, #F1F5F9 100%); border: 1px solid #E2E8F0; border-radius: 12px; padding: 28px 40px;" class="code-box">
                      <tr>
                        <td align="center">
                          <span style="font-size: 36px; font-weight: 700; color: #1A73E8; letter-spacing: 8px; font-variant-numeric: tabular-nums;" class="code-digits">${code}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 24px;">
                    <p style="margin: 0; font-size: 14px; color: #9CA3AF;">This code expires in <strong style="color: #6B7280;">10 minutes</strong></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 32px; border-top: 1px solid #F1F5F9; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #9CA3AF; line-height: 1.6;">If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; padding: 24px 40px; text-align: center; border-top: 1px solid #F1F5F9;">
              <p style="margin: 0; font-size: 12px; color: #94A3B8;">&copy; ${new Date().getFullYear()} Committed. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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

