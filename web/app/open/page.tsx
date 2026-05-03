'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';

const FALLBACK_DELAY_MS = 1200;

function webHrefForOpenTarget(target: string): string | undefined {
  const raw = (target || 'sign-in').trim().replace(/^\//, '');
  if (!raw) return '/sign-in';
  const lower = raw.toLowerCase();
  if (lower === 'sign-in' || lower === 'signin') return '/sign-in';
  if (lower === 'sign-up' || lower === 'signup') return '/sign-up';
  if (lower === 'home' || lower === 'feed') return '/app';
  if (lower.startsWith('post/')) return `/app/${raw.split('?')[0]}`;
  if (lower.startsWith('reel/')) return `/app/${raw.split('?')[0]}`;
  return undefined;
}

function OpenContent() {
  const searchParams = useSearchParams();
  const target = searchParams.get('target') || 'sign-in';
  const [showFallback, setShowFallback] = useState(false);

  const deepLinkUrl = `${APP_SCHEME}${target}`;
  const webShellHref = webHrefForOpenTarget(target);

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
        <OpenAppFallback deepLinkUrl={deepLinkUrl} webShellHref={webShellHref} webShellLabel="Continue in browser" />
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
