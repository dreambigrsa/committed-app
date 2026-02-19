/**
 * DeepLinkService - Centralized deep link parsing and intended route storage.
 * Links are processed AFTER auth hydration. If user not logged in, intended route is stored.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const INTENDED_ROUTE_KEY = '@committed/intended_route';

export interface ParsedDeepLink {
  type: 'referral' | 'post' | 'reel' | 'verify-email' | 'auth-callback' | 'unknown';
  params: Record<string, string>;
  path?: string;
}

const SCHEME = 'committed';

export function parseDeepLink(url: string): ParsedDeepLink | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const clean = url.replace(/^committed:\/\//, '').replace(/^https?:\/\/[^/]*\//, '');
    const [pathPart, qs] = clean.split('?');
    const hashPart = url.includes('#') ? url.split('#')[1] || '' : '';
    const params: Record<string, string> = {};
    if (qs) {
      qs.split('&').forEach((pair) => {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        if (k && v) params[k] = v;
      });
    }
    if (hashPart) {
      hashPart.split('&').forEach((pair) => {
        const [k, v] = pair.split('=').map(decodeURIComponent);
        if (k && v) params[k] = v;
      });
    }
    const path = pathPart || '';

    if (params.token || path.includes('verify')) {
      return { type: 'verify-email', params, path };
    }
    if (params.code || params.access_token || params.type === 'recovery') {
      return { type: 'auth-callback', params, path };
    }
    if (path.startsWith('referral') || params.code) {
      return { type: 'referral', params: { ...params, code: params.code || params.ref }, path };
    }
    const postMatch = path.match(/post\/([^/]+)/) || url.match(/post\/([^/]+)/);
    if (postMatch) {
      return { type: 'post', params: { ...params, postId: postMatch[1] }, path };
    }
    const reelMatch = path.match(/reel\/([^/]+)/) || url.match(/reel\/([^/]+)/);
    if (reelMatch) {
      return { type: 'reel', params: { ...params, reelId: reelMatch[1] }, path };
    }
    return { type: 'unknown', params, path };
  } catch {
    return null;
  }
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
  } catch (e) {
    console.warn('Failed to store intended route:', e);
  }
}

export async function clearIntendedRoute(): Promise<void> {
  try {
    await AsyncStorage.removeItem(INTENDED_ROUTE_KEY);
  } catch {
    // no-op
  }
}
