/**
 * AppGate - Single place for ALL auth-based routing decisions.
 * No screen performs auth redirects. Only AppGate navigates.
 */
import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import SplashScreen from './SplashScreen';

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authLoading, isAuthenticated } = useAuth();
  const lastTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let target: string;
    if (!isAuthenticated || !user) {
      target = '/';
    } else if (user.isPasswordRecovery) {
      target = '/reset-password';
    } else if (!user.emailVerified) {
      target = '/verify-email';
    } else if (!user.acceptedLegalDocs) {
      // Legal modal shows overlay - no redirect
      lastTargetRef.current = 'legal';
      return;
    } else if (!user.completedOnboarding) {
      target = '/onboarding';
    } else {
      target = '/(tabs)/home';
    }

    const publicPaths = ['/', '/auth', '/auth-callback'];
    if (!isAuthenticated && publicPaths.some((p) => pathname === p || pathname?.startsWith(p))) {
      lastTargetRef.current = target;
      return;
    }

    if (lastTargetRef.current === target) return;
    lastTargetRef.current = target;

    const current = pathname || '/';
    if (current === target || (target === '/(tabs)/home' && current.startsWith('/(tabs)'))) return;

    // Defer navigation to avoid "Cannot update component while rendering another"
    const id = setTimeout(() => {
      router.replace(target as any);
    }, 0);
    return () => clearTimeout(id);
  }, [authLoading, isAuthenticated, user, pathname, router]);

  if (authLoading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
