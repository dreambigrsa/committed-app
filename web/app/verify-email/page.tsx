'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Smartphone, Mail, RefreshCcw } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/env';
import { APP_SCHEME } from '@/lib/appLinks';
import { getSupabaseBrowser } from '@/lib/supabase-client';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [triedOpen, setTriedOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    if (email && !token) {
      setStatus('loading');
      return;
    }
    if (!token || token.length < 16) {
      setStatus('error');
      return;
    }
    let cancelled = false;
    const base = typeof window !== 'undefined' ? window.location.origin : (SITE_URL || '').replace(/\/$/, '') || '';
    const url = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    fetch(url, { method: 'GET' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setStatus(data.ok === true ? 'success' : 'error');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => { cancelled = true; };
  }, [token, email]);

  useEffect(() => {
    if (!email || token) return;
    let cancelled = false;
    let intervalId: number | null = null;

    const checkVerified = async () => {
      try {
        const supabase = getSupabaseBrowser();
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        const activeEmail = email || currentSession?.user?.email || '';
        if (!activeEmail) {
          if (!cancelled) setStatus('error');
          return;
        }

        let authVerified = Boolean(currentSession?.user?.email_confirmed_at);
        if (!authVerified && currentSession?.refresh_token) {
          const {
            data: { session: refreshedSession },
          } = await supabase.auth.refreshSession();
          authVerified = Boolean(refreshedSession?.user?.email_confirmed_at);
        }

        const res = await fetch(`/api/auth/verification-status?email=${encodeURIComponent(activeEmail)}`, {
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as { verified?: boolean };
        if (cancelled) return;

        const verified = authVerified || data.verified === true;
        setStatus(verified ? 'success' : 'loading');
        if (!verified) return;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session?.user) {
          router.replace('/app');
        }
      } catch {
        // Keep the instruction page visible; the next poll/focus can retry.
      }
    };

    void checkVerified();
    intervalId = window.setInterval(() => void checkVerified(), 3000);
    const onFocus = () => void checkVerified();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void checkVerified();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [email, router, token]);

  const openApp = useCallback(() => {
    if (!token) return;
    setTriedOpen(true);
    window.location.href = `${APP_SCHEME}sign-in`;
  }, [token]);

  const resendVerification = useCallback(async () => {
    if (!email || resending) return;
    setResending(true);
    setResendError('');
    setResendMessage('');
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Unable to send verification email.');
      }
      setResendMessage('Verification email sent. Please check your inbox.');
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Unable to send verification email.');
    } finally {
      setResending(false);
    }
  }, [email, resending]);

  if (email && !token && status !== 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
            <Mail className="mx-auto h-16 w-16 text-violet-600" />
            <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">Check your email</h1>
            <p className="mt-2 text-slate-600">
              We sent a verification link to <span className="font-semibold text-slate-900">{email}</span>.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              After verification, keep this tab open. We will continue automatically when your email is confirmed.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={resendVerification}
                disabled={resending}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-6 py-3 font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60"
              >
                {resending ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
                Resend verification
              </button>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
              >
                Sign in on web
              </Link>
              <a
                href={`${APP_SCHEME}sign-in`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Smartphone className="h-5 w-5" />
                Open mobile app
              </a>
            </div>
            {resendMessage && <p className="mt-4 text-sm text-emerald-700">{resendMessage}</p>}
            {resendError && <p className="mt-4 text-sm text-red-600">{resendError}</p>}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (email && !token && status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-3xl border border-emerald-100 bg-white p-8 text-center shadow-xl shadow-emerald-100/50">
            <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">Email verified</h1>
            <p className="mt-2 text-slate-600">
              Your email is confirmed. You can continue into Committed now.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/app"
                className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
              >
                Continue to web app
              </Link>
              <Link href="/sign-in" className="text-sm text-slate-600 hover:text-primary-600">
                Sign in with this account
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!token || token.length < 16) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Invalid or missing link</h1>
            <p className="mt-2 text-slate-600">This verification link is invalid or has expired.</p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href={`${APP_SCHEME}sign-in`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
              >
                <Smartphone className="h-5 w-5" />
                Open App to Sign In
              </a>
              <Link href="/sign-in" className="text-sm text-slate-600 hover:text-primary-600">
                Sign in on web instead
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-600" />
            <p className="mt-4 text-slate-600">Verifying your email…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Link invalid or expired</h1>
            <p className="mt-2 text-slate-600">This verification link is no longer valid. Request a new one from the app.</p>
            <div className="mt-6 flex flex-col gap-3">
              <a
                href={`${APP_SCHEME}sign-in`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
              >
                <Smartphone className="h-5 w-5" />
                Open App to Sign In
              </a>
              <Link href="/sign-in" className="text-sm text-slate-600 hover:text-primary-600">
                Sign in on web instead
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Email verified</h1>
            <p className="mt-2 text-slate-600">Your email has been verified. You can now continue on web or use the app.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
            >
              Sign in on web
            </Link>
            <button
              type="button"
              onClick={openApp}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Smartphone className="h-5 w-5" />
              Open App
            </button>
            <Link href="/download" className="text-sm text-slate-600 hover:text-primary-600">
              Don’t have the app? Download it here
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary-600" />
              <p className="mt-4 text-slate-600">Loading…</p>
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
