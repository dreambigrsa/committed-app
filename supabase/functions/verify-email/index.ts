// @ts-nocheck
// GET /functions/v1/verify-email?token=...
// Validates token, marks used, sets profiles.is_verified = true. Returns { ok: true }.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function corsHeaders(req?: Request) {
  const requested = req?.headers?.get("Access-Control-Request-Headers");
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (req.method !== "GET") return json(405, { ok: false, error: "Method not allowed" }, req);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) return json(400, { ok: false, error: "Invalid or missing token" }, req);

    const tokenHash = await hashToken(token);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: fetchErr } = await supabase
      .from("auth_tokens")
      .select("id, user_id, email, used_at, expires_at")
      .eq("token_hash", tokenHash)
      .eq("type", "verify_email")
      .maybeSingle();

    if (fetchErr || !row) return json(400, { ok: false, error: "Invalid or expired link" }, req);
    if (row.used_at) return json(400, { ok: false, error: "Link already used" }, req);
    if (new Date(row.expires_at) < new Date()) return json(400, { ok: false, error: "Link expired" }, req);

    await supabase.from("auth_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    const profileId = row.user_id;
    if (profileId) {
      await supabase
        .from("profiles")
        .update({ is_verified: true, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", profileId);
    } else {
      const { data: byEmail } = await supabase.from("profiles").select("id").eq("email", row.email).limit(1).maybeSingle();
      if (byEmail?.id) {
        await supabase
          .from("profiles")
          .update({ is_verified: true, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", byEmail.id);
      }
    }

    return json(200, { ok: true }, req);
  } catch (e) {
    console.error("verify-email error:", e);
    return json(500, { ok: false, error: "Something went wrong" }, req);
  }
});
