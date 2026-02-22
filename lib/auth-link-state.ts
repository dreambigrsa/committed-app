/**
 * Global auth-link state machine for reset/verify flows.
 * Prevents ResetPassword from showing "expired" before AuthCallback finishes exchange.
 */

export type AuthLinkStatus = "idle" | "processing" | "success" | "error";
export type AuthLinkIntent = "recovery" | "verify";

let _status: AuthLinkStatus = "idle";
let _intent: AuthLinkIntent | null = null;
let _error: string | null = null;

export function getAuthLinkStatus(): AuthLinkStatus {
  return _status;
}

export function getAuthLinkIntent(): AuthLinkIntent | null {
  return _intent;
}

export function getAuthLinkError(): string | null {
  return _error;
}

export function setAuthLinkProcessing(intent: AuthLinkIntent): void {
  _status = "processing";
  _intent = intent;
  _error = null;
}

export function setAuthLinkSuccess(): void {
  _status = "success";
  _error = null;
}

export function setAuthLinkError(message: string): void {
  _status = "error";
  _error = message;
}

export function resetAuthLinkState(): void {
  _status = "idle";
  _intent = null;
  _error = null;
}
