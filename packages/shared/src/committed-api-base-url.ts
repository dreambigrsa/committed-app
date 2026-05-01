/**
 * Single resolver for the committed HTTP API (tRPC) base URL — Expo + Next.js.
 */
const PROD_DEFAULT = 'https://committed-5mxf.onrender.com';

export type GetCommittedApiBaseUrlOptions = {
  /**
   * When env is unset: use localhost in dev (Expo `__DEV__` / Next dev).
   * Expo tRPC historically defaults to localhost without env; Next defaults to prod unless env is set.
   */
  useLocalhostWhenDevAndUnset?: boolean;
};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function getCommittedApiBaseUrl(options: GetCommittedApiBaseUrlOptions = {}): string {
  const { useLocalhostWhenDevAndUnset = false } = options;
  const envRaw =
    typeof process !== 'undefined' && process.env
      ? process.env.EXPO_PUBLIC_COMMITTED_API_BASE_URL || process.env.NEXT_PUBLIC_COMMITTED_API_BASE_URL
      : undefined;
  if (envRaw) return stripTrailingSlash(envRaw);

  const rnDev =
    typeof globalThis !== 'undefined' && (globalThis as { __DEV__?: boolean }).__DEV__ === true;
  const isDev =
    rnDev || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development');

  if (useLocalhostWhenDevAndUnset && isDev) {
    return 'http://localhost:3000';
  }

  return PROD_DEFAULT;
}
