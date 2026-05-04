'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const MobileWebAppShell = dynamic(() => import('@/components/MobileWebAppShell'), {
  ssr: false,
  loading: () => (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-6 py-16 md:px-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/60 md:p-10">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-violet-600" />
        <h1 className="mt-5 font-display text-2xl font-bold text-slate-950">Preparing your web app</h1>
        <p className="mt-2 text-slate-600">Loading your workspace.</p>
      </div>
    </main>
  ),
});

export default function MobileWebAppShellLoader({ initialTab }: { initialTab?: string }) {
  return <MobileWebAppShell initialTab={initialTab || 'home'} />;
}
