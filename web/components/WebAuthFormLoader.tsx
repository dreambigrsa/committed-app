'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const WebAuthForm = dynamic(() => import('@/components/WebAuthForm'), {
  ssr: false,
  loading: () => (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/50">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
      <p className="mt-4 text-sm font-semibold text-slate-600">Loading secure auth...</p>
    </div>
  ),
});

export default function WebAuthFormLoader({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <WebAuthForm mode={mode} />;
}
