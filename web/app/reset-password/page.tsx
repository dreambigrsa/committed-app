'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, CheckCircle, XCircle, Loader2, Smartphone } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/env';
import { APP_SCHEME } from '@/lib/appLinks';

type Status = 'form' | 'loading' | 'success' | 'error' | 'no-token';

const MIN_PASSWORD_LENGTH = 6;

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('form');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!token || token.length < 16) setStatus('no-token');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || token.length < 16) {
      setStatus('no-token');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setErrorMessage('');
    setStatus('loading');
    const base = typeof window !== 'undefined' ? window.location.origin : (SITE_URL || '').replace(/\/$/, '') || '';
    try {
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok === true) setStatus('success');
      else setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) return;
    setResetting(true);
    const base = typeof window !== 'undefined' ? window.location.origin : (SITE_URL || '').replace(/\/$/, '') || '';
    try {
      await fetch(`${base}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
    } catch {
      /* ignore */
    }
    setResetSent(true);
    setResetting(false);
  };

  if (status === 'no-token') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Invalid or expired link</h1>
            <p className="mt-2 text-slate-600">This reset link is missing or no longer valid. Request a new one below.</p>
            <form onSubmit={handleRequestReset} className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-sm font-medium text-slate-700">Request new reset link</p>
              <input
                type="email"
                placeholder="Your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2"
                required
              />
              <button
                type="submit"
                disabled={resetting || !resetEmail}
                className="mt-2 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {resetting ? 'Sending…' : 'Send reset link'}
              </button>
              {resetSent && (
                <p className="mt-2 text-sm text-slate-600">If that email is registered, you&apos;ll receive a new link.</p>
              )}
            </form>
            <Link href="/sign-in" className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700">
              Go to Sign in
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Password updated</h1>
            <p className="mt-2 text-slate-600">Sign in with your new password in the app.</p>
            <a
              href={`${APP_SCHEME}sign-in`}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
            >
              <Smartphone className="h-5 w-5" />
              Open App to Sign In
            </a>
            <Link href="/download" className="mt-4 block text-sm text-slate-600 hover:text-primary-600">
              Download the app
            </Link>
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
            <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Couldn’t update password</h1>
            <p className="mt-2 text-slate-600">This link may have expired or already been used. Request a new one below.</p>
            <form onSubmit={handleRequestReset} className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-sm font-medium text-slate-700">Request new reset link</p>
              <input
                type="email"
                placeholder="Your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2"
                required
              />
              <button
                type="submit"
                disabled={resetting || !resetEmail}
                className="mt-2 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {resetting ? 'Sending…' : 'Send reset link'}
              </button>
              {resetSent && (
                <p className="mt-2 text-sm text-slate-600">If that email is registered, you&apos;ll receive a new link.</p>
              )}
            </form>
            <Link href="/sign-in" className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700">
              Go to Sign in
            </Link>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Set new password</h1>
          <p className="mt-2 text-slate-600">Enter your new password below.</p>

          {status === 'loading' ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  required
                  autoComplete="new-password"
                />
              </div>
              {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
              <button
                type="submit"
                className="w-full rounded-xl bg-primary-600 py-3 font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Update password
              </button>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
