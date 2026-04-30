/**
 * AuthContext - Single source of truth for auth/session.
 * Only place that calls getSession() on startup. All other code uses this context.
 * NEVER navigates. Deep link handling runs only after authLoading === false.
 * authLoading is ONLY for cold-start session restore (and sign-out), not for
 * signIn/signUp; otherwise AppGate would cover the whole app with SplashScreen
 * on slow mobile networks while credentials are sent.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { updatePasswordViaApi } from '@/lib/supabase-auth-api';
import { logAuthEvent, errorToAuthCode } from '@/lib/auth-telemetry';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { hasPendingPasswordRecovery, setPendingPasswordRecovery } from '@/lib/pending-password-recovery';
import { requestPasswordReset } from '@/lib/auth-functions';

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isAuthTimeoutError(err: unknown) {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return msg.includes('auth_refresh_session timed out') || msg.includes('auth_profile_hydrate timed out');
}

function isAuthSessionMissingError(err: unknown) {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return msg.includes('auth session missing') || msg.includes('authsessionmissingerror');
}

function logAuthRecoverableError(label: string, err: unknown) {
  if (isAuthTimeoutError(err)) {
    const msg = err instanceof Error ? err.message : String(err ?? 'unknown auth timeout');
    console.warn(`${label} ${msg}`);
    return;
  }

  if (isAuthSessionMissingError(err)) {
    if (__DEV__) console.log(`${label} no active auth session`);
    return;
  }

  console.error(label, err);
}

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
  profileHydrated: boolean;
  authLoading: boolean;
  authReady: boolean;
  authInitialized: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, phoneNumber: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => void;
  refreshSession: () => Promise<void>;
  syncAuthState: (opts?: { reason?: string; refreshToken?: boolean }) => Promise<boolean>;
  /** Full bootstrap recovery (closest to cold app relaunch without process restart). */
  recoverSessionHard: () => Promise<boolean>;
  /** Last resort: hide AppGate splash if bootstrap is stuck (should be rare). */
  forceAuthBootstrapUnblock: () => void;
  setPasswordRecovery: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const lastActiveSyncRef = useRef(0);
  const syncInFlightRef = useRef<Promise<boolean> | null>(null);
  const transientNullSinceRef = useRef<number | null>(null);
  const TRANSIENT_NULL_GRACE_MS = 20000;

  const isAuthenticated = user !== null;
  const authReady = authInitialized && !authLoading;

  /** Build minimal AuthUser from session only (no DB). Used so sign-in can resolve immediately. */
  const getMinimalUserFromSession = useCallback(
    (
      session: { user: { id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> }; access_token: string; refresh_token?: string },
      opts?: { isPasswordRecovery?: boolean }
    ): AuthUser => {
      const u = session.user;
      const meta = (u as { user_metadata?: Record<string, string> }).user_metadata;
      return {
        id: u.id,
        email: u.email || '',
        fullName: meta?.full_name || '',
        phoneNumber: meta?.phone_number || '',
        emailVerified: !!(u as { email_confirmed_at?: string }).email_confirmed_at,
        acceptedLegalDocs: false,
        completedOnboarding: false,
        isPasswordRecovery: opts?.isPasswordRecovery ?? isPasswordRecovery,
      };
    },
    [isPasswordRecovery]
  );

  const hydrateFromSession = useCallback(
    async (
      session: { user: { id: string; email?: string; email_confirmed_at?: string }; access_token: string; refresh_token?: string },
      opts?: { isPasswordRecovery?: boolean; clearOnError?: boolean }
    ) => {
      const clearOnError = opts?.clearOnError !== false;
      try {
        setSession(session as Session);
        setAccessToken(session.access_token);
        setRefreshToken(session.refresh_token ?? null);

        if (opts?.isPasswordRecovery) {
          setIsPasswordRecovery(true);
        }

        const [{ data: profileData }, { data: userData }] = await withTimeout(
          Promise.all([
            supabase.from('profiles').select('is_verified').eq('id', session.user.id).maybeSingle(),
            supabase.from('users').select('id, full_name, email, phone_number').eq('id', session.user.id).single(),
          ]),
          10000,
          'auth_profile_hydrate'
        );
        const isVerified = profileData?.is_verified ?? false;

        if (!userData) {
          const acceptanceStatus = await withTimeout(
            checkUserLegalAcceptances(session.user.id),
            8000,
            'auth_legal_hydrate'
          );
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
          setProfileHydrated(true);
          return;
        }

        const [acceptanceStatus, { data: onboardingData }] = await withTimeout(
          Promise.all([
            checkUserLegalAcceptances(session.user.id),
            supabase
              .from('user_onboarding_data')
              .select('has_completed_onboarding')
              .eq('user_id', session.user.id)
              .maybeSingle(),
          ]),
          10000,
          'auth_onboarding_hydrate'
        );

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
        setProfileHydrated(true);
      } catch (err) {
        logAuthRecoverableError('AuthContext hydrate error:', err);
        if (clearOnError) {
          logAuthEvent('hydrate_cleared_state', {
            code: errorToAuthCode(err),
            clearOnError: true,
          });
          setUser(null);
          setSession(null);
          setAccessToken(null);
          setRefreshToken(null);
          setProfileHydrated(false);
        } else {
          logAuthEvent('hydrate_failed_kept_session', { code: errorToAuthCode(err) });
          // Keep auth state and stop showing "temporary minimal user" decisions.
          setProfileHydrated(true);
        }
      }
    },
    [isPasswordRecovery]
  );

  const restoreSession = useCallback(async () => {
    setAuthLoading(true);
    const loadingDoneRef = { done: false };
    const finishLoading = () => {
      if (loadingDoneRef.done) return;
      loadingDoneRef.done = true;
      setAuthLoading(false);
    };

    // Never end splash before getSession() settles — a 4s timeout here caused users to appear
    // logged out on cold start while AsyncStorage was still being read (common on slower devices).
    // Only unblock after an extreme hang (broken bridge / deadlock).
    const hangTimeoutId = setTimeout(() => {
      logAuthEvent('restore_hang_timeout', { ms: 25000 });
      if (__DEV__) console.warn('[Auth] getSession exceeded 25s; unblocking splash');
      finishLoading();
    }, 25000);

    const readSessionWithRetry = async () => {
      let lastError: { message?: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        let result: Awaited<ReturnType<typeof supabase.auth.getSession>>;
        try {
          result = await withTimeout(
            supabase.auth.getSession(),
            8000,
            'restore_get_session'
          );
        } catch (err: any) {
          lastError = err;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
          continue;
        }
        const { data: { session: s }, error } = result;
        if (!error) return { session: s, error: null as null };
        lastError = error;
        const em = (error.message ?? String(error)).toLowerCase();
        if (em.includes('aborted') || em.includes('signal')) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
      return { session: null as Session | null, error: lastError };
    };

    try {
      const { session: s, error } = await readSessionWithRetry();
      if (error) {
        console.error('Session restore error:', error);
        logAuthEvent('restore_get_session_error', { code: errorToAuthCode(error) });
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setProfileHydrated(false);
        return;
      }
      logAuthEvent('restore_complete', { hasSession: !!s });
      if (s) {
        setSession(s);
        setAccessToken(s.access_token);
        setRefreshToken(s.refresh_token ?? null);
        const isRecovery =
          hasPendingPasswordRecovery() ||
          (typeof window !== 'undefined' && window.location?.href?.includes('type=recovery'));
        // Critical: set user immediately so AppGate sees isAuthenticated before DB hydration finishes.
        setUser(getMinimalUserFromSession(s, { isPasswordRecovery: !!isRecovery }));
        setProfileHydrated(false);
        hydrateFromSession(s, { isPasswordRecovery: !!isRecovery, clearOnError: false }).catch((err: any) => {
          const msg = (err?.message ?? String(err)) ?? '';
          if (!msg.includes('aborted') && !msg.includes('signal')) {
            logAuthRecoverableError('hydrateFromSession error:', err);
            logAuthEvent('hydrate_failed_after_restore', { code: errorToAuthCode(err) });
          }
        });
      } else {
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setProfileHydrated(false);
      }
    } catch (err: any) {
      const msg = (err?.message ?? String(err)) ?? '';
      if (msg.includes('aborted') || msg.includes('signal')) {
        return;
      }
      console.error('restoreSession error:', err);
      logAuthEvent('restore_throw', { code: errorToAuthCode(err) });
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setRefreshToken(null);
      setProfileHydrated(false);
    } finally {
      clearTimeout(hangTimeoutId);
      setAuthInitialized(true);
      finishLoading();
    }
  }, [hydrateFromSession, getMinimalUserFromSession]);

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
        // During cold-start bootstrap, ignore transient null refresh events.
        if (!authInitialized && event === 'TOKEN_REFRESHED') {
          return;
        }
        logAuthEvent('auth_cleared', {
          reason: event === 'SIGNED_OUT' ? 'signed_out' : 'token_refresh_no_session',
        });
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setProfileHydrated(false);
        return;
      }

      logAuthEvent('auth_state_change', { event, hasSession: !!newSession });

      if (newSession) {
        setSession(newSession);
        setAccessToken(newSession.access_token);
        setRefreshToken(newSession.refresh_token ?? null);
        const isRecovery =
          event === 'PASSWORD_RECOVERY' || hasPendingPasswordRecovery() ||
          (typeof window !== 'undefined' && window.location?.href?.includes('type=recovery'));
        // Same as cold start: avoid a window where session exists but user is null (AppGate → logged-out routes).
        setUser(getMinimalUserFromSession(newSession, { isPasswordRecovery: !!isRecovery }));
        setProfileHydrated(false);
        try {
          await hydrateFromSession(newSession, { isPasswordRecovery: !!isRecovery, clearOnError: false });
        } catch (err: any) {
          const msg = (err?.message ?? String(err)) ?? '';
          if (!msg.includes('aborted') && !msg.includes('signal')) {
            logAuthRecoverableError('onAuthStateChange hydrate error:', err);
            logAuthEvent('hydrate_failed_listener', { code: errorToAuthCode(err) });
          }
        }
      }
      // Intentionally no "else { clear }": cold start is handled by restoreSession(). Clearing here on
      // arbitrary events with null session caused spurious logouts; SIGNED_OUT / failed refresh still clear above.
    });
    return () => subscription.unsubscribe();
  }, [hydrateFromSession, getMinimalUserFromSession, authInitialized]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Do NOT set authLoading here: AppGate treats authLoading as "show full-app splash".
      // On mobile, signInWithPassword can take several seconds; keeping the auth screen
      // visible with its own button spinner is critical (web often feels fine because it's faster).
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        const session = data.session;
        setSession(session);
        setAccessToken(session.access_token);
        setRefreshToken(session.refresh_token ?? null);
        // Resolve sign-in immediately once auth session exists.
        // Do not block on extra DB reads (profiles/onboarding/legal), which can be slow.
        setUser(getMinimalUserFromSession(session));
        setProfileHydrated(false);
        logAuthEvent('sign_in_ok', {});

        // Hydrate full profile in background (legal acceptances, user record, etc).
        // clearOnError:false ensures we don't log out the user if hydration is slow.
        hydrateFromSession(session, { clearOnError: false }).catch((err) => {
          console.warn('Background hydration after sign-in failed:', err);
          logAuthEvent('hydrate_failed_after_sign_in', { code: errorToAuthCode(err) });
        });
      }
    },
    [getMinimalUserFromSession, hydrateFromSession]
  );

  const signUp = useCallback(
    async (fullName: string, email: string, phoneNumber: string, password: string) => {
      // Same as signIn: avoid full-app splash during network call (especially on native).
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
        setProfileHydrated(false);
      } else if (data.session) {
        const sess = data.session;
        setSession(sess);
        setAccessToken(sess.access_token);
        setRefreshToken(sess.refresh_token ?? null);
        setUser(getMinimalUserFromSession(sess));
        setProfileHydrated(false);
        await hydrateFromSession(sess, { clearOnError: false });
        logAuthEvent('sign_up_ok', { hasSession: true });
      }
    },
    [hydrateFromSession, getMinimalUserFromSession]
  );

  const signOut = useCallback(async () => {
    logAuthEvent('sign_out', {});
    setAuthLoading(true);
    const SIGN_OUT_TIMEOUT_MS = 12000;
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('signOut_timeout')), SIGN_OUT_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      console.error('SignOut error:', err);
    } finally {
      // Always clear local auth state so AppGate can leave splash even if SDK/network hangs.
      setUser(null);
      setSession(null);
      setAccessToken(null);
      setRefreshToken(null);
      setProfileHydrated(false);
      setIsPasswordRecovery(false);
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

  const forceAuthBootstrapUnblock = useCallback(() => {
    logAuthEvent('force_bootstrap_unblock', {});
    if (__DEV__) console.warn('[Auth] forceAuthBootstrapUnblock');
    setAuthLoading(false);
  }, []);

  const syncAuthState = useCallback(
    async (opts?: { reason?: string; refreshToken?: boolean }) => {
      if (syncInFlightRef.current) {
        return syncInFlightRef.current;
      }

      const run = (async (): Promise<boolean> => {
        const reason = opts?.reason ?? 'manual';
        try {
          if (__DEV__) {
            console.log('[AuthContext] syncAuthState start:', reason, 'refreshToken=', !!opts?.refreshToken);
          }

          if (opts?.refreshToken) {
            const { data: refreshed, error: refreshErr } = await withTimeout(
              supabase.auth.refreshSession(),
              12000,
              'auth_refresh_session'
            );
            if (refreshErr && !isAuthSessionMissingError(refreshErr)) throw refreshErr;
            if (refreshed.session) {
              transientNullSinceRef.current = null;
              setSession(refreshed.session);
              setAccessToken(refreshed.session.access_token);
              setRefreshToken(refreshed.session.refresh_token ?? null);
              setUser(getMinimalUserFromSession(refreshed.session));
              setProfileHydrated(false);
              await hydrateFromSession(refreshed.session, { clearOnError: false });
              logAuthEvent('sync_ok', { reason, refreshed: true });
              return true;
            }
          }

          const { data: { session: liveSession }, error } = await withTimeout(
            supabase.auth.getSession(),
            8000,
            'auth_get_session'
          );
          if (error) throw error;

          if (!liveSession) {
            const hadAuthState = !!session || !!user;
            const isResumePath = reason === 'app_focus' || reason === 'home_missing_current_user' || reason === 'appgate_splash_watchdog';

            // One extra active refresh attempt before considering a clear.
            try {
              const { data: refreshed, error: refreshErr } = await withTimeout(
                supabase.auth.refreshSession(),
                12000,
                'auth_refresh_after_null'
              );
              if (!refreshErr && refreshed.session) {
                transientNullSinceRef.current = null;
                setSession(refreshed.session);
                setAccessToken(refreshed.session.access_token);
                setRefreshToken(refreshed.session.refresh_token ?? null);
                setUser(getMinimalUserFromSession(refreshed.session));
                setProfileHydrated(false);
                await hydrateFromSession(refreshed.session, { clearOnError: false });
                logAuthEvent('sync_ok', { reason, refreshed: true, recoveredAfterNull: true });
                return true;
              }
            } catch {
              // Ignore transient refresh errors; handled by grace logic below.
            }

            if (hadAuthState && isResumePath) {
              const now = Date.now();
              if (!transientNullSinceRef.current) transientNullSinceRef.current = now;
              const elapsed = now - transientNullSinceRef.current;
              if (elapsed < TRANSIENT_NULL_GRACE_MS) {
                if (__DEV__) {
                  console.log('[AuthContext] syncAuthState transient null session during resume, keeping state:', reason, 'elapsed=', elapsed);
                }
                logAuthEvent('sync_transient_no_session_kept', { reason, elapsed });
                return true;
              }
            }

            if (__DEV__) console.log('[AuthContext] syncAuthState no session confirmed, clearing:', reason);
            transientNullSinceRef.current = null;
            setUser(null);
            setSession(null);
            setAccessToken(null);
            setRefreshToken(null);
            setProfileHydrated(false);
            logAuthEvent('sync_cleared', { reason });
            return false;
          }

          transientNullSinceRef.current = null;
          const isRecovery =
            hasPendingPasswordRecovery() ||
            (typeof window !== 'undefined' && window.location?.href?.includes('type=recovery'));

          setSession(liveSession);
          setAccessToken(liveSession.access_token);
          setRefreshToken(liveSession.refresh_token ?? null);
          setUser(getMinimalUserFromSession(liveSession, { isPasswordRecovery: !!isRecovery }));
          setProfileHydrated(false);
          await hydrateFromSession(liveSession, { isPasswordRecovery: !!isRecovery, clearOnError: false });
          logAuthEvent('sync_ok', { reason, refreshed: false });
          return true;
        } catch (err: any) {
          const msg = (err?.message ?? String(err)) ?? '';
          if (msg.includes('aborted') || msg.includes('signal')) {
            return !!session || !!user;
          }
          logAuthRecoverableError('syncAuthState error:', err);
          logAuthEvent('sync_error', { reason: opts?.reason ?? 'manual', code: errorToAuthCode(err) });
          return !!session || !!user;
        } finally {
          syncInFlightRef.current = null;
        }
      })();

      syncInFlightRef.current = run;
      return run;
    },
    [getMinimalUserFromSession, hydrateFromSession, session, user]
  );

  const refreshSession = useCallback(async () => {
    if (!refreshToken) {
      await syncAuthState({ reason: 'refresh_without_refresh_token', refreshToken: false });
      return;
    }
    try {
      const { data, error } = await withTimeout(
        supabase.auth.refreshSession(),
        12000,
        'manual_refresh_session'
      );
      if (error) throw error;
      if (data.session) {
        await hydrateFromSession(data.session);
        logAuthEvent('refresh_ok', {});
      }
    } catch (err: any) {
      const msg = (err?.message ?? String(err)) ?? '';
      if (msg.includes('aborted') || msg.includes('signal')) return;
      const lower = msg.toLowerCase();
      const isInvalidRefresh =
        lower.includes('invalid refresh token') ||
        lower.includes('refresh token not found') ||
        lower.includes('jwt expired') ||
        lower.includes('session not found');

      if (isInvalidRefresh) {
        // Session is truly invalid - clear auth state.
        console.error('Token refresh failed (invalid session):', err);
        logAuthEvent('refresh_cleared', { reason: 'invalid_or_expired' });
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setProfileHydrated(false);
      } else {
        // Transient/network failure - keep current session and retry later.
        console.warn('Token refresh failed (transient), keeping session:', err);
        logAuthEvent('refresh_transient', { code: errorToAuthCode(err) });
      }
    }
  }, [refreshToken, hydrateFromSession, syncAuthState]);

  const recoverSessionHard = useCallback(async (): Promise<boolean> => {
    try {
      if (__DEV__) console.log('[AuthContext] recoverSessionHard start');
      syncInFlightRef.current = null;
      transientNullSinceRef.current = null;

      const authApi = supabase.auth as unknown as {
        startAutoRefresh?: () => void;
        stopAutoRefresh?: () => void;
      };
      authApi.stopAutoRefresh?.();
      authApi.startAutoRefresh?.();

      // Re-run the same startup bootstrap path used on cold launch.
      await restoreSession();

      const { data: { session: s }, error } = await withTimeout(
        supabase.auth.getSession(),
        8000,
        'recover_get_session'
      );
      if (error || !s) {
        if (__DEV__) console.warn('[AuthContext] recoverSessionHard no session after restore');
        setUser(null);
        setSession(null);
        setAccessToken(null);
        setRefreshToken(null);
        setProfileHydrated(false);
        return false;
      }

      setSession(s);
      setAccessToken(s.access_token);
      setRefreshToken(s.refresh_token ?? null);
      setUser(getMinimalUserFromSession(s));
      setProfileHydrated(false);
      await hydrateFromSession(s, { clearOnError: false }).catch((err) => {
        // Session is already restored; hydration can finish later via AppContext/Auth listener.
        console.warn('recoverSessionHard hydrate warning:', err);
      });
      logAuthEvent('recover_session_hard_ok', {});
      return true;
    } catch (err: any) {
      console.error('recoverSessionHard error:', err);
      logAuthEvent('recover_session_hard_error', { code: errorToAuthCode(err) });
      return false;
    }
  }, [restoreSession, getMinimalUserFromSession, hydrateFromSession]);

  useEffect(() => {
    const authApi = supabase.auth as unknown as {
      startAutoRefresh?: () => void;
      stopAutoRefresh?: () => void;
    };

    const applyAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        authApi.stopAutoRefresh?.();
        return;
      }
      if (next !== 'active') return;

      // Supabase RN: timers for auto-refresh pause in background; restart on foreground.
      authApi.startAutoRefresh?.();

      if (authLoading) return;
      const now = Date.now();
      if (now - lastActiveSyncRef.current < 2000) return;
      lastActiveSyncRef.current = now;
      syncAuthState({ reason: 'app_focus', refreshToken: true }).catch(() => {});
    };

    // Cold start: listener may not fire for initial "active" state.
    if (AppState.currentState === 'active') {
      authApi.startAutoRefresh?.();
    }

    const sub = AppState.addEventListener('change', applyAppState);
    return () => {
      sub.remove();
      authApi.stopAutoRefresh?.();
    };
  }, [syncAuthState, authLoading]);

  const value: AuthContextValue = {
    user,
    session,
    accessToken,
    refreshToken,
    isAuthenticated,
    profileHydrated,
    authLoading,
    authReady,
    authInitialized,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    updateUser,
    refreshSession,
    syncAuthState,
    recoverSessionHard,
    forceAuthBootstrapUnblock,
    setPasswordRecovery: setIsPasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
