'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  UNIVERSAL_DOWNLOAD_URL,
  getMobileOS,
  getStoreUrl,
} from '@/lib/appLinks';
import { openDownload, handleSignupClick } from '@/lib/deeplink';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';

type Variant = 'primary' | 'secondary';

type Props = {
  label?: string;
  variant?: Variant;
  href?: string;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
};

/** Primary CTA: Get Started / Sign Up - deep link + store fallback on mobile, /sign-up on desktop */
export function GetStartedButton({ label = 'Get Started', variant = 'primary', className = '', ...rest }: Props) {
  return (
    <Link
      href="/sign-up"
      onClick={(e) => handleSignupClick(e)}
      className={`btn-glow inline-flex min-h-[56px] items-center justify-center rounded-2xl px-10 py-4 text-lg font-semibold transition-all ${
        variant === 'primary'
          ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:shadow-xl'
          : 'border-2 border-violet-300 bg-white/90 text-violet-700 shadow-[var(--shadow-soft)] backdrop-blur-sm hover:border-violet-400 hover:bg-white'
      } ${className}`}
      {...rest}
    >
      {label}
    </Link>
  );
}

/** Secondary CTA: Download App - desktop: QR modal; mobile: deep link then store fallback after ~900ms */
export function DownloadButton({
  label = 'Download App',
  variant = 'secondary',
  showQROnDesktop = true,
  className = '',
}: Props & { showQROnDesktop?: boolean }) {
  const [qrOpen, setQrOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (typeof window === 'undefined') return;
      const os = getMobileOS();
      if (os === 'ios' || os === 'android') {
        e.preventDefault();
        openDownload();
      } else if (showQROnDesktop) {
        e.preventDefault();
        setQrOpen(true);
      }
    },
    [showQROnDesktop]
  );

  const href = typeof window !== 'undefined' && getMobileOS() ? getStoreUrl() : '/download';

  return (
    <>
      <Link
        href={href}
        onClick={handleClick}
        className={`inline-flex min-h-[56px] items-center justify-center rounded-2xl px-10 py-4 text-lg font-semibold transition-all ${
          variant === 'primary'
            ? 'btn-glow bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 text-white shadow-lg shadow-violet-500/30'
            : 'border-2 border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/60'
        } ${className}`}
      >
        {label}
      </Link>

      {qrOpen && (
        <QRModal
          onClose={() => setQrOpen(false)}
          downloadUrl={UNIVERSAL_DOWNLOAD_URL}
          appStore={APP_STORE_URL}
          playStore={PLAY_STORE_URL}
        />
      )}
    </>
  );
}

function QRModal({
  onClose,
  downloadUrl,
  appStore,
  playStore,
}: {
  onClose: () => void;
  downloadUrl: string;
  appStore: string;
  playStore: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(downloadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [downloadUrl]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="qr-modal-title" className="font-display text-xl font-bold text-slate-900">
          Scan to download
        </h2>
        <p className="mt-1 text-sm text-slate-600">Point your phone camera at the QR code</p>
        <div className="mt-6 flex justify-center rounded-xl bg-white p-4 ring-1 ring-slate-200/80">
          <QRCodeSVG value={downloadUrl} size={160} level="M" />
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <div className="mt-6 flex gap-4">
          {appStore !== '#' && (
            <a
              href={appStore}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              App Store
            </a>
          )}
          {playStore !== '#' && (
            <a
              href={playStore}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Google Play
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
