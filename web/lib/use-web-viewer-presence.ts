import { useEffect, useRef } from 'react';
import { syncWebViewerAway, syncWebViewerOnline } from '@/lib/web-user-status-presence';

const HEARTBEAT_MS = 2 * 60 * 1000;

/**
 * Keeps the signed-in viewer's `user_status` row updated while this tab is open
 * (heartbeat, visibility, page hide). Optional callback for UI that shows the viewer
 * as the profile subject (e.g. own profile presence dot).
 */
export function useWebViewerPresence(
  supabase: { from: (t: string) => any } | null,
  viewerUserId: string | null | undefined,
  onAfterWrite?: (userId: string, statusType: string) => void,
) {
  const onAfterWriteRef = useRef(onAfterWrite);
  onAfterWriteRef.current = onAfterWrite;

  useEffect(() => {
    if (!supabase || !viewerUserId) return;
    const uid = viewerUserId;

    const tick = async () => {
      const t = await syncWebViewerOnline(supabase, uid);
      if (t) onAfterWriteRef.current?.(uid, t);
    };

    void tick();
    const interval = window.setInterval(() => void tick(), HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void tick();
      else
        void (async () => {
          const ok = await syncWebViewerAway(supabase, uid);
          if (ok) onAfterWriteRef.current?.(uid, 'away');
        })();
    };

    const onPageHide = () => {
      void (async () => {
        const ok = await syncWebViewerAway(supabase, uid);
        if (ok) onAfterWriteRef.current?.(uid, 'away');
      })();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [supabase, viewerUserId]);
}
