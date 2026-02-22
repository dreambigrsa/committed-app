'use client';

import Link from 'next/link';
import { Download, QrCode } from 'lucide-react';
import { APP_SCHEME, PLAY_STORE_URL, APP_STORE_URL } from '@/lib/appLinks';
import { QRCodeSVG } from 'qrcode.react';

type Props = {
  deepLinkUrl: string;
  title?: string;
  description?: string;
};

/** Shared fallback UI when deep link doesn't open the app: Open button, QR, store links */
export default function OpenAppFallback({
  deepLinkUrl,
  title = 'Open in app',
  description,
}: Props) {
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const defaultDesc = isMobile
    ? "Tap the button below to open the app, or download it if you don't have it yet."
    : 'On your phone, scan the QR code or use the download links.';

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
      <h1 className="font-display text-xl font-bold text-slate-900 text-center">{title}</h1>
      <p className="mt-2 text-center text-slate-600">{description ?? defaultDesc}</p>
      <div className="mt-6 flex justify-center">
        <a
          href={deepLinkUrl}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700"
        >
          Open Committed
        </a>
      </div>
      <div className="mt-8 flex flex-col items-center gap-4 rounded-xl bg-slate-50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <QrCode className="h-4 w-4" />
          Scan to open
        </p>
        <QRCodeSVG value={deepLinkUrl} size={160} level="M" />
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
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
      <p className="mt-4 text-center">
        <Link href="/download" className="text-sm text-primary-600 hover:underline">
          Full download page
        </Link>
      </p>
    </div>
  );
}
