'use client';

/**
 * Normalize profile / avatar image URLs for the browser.
 *
 * Sources in this repo:
 * - `app/settings.tsx`: bucket `avatars`, path `profile-pictures/<file>` (getPublicUrl → full https URL).
 * - `app/(tabs)/profile.tsx` & legacy web uploads: bucket `media`, path often `avatars/<userId>/<file>`.
 * - Web settings profile photo: same as mobile — bucket `avatars`, `profile-pictures/...` (see `MobileWebAppShell` upload helper).
 *
 * Path-only values must map to the correct bucket — never assume everything is under `media`.
 * Use {@link resolveProfilePictureUrlWithSupabase} when you have a client: it matches mobile by calling `storage.from(...).getPublicUrl(...)`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getWebSupabaseUrl } from '@/lib/supabase-client';

const UUID_FOLDER = /^avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;

function projectBase(): string {
  return getWebSupabaseUrl().replace(/\/$/, '');
}

/** Re-host public storage paths on the Supabase URL the web client actually uses (fixes stale alt-project URLs in `users.profile_picture`). */
function rewriteStoragePublicUrlToCurrentProject(url: string): string {
  const marker = '/storage/v1/object/public/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const base = projectBase();
  if (!base) return url;
  return `${base}${url.slice(i)}`;
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
export function profilePictureStorageKeyToBucketAndPath(s: string): { bucket: string; objectPath: string } {
  const key = s.replace(/^\/+/, '');
  if (key.startsWith('profile-pictures/')) {
    return { bucket: 'avatars', objectPath: key };
  }
  // Legacy web shell: object key `avatars/<userUuid>/...` lives in the **media** bucket.
  if (UUID_FOLDER.test(key)) {
    return { bucket: 'media', objectPath: key };
  }
  // Other `avatars/...` keys are treated as inside the **avatars** bucket (same as mobile `getPublicUrl` usage).
  if (key.startsWith('avatars/')) {
    return { bucket: 'avatars', objectPath: key };
  }
  return { bucket: 'media', objectPath: key };
}

/**
 * Returns a loadable https URL, or null if the value cannot be resolved.
 */
export function resolveProfilePictureUrl(raw: string | null | undefined): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;

  if (s.startsWith('//')) {
    return rewriteStoragePublicUrlToCurrentProject(`https:${s}`);
  }
  if (/^https?:\/\//i.test(s)) {
    return rewriteStoragePublicUrlToCurrentProject(s);
  }

  const base = projectBase();
  if (!base) return null;

  if (s.includes('/object/public/')) {
    return s.startsWith('//') ? `https:${s}` : s.startsWith('/') ? `${base}${s}` : rewriteStoragePublicUrlToCurrentProject(s);
  }

  const { bucket, objectPath } = profilePictureStorageKeyToBucketAndPath(s);
  return publicObjectUrl(base, bucket, objectPath);
}

/** Same as {@link resolveProfilePictureUrl} but uses the Supabase client for path-only keys (identical to mobile `getPublicUrl`). */
export function resolveProfilePictureUrlWithSupabase(
  supabase: SupabaseClient,
  raw: string | null | undefined
): string | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;
  if (s.startsWith('//')) {
    return resolveProfilePictureUrl(`https:${s}`);
  }
  if (/^https?:\/\//i.test(s)) {
    return resolveProfilePictureUrl(s);
  }
  const { bucket, objectPath } = profilePictureStorageKeyToBucketAndPath(s);
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return resolveProfilePictureUrl(data.publicUrl);
}
