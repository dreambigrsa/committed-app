/**
 * Direct Supabase Auth API calls to avoid SDK bugs (e.g. updateUser lock that never resolves).
 * Each request uses a fresh AbortController for timeout only; no shared/global controller.
 */

import { getSupabaseAuthConfig } from '@/lib/supabase';

const AUTH_UPDATE_USER_PATH = '/auth/v1/user';
const DEFAULT_TIMEOUT_MS = 25000;

export class UpdatePasswordTimeoutError extends Error {
  constructor() {
    super('UPDATE_PASSWORD_TIMEOUT');
    this.name = 'UpdatePasswordTimeoutError';
  }
}

export class UpdatePasswordAbortedError extends Error {
  constructor() {
    super('Request was cancelled.');
    this.name = 'UpdatePasswordAbortedError';
  }
}

/**
 * Update user password via Supabase Auth REST API.
 * Uses a single timeout AbortController for this request only (no unmount/route abort).
 * @param accessToken - Current session access_token (from recovery link).
 * @param newPassword - New password.
 * @param options - timeoutMs (default 25s).
 * @returns void on success.
 * @throws UpdatePasswordTimeoutError on timeout (allow retry).
 * @throws UpdatePasswordAbortedError on abort (do not show "Failed to save").
 * @throws Error with message for 4xx/5xx (expired token, weak password, etc.).
 */
export async function updatePasswordViaApi(
  accessToken: string,
  newPassword: string,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  const { url, anonKey } = getSupabaseAuthConfig();
  const endpoint = `${url.replace(/\/$/, '')}${AUTH_UPDATE_USER_PATH}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  if (__DEV__) {
    console.log('[Auth API] updatePassword: token present=', !!accessToken, 'endpoint=', endpoint);
  }

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ password: newPassword }),
      signal: controller.signal,
    });

    const duration = Date.now() - start;
    if (__DEV__) {
      console.log('[Auth API] updatePassword: status=', res.status, 'duration_ms=', duration);
    }

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.msg ?? data?.message ?? data?.error_description ?? `Request failed (${res.status})`;
      if (__DEV__) {
        console.log('[Auth API] updatePassword: error type=', res.status >= 500 ? '5xx' : '4xx', 'message=', msg);
      }
      if (res.status === 401 || res.status === 410 || (typeof msg === 'string' && msg.toLowerCase().includes('expired'))) {
        throw new Error('This reset link has expired. Please request a new password reset.');
      }
      if (res.status === 400 && typeof msg === 'string' && msg.toLowerCase().includes('password')) {
        throw new Error(msg || 'Password does not meet requirements.');
      }
      throw new Error(typeof msg === 'string' ? msg : 'Failed to update password.');
    }

    return;
  } catch (e: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    if (__DEV__) {
      console.log('[Auth API] updatePassword: error after_ms=', duration, 'name=', e?.name, 'message=', e?.message);
    }
    if (e?.name === 'AbortError') {
      if (duration >= timeoutMs - 500) {
        throw new UpdatePasswordTimeoutError();
      }
      throw new UpdatePasswordAbortedError();
    }
    throw e;
  }
}
