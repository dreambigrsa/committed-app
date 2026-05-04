import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Signed URL for status image/video paths (parity with `lib/status-queries` getSignedUrlForMedia).
 */
export async function getSignedUrlForMediaForWeb(
  supabase: SupabaseClient,
  mediaPath: string
): Promise<string | null> {
  if (!mediaPath) return null;
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://')) {
    return mediaPath;
  }

  const attempts: { bucket: string; path: string }[] = [];
  const addAttempt = (bucket: string, path: string) => {
    const cleanPath = path.replace(/^\/+/, '');
    if (!cleanPath) return;
    if (attempts.some((a) => a.bucket === bucket && a.path === cleanPath)) return;
    attempts.push({ bucket, path: cleanPath });
  };

  const parts = mediaPath.split('/');
  const first = parts[0];

  if (mediaPath.startsWith('status-media/')) {
    const p = mediaPath.substring('status-media/'.length);
    addAttempt('status-media', p);
    addAttempt('media', p);
    addAttempt('media', mediaPath.substring('status-media/'.length));
  } else if (mediaPath.startsWith('media/')) {
    const p = mediaPath.substring('media/'.length);
    addAttempt('media', p);
    addAttempt('status-media', p);
    if (p.startsWith('status-media/')) {
      const inner = p.substring('status-media/'.length);
      addAttempt('media', inner);
      addAttempt('status-media', inner);
    }
  } else if (parts.length > 1) {
    const rest = parts.slice(1).join('/');
    addAttempt(first, rest);
    addAttempt('status-media', mediaPath);
    addAttempt('media', mediaPath);
    addAttempt('status-media', rest);
    addAttempt('media', rest);
    if (rest.startsWith('status-media/')) {
      const inner = rest.substring('status-media/'.length);
      addAttempt(first, inner);
      addAttempt('media', inner);
      addAttempt('status-media', inner);
    }
  } else {
    addAttempt('status-media', mediaPath);
    addAttempt('media', mediaPath);
  }

  for (const { bucket, path } of attempts) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
    if (error && !String((error as { message?: string }).message || '').toLowerCase().includes('not found')) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[status-media] signed URL attempt failed', { bucket, path, error });
      }
    }
  }
  return null;
}
