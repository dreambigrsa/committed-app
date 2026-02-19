/**
 * AuthContext - Single source of truth for session state only.
 * NEVER navigates. NEVER reads storage directly in screens.
 * All routing flows through AppGate.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';

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
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const isAuthenticated = user !== null;

  const hydrateFromSession = useCallback(
    async (
      session: { user: { id: string; email?: string; email_confirmed_at?: string }; access_token: string; refresh_token?: string },
      opts?: { isPasswordRecovery?: boolean }
    ) => {
      try {
        setAccessToken(session.access_token);
        setRefreshToken(session.refresh_token ?? null);

        if (opts?.isPasswordRecovery) {
          setIsPasswordRecovery(true);
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id, full_name, email, phone_number')
          .eq('id', session.user.id)
          .single();

        if (!userData) {
          // User record may not exist yet (e.g. right after signup). Use session for routing.
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: (session.user as any).user_metadata?.full_name || '',
            phoneNumber: (session.user as any).user_metadata?.phone_number || '',
            emailVerified: !!session.user.email_confirmed_at,
            acceptedLegalDocs: false,
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
          emailVerified: !!session.user.email_confirmed_at,
          acceptedLegalDocs: acceptanceStatus.hasAllRequired,
          completedOnboarding: onboardingData?.has_completed_onboarding ?? false,
          isPasswordRecovery: opts?.isPasswordRecovery ?? isPasswordRecovery,
        });
      } catch (err) {
        console.error('AuthContext hydrate error:', err);
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
      }
    },
    [isPasswordRecovery]
  );

  const restoreSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Session restore error:', error);
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        return;
      }
      if (session) {
        await hydrateFromSession(session);
      } else {
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
      }
    } catch (err) {
      console.error('restoreSession error:', err);
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    } finally {
      setAuthLoading(false);
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
        setAccessToken(null);
        setRefreshToken(null);
        return;
      }

      if (newSession) {
        setAccessToken(newSession.access_token);
        setRefreshToken(newSession.refresh_token ?? null);
        await hydrateFromSession(newSession, { isPasswordRecovery: event === 'PASSWORD_RECOVERY' });
      } else {
        setUser(null);
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
      setAccessToken(null);
      setRefreshToken(null);
      setIsPasswordRecovery(false);
    } catch (err) {
      console.error('SignOut error:', err);
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { getAuthRedirectUrl } = await import('@/lib/auth-redirect');
    const redirectTo = getAuthRedirectUrl();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setIsPasswordRecovery(false);
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
    } catch (err) {
      console.error('Token refresh failed:', err);
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }, [refreshToken, hydrateFromSession]);

  const value: AuthContextValue = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    authLoading,
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
