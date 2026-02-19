/**
 * AppGate - Single place for auth-based routing and deep link processing.
 * Deep links are processed only after auth is ready (authLoading === false).
 */
import React, { useEffect, useRef } from 'react';
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

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authLoading, isAuthenticated } = useAuth();
  const lastTargetRef = useRef<string | null>(null);
  const processedDeepLinkRef = useRef(false);
  const appliedIntendedRouteRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    const authReady = !authLoading;

    if (authReady) {
      const pending = getAndClearPendingDeepLink();
      if (pending && !processedDeepLinkRef.current) {
        processedDeepLinkRef.current = true;
        if (pending.type === 'referral' && pending.referralCode) {
          setStoredReferralCode(pending.referralCode).catch(() => {});
        } else if (pending.type === 'post' && pending.postId) {
          if (isAuthenticated && user) {
            setIntendedRoute(`/post/${pending.postId}`).catch(() => {});
          } else {
            setIntendedRoute(`/post/${pending.postId}`).catch(() => {});
          }
        } else if (pending.type === 'reel' && pending.reelId) {
          if (isAuthenticated && user) {
            setIntendedRoute(`/(tabs)/reels?reelId=${encodeURIComponent(pending.reelId)}`).catch(() => {});
          } else {
            setIntendedRoute(`/(tabs)/reels?reelId=${encodeURIComponent(pending.reelId)}`).catch(() => {});
          }
        }
      }
    }

    let target: string;
    if (!isAuthenticated || !user) {
      target = '/';
    } else if (user.isPasswordRecovery) {
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

    const current = pathname || '/';
    if (current === target || (target === '/(tabs)/home' && current.startsWith('/(tabs)'))) return;

    const id = setTimeout(() => {
      router.replace(target as any);
    }, 0);
    return () => clearTimeout(id);
  }, [authLoading, isAuthenticated, user, pathname, router]);

  // After we're on main app, navigate to intended route once (e.g. post/reel from deep link)
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user || appliedIntendedRouteRef.current) return;
    const current = pathname || '/';
    const onMainApp = current.startsWith('/(tabs)') || current.startsWith('/post');
    if (!onMainApp) return;

    getIntendedRoute().then((route) => {
      if (!route) return;
      appliedIntendedRouteRef.current = true;
      clearIntendedRoute();
      setTimeout(() => router.push(route as any), 150);
    });
  }, [authLoading, isAuthenticated, user, pathname, router]);

  if (authLoading) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}
