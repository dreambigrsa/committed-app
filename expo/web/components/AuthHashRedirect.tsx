'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * When user lands on / with Supabase auth hash (#access_token=...&type=signup),
 * redirect to /auth-callback so the flow is handled correctly.
 * Supabase's "Confirm your signup" email sends users to Site URL with this hash.
 */
export default function AuthHashRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const isRoot = !pathname || pathname === '/';
    const hasAuthHash = hash.includes('access_token=') && hash.includes('type=');
    if (isRoot && hasAuthHash) {
      window.location.replace(`/auth-callback${hash}`);
    }
  }, [pathname]);

  return null;
}
