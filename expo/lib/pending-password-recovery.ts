/**
 * Password recovery intent: set as soon as we see a recovery URL (before any async/navigation).
 * Used so AuthContext and AppGate treat the session as recovery even if the URL hash is lost.
 */
let pendingPasswordRecovery = false;

if (typeof window !== 'undefined' && window.location?.href?.includes('type=recovery')) {
  pendingPasswordRecovery = true;
}

export function setPendingPasswordRecovery(value: boolean): void {
  pendingPasswordRecovery = value;
}

export function getAndClearPendingPasswordRecovery(): boolean {
  const v = pendingPasswordRecovery;
  pendingPasswordRecovery = false;
  return v;
}

export function hasPendingPasswordRecovery(): boolean {
  return pendingPasswordRecovery;
}
