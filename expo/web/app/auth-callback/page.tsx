'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { XCircle, Loader2, CheckCircle, Smartphone, QrCode, Download } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { SITE_URL } from '@/lib/env';
import { APP_SCHEME, getMobileOS } from '@/lib/appLinks';
import { QRCodeSVG } from 'qrcode.react';

type Status = 'loading' | 'success' | 'error' | 'no-params' | 'redirecting';

type ParsedParams = {
  type: 'verify' | 'recovery' | null;
  token: string | null;
  code: string | null;
  access_token: string | null;
};

function parseAuthParams(searchParams: URLSearchParams, hash: string): ParsedParams {
  let type = searchParams.get('type') as 'verify' | 'recovery' | null;
  let token = searchParams.get('token') || searchParams.get('access_token');
  const code = searchParams.get('code');

  if (hash) {
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    token = token || hashParams.get('access_token') || hashParams.get('token');
    const hashType = hashParams.get('type');
    if (hashType === 'signup') type = 'verify'; // Supabase confirms with type=signup; treat as verify success
    if (!type && (hashType === 'verify' || hashType === 'recovery')) type = hashType as 'verify' | 'recovery';
  }

  let access_token: string | null = null;
  if (hash) {
    const m = hash.match(/access_token=([^&]+)/);
    if (m) access_token = decodeURIComponent(m[1]);
  }

  return {
    type: type === 'verify' || type === 'recovery' ? type : null,
    token,
    code: code || null,
    access_token: access_token || searchParams.get('access_token'),
  };
}

function AuthSuccessBlock({ message, showOpenInApp = true }: { message: string; showOpenInApp?: boolean }) {
  const isMobile = getMobileOS() !== null;
  return (
    <div className="space-y-6">
      <CheckCircle className="mx-auto h-16 w-16 text-emerald-500" />
      <h1 className="font-display text-xl font-bold text-slate-900">{message}</h1>
      <p className="text-slate-600">You can now use the app to continue.</p>
      {showOpenInApp && (
        <div className="space-y-4">
          <a
            href={`${APP_SCHEME}sign-in`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
          >
            <Smartphone className="h-5 w-5" />
            Open in App
          </a>
          {!isMobile && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                <QrCode className="h-4 w-4" />
                Scan to open
              </p>
              <div className="flex justify-center">
                <QRCodeSVG value={`${APP_SCHEME}sign-in`} size={140} level="M" />
              </div>
            </div>
          )}
          <Link href="/download" className="block text-center text-sm text-slate-600 hover:text-violet-600">
            Don&apos;t have the app? Download it
          </Link>
        </div>
      )}
    </div>
  );
}

function AuthErrorBlock({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  const isMobile = getMobileOS() !== null;
  return (
    <div className="space-y-6">
      <XCircle className="mx-auto h-16 w-16 text-red-500" />
      <h1 className="font-display text-xl font-bold text-slate-900">{title}</h1>
      <p className="text-slate-600">{message}</p>
      <div className="space-y-3">
        {children}
        <a
          href={`${APP_SCHEME}sign-in`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-700"
        >
          <Smartphone className="h-5 w-5" />
          Open App
        </a>
        {!isMobile && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
              <QrCode className="h-4 w-4" />
              Scan to open
            </p>
            <div className="flex justify-center">
              <QRCodeSVG value={`${APP_SCHEME}sign-in`} size={120} level="M" />
            </div>
          </div>
        )}
        <Link href="/download" className="block text-center text-sm text-slate-600 hover:text-violet-600">
          Download the app
        </Link>
      </div>
    </div>
  );
}

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState('');
  const [resending, setResending] = useState(false);

  const runVerify = useCallback(
    async (token: string) => {
      const base = typeof window !== 'undefined' ? window.location.origin : (SITE_URL || '').replace(/\/$/, '') || '';
      const url = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      try {
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        setStatus(data.ok === true ? 'success' : 'error');
      } catch {
        setStatus('error');
      }
    },
    []
  );

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const { type, token } = parseAuthParams(searchParams, hash);

    if (!type || !token || token.length < 16) {
      setStatus('no-params');
      return;
    }

    if (type === 'recovery') {
      setStatus('redirecting');
      router.replace(`/reset-password?token=${encodeURIComponent(token)}`);
      return;
    }

    if (type === 'verify') {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const hashParams = hash ? new URLSearchParams(hash.replace(/^#/, '')) : null;
      const isSupabaseSignup = hashParams?.get('type') === 'signup' && hashParams?.get('access_token');
      if (isSupabaseSignup) {
        setStatus('success');
        return;
      }
      runVerify(token);
    }
  }, [searchParams, router, runVerify]);

  const handleResendVerification = async () => {
    if (!resendEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail)) return;
    setResending(true);
    setResendError('');
    const base = typeof window !== 'undefined' ? window.location.origin : (SITE_URL || '').replace(/\/$/, '') || '';
    try {
      const res = await fetch(`${base}/api/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success === true) {
        setResendSent(true);
      } else {
        setResendError((data as { error?: string }).error || 'Failed to send verification email.');
      }
    } catch {
      setResendError('Could not reach the server. Please try again.');
    }
    setResending(false);
  };

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-600" />
            <p className="mt-4 text-slate-600">
              {status === 'redirecting' ? 'Taking you to set your password…' : 'Verifying…'}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (status === 'no-params') {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
            <AuthErrorBlock
              title="Invalid or expired link"
              message="This link is missing information or has expired. Request a new link from the app."
            />
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
            <AuthSuccessBlock message="Email verified" />
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
            <AuthErrorBlock
              title="Link invalid or expired"
              message="This verification link is no longer valid. Request a new one below."
            >
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Resend verification email</p>
                <input
                  type="email"
                  placeholder="Your email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2"
                />
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending || !resendEmail}
                  className="mt-2 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {resending ? 'Sending…' : 'Send'}
                </button>
                {resendError && (
                  <p className="mt-2 text-sm text-red-600">{resendError}</p>
                )}
                {resendSent && !resendError && (
                  <p className="mt-2 text-sm text-slate-600">
                    If that email is registered, you&apos;ll receive a new link.
                  </p>
                )}
              </div>
            </AuthErrorBlock>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-600" />
              <p className="mt-4 text-slate-600">Loading…</p>
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
