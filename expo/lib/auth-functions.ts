/**
 * Auth API - calls our website's API routes (Resend for emails).
 * Uses EXPO_PUBLIC_APP_WEB_URL or EXPO_PUBLIC_SITE_URL for the website base.
 * No Supabase Edge Functions - all email flows go through our app/website.
 */
const getAuthApiBaseUrl = (): string => {
  const url =
    process.env.EXPO_PUBLIC_APP_WEB_URL ||
    process.env.EXPO_PUBLIC_SITE_URL ||
    (typeof globalThis !== "undefined" && (globalThis as any).EXPO_PUBLIC_APP_WEB_URL) ||
    (typeof globalThis !== "undefined" && (globalThis as any).EXPO_PUBLIC_SITE_URL) ||
    "";
  const base = typeof url === "string" ? url.trim() : "";
  return base ? base.replace(/\/$/, "") : "https://committed.dreambig.org.za";
};

/** @deprecated Use getAuthApiBaseUrl. Kept for any external references. */
export function getFunctionsBaseUrl(): string {
  return getAuthApiBaseUrl();
}

function normalizeFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|network request failed|networkerror/i.test(msg)) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }
  return msg || 'Something went wrong. Please try again.';
}

async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<{ data: T; ok: boolean; status: number }> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { data, ok: res.ok, status: res.status };
}

export async function sendVerificationEmail(
  accessToken: string | null,
  email?: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const base = getAuthApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const { data, ok } = await fetchJson<{ success?: boolean; message?: string; error?: string }>(
      `${base}/api/auth/send-verification`,
      { method: "POST", headers, body: JSON.stringify(email ? { email } : {}) }
    );
    if (!ok) {
      const errMsg = (data as { error?: string }).error || (data as { message?: string }).message;
      return { success: false, message: errMsg || 'Failed to send verification email.' };
    }
    return { success: data.success === true, message: data.message };
  } catch (err) {
    return { success: false, message: normalizeFetchError(err) };
  }
}

export async function verifyEmailToken(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const base = getAuthApiBaseUrl();
    const { data } = await fetchJson<{ ok?: boolean; error?: string }>(
      `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`,
      { method: "GET" }
    );
    return { ok: data.ok === true, error: data.error };
  } catch (err) {
    return { ok: false, error: normalizeFetchError(err) };
  }
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; message?: string }> {
  try {
    const base = getAuthApiBaseUrl();
    const { data, ok } = await fetchJson<{ success?: boolean; message?: string; error?: string }>(
      `${base}/api/auth/request-password-reset`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );
    if (!ok) {
      const errMsg = (data as { error?: string }).error || (data as { message?: string }).message;
      return { success: false, message: errMsg || 'Failed to send reset link.' };
    }
    return { success: data.success === true, message: data.message };
  } catch (err) {
    return { success: false, message: normalizeFetchError(err) };
  }
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const base = getAuthApiBaseUrl();
    const { data } = await fetchJson<{ ok?: boolean; error?: string }>(
      `${base}/api/auth/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      }
    );
    return { ok: data.ok === true, error: data.error };
  } catch (err) {
    return { ok: false, error: normalizeFetchError(err) };
  }
}
