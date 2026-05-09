'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const WebAuthForm = dynamic(() => import('@/components/WebAuthForm'), {
  ssr: false,
  loading: () => (
    <div className="rounded-md bg-white p-8 text-center">
      <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-600" />
      <p className="mt-4 text-sm font-semibold text-slate-600">Loading secure auth...</p>
    </div>
  ),
});

export default function WebAuthFormLoader({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return <WebAuthForm mode={mode} />;
}
