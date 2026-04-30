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
      console.debug('[WebAuthGuard] Authenticated user object', {
        id: user?.id ?? null,
        email: user?.email ?? null,
      });
      if (!mounted || !user) return;
      router.replace('/app');
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: string, session: any) => {
      if (!mounted || !session?.user) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.debug('[WebAuthGuard] Auth state user object', {
        id: user?.id ?? null,
        email: user?.email ?? null,
      });
      if (!mounted || !user) return;
      router.replace('/app');
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  return null;
}
