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
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted || !session?.user) return;
      router.replace('/app');
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (!mounted || !session?.user) return;
      router.replace('/app');
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [router]);

  return null;
}
