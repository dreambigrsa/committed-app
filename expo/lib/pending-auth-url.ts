/**
 * When the app is already open and user opens an auth link (e.g. reset password),
 * the "url" event fires but auth-callback may not be mounted. We store the URL here
 * so that when we navigate to /auth-callback, it can read and process it.
 * Only clear after successful exchange + navigation (see auth-callback).
 */
let pendingAuthUrl: string | null = null;

export function setPendingAuthUrl(url: string | null): void {
  pendingAuthUrl = url;
}

/** Peek without clearing. */
export function getPendingAuthUrl(): string | null {
  return pendingAuthUrl;
}

export function getAndClearPendingAuthUrl(): string | null {
  const url = pendingAuthUrl;
  pendingAuthUrl = null;
  return url;
}

export function clearPendingAuthUrl(): void {
  pendingAuthUrl = null;
}
