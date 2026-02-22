/**
 * AuthContext - Single source of truth for auth/session.
 * Only place that calls getSession() on startup. All other code uses this context.
 * NEVER navigates. Deep link handling runs only after authLoading === false.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { updatePasswordViaApi, UpdatePasswordTimeoutError, UpdatePasswordAbortedError } from '@/lib/supabase-auth-api';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { hasPendingPasswordRecovery, setPendingPasswordRecovery } from '@/lib/pending-password-recovery';
import { requestPasswordReset } from '@/lib/auth-functions';

// Minimal auth user for routing decisions
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  emailVerified: boolean;
  acceptedLegalDocs: boolean;
  completedOnboarding: boolean;
  isPasswordRecovery?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authReady: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, phoneNumber: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => void;
  refreshSession: () => Promise<void>;
  setPasswordRecovery: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const isAuthenticated = user !== null;
  const authReady = !authLoading;

  const hydrateFromSession = useCallback(
    async (
      session: { user: { id: string; email?: string; email_confirmed_at?: string }; access_token: string; refresh_token?: string },
      opts?: { isPasswordRecovery?: boolean }
    ) => {
      try {
        setSession(session as Session);
        setAccessToken(session.access_token);
        setRefreshToken(session.refresh_token ?? null);

        if (opts?.isPasswordRecovery) {
          setIsPasswordRecovery(true);
        }

        const [{ data: profileData }, { data: userData }] = await Promise.all([
          supabase.from('profiles').select('is_verified').eq('id', session.user.id).maybeSingle(),
          supabase.from('users').select('id, full_name, email, phone_number').eq('id', session.user.id).single(),
        ]);
        const isVerified = profileData?.is_verified ?? false;

        if (!userData) {
          const acceptanceStatus = await checkUserLegalAcceptances(session.user.id);
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: (session.user as any).user_metadata?.full_name || '',
            phoneNumber: (session.user as any).user_metadata?.phone_number || '',
            emailVerified: isVerified,
            acceptedLegalDocs: acceptanceStatus.hasAllRequired,
            completedOnboarding: false,
            isPasswordRecovery: opts?.isPasswordRecovery ?? isPasswordRecovery,
          });
          return;
        }

        const acceptanceStatus = await checkUserLegalAcceptances(session.user.id);
        const { data: onboardingData } = await supabase
          .from('user_onboarding_data')
          .select('has_completed_onboarding')
          .eq('user_id', session.user.id)
          .maybeSingle();

        setUser({
          id: userData.id,
          email: userData.email || '',
          fullName: userData.full_name || '',
          phoneNumber: userData.phone_number || '',
          emailVerified: isVerified,
          acceptedLegalDocs: acceptanceStatus.hasAllRequired,
          completedOnboarding: onboardingData?.has_completed_onboarding ?? false,
          isPasswordRecovery: opts?.isPasswordRecovery ?? isPasswordRecovery,
        });
      } catch (err) {
        console.error('AuthContext hydrate error:', err);
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
      }
    },
    [isPasswordRecovery]
  );

  const restoreSession = useCallback(async () => {
    setAuthLoading(true);
    const forceStopRef = { done: false };
    const forceStopLoading = () => {
      if (forceStopRef.done) return;
      forceStopRef.done = true;
      setAuthLoading(false);
      if (__DEV__) console.log('[Auth] Loading forced stop (timeout)');
    };
    const timeoutId = setTimeout(forceStopLoading, 4000);

    try {
      const { data: { session: s }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session restore error:', error);
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setAuthLoading(false);
        return;
      }
      if (s) {
        setSession(s);
        setAuthLoading(false);
        // Session may have been set from URL. Use pending recovery flag (set at first URL sight) so we
        // always send to /reset-password and never home.
        const isRecovery =
          hasPendingPasswordRecovery() ||
          (typeof window !== 'undefined' && window.location?.href?.includes('type=recovery'));
        hydrateFromSession(s, { isPasswordRecovery: !!isRecovery }).catch((err: any) => {
          const msg = (err?.message ?? String(err)) ?? '';
          if (!msg.includes('aborted') && !msg.includes('signal')) console.error('hydrateFromSession error:', err);
          setUser(null);
          setSession(null);
          setAccessToken(null);
          setRefreshToken(null);
        });
      } else {
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setAuthLoading(false);
      }
    } catch (err: any) {
      const msg = (err?.message ?? String(err)) ?? '';
      if (msg.includes('aborted') || msg.includes('signal')) {
        setAuthLoading(false);
        return;
      }
      console.error('restoreSession error:', err);
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setRefreshToken(null);
      setAuthLoading(false);
    } finally {
      clearTimeout(timeoutId);
      forceStopLoading();
    }
  }, [hydrateFromSession]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else {
        setIsPasswordRecovery(false);
      }

      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !newSession)) {
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        return;
      }

      if (newSession) {
        setSession(newSession);
        setAccessToken(newSession.access_token);
        setRefreshToken(newSession.refresh_token ?? null);
        const isRecovery =
          event === 'PASSWORD_RECOVERY' || hasPendingPasswordRecovery() ||
          (typeof window !== 'undefined' && window.location?.href?.includes('type=recovery'));
        try {
          await hydrateFromSession(newSession, { isPasswordRecovery: !!isRecovery });
        } catch (err: any) {
          const msg = (err?.message ?? String(err)) ?? '';
          if (!msg.includes('aborted') && !msg.includes('signal')) console.error('onAuthStateChange hydrate error:', err);
        }
      } else {
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
      }
    });
    return () => subscription.unsubscribe();
  }, [hydrateFromSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          await hydrateFromSession(data.session);
        }
      } finally {
        setAuthLoading(false);
      }
    },
    [hydrateFromSession]
  );

  const signUp = useCallback(
    async (fullName: string, email: string, phoneNumber: string, password: string) => {
      setAuthLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone_number: phoneNumber },
          },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setUser(null);
          setSession(null);
          setAccessToken(null);
          setRefreshToken(null);
        } else if (data.session) {
          await hydrateFromSession(data.session);
        }
      } finally {
        setAuthLoading(false);
      }
    },
    [hydrateFromSession]
  );

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setRefreshToken(null);
      setIsPasswordRecovery(false);
    } catch (err) {
      console.error('SignOut error:', err);
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setRefreshToken(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const result = await requestPasswordReset(email);
    if (!result.success) throw new Error(result.message || 'Failed to send reset email');
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    // Use direct Auth API to avoid Supabase SDK updateUser() lock bug (never resolves on success).
    const { data: { session: s } } = await supabase.auth.getSession();
    const token = s?.access_token ?? null;
    if (!token) {
      throw new Error('No session. This reset link may have expired. Please request a new password reset.');
    }
    await updatePasswordViaApi(token, newPassword, { timeoutMs: 25000 });
    setIsPasswordRecovery(false);
    setPendingPasswordRecovery(false);
    // Optionally refresh session so client state is in sync (no await to avoid blocking).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setAccessToken(session.access_token);
      }
    }).catch(() => {});
  }, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : null));
  }, []);

  const refreshSession = useCallback(async () => {
    if (!refreshToken) return;
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (data.session) {
        await hydrateFromSession(data.session);
      }
    } catch (err: any) {
      const msg = (err?.message ?? String(err)) ?? '';
      if (msg.includes('aborted') || msg.includes('signal')) return;
      console.error('Token refresh failed:', err);
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, [refreshToken, hydrateFromSession]);

  const value: AuthContextValue = {
    user,
    session,
    accessToken,
    refreshToken,
    isAuthenticated,
    authLoading,
    authReady,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateUser,
    refreshSession,
    setPasswordRecovery: setIsPasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
