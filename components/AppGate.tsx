/**
 * AppGate - Single place for auth-based routing and deep link processing.
 * Deep links are queued and processed only after authReady === true.
 * Bootstrap splash should not hang indefinitely; watchdog + AuthContext unblock handle edge cases.
 *
 * Auth routing order (signed-in user):
 * 1. Password recovery → /reset-password
 * 2. Email not verified (JWT before hydrate; DB is_verified after) → /verify-email
 * 3. Verified but profile still loading → /(tabs)/home shell (avoids onboarding with false minimal-user flags)
 * 4. Else → home
 *
 * Legal acceptance is **not** a navigation gate — `LegalAcceptanceEnforcer` uses a dismissible sheet + banner
 * reminders (soft UX). Committed AI consent also uses a soft reminder over the home shell.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import SplashScreen from './SplashScreen';
import {
  getAndClearPendingDeepLink,
  getIntendedRoute,
  clearIntendedRoute,
  setIntendedRoute,
  subscribePendingDeepLink,
} from '@/lib/deep-link-service';
import { setStoredReferralCode } from '@/lib/referral-storage';
import { hasPendingPasswordRecovery } from '@/lib/pending-password-recovery';
import { isCallbackProcessing } from '@/lib/auth-callback-state';

const SIGNED_IN_APP_ROUTE_ROOTS = [
  '/(tabs)',
  '/home',
  '/feed',
  '/reels',
  '/dating',
  '/search',
  '/notifications',
  '/messages',
  '/profile',
  '/post',
  '/reel',
  '/status',
  '/status-item',
  '/bookings',
  '/ads',
  '/admin',
  '/professional',
  '/relationship',
  '/verification',
  '/anniversary',
  '/certificates',
  '/settings',
];

function isSignedInAppRoute(pathname: string) {
  return SIGNED_IN_APP_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authLoading, authReady, authInitialized, isAuthenticated, profileHydrated, syncAuthState, forceAuthBootstrapUnblock } =
    useAuth();
  const { legalAcceptanceStatus, hasCompletedOnboarding } = useApp();
  const lastTargetRef = useRef<string | null>(null);
  const appliedIntendedRouteRef = useRef(false);

  // New login / account switch: allow AppGate to navigate again (avoid stale lastTarget blocking verify→home).
  useLayoutEffect(() => {
    lastTargetRef.current = null;
  }, [user?.id]);

  /** Bumped when a deep link is queued so routing re-runs (warm links after AppGate mounted). */
  const [pendingDeepLinkSignal, setPendingDeepLinkSignal] = useState(0);

  useEffect(() => {
    return subscribePendingDeepLink(() => {
      setPendingDeepLinkSignal((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (!authInitialized || !authReady || authLoading) return;
    if (isCallbackProcessing()) {
      if (__DEV__) console.log('[AppGate] Callback processing, skip redirect');
      return;
    }

    if (__DEV__) {
      console.log('[AppGate] Auth ready, isAuthenticated:', isAuthenticated, 'pathname:', pathname);
    }

    const pending = getAndClearPendingDeepLink();
    let pendingRoute: string | null = null;
    if (pending) {
      if (__DEV__) console.log('[AppGate] Deep link:', pending.type, pending.postId ?? pending.reelId ?? pending.datingUserId ?? pending.referralCode);
      if (pending.type === 'referral' && pending.referralCode) {
        setStoredReferralCode(pending.referralCode).catch(() => {});
      } else if (pending.type === 'post' && pending.postId) {
        pendingRoute = `/post/${pending.postId}`;
      } else if (pending.type === 'reel' && pending.reelId) {
        pendingRoute = `/reel/${pending.reelId}`;
      } else if (pending.type === 'dating-profile' && pending.datingUserId) {
        pendingRoute = `/dating/user-profile?userId=${encodeURIComponent(pending.datingUserId)}`;
      }

      if (pendingRoute) {
        appliedIntendedRouteRef.current = false;
        setIntendedRoute(pendingRoute).catch(() => {});
      }
    }

    const current = (pathname && pathname.startsWith('/') ? pathname : `/${pathname || ''}`) || '/';
    if (current === '/auth-callback') {
      lastTargetRef.current = '/auth-callback';
      return;
    }
    if (current === '/reset-password' && (isAuthenticated && user ? true : hasPendingPasswordRecovery())) {
      lastTargetRef.current = '/reset-password';
      return;
    }
    // Stay on verify-email: (1) until DB/JWT agree user is unverified, or (2) until profile hydrates so we
    // don't jump to home on a JWT-only email_confirmed_at race before profiles.is_verified is loaded.
    if (current === '/verify-email' && isAuthenticated && user) {
      if (!user.emailVerified) {
        lastTargetRef.current = '/verify-email';
        return;
      }
      if (!profileHydrated) {
        lastTargetRef.current = '/verify-email';
        return;
      }
    }
    // Always allow viewing legal documents, even if not yet accepted (so users can read before accepting).
    if (current.startsWith('/legal/')) {
      lastTargetRef.current = current;
      return;
    }
    if (
      isAuthenticated &&
      user?.emailVerified &&
      isSignedInAppRoute(current)
    ) {
      lastTargetRef.current = current;
      return;
    }

    let target: string;
    const urlHasRecovery =
      typeof window !== 'undefined' && !!window.location?.href?.includes('type=recovery');
    const inRecoveryFlow = user?.isPasswordRecovery || urlHasRecovery || hasPendingPasswordRecovery();
    if (hasPendingPasswordRecovery()) {
      target = '/reset-password';
    } else if (!isAuthenticated || !user) {
      target = current === '/' ? '/' : '/auth';
    } else if (inRecoveryFlow) {
      // Recovery: must go to reset-password first; do not redirect to home.
      target = '/reset-password';
    } else if (!profileHydrated) {
      // While DB profile flags hydrate, use the session email state. Already verified
      // sign-ins should not flash through /verify-email.
      target = user.emailVerified ? '/(tabs)/home' : '/verify-email';
    } else if (!user.emailVerified) {
      // New signups (and anyone not verified in DB/JWT) stay on verify until confirmed.
      target = '/verify-email';
    } else if (pendingRoute) {
      target = pendingRoute;
    } else if (!user.acceptedLegalDocs) {
      target = '/(tabs)/home';
    } else {
      target = '/(tabs)/home';
    }

    const publicPaths = ['/', '/auth', '/auth-callback', '/reset-password', '/verify-email', '/sign-in', '/sign-up', '/signup'];
    if (!isAuthenticated && publicPaths.some((p) => current === p || current.startsWith(p + '/'))) {
      lastTargetRef.current = target;
      return;
    }

    const onAuthShell =
      current === '/auth' ||
      current.startsWith('/auth?') ||
      current === '/sign-in' ||
      current.startsWith('/sign-in?') ||
      current === '/sign-up' ||
      current.startsWith('/sign-up?') ||
      current === '/signup' ||
      current.startsWith('/signup?');

    // If lastTarget already equals target we normally skip — but signed-in users must never
    // stay stuck on /auth after login just because lastTarget was already /(tabs)/home.
    if (lastTargetRef.current === target) {
      const mustLeaveAuthShell =
        isAuthenticated && !!user && onAuthShell && current !== target;
      if (!mustLeaveAuthShell) return;
    }
    lastTargetRef.current = target;

    // Same route: skip. Allow tab-to-tab when target is home (don't force home tab on every tick).
    const onTabs = isSignedInAppRoute(current);
    const sameRoute =
      current === target ||
      (current.startsWith('/post/') && target.startsWith('/post/') && current === target) ||
      (current.startsWith('/reel/') && target.startsWith('/reel/') && current === target) ||
      (current.startsWith('/dating/user-profile') && target.startsWith('/dating/user-profile') && current === target) ||
      (current.startsWith('/messages/') && target.startsWith('/messages/') && current === target) ||
      (target === '/(tabs)/home' && onTabs);
    if (sameRoute) return;

    const id = setTimeout(() => {
      router.replace(target as any);
    }, 0);
    return () => clearTimeout(id);
  }, [authInitialized, authReady, authLoading, isAuthenticated, user, pathname, router, pendingDeepLinkSignal, profileHydrated, legalAcceptanceStatus, hasCompletedOnboarding]);

  // After we're on main app, navigate to intended route once (e.g. post/reel from deep link)
  useEffect(() => {
    if (!authInitialized || !authReady || authLoading || !isAuthenticated || !user || appliedIntendedRouteRef.current) return;
    const current = pathname || '/';
    const onMainApp =
      isSignedInAppRoute(current);
    if (!onMainApp) return;

    getIntendedRoute().then((route) => {
      if (!route) return;
      appliedIntendedRouteRef.current = true;
      clearIntendedRoute();
      setTimeout(() => router.push(route as any), 200);
    });
  }, [authInitialized, authReady, authLoading, isAuthenticated, user, pathname, router]);

  const showSplash = !authInitialized || !authReady || authLoading;

  useEffect(() => {
    if (!showSplash) return;
    const syncId = setTimeout(() => {
      void syncAuthState({ reason: 'appgate_splash_watchdog', refreshToken: true });
    }, 12000);
    const unblockId = setTimeout(() => {
      void syncAuthState({ reason: 'appgate_splash_unblock', refreshToken: true });
      forceAuthBootstrapUnblock();
    }, 24000);
    return () => {
      clearTimeout(syncId);
      clearTimeout(unblockId);
    };
  }, [showSplash, syncAuthState, forceAuthBootstrapUnblock]);

  if (__DEV__ && showSplash) {
    console.log('[AppGate] Splash: authReady=', authReady, 'authLoading=', authLoading);
  }

  if (showSplash) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
