/**
 * Centralized deep link parsing and handling.
 * Supports: auth (code/token), referral, post, reel.
 * Used on app open (cold start), background, and foreground.
 */

export interface ParsedDeepLink {
  type: 'auth' | 'referral' | 'post' | 'reel';
  referralCode?: string;
  postId?: string;
  reelId?: string;
  rawUrl: string;
}

/**
 * Parse a URL (deep link or web) into a structured type.
 * Handles: myapp://..., https://myapp.com/..., committed://...
 */
export function parseDeepLink(url: string): ParsedDeepLink | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    // Normalize: get path and query/hash
    let path = trimmed;
    let search = '';
    let hash = '';
    const hashIndex = trimmed.indexOf('#');
    const searchIndex = trimmed.indexOf('?');
    if (hashIndex >= 0) {
      hash = trimmed.slice(hashIndex + 1);
      path = trimmed.slice(0, hashIndex);
    }
    if (searchIndex >= 0 && hashIndex < 0) {
      search = trimmed.slice(searchIndex + 1);
      path = trimmed.slice(0, searchIndex);
    } else if (searchIndex >= 0 && hashIndex >= 0) {
      const beforeHash = trimmed.slice(0, hashIndex);
      const q = beforeHash.indexOf('?');
      if (q >= 0) {
        search = beforeHash.slice(q + 1);
        path = beforeHash.slice(0, q);
      }
    }
    const query = new URLSearchParams(search || hash);

    // Auth: code=, access_token=, type=recovery
    if (
      trimmed.includes('code=') ||
      trimmed.includes('access_token=') ||
      trimmed.includes('type=recovery') ||
      trimmed.includes('auth-callback')
    ) {
      return { type: 'auth', rawUrl: trimmed };
    }

    // Referral: referral?code=ABC123 or ?referral=ABC123 or ?code=ABC123 (on landing)
    const referralCode =
      query.get('code') || query.get('referral') || query.get('referralCode') || null;
    if (referralCode && (path.includes('referral') || trimmed.includes('referral'))) {
      return { type: 'referral', referralCode, rawUrl: trimmed };
    }
    // Also accept root/signup with referral code for web
    if (referralCode && (path === '/' || path === '' || path.includes('auth') || path.includes('signup'))) {
      return { type: 'referral', referralCode, rawUrl: trimmed };
    }

    // Post: /post/12345 or post/12345
    const postMatch = path.match(/\/(?:post)\/([a-zA-Z0-9_-]+)/i) || trimmed.match(/post\/([a-zA-Z0-9_-]+)/i);
    if (postMatch) {
      return { type: 'post', postId: postMatch[1], rawUrl: trimmed };
    }

    // Reel: /reel/67890 or reel/67890
    const reelMatch = path.match(/\/(?:reel)\/([a-zA-Z0-9_-]+)/i) || trimmed.match(/reel\/([a-zA-Z0-9_-]+)/i);
    if (reelMatch) {
      return { type: 'reel', reelId: reelMatch[1], rawUrl: trimmed };
    }

    return null;
  } catch {
    return null;
  }
}
