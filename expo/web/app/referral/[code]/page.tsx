'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';

const FALLBACK_DELAY_MS = 1200;

export default function ReferralPage() {
  const params = useParams();
  const code = typeof params.code === 'string' ? decodeURIComponent(params.code).trim() : '';
  const [showFallback, setShowFallback] = useState(false);

  const deepLinkUrl = `${APP_SCHEME}referral?ref=${encodeURIComponent(code)}`;

  useEffect(() => {
    if (!code) {
      setShowFallback(true);
      return;
    }
    window.location.href = deepLinkUrl;
    const t = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, [code, deepLinkUrl]);

  if (!code) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">Invalid referral link</h1>
          <p className="mt-2 text-slate-600">This link appears to be invalid or expired.</p>
          <a href="/" className="mt-6 inline-block text-primary-600 hover:underline">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      {!showFallback ? (
        <div className="text-center">
          <p className="text-lg text-slate-600">Opening Committed…</p>
          <p className="mt-2 text-sm text-slate-500">If the app doesn&apos;t open, use the options below.</p>
        </div>
      ) : (
        <OpenAppFallback
          deepLinkUrl={deepLinkUrl}
          title="Join with referral"
          description="Tap below to open Committed with this referral link, or download the app if you don't have it yet."
        />
      )}
    </div>
  );
}
