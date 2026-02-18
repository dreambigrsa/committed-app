/**
 * Central auth gate: shows splash until auth is resolved, then renders app
 * and ensures a single redirect to the resolved route (no landing flash for logged-in users).
 */

import * as SplashScreen from 'expo-splash-screen';
import { useRouter, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getResolvedRoute } from '@/lib/auth-gate';
import { getAndClearPendingRoute } from '@/lib/pending-route';
import LoadingScreen from './LoadingScreen';

SplashScreen.preventAutoHideAsync();

// Post-auth routes where session may briefly be null while propagating after sign-in/sign-up
function isPostAuthRoute(path: string): boolean {
  if (path === '/verify-email' || path === '/onboarding') return true;
  if (path.startsWith('/(tabs)')) return true;
  const tabPaths = ['/home', '/feed', '/reels', '/messages', '/profile', '/notifications', '/search', '/dating'];
  return tabPaths.some(p => path === p || path.startsWith(p + '/'));
}
const POST_AUTH_GRACE_MS = 1800;

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
  const [postAuthGraceExpired, setPostAuthGraceExpired] = useState(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep native splash visible until auth is loaded
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Start grace period when on a post-auth route without session (likely just completed sign-in/sign-up)
  useEffect(() => {
    const currentPath = pathname ?? '/';
    const isPostAuth = isPostAuthRoute(currentPath);
    const isOnAuth = currentPath === '/auth';
    const isOnLanding = currentPath === '/' || currentPath === '';

    if (session || isOnAuth || isOnLanding) {
      setPostAuthGraceExpired(false);
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      return;
    }
    if (!session && isPostAuth && !postAuthGraceExpired) {
      if (graceTimerRef.current) return;
      graceTimerRef.current = setTimeout(() => {
        setPostAuthGraceExpired(true);
        graceTimerRef.current = null;
      }, POST_AUTH_GRACE_MS);
    }
    return () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [pathname, session, postAuthGraceExpired]);

  // Single redirect only: run once when auth is resolved and we're on landing with a session. Prevents double navigation and loops.
  useEffect(() => {
    if (isLoading) return;

    const currentPath = pathname ?? '/';
    const isOnLanding = currentPath === '/' || currentPath === '';
    const isOnVerifyEmail = currentPath === '/verify-email';
    const isOnResetPassword = currentPath === '/reset-password';
    const isOnAuth = currentPath === '/auth';
    const isPostAuth = isPostAuthRoute(currentPath);

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
      // Don't redirect from post-auth routes until grace period expires (session may be propagating)
      if (isPostAuth && !postAuthGraceExpired) return;
      if (isOnVerifyEmail || isOnResetPassword) {
        router.replace('/auth');
        return;
      }
      // Allow /legal/* when not logged in (user may be reading docs from sign-up/sign-in)
      const isOnLegal = currentPath.startsWith('/legal/') || currentPath.startsWith('/legal');
      if (isOnLegal) return;
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
    postAuthGraceExpired,
  ]);

  // Single splash when auth is loading — no wrapper with different background
  if (isLoading) {
    return <LoadingScreen visible />;
  }

  return <>{children}</>;
}
