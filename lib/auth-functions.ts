/**
 * Call our custom auth Edge Functions (verify email, request/reset password).
 * Base URL derived from EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL.
 */
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (typeof globalThis !== "undefined" && (globalThis as any).EXPO_PUBLIC_SUPABASE_URL) ||
  "";
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (typeof globalThis !== "undefined" && (globalThis as any).EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
  "";

export function getFunctionsBaseUrl(): string {
  const custom = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
  if (custom && typeof custom === "string") return custom.replace(/\/$/, "");
  if (SUPABASE_URL) return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1`;
  return "";
}

export async function sendVerificationEmail(accessToken: string | null, email?: string): Promise<{ success: boolean; message?: string }> {
  const base = getFunctionsBaseUrl();
  if (!base) return { success: false, message: "Functions URL not configured" };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  const res = await fetch(`${base}/send-verification`, {
    method: "POST",
    headers,
    body: JSON.stringify(email ? { email } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { success: data.success === true, message: data.message };
}

export async function verifyEmailToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const base = getFunctionsBaseUrl();
  if (!base) return { ok: false, error: "Functions URL not configured" };
  const res = await fetch(`${base}/verify-email?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { "apikey": ANON_KEY },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: data.ok === true, error: data.error };
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
  const base = getFunctionsBaseUrl();
  if (!base) return { success: false, message: "Functions URL not configured" };
  const res = await fetch(`${base}/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  return { success: data.success === true, message: data.message };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const base = getFunctionsBaseUrl();
  if (!base) return { ok: false, error: "Functions URL not configured" };
  const res = await fetch(`${base}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: data.ok === true, error: data.error };
}
