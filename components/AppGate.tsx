/**
 * Single App Gate: ALL auth-based routing happens here.
 * No screen may independently decide auth routing.
 * - authLoading → Splash (do not render app until hydrate complete)
 * - !authenticated → Landing (or Auth from verify-email/reset)
 * - session but no user yet → still loading (Splash)
 * - then: VerifyEmail → Legal (modal) → Onboarding → MainApp
 */

import * as SplashScreen from 'expo-splash-screen';
import { useRouter, usePathname } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getResolvedRoute } from '@/lib/auth-gate';
import { getAndClearPendingRoute } from '@/lib/pending-route';
import LoadingScreen from './LoadingScreen';

SplashScreen.preventAutoHideAsync();

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    session,
    currentUser,
    legalAcceptanceStatus,
    hasCompletedOnboarding,
    isPasswordRecoveryFlow,
    isLoading: authLoading,
  } = useApp();
  const emailVerified = Boolean(currentUser?.verifications?.email ?? session?.user?.email_confirmed_at);
  const hasRedirected = useRef(false);
  const isAuthenticated = !!session;

  // Splash until auth hydrate is complete. No app content renders before this.
  useEffect(() => {
    if (!authLoading) {
      SplashScreen.hideAsync();
    }
  }, [authLoading]);

  // 1) Auth still loading → only Splash (tokens/user not ready)
  if (authLoading) {
    return <LoadingScreen visible />;
  }

  // 2) Not authenticated → Landing or Auth (from verify-email/reset). Allow /legal for sign-up flow.
  const currentPath = pathname ?? '/';
  const isOnLanding = currentPath === '/' || currentPath === '';
  const isOnAuth = currentPath === '/auth';
  const isOnVerifyEmail = currentPath === '/verify-email';
  const isOnResetPassword = currentPath === '/reset-password';
  const isOnLegal = currentPath.startsWith('/legal/') || currentPath === '/legal';

  if (!isAuthenticated) {
    hasRedirected.current = false;
    if (isOnVerifyEmail || isOnResetPassword) {
      router.replace('/auth');
      return <LoadingScreen visible />;
    }
    if (isOnLegal) {
      return <>{children}</>;
    }
    if (!isOnLanding && !isOnAuth) {
      router.replace('/');
      return <LoadingScreen visible />;
    }
    return <>{children}</>;
  }

  // 3) Authenticated: resolve target route. Redirect from Landing or Auth when we have a concrete route.
  const resolved = getResolvedRoute({
    session,
    currentUser,
    legalAcceptanceStatus,
    hasCompletedOnboarding,
    isPasswordRecoveryFlow,
    emailVerified,
  });
  const pending = getAndClearPendingRoute();
  const route = pending && (pending.startsWith('/post/') || pending.startsWith('/reel/')) ? pending : resolved;

  if ((isOnLanding || isOnAuth) && route !== '/' && route !== '/auth') {
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(route as any);
    }
    return <LoadingScreen visible />;
  }

  hasRedirected.current = true;
  return <>{children}</>;
}
