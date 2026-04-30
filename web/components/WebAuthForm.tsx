'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Mail, UserRound } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import OpenAppButton from '@/components/OpenAppButton';

type Mode = 'sign-in' | 'sign-up';

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
  await fetch('/api/auth/send-verification', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isSignUp = mode === 'sign-up';
  const title = isSignUp ? 'Create your account' : 'Welcome back';
  const subtitle = isSignUp
    ? 'Start on web, then continue here or in the mobile app.'
    : 'Sign in to continue your Committed experience on web.';

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (isSignUp && (!fullName.trim() || !phone.trim())) return false;
    return true;
  }, [email, password, isSignUp, fullName, phone]);

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

        await sendVerification(normalizedEmail, data.session?.access_token);
        router.replace(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        return;
      }

      await supabaseBrowser.auth.signOut({ scope: 'local' });
      const { data, error: signInError } = await supabaseBrowser.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) throw signInError;

      const {
        data: { user: authenticatedUser },
        error: authenticatedUserError,
      } = await supabaseBrowser.auth.getUser();
      console.debug('[WebAuthForm] Authenticated user object', {
        id: authenticatedUser?.id ?? data.user?.id ?? null,
        email: authenticatedUser?.email ?? data.user?.email ?? null,
        signInUserId: data.user?.id ?? null,
        error: authenticatedUserError?.message ?? null,
      });

      const userId = authenticatedUser?.id || data.user?.id;
      if (userId) {
        const { data: profile } = await supabaseBrowser
          .from('profiles')
          .select('is_verified')
          .eq('id', userId)
          .maybeSingle();
        console.debug('[WebAuthForm] Profile fetch response', {
          requestedUserId: userId,
          profile,
        });

        if (profile && (profile as { is_verified?: boolean }).is_verified === false) {
          await sendVerification(normalizedEmail, data.session?.access_token);
          router.replace(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
          return;
        }
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
