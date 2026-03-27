'use client';

import { useState, useCallback } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { APP_SCHEME, APP_STORE_URL, PLAY_STORE_URL } from '@/lib/appLinks';
import Link from 'next/link';

const FALLBACK_DELAY_MS = 1200;

type OpenAppButtonProps = {
  target?: string; // e.g. 'sign-in', 'sign-up', 'verify-email', 'reset-password'
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  showFallbackAfter?: boolean;
};

export default function OpenAppButton({
  target = 'sign-in',
  label = 'Open App',
  className = '',
  variant = 'primary',
  showFallbackAfter = true,
}: OpenAppButtonProps) {
  const [showFallback, setShowFallback] = useState(false);

  const handleClick = useCallback(() => {
    const url = `${APP_SCHEME}${target}`;
    if (typeof window === 'undefined') return;
    window.location.href = url;
    if (showFallbackAfter) {
      setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    }
  }, [target, showFallbackAfter]);

  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={handleClick}
        className={`${base} ${variants[variant]} ${className}`}
        aria-label={label}
      >
        <Smartphone className="h-5 w-5" />
        {label}
      </button>
      {showFallback && (
        <div className="animate-fade-in mt-2 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">App not installed? Download below:</p>
          <div className="flex gap-3">
            {PLAY_STORE_URL && PLAY_STORE_URL !== '#' && (
              <Link
                href={PLAY_STORE_URL}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Android
              </Link>
            )}
            {APP_STORE_URL && APP_STORE_URL !== '#' && (
              <Link
                href={APP_STORE_URL}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                iOS
              </Link>
            )}
          </div>
          <Link href="/download" className="text-sm text-primary-600 hover:underline">
            View download page
          </Link>
        </div>
      )}
    </div>
  );
}
