/**
 * Single source of truth for Committed app links, deep links, and store URLs.
 * Use these for ALL CTAs — no hardcoded links.
 */

export const APP_SCHEME = process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'committed://';
export const WEB_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#';
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#';
export const UNIVERSAL_DOWNLOAD_URL = `${WEB_BASE_URL}/download`;

/** @deprecated Use APP_SCHEME */
export const DEEPLINK_SCHEME = APP_SCHEME;

/** @deprecated Use WEB_BASE_URL */
export const SITE_URL = WEB_BASE_URL;

/** Deep link paths for in-app routing */
export const deepLinks = {
  signup: `${APP_SCHEME}signup`,
  signUp: `${APP_SCHEME}signup`,
  signIn: `${APP_SCHEME}sign-in`,
  registerRelationship: `${APP_SCHEME}register-relationship`,
  verifyProfile: `${APP_SCHEME}verify-profile`,
  support: `${APP_SCHEME}support`,
  download: `${APP_SCHEME}download`,
  authCallback: (type: 'verify' | 'recovery', token: string) =>
    `${APP_SCHEME}auth-callback?type=${type}&token=${encodeURIComponent(token)}`,
  /** Shared content links (must match mobile app buildPostLink, buildReelLink, buildReferralLink) */
  post: (id: string) => `${APP_SCHEME}post/${id}`,
  reel: (id: string) => `${APP_SCHEME}reel/${id}`,
  referral: (code: string) => `${APP_SCHEME}referral?ref=${encodeURIComponent(code)}`,
} as const;

/** Build web URLs for shared content (used when sharing from app) */
export function buildPostWebUrl(id: string): string {
  return `${WEB_BASE_URL}/post/${id}`;
}
export function buildReelWebUrl(id: string): string {
  return `${WEB_BASE_URL}/reel/${id}`;
}
export function buildReferralWebUrl(code: string): string {
  return `${WEB_BASE_URL}/referral/${encodeURIComponent(code)}`;
}

/** Fallback web URL when app isn't installed */
export function getWebFallback(target: keyof typeof deepLinks): string {
  const path = target.replace(/([A-Z])/g, (m) => m.toLowerCase());
  return `${WEB_BASE_URL}/open?target=${path}`;
}

/** Detect mobile OS from user agent */
export function getMobileOS(): 'ios' | 'android' | null {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

/** Whether current device is mobile */
export function isMobile(): boolean {
  return getMobileOS() !== null;
}

/** Whether to show QR modal (desktop) instead of direct navigation */
export function shouldShowQRModal(): boolean {
  return !isMobile();
}

/** Get store URL for current platform */
export function getStoreUrl(): string {
  const os = getMobileOS();
  if (os === 'ios' && APP_STORE_URL !== '#') return APP_STORE_URL;
  if (os === 'android' && PLAY_STORE_URL !== '#') return PLAY_STORE_URL;
  return UNIVERSAL_DOWNLOAD_URL;
}

/** Get the best URL for "Get Started" / "Sign Up": deep link on mobile, /sign-up on desktop */
export function getSignUpUrl(): string {
  if (typeof window === 'undefined') return '/sign-up';
  if (isMobile()) return deepLinks.signup;
  return '/sign-up';
}

/** Get the best URL for "Download App": store on mobile (after deep link attempt), /download on desktop */
export function getDownloadUrl(): string {
  if (typeof window === 'undefined') return '/download';
  if (isMobile()) return getStoreUrl();
  return '/download';
}
