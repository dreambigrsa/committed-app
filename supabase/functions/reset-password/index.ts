// @ts-nocheck
// POST /functions/v1/reset-password
// Body: { token, newPassword }. Validates token, updates auth user password via Admin API, marks token used.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MIN_PASSWORD_LENGTH = 6;

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

async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const newPassword = body?.newPassword ?? body?.new_password;

    if (!token || typeof token !== "string" || token.length < 16) {
      return json(400, { ok: false, error: "Invalid or missing token" }, req);
    }
    if (!newPassword || typeof newPassword !== "string") {
      return json(400, { ok: false, error: "New password is required" }, req);
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return json(400, { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, req);
    }

    const tokenHash = await hashToken(token);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: fetchErr } = await supabase
      .from("auth_tokens")
      .select("id, user_id, used_at, expires_at")
      .eq("token_hash", tokenHash)
      .eq("type", "reset_password")
      .maybeSingle();

    if (fetchErr || !row) return json(400, { ok: false, error: "Invalid or expired link" }, req);
    if (row.used_at) return json(400, { ok: false, error: "Link already used" }, req);
    if (new Date(row.expires_at) < new Date()) return json(400, { ok: false, error: "Link expired" }, req);

    const userId = row.user_id;
    if (!userId) return json(400, { ok: false, error: "Invalid or expired link" }, req);

    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (updateErr) {
      console.error("admin updateUserById error:", updateErr.message);
      return json(400, { ok: false, error: updateErr.message || "Failed to update password" }, req);
    }

    await supabase.from("auth_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    return json(200, { ok: true }, req);
  } catch (e) {
    console.error("reset-password error:", e);
    return json(500, { ok: false, error: "Something went wrong" }, req);
  }
});
