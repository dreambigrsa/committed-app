'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Smartphone } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/env';
import { APP_SCHEME } from '@/lib/appLinks';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [triedOpen, setTriedOpen] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
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
  }, [token]);

  const openApp = useCallback(() => {
    if (!token) return;
    setTriedOpen(true);
    window.location.href = `${APP_SCHEME}sign-in`;
  }, [token]);

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
          <p className="mt-2 text-slate-600">Your email has been verified. You can now use the app.</p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={openApp}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
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
