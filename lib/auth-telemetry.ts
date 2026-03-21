/**
 * Auth/session diagnostics without PII or tokens.
 * - Always logs in __DEV__
 * - In production, set EXPO_PUBLIC_AUTH_TELEMETRY=1 to enable (e.g. for staged debugging)
 * - Hook Sentry/Bugsnag later via setAuthTelemetrySink()
 */

type AuthTelemetryPayload = Record<string, string | number | boolean | undefined | null>;

let externalSink: ((event: string, payload: AuthTelemetryPayload) => void) | null = null;

export function setAuthTelemetrySink(
  sink: ((event: string, payload: AuthTelemetryPayload) => void) | null
): void {
  externalSink = sink;
}

function shouldEmit(): boolean {
  if (__DEV__) return true;
  try {
    return (
      typeof process !== 'undefined' &&
      process.env.EXPO_PUBLIC_AUTH_TELEMETRY === '1'
    );
  } catch {
    return false;
  }
}

/** Strip risky strings — only allow short alphanumeric codes/messages (no emails, no JWT fragments). */
function sanitizePayload(payload: AuthTelemetryPayload): AuthTelemetryPayload {
  const out: AuthTelemetryPayload = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined || v === null) {
      out[k] = v;
      continue;
    }
    if (typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
      continue;
    }
    const s = String(v).slice(0, 120);
    // Drop values that look like emails or base64/jwt
    if (/@/.test(s) || /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\./.test(s)) {
      out[k] = '[redacted]';
      continue;
    }
    out[k] = s;
  }
  return out;
}

/**
 * Structured auth log. Event names are stable for dashboards.
 * Examples: restore_complete, restore_error, auth_state_change, refresh_invalid, refresh_transient, hydrate_failed, sign_out
 */
export function logAuthEvent(event: string, payload: AuthTelemetryPayload = {}): void {
  const safe = sanitizePayload({ ...payload, ts: Date.now() });
  if (shouldEmit()) {
    console.log(`[AuthTelemetry] ${event}`, safe);
  }
  try {
    externalSink?.(event, safe);
  } catch {
    // Never break auth for telemetry
  }
}

export function errorToAuthCode(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    const m = (err as Error).message.toLowerCase();
    if (m.includes('network') || m.includes('fetch')) return 'network';
    if (m.includes('aborted') || m.includes('signal')) return 'aborted';
    if (m.includes('invalid refresh')) return 'invalid_refresh';
    if (m.includes('jwt')) return 'jwt';
    return 'unknown';
  }
  return 'unknown';
}
