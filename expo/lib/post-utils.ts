/**
 * Post modal utilities: ID resolution, fetch timeout, instrumentation.
 * Use resolvePostId everywhere when opening the post modal so shared posts
 * resolve to the real post ID (originalPostId) and never time out on wrong ID.
 */

const LOG_PREFIX = '[PostModal]';

export type PostLikeItem = {
  id?: string;
  postId?: string;
  originalPostId?: string;
  post?: { id?: string };
  [key: string]: unknown;
};

/**
 * Returns the real post ID for modal fetch. Shared posts may have
 * share wrapper id vs original post id — always use the underlying post.
 */
export function resolvePostId(item: PostLikeItem | null | undefined): string | undefined {
  if (!item) return undefined;
  const id =
    (item as any).originalPostId ??
    (item as any).postId ??
    (item as any).post?.id ??
    (item as any).id;
  return typeof id === 'string' ? id.trim() || undefined : undefined;
}

/**
 * Wrap a promise with a timeout. Rejects with a clear message on timeout.
 * Use for Supabase queries so the modal never hangs indefinitely.
 */
export function fetchWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  opts?: { endpoint?: string; label?: string }
): Promise<T> {
  const label = opts?.label ?? opts?.endpoint ?? 'request';
  const start = Date.now();
  if (__DEV__) {
    console.log(`${LOG_PREFIX} fetch start: ${label}`);
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (__DEV__) {
        console.warn(`${LOG_PREFIX} fetch timed out after ${ms}ms: ${label}`);
      }
      reject(new Error('Request timed out'));
    }, ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        if (__DEV__) {
          console.log(`${LOG_PREFIX} fetch end: ${label} (${Date.now() - start}ms)`);
        }
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        if (__DEV__) {
          console.warn(`${LOG_PREFIX} fetch error: ${label}`, e?.message ?? e);
        }
        reject(e);
      });
  });
}

/** Instrumentation: log resolved post id when opening modal */
export function logResolvedPostId(
  resolvedId: string | undefined,
  source: 'params' | 'initialPost'
): void {
  if (__DEV__) {
    console.log(`${LOG_PREFIX} resolvedPostId: ${resolvedId ?? 'missing'} (source: ${source})`);
  }
}

/** Instrumentation: log when request was aborted (e.g. modal closed) */
export function logAborted(label: string): void {
  if (__DEV__) {
    console.log(`${LOG_PREFIX} aborted: ${label}`);
  }
}

