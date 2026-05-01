'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Mail, UserRound } from 'lucide-react';
import { normalizePhoneWithCountryCode } from '@committed/shared';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import OpenAppButton from '@/components/OpenAppButton';

type Mode = 'sign-in' | 'sign-up';
type LegalDoc = {
  id: string;
  title: string;
  slug: string;
  version: string;
  is_required?: boolean | null;
};

const countryCodes = [
  { code: '+263', label: 'ZW' },
  { code: '+27', label: 'ZA' },
  { code: '+1', label: 'US' },
  { code: '+44', label: 'UK' },
  { code: '+234', label: 'NG' },
  { code: '+254', label: 'KE' },
  { code: '+233', label: 'GH' },
  { code: '+256', label: 'UG' },
  { code: '+255', label: 'TZ' },
  { code: '+267', label: 'BW' },
  { code: '+260', label: 'ZM' },
  { code: '+265', label: 'MW' },
  { code: '+258', label: 'MZ' },
];

async function sendVerification(email: string, accessToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const controller = new AbortController();
  const kill = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('/api/auth/send-verification', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || `Verification request failed (${res.status})`);
    }
  } finally {
    window.clearTimeout(kill);
  }
}

function raceWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} is taking too long. Check your connection and try again.`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export default function WebAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+263');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLegalDocs, setLoadingLegalDocs] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [legalDocs, setLegalDocs] = useState<LegalDoc[]>([]);
  const [legalAcceptances, setLegalAcceptances] = useState<Record<string, boolean>>({});

  const isSignUp = mode === 'sign-up';
  const title = isSignUp ? 'Create your account' : 'Welcome back';
  const subtitle = isSignUp
    ? 'Start on web, then continue here or in the mobile app.'
    : 'Sign in to continue your Committed experience on web.';

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (isSignUp && (!fullName.trim() || !phone.trim())) return false;
    if (isSignUp) {
      const requiredDocs = legalDocs.filter((doc) => !!doc.is_required);
      const hasAllRequired = requiredDocs.every((doc) => !!legalAcceptances[doc.id]);
      if (!hasAllRequired) return false;
    }
    return true;
  }, [email, password, isSignUp, fullName, phone, legalAcceptances, legalDocs]);

  useEffect(() => {
    let cancelled = false;
    const loadLegalDocs = async () => {
      if (!isSignUp) return;
      setLoadingLegalDocs(true);
      try {
        const supabaseBrowser = getSupabaseBrowser();
        const { data, error: docsError } = await supabaseBrowser
          .from('legal_documents')
          .select('id,title,slug,version,is_required')
          .eq('is_active', true)
          .contains('display_location', ['signup'])
          .order('created_at', { ascending: true });
        if (docsError) throw docsError;
        if (cancelled) return;
        const docs = ((data ?? []) as LegalDoc[]).filter(Boolean);
        setLegalDocs(docs);
        const defaults: Record<string, boolean> = {};
        docs.forEach((doc) => {
          defaults[doc.id] = false;
        });
        setLegalAcceptances(defaults);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load legal documents.');
      } finally {
        if (!cancelled) setLoadingLegalDocs(false);
      }
    };
    void loadLegalDocs();
    return () => {
      cancelled = true;
    };
  }, [isSignUp]);

  const saveSignUpLegalAcceptances = async (userId: string) => {
    const supabaseBrowser = getSupabaseBrowser();
    const supabaseAny = supabaseBrowser as any;
    const acceptedDocs = legalDocs
      .filter((doc) => legalAcceptances[doc.id])
      .map((doc) => ({
        user_id: userId,
        document_id: doc.id,
        document_version: doc.version || '1.0.0',
        context: 'signup',
        accepted_at: new Date().toISOString(),
      }));
    if (!acceptedDocs.length) return;

    // Mirror mobile strategy: try RPC first, then fallback to table upsert.
    try {
      const rpcResults = await Promise.all(
        acceptedDocs.map((row) =>
          supabaseAny.rpc('insert_user_legal_acceptance', {
            p_user_id: row.user_id,
            p_document_id: row.document_id,
            p_document_version: row.document_version,
            p_context: row.context,
          })
        )
      );
      const rpcFailed = rpcResults.some((result) => !!result.error);
      if (!rpcFailed) return;
    } catch {
      // fall through to upsert fallback
    }

    const { error: upsertError } = await supabaseAny
      .from('user_legal_acceptances')
      .upsert(acceptedDocs, { onConflict: 'user_id,document_id' });
    if (upsertError) throw upsertError;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setError('');
    setNotice('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const supabaseBrowser = getSupabaseBrowser();

      if (isSignUp) {
        const requiredDocs = legalDocs.filter((doc) => !!doc.is_required);
        const missingRequired = requiredDocs.filter((doc) => !legalAcceptances[doc.id]);
        if (missingRequired.length) {
          throw new Error('Please accept all required legal documents to continue.');
        }
        const normalizedPhone = normalizePhoneWithCountryCode(countryCode, phone);
        const redirectTo =
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth-callback`
            : undefined;

        const { data, error: signUpError } = await supabaseBrowser.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              full_name: fullName.trim(),
              phone_number: normalizedPhone,
            },
          },
        });

        if (signUpError) throw signUpError;
        if (data.user?.id) {
          await saveSignUpLegalAcceptances(data.user.id);
        }

        await sendVerification(normalizedEmail, data.session?.access_token);
        router.replace(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      // Clear any stale local session quickly; sign-in below replaces it.
      try {
        await Promise.race([
          supabaseBrowser.auth.signOut({ scope: 'local' }),
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch {
        /* non-fatal */
      }

      // Same-origin sign-in: server calls Supabase (works when the browser cannot reach *.supabase.co).
      type SignInApiOk = {
        access_token: string;
        refresh_token: string;
        user: { id: string | null; email: string | null };
        profile?: { is_verified: boolean | null } | null;
      };
      const signInPayload = await raceWithTimeout(
        fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password }),
        }).then(async (res) => {
          const payload = (await res.json().catch(() => ({}))) as SignInApiOk & { error?: string };
          if (!res.ok) {
            throw new Error(
              typeof payload.error === 'string' && payload.error ? payload.error : 'Sign in failed.'
            );
          }
          return payload;
        }),
        60_000,
        'Sign in'
      );

      const { access_token: accessToken, refresh_token: refreshToken, user: apiUser } = signInPayload;
      if (!accessToken || !refreshToken) {
        throw new Error('Sign-in returned no tokens. Please try again.');
      }

      const { error: setSessionError } = await supabaseBrowser.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (setSessionError) throw setSessionError;

      const signedInUser = apiUser;
      if (!signedInUser?.id) {
        throw new Error('Sign-in succeeded but no user was returned. Please try again.');
      }

      console.debug('[WebAuthForm] Authenticated user object', {
        id: signedInUser.id,
        email: signedInUser.email ?? null,
        signInUserId: signedInUser.id,
      });

      const prof = signInPayload.profile;
      console.debug('[WebAuthForm] Profile from sign-in API', { userId: signedInUser.id, profile: prof });
      if (prof && prof.is_verified === false) {
        await sendVerification(normalizedEmail, accessToken);
        router.replace(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      const redirectParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect') || '/app'
          : '/app';
      const safeRedirect = redirectParam.startsWith('/app') ? redirectParam : '/app';
      router.replace(safeRedirect);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-rose-500 text-white shadow-lg">
          {isSignUp ? <UserRound className="h-7 w-7" /> : <Mail className="h-7 w-7" />}
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-slate-600">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {isSignUp && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </label>
        )}

        {isSignUp && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Required legal documents</p>
            {loadingLegalDocs ? (
              <p className="mt-2 text-sm text-slate-500">Loading documents...</p>
            ) : legalDocs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No signup legal documents found.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {legalDocs.map((doc) => (
                  <label key={doc.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={!!legalAcceptances[doc.id]}
                      onChange={(event) =>
                        setLegalAcceptances((current) => ({
                          ...current,
                          [doc.id]: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">
                      I accept{' '}
                      <Link href={`/legal/${doc.slug}`} className="font-semibold text-violet-700 hover:text-violet-900">
                        {doc.title}
                      </Link>{' '}
                      (v{doc.version})
                      {doc.is_required ? ' *' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        {isSignUp && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Phone number</span>
            <div className="mt-2 flex gap-2">
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="w-28 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              >
                {countryCodes.map(({ code, label }) => (
                  <option key={`${label}-${code}`} value={code}>
                    {label} {code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                placeholder="Phone number"
                autoComplete="tel"
              />
            </div>
          </label>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Password</span>
          <div className="relative mt-2">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-950 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
              placeholder="Enter your password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 hover:bg-slate-100"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {error && (
          <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {isSignUp ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-600">
        {isSignUp ? (
          <p>
            Already have an account?{' '}
            <Link href="/sign-in" className="font-semibold text-violet-700 hover:text-violet-900">
              Sign in
            </Link>
          </p>
        ) : (
          <p>
            New to Committed?{' '}
            <Link href="/sign-up" className="font-semibold text-violet-700 hover:text-violet-900">
              Create an account
            </Link>
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="mb-3 text-sm font-medium text-slate-700">Prefer the mobile app?</p>
        <OpenAppButton target={isSignUp ? 'sign-up' : 'sign-in'} label={isSignUp ? 'Open App to Sign Up' : 'Open App to Sign In'} variant="secondary" />
      </div>
    </div>
  );
}
