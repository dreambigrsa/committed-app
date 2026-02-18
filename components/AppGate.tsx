/**
 * Central auth gate: shows splash until auth is resolved, then renders app
 * and ensures a single redirect to the resolved route (no landing flash for logged-in users).
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
    isLoading,
  } = useApp();
  const emailVerified = Boolean(currentUser?.verifications?.email);
  const hasRedirected = useRef(false);

  // Keep native splash visible until auth is loaded
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Single redirect only: run once when auth is resolved and we're on landing with a session. Prevents double navigation and loops.
  useEffect(() => {
    if (isLoading) return;

    const currentPath = pathname ?? '/';
    const isOnLanding = currentPath === '/' || currentPath === '';
    const isOnVerifyEmail = currentPath === '/verify-email';
    const isOnResetPassword = currentPath === '/reset-password';
    const isOnAuth = currentPath === '/auth';

    if (session && isOnLanding) {
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
      if (route !== '/' && !hasRedirected.current) {
        hasRedirected.current = true;
        router.replace(route as any);
      }
      return;
    }
    if (!session) {
      hasRedirected.current = false;
      if (isOnVerifyEmail || isOnResetPassword) {
        router.replace('/auth');
        return;
      }
      if (!isOnLanding && !isOnAuth) {
        router.replace('/');
        return;
      }
    }
  }, [
    isLoading,
    session,
    currentUser,
    legalAcceptanceStatus,
    hasCompletedOnboarding,
    isPasswordRecoveryFlow,
    emailVerified,
    pathname,
    router,
  ]);

  // Single splash when auth is loading — no wrapper with different background
  if (isLoading) {
    return <LoadingScreen visible />;
  }

  return <>{children}</>;
}
