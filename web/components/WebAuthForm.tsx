'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, Loader2, Mail, UserRound } from 'lucide-react';
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

function normalizePhone(countryCode: string, rawPhone: string) {
  const trimmed = rawPhone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed.replace(/\s+/g, '');
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  return `${countryCode}${digits}`;
}

async function sendVerification(email: string, accessToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch('/api/auth/send-verification', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
  if (!res.ok || data.success === false) {
    throw new Error(
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : 'Unable to send verification email. Please try again.'
    );
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function debugAuth(label: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(label, payload);
  }
}

const WEB_REFERRAL_STORAGE_KEY = 'committed:web_referral_code';

function readPendingWebReferral(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (sessionStorage.getItem(WEB_REFERRAL_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function writePendingWebReferral(code: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(WEB_REFERRAL_STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

async function applyPendingWebReferral(supabase: { from: (t: string) => any }, userId: string) {
  const code = readPendingWebReferral();
  if (!code) return;
  const { error } = await supabase
    .from('users')
    .update({ referred_by_code: code })
    .eq('id', userId)
    .is('referred_by_code', null);
  if (!error) {
    try {
      sessionStorage.removeItem(WEB_REFERRAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
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
  const [signUpStep, setSignUpStep] = useState(1);

  const isSignUp = mode === 'sign-up';
  const title = isSignUp ? 'Create your account' : 'Welcome back';
  const subtitle = isSignUp
    ? 'Two quick steps to set up your secure web account.'
    : 'Sign in to continue your Committed experience on web.';

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (isSignUp && (!fullName.trim() || !phone.trim())) return false;
    if (isSignUp && loadingLegalDocs) return false;
    if (isSignUp) {
      const requiredDocs = legalDocs.filter((doc) => !!doc.is_required);
      const hasAllRequired = requiredDocs.every((doc) => !!legalAcceptances[doc.id]);
      if (!hasAllRequired) return false;
    }
    return true;
  }, [email, password, isSignUp, fullName, phone, legalAcceptances, legalDocs, loadingLegalDocs]);

  const canContinueSignUp = useMemo(() => {
    if (!isSignUp) return true;
    return Boolean(fullName.trim() && email.trim() && phone.trim());
  }, [email, fullName, isSignUp, phone]);

  useEffect(() => {
    if (!isSignUp || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get('ref') || params.get('referral') || '').trim();
    if (ref) writePendingWebReferral(ref);
  }, [isSignUp]);

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

  /** Best-effort only: with email confirmation there is often no session yet, so RLS can block writes. */
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

    // Same pattern as mobile auth: wait briefly for public.users row (trigger can lag).
    let userRowReady = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: userRecord } = await supabaseBrowser.from('users').select('id').eq('id', userId).maybeSingle();
      if (userRecord) {
        userRowReady = true;
        break;
      }
      await delay(500);
    }
    if (!userRowReady) return;

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
    if (isSignUp && signUpStep === 1) {
      if (!canContinueSignUp) {
        setError('Please add your name, email, and phone number to continue.');
        return;
      }
      setError('');
      setSignUpStep(2);
      return;
    }
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
        const normalizedPhone = normalizePhone(countryCode, phone);
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
          try {
            await saveSignUpLegalAcceptances(data.user.id);
          } catch (legalErr) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[WebAuthForm] Sign-up legal acceptances not saved (non-fatal):', legalErr);
            }
          }
        }

        const signedInUserId = data.session?.user?.id || data.user?.id;
        if (signedInUserId) {
          await applyPendingWebReferral(supabaseBrowser, signedInUserId);
        }

        await sendVerification(normalizedEmail, data.session?.access_token);
        router.replace(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      // Best-effort local clear before password sign-in. Cap wait at 2s so hung storage never blocks sign-in.
      await Promise.race([
        supabaseBrowser.auth.signOut({ scope: 'local' }).catch(() => undefined),
        delay(2000),
      ]);

      const { data, error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) throw signInError;

      debugAuth('[WebAuthForm] Authenticated user object', {
        id: data.user?.id ?? null,
        email: data.user?.email ?? null,
        signInUserId: data.user?.id ?? null,
        error: null,
      });

      if (data.user?.id) {
        await applyPendingWebReferral(supabaseBrowser, data.user.id);
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
    <div className="p-4 sm:p-7">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-teal-300 shadow-lg shadow-slate-950/10 sm:h-14 sm:w-14">
          {isSignUp ? <UserRound className="h-7 w-7" /> : <Mail className="h-7 w-7" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black tracking-normal text-slate-950 sm:text-2xl">{title}</h1>
            {isSignUp ? (
              <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-black uppercase text-teal-700 ring-1 ring-teal-100">
                2 min setup
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{subtitle}</p>
        </div>
      </div>

      {isSignUp ? (
        <div className="mt-7 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {[
            { step: 1, label: 'Your details' },
            { step: 2, label: 'Secure account' },
          ].map(({ step, label }) => (
            <div
              key={step}
              className={`rounded-md px-3 py-3 transition ${
                signUpStep === step ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`grid h-6 w-6 place-items-center rounded-md text-xs font-black ${signUpStep === step ? 'bg-teal-500 text-slate-950' : 'bg-white text-slate-500'}`}>
                  {step}
                </span>
                <span className="text-[10px] font-black uppercase sm:text-xs">{label}</span>
              </div>
              <div className={`mt-3 h-1.5 rounded-full ${step <= signUpStep ? 'bg-teal-500' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>
      ) : null}

      {isSignUp ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-900">
            {signUpStep === 1 ? 'Tell us how to identify you.' : 'Protect the account and confirm the essentials.'}
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {signUpStep === 1
              ? 'Use the same details you want connected to relationship and dating trust signals.'
              : 'Your password secures web access. Legal confirmations keep the trust system explicit.'}
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {isSignUp && signUpStep === 1 && (
          <label className="block">
            <span className="text-sm font-black text-slate-800">Full name</span>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </label>
        )}

        {(!isSignUp || signUpStep === 1) && (
          <label className="block">
            <span className="text-sm font-black text-slate-800">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
        )}

        {isSignUp && signUpStep === 1 && (
          <label className="block">
            <span className="text-sm font-black text-slate-800">Phone number</span>
            <div className="mt-2 flex gap-2">
              <select
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-800 shadow-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
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
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder="Phone number"
                autoComplete="tel"
              />
            </div>
          </label>
        )}

        {(!isSignUp || signUpStep === 2) && (
          <label className="block">
            <span className="text-sm font-black text-slate-800">Password</span>
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder="Enter your password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 hover:bg-slate-100"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
        )}

        {isSignUp && signUpStep === 2 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-900">Legal confirmations</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Accept each required document to finish sign-up.</p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-teal-700 ring-1 ring-slate-200">
                {legalDocs.filter((doc) => legalAcceptances[doc.id]).length}/{legalDocs.length || 0}
              </span>
            </div>
            {loadingLegalDocs ? (
              <p className="mt-3 text-sm text-slate-500">Loading documents...</p>
            ) : legalDocs.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No signup legal documents found.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {legalDocs.map((doc) => (
                  <label key={doc.id} className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-300">
                    <input
                      type="checkbox"
                      checked={!!legalAcceptances[doc.id]}
                      onChange={(event) =>
                        setLegalAcceptances((current) => ({
                          ...current,
                          [doc.id]: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 accent-teal-500"
                    />
                    <span className="text-sm font-semibold leading-5 text-slate-700">
                      I accept{' '}
                      <Link href={`/legal/${doc.slug}`} className="font-black text-teal-700 hover:text-teal-900">
                        {doc.title}
                      </Link>
                      <span className="text-slate-400"> (v{doc.version})</span>
                      {doc.is_required ? <span className="font-black text-rose-500"> *</span> : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        <div className={`grid gap-3 ${isSignUp && signUpStep === 2 ? 'sm:grid-cols-[0.45fr_0.55fr]' : ''}`}>
          {isSignUp && signUpStep === 2 ? (
            <button
              type="button"
              onClick={() => {
                setError('');
                setSignUpStep(1);
              }}
              className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-md border border-slate-200 px-5 font-black text-slate-700 transition hover:border-teal-300 hover:bg-teal-50"
            >
              <ChevronLeft className="h-5 w-5" />
              Back
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSignUp && signUpStep === 1 ? !canContinueSignUp : !canSubmit || loading}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-md bg-teal-500 px-6 py-3 font-black text-slate-950 shadow-lg shadow-teal-950/10 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {isSignUp && signUpStep === 1 ? (
              <>
                Continue
                <ArrowRight className="h-5 w-5" />
              </>
            ) : isSignUp ? (
              'Create account'
            ) : (
              'Sign in'
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-sm text-slate-600">
        {isSignUp ? (
          <p>
            Already have an account?{' '}
            <Link href="/sign-in" className="font-semibold text-teal-700 hover:text-teal-900">
              Sign in
            </Link>
          </p>
        ) : (
          <p>
            New to Committed?{' '}
            <Link href="/sign-up" className="font-semibold text-teal-700 hover:text-teal-900">
              Create an account
            </Link>
          </p>
        )}
      </div>

      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="mb-3 text-sm font-medium text-slate-700">Prefer the mobile app?</p>
        <OpenAppButton target={isSignUp ? 'sign-up' : 'sign-in'} label={isSignUp ? 'Open App to Sign Up' : 'Open App to Sign In'} variant="secondary" />
      </div>
    </div>
  );
}
