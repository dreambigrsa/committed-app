/**
 * Normalize profile / avatar image URLs for the browser.
 * Mobile often stores a full public URL; older rows may store only a storage path under bucket `media`.
 */

const DEFAULT_SUPABASE_URL = 'https://dizcuexznganwgddsrfo.supabase.co';

function supabaseProjectBase(): string {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env.SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL;
  return raw.replace(/\/$/, '');
}

function publicObjectUrl(base: string, bucket: string, objectPath: string): string {
  const path = objectPath.replace(/^\/+/, '');
  const encoded = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/**
 * Returns a loadable https URL, or null if the value cannot be resolved.
 */
export function resolveProfilePictureUrl(raw: string | null | undefined): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const base = supabaseProjectBase();
  if (!base) return null;
  if (s.includes('/object/public/')) {
    return s.startsWith('//') ? `https:${s}` : s.startsWith('/') ? `${base}${s}` : s;
  }
  return publicObjectUrl(base, 'media', s);
}
