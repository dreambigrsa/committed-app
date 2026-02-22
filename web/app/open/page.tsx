'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';

const FALLBACK_DELAY_MS = 1200;

function OpenContent() {
  const searchParams = useSearchParams();
  const target = searchParams.get('target') || 'sign-in';
  const [showFallback, setShowFallback] = useState(false);

  const deepLinkUrl = `${APP_SCHEME}${target}`;

  useEffect(() => {
    window.location.href = deepLinkUrl;
    const t = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, [deepLinkUrl]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      {!showFallback ? (
        <div className="text-center">
          <p className="text-lg text-slate-600">Opening Committed…</p>
          <p className="mt-2 text-sm text-slate-500">If the app doesn&apos;t open, use the options below.</p>
        </div>
      ) : (
        <OpenAppFallback deepLinkUrl={deepLinkUrl} />
      )}
    </div>
  );
}

export default function OpenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
          <p className="text-lg text-slate-600">Loading…</p>
        </div>
      }
    >
      <OpenContent />
    </Suspense>
  );
}
