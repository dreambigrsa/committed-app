/**
 * Centralized deep link parsing, pending storage, and link building.
 * All deep link logic lives here and in AppGate; no parsing in screens.
 * Process links only after auth is ready (authLoading === false).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEME = 'committed';

function getWebOriginDefault(): string {
  if (typeof globalThis !== 'undefined' && (globalThis as any).location?.origin)
    return (globalThis as any).location.origin;
  return (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? '').trim();
}
const PENDING_LINK_KEY = '@committed/pending_deep_link';
const INTENDED_ROUTE_KEY = '@committed/intended_route';
const DEBUG = __DEV__;

export type DeepLinkType = 'referral' | 'post' | 'reel' | 'verify-email' | 'auth-callback' | 'unknown';

export interface ParsedDeepLink {
  type: DeepLinkType;
  postId?: string;
  reelId?: string;
  referralCode?: string;
  params: Record<string, string>;
  rawUrl: string;
}

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log('[DeepLink]', ...args);
  }
}

/**
 * Parse incoming URL into type + IDs. Handles app scheme and web URLs.
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const rawUrl = url;
    const base = getWebOriginDefault() || 'https://committed.app';
    const normalized = url.replace(/^committed:\/\//i, `${base}/`).replace(/^committed:\//i, `${base}/`);
    const u = new URL(normalized);
    const path = (u.pathname || '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const params: Record<string, string> = {};
    u.searchParams.forEach((v, k) => { params[k] = v; });
    if (u.hash) {
      u.hash.replace(/^#/, '').split('&').forEach((pair) => {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        if (k && v) params[k] = v;
      });
    }

    const pathLower = path.toLowerCase();

    // Auth: verify-email or auth-callback (code, access_token, type=recovery)
    if (params.token || pathLower.includes('verify') || params.type === 'recovery' || params.access_token) {
      return {
        type: params.type === 'recovery' || params.access_token ? 'auth-callback' : 'verify-email',
        params,
        rawUrl,
      };
    }
    if (params.code && (pathLower.includes('auth') || pathLower.includes('callback'))) {
      return { type: 'auth-callback', params, rawUrl };
    }

    // Referral: path /referral or /referral/CODE, or query ref= / referral= (do not use code= to avoid OAuth clash)
    const refCode = params.ref || params.referral || (pathLower.startsWith('referral/') ? path.split('/')[1] : null);
    if (pathLower.startsWith('referral') || pathLower === 'referral' || refCode) {
      const code = pathLower.startsWith('referral/') ? decodeURIComponent((path.split('/')[1] || '').trim()) : refCode;
      if (code && code.length > 0) {
        return { type: 'referral', referralCode: code, params: { ...params, ref: code }, rawUrl };
      }
    }

    // Post: /post/:id or path contains post/
    const postMatch = path.match(/^post\/([^/]+)/i) || path.match(/post\/([^/]+)/i);
    if (postMatch && postMatch[1]) {
      return { type: 'post', postId: postMatch[1], params, rawUrl };
    }

    // Reel: /reel/:id or path contains reel/
    const reelMatch = path.match(/^reel\/([^/]+)/i) || path.match(/reel\/([^/]+)/i);
    if (reelMatch && reelMatch[1]) {
      return { type: 'reel', reelId: reelMatch[1], params, rawUrl };
    }

    return { type: 'unknown', params, rawUrl };
  } catch (e) {
    if (DEBUG) console.warn('[DeepLink] parse error', e);
    return null;
  }
}

/**
 * Returns true if URL is auth-related (should go to auth-callback, not stored as content deep link).
 */
export function isAuthLink(url: string): boolean {
  const parsed = parseDeepLink(url);
  return parsed?.type === 'auth-callback' || parsed?.type === 'verify-email' || !!url?.includes('access_token=') || !!url?.includes('type=recovery') || !!url?.includes('code=');
}

// In-memory pending (one at a time; cleared when processed)
let pendingParsed: ParsedDeepLink | null = null;
let lastHandledUrl: string | null = null;

export function setPendingDeepLink(url: string): void {
  const parsed = parseDeepLink(url);
  if (!parsed) return;
  if (parsed.type === 'auth-callback' || parsed.type === 'verify-email') return;
  if (lastHandledUrl === url) return;
  log('setPendingDeepLink', parsed.type, parsed);
  pendingParsed = parsed;
}

export function getAndClearPendingDeepLink(): ParsedDeepLink | null {
  const p = pendingParsed;
  if (p) lastHandledUrl = p.rawUrl;
  pendingParsed = null;
  return p;
}

export function markDeepLinkHandled(url: string): void {
  lastHandledUrl = url;
}

export async function getIntendedRoute(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(INTENDED_ROUTE_KEY);
  } catch {
    return null;
  }
}

export async function setIntendedRoute(route: string): Promise<void> {
  try {
    await AsyncStorage.setItem(INTENDED_ROUTE_KEY, route);
    log('setIntendedRoute', route);
  } catch (e) {
    if (DEBUG) console.warn('[DeepLink] setIntendedRoute failed', e);
  }
}

export async function clearIntendedRoute(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INTENDED_ROUTE_KEY);
  } catch {
    // no-op
  }
}

// --- Build shareable links (app + web) ---

export function getWebOrigin(): string {
  const o = getWebOriginDefault();
  return o || 'https://committed.app';
}

export function buildPostLink(postId: string): { app: string; web: string } {
  if (!postId) return { app: '', web: '' };
  const base = getWebOriginDefault() || 'https://committed.app';
  return {
    app: `${SCHEME}://post/${postId}`,
    web: `${base}/post/${postId}`,
  };
}

export function buildReelLink(reelId: string): { app: string; web: string } {
  if (!reelId) return { app: '', web: '' };
  const base = getWebOriginDefault() || 'https://committed.app';
  return {
    app: `${SCHEME}://reel/${reelId}`,
    web: `${base}/reel/${reelId}`,
  };
}

export function buildReferralLink(code: string): { app: string; web: string } {
  if (!code) return { app: '', web: '' };
  const base = getWebOriginDefault() || 'https://committed.app';
  return {
    app: `${SCHEME}://referral?ref=${encodeURIComponent(code)}`,
    web: `${base}/referral/${encodeURIComponent(code)}`,
  };
}
