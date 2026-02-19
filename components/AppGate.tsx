/**
 * AppGate - Single place for auth-based routing and deep link processing.
 * Deep links are queued and processed only after authReady === true.
 * Loading has a 4s hard stop so the app never stays on splash indefinitely.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import SplashScreen from './SplashScreen';
import {
  getAndClearPendingDeepLink,
  getIntendedRoute,
  clearIntendedRoute,
  setIntendedRoute,
} from '@/lib/deep-link-service';
import { setStoredReferralCode } from '@/lib/referral-storage';
import { hasPendingPasswordRecovery } from '@/lib/pending-password-recovery';

const LOADING_MAX_MS = 4000;

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authLoading, authReady, isAuthenticated } = useAuth();
  const lastTargetRef = useRef<string | null>(null);
  const processedDeepLinkRef = useRef(false);
  const appliedIntendedRouteRef = useRef(false);
  const [loadingOverride, setLoadingOverride] = useState(false);

  useEffect(() => {
    if (!authReady || authLoading) return;

    if (__DEV__) {
      console.log('[AppGate] Auth ready, isAuthenticated:', isAuthenticated, 'pathname:', pathname);
    }

    const pending = getAndClearPendingDeepLink();
    if (pending && !processedDeepLinkRef.current) {
      processedDeepLinkRef.current = true;
      if (__DEV__) console.log('[AppGate] Deep link:', pending.type, pending.postId ?? pending.reelId ?? pending.referralCode);
      if (pending.type === 'referral' && pending.referralCode) {
        setStoredReferralCode(pending.referralCode).catch(() => {});
      } else if (pending.type === 'post' && pending.postId) {
        setIntendedRoute(`/post/${pending.postId}`).catch(() => {});
      } else if (pending.type === 'reel' && pending.reelId) {
        setIntendedRoute(`/reel/${pending.reelId}`).catch(() => {});
      }
    }

    const current = pathname || '/';
    // Never redirect away from reset-password when user has a session (recovery flow).
    if (current === '/reset-password' && isAuthenticated && user) {
      lastTargetRef.current = '/reset-password';
      return;
    }
    // Always allow viewing legal documents, even if not yet accepted (so users can read before accepting).
    if (current.startsWith('/legal/')) {
      lastTargetRef.current = current;
      return;
    }

    let target: string;
    const hasPendingPost = pending?.type === 'post' && pending?.postId;
    const hasPendingReel = pending?.type === 'reel' && pending?.reelId;
    const urlHasRecovery =
      typeof window !== 'undefined' && !!window.location?.href?.includes('type=recovery');
    const inRecoveryFlow = user?.isPasswordRecovery || urlHasRecovery || hasPendingPasswordRecovery();
    if (!isAuthenticated || !user) {
      if (hasPendingPost) {
        target = `/post/${pending!.postId!}`;
      } else if (hasPendingReel) {
        target = `/reel/${pending!.reelId!}`;
      } else {
        target = '/';
      }
    } else if (inRecoveryFlow) {
      // Recovery: must go to reset-password first; do not redirect to home.
      target = '/reset-password';
    } else if (!user.emailVerified) {
      target = '/verify-email';
    } else if (!user.acceptedLegalDocs) {
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

    if (current === target || (target === '/(tabs)/home' && current.startsWith('/(tabs)'))) return;

    const id = setTimeout(() => {
      router.replace(target as any);
    }, 0);
    return () => clearTimeout(id);
  }, [authReady, authLoading, isAuthenticated, user, pathname, router]);

  // After we're on main app, navigate to intended route once (e.g. post/reel from deep link)
  useEffect(() => {
    if (!authReady || authLoading || !isAuthenticated || !user || appliedIntendedRouteRef.current) return;
    const current = pathname || '/';
    const onMainApp = current.startsWith('/(tabs)') || current.startsWith('/post') || current.startsWith('/reel/');
    if (!onMainApp) return;

    getIntendedRoute().then((route) => {
      if (!route) return;
      appliedIntendedRouteRef.current = true;
      clearIntendedRoute();
      setTimeout(() => router.push(route as any), 200);
    });
  }, [authReady, authLoading, isAuthenticated, user, pathname, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoadingOverride(true);
      if (__DEV__) console.log('[AppGate] Loading timeout reached, showing app');
    }, LOADING_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  const showSplash = !loadingOverride && (!authReady || authLoading);
  if (__DEV__ && showSplash) {
    console.log('[AppGate] Splash: authReady=', authReady, 'authLoading=', authLoading);
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
