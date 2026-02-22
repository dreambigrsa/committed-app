// @ts-nocheck
// POST /functions/v1/request-password-reset
// Body: { email }. Creates reset_password token (30 min), sends email. Generic response.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_WEB_URL = Deno.env.get("APP_WEB_URL") || "https://committed.dreambig.org.za";
const APP_DEEPLINK_BASE = Deno.env.get("APP_DEEPLINK_BASE") || "committed://";

const RESET_EXPIRY_MINUTES = 30;
const RATE_LIMIT_PER_EMAIL_MINUTES = 10;
const RATE_LIMIT_MAX_PER_EMAIL = 3;

function corsHeaders(req?: Request) {
  const requested = req?.headers?.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requested || "authorization, x-client-info, apikey, content-type",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(status: number, body: unknown, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, req);

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(200, { success: true, message: "If this email is registered, you will receive a password reset link." }, req);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: recent } = await supabase
      .from("auth_tokens")
      .select("id")
      .eq("email", email)
      .eq("type", "reset_password")
      .gte("created_at", new Date(Date.now() - RATE_LIMIT_PER_EMAIL_MINUTES * 60 * 1000).toISOString());
    if (recent && recent.length >= RATE_LIMIT_MAX_PER_EMAIL) {
      return json(200, { success: true, message: "If this email is registered, you will receive a password reset link." }, req);
    }

    const { data: profileRow } = await supabase.from("profiles").select("id").eq("email", email).limit(1).maybeSingle();
    const uid = profileRow?.id ?? null;

    const rawToken = randomToken(32);
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    const { error: insertErr } = await supabase.from("auth_tokens").insert({
      user_id: uid,
      email,
      token_hash: tokenHash,
      type: "reset_password",
      expires_at: expiresAt,
      request_ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });
    if (insertErr) {
      console.error("auth_tokens insert error:", insertErr.message);
      return json(200, { success: true, message: "If this email is registered, you will receive a password reset link." }, req);
    }

    const baseUrl = APP_WEB_URL;
    const resetUrl = `${baseUrl}/auth-callback?type=recovery&token=${encodeURIComponent(rawToken)}`;
    const deepLink = `${APP_DEEPLINK_BASE}auth-callback?type=recovery&token=${encodeURIComponent(rawToken)}`;

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return json(200, { success: true, message: "If this email is registered, you will receive a password reset link." }, req);
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:system-ui,sans-serif;background:#f1f5f9;padding:24px">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
  <div style="background:linear-gradient(135deg,#1a73e8 0%,#1557b0 100%);padding:32px;text-align:center">
    <h1 style="margin:0;font-size:24px;color:#fff">Committed</h1>
    <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.9)">Reset your password</p>
  </div>
  <div style="padding:32px">
    <p style="margin:0 0 24px;color:#374151;line-height:1.6">Click the button below to set a new password. This link expires in ${RESET_EXPIRY_MINUTES} minutes.</p>
    <p style="margin:0 0 16px"><a href="${resetUrl}" style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:600">Reset Password</a></p>
    <p style="margin:0;font-size:14px;color:#6b7280">Or open in app: <a href="${deepLink}" style="color:#1a73e8">Open in App</a></p>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af">If you didn't request this, you can ignore this email.</p>
  </div>
  <div style="background:#f8fafc;padding:20px;text-align:center;border-top:1px solid #f1f5f9">
    <p style="margin:0;font-size:12px;color:#94a3b8">&copy; ${new Date().getFullYear()} Committed.</p>
  </div>
</div></body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Committed <noreply@resend.dev>",
        to: [email],
        subject: "Reset your password – Committed",
        html,
      }),
    });
    const resData = await res.json().catch(() => ({}));
    if (!res.ok) console.error("Resend error:", resData);

    return json(200, { success: true, message: "If this email is registered, you will receive a password reset link." }, req);
  } catch (e) {
    console.error("request-password-reset error:", e);
    return json(200, { success: true, message: "If this email is registered, you will receive a password reset link." }, req);
  }
});
