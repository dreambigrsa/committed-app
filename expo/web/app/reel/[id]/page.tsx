'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';

const FALLBACK_DELAY_MS = 1200;

export default function ReelPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const [showFallback, setShowFallback] = useState(false);

  const deepLinkUrl = `${APP_SCHEME}reel/${id}`;

  useEffect(() => {
    if (!id) {
      setShowFallback(true);
      return;
    }
    window.location.href = deepLinkUrl;
    const t = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, [id, deepLinkUrl]);

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">Reel not found</h1>
          <p className="mt-2 text-slate-600">This link appears to be invalid.</p>
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
          <p className="text-lg text-slate-600">Opening reel in Committed…</p>
          <p className="mt-2 text-sm text-slate-500">If the app doesn&apos;t open, use the options below.</p>
        </div>
      ) : (
        <OpenAppFallback
          deepLinkUrl={deepLinkUrl}
          title="Watch reel in app"
          description="Tap below to open this reel in Committed, or download the app if you don't have it yet."
        />
      )}
    </div>
  );
}
