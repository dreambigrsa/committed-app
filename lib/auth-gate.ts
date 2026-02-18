/**
 * Central auth gate logic: single source of truth for "where should the user be?"
 * Used by AppGate, index, verify-email, auth-callback, auth.
 * Prevents redirect loops and ensures consistent post-auth routing.
 */

import type { User } from '@/types';
import type { AcceptanceStatus } from './legal-enforcement';

export type ResolvedRoute =
  | '/'
  | '/auth'
  | '/verify-email'
  | '/reset-password'
  | '/onboarding'
  | '/(tabs)/home';

export interface AuthGateState {
  session: unknown;
  currentUser: User | null;
  legalAcceptanceStatus: AcceptanceStatus | null;
  hasCompletedOnboarding: boolean | null;
  isPasswordRecoveryFlow: boolean;
  emailVerified: boolean;
}

/**
 * Returns the route the user should be on given current auth state.
 * Order: no session → landing; recovery → reset-password; !emailVerified → verify-email;
 * !legal → main (legal modal will show); !onboarding → onboarding; else main.
 */
export function getResolvedRoute(state: AuthGateState): ResolvedRoute {
  const {
    session,
    currentUser,
    legalAcceptanceStatus,
    hasCompletedOnboarding,
    isPasswordRecoveryFlow,
    emailVerified,
  } = state;

  if (!session) return '/';
  if (isPasswordRecoveryFlow) return '/reset-password';
  if (currentUser && !emailVerified) return '/verify-email';
  if (!currentUser) return '/'; // Session but no user yet (loading)
  if (hasCompletedOnboarding === null) return '/'; // Still loading onboarding
  if (hasCompletedOnboarding === false) return '/onboarding';
  // Legal: if not all required, user goes to main app and LegalAcceptanceEnforcer shows blocking modal
  return '/(tabs)/home';
}

/**
 * Returns true if the user has passed the full gate (session + email verified + legal + onboarding).
 */
export function hasPassedAuthGate(state: AuthGateState): boolean {
  if (!state.session || !state.currentUser) return false;
  if (!state.emailVerified) return false;
  if (state.legalAcceptanceStatus && !state.legalAcceptanceStatus.hasAllRequired) return false;
  if (state.hasCompletedOnboarding !== true) return false;
  return true;
}
