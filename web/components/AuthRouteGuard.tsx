'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-client';

export default function AuthRouteGuard() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowser() as any;

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let emailConfirmedAt = user?.email_confirmed_at || session?.user?.email_confirmed_at || null;
      if (!emailConfirmedAt && session?.refresh_token) {
        const {
          data: { session: refreshedSession },
        } = await supabase.auth.refreshSession();
        emailConfirmedAt = refreshedSession?.user?.email_confirmed_at || null;
      }
      console.debug('[WebAuthGuard] Authenticated user object', {
        id: user?.id ?? null,
        email: user?.email ?? null,
        emailConfirmedAt,
      });
      if (!mounted || !user) return;
      if (!emailConfirmedAt) {
        const emailParam = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
        router.replace(`/verify-email${emailParam}`);
        return;
      }
      router.replace('/app');
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!mounted || !session?.user) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const emailConfirmedAt = user?.email_confirmed_at || session?.user?.email_confirmed_at || null;
      console.debug('[WebAuthGuard] Auth state user object', {
        id: user?.id ?? null,
        email: user?.email ?? null,
        event: _event,
        emailConfirmedAt,
      });
      if (!mounted || !user) return;
      if (!emailConfirmedAt) {
        const emailParam = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
        router.replace(`/verify-email${emailParam}`);
        return;
      }
      router.replace('/app');
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  return null;
}
