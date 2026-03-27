/**
 * Single source of truth for auth callback processing.
 * - Prevents double-processing the same URL (idempotency).
 * - Tracks processing state so guards can avoid redirecting during callback.
 */

const PROCESSING_TIMEOUT_MS = 12000;
const MAX_CALLBACK_HASHES = 20;

let lastProcessedHashes: string[] = [];
let callbackProcessing = false;

export function isCallbackProcessing(): boolean {
  return callbackProcessing;
}

export function setCallbackProcessing(value: boolean): void {
  callbackProcessing = value;
}

export function getProcessingTimeoutMs(): number {
  return PROCESSING_TIMEOUT_MS;
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h |= 0;
  }
  return String(Math.abs(h));
}

/**
 * Returns true if this URL was already processed (skip to avoid double exchange).
 * Call markUrlProcessed after successful handling.
 */
export function wasUrlProcessed(url: string): boolean {
  const hash = simpleHash(url);
  return lastProcessedHashes.includes(hash);
}

export function markUrlProcessed(url: string): void {
  const hash = simpleHash(url);
  lastProcessedHashes = [hash, ...lastProcessedHashes].slice(0, MAX_CALLBACK_HASHES);
}
