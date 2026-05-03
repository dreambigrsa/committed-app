'use client';

/**
 * Normalize profile / avatar image URLs for the browser.
 *
 * Sources in this repo:
 * - `app/settings.tsx`: bucket `avatars`, path `profile-pictures/<file>` (getPublicUrl → full https URL).
 * - `app/(tabs)/profile.tsx` & web `uploadMediaFile`: bucket `media`, path often `avatars/<userId>/<file>` or other folders under `media`.
 *
 * Path-only values must map to the correct bucket — never assume everything is under `media`.
 */

import { getWebSupabaseUrl } from '@/lib/supabase-client';

function projectBase(): string {
  return getWebSupabaseUrl().replace(/\/$/, '');
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
 * Path-only (no scheme): choose bucket to match mobile / web upload conventions.
 */
function bucketAndPathForRelativeStorageKey(s: string): { bucket: string; objectPath: string } {
  const key = s.replace(/^\/+/, '');
  // Mobile Settings profile photo — see app/settings.tsx (`avatars` bucket, `profile-pictures/...`).
  if (key.startsWith('profile-pictures/')) {
    return { bucket: 'avatars', objectPath: key };
  }
  // Web shell upload uses folder name `avatars` *inside* bucket `media` — see MobileWebAppShell `uploadMediaFile`.
  return { bucket: 'media', objectPath: key };
}

/**
 * Returns a loadable https URL, or null if the value cannot be resolved.
 */
export function resolveProfilePictureUrl(raw: string | null | undefined): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;

  const base = projectBase();
  if (!base) return null;

  if (s.includes('/object/public/')) {
    return s.startsWith('//') ? `https:${s}` : s.startsWith('/') ? `${base}${s}` : s;
  }

  const { bucket, objectPath } = bucketAndPathForRelativeStorageKey(s);
  return publicObjectUrl(base, bucket, objectPath);
}
