'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { deepLinks } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';

const FALLBACK_DELAY_MS = 1200;

function DatingProfileBridge() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const [showFallback, setShowFallback] = useState(false);

  const deepLinkUrl = useMemo(() => {
    if (!userId) return '';
    return deepLinks.datingProfile(userId);
  }, [userId]);

  useEffect(() => {
    if (!deepLinkUrl) {
      setShowFallback(true);
      return;
    }

    window.location.href = deepLinkUrl;
    const timer = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [deepLinkUrl]);

  if (!userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">Profile not found</h1>
          <p className="mt-2 text-slate-600">This dating profile link appears to be invalid.</p>
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
          <p className="text-lg text-slate-600">Opening dating profile in Committed...</p>
          <p className="mt-2 text-sm text-slate-500">If the app doesn&apos;t open, use the options below.</p>
        </div>
      ) : (
        <OpenAppFallback
          deepLinkUrl={deepLinkUrl}
          title="View dating profile in app"
          description="Tap below to open this profile in Committed, or download the app if you don't have it yet."
        />
      )}
    </div>
  );
}

export default function DatingProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
          <p className="text-lg text-slate-600">Opening dating profile in Committed...</p>
        </div>
      }
    >
      <DatingProfileBridge />
    </Suspense>
  );
}
