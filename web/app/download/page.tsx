'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, QrCode } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OpenAppButton from '@/components/OpenAppButton';
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  UNIVERSAL_DOWNLOAD_URL,
  getMobileOS,
} from '@/lib/appLinks';
import { QRCodeSVG } from 'qrcode.react';

export default function DownloadPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    const os = getMobileOS();
    if (os === 'ios' && APP_STORE_URL && APP_STORE_URL !== '#') {
      window.location.href = APP_STORE_URL;
      return;
    }
    if (os === 'android' && PLAY_STORE_URL && PLAY_STORE_URL !== '#') {
      window.location.href = PLAY_STORE_URL;
      return;
    }
  }, [mounted]);

  const os = mounted && typeof window !== 'undefined' ? getMobileOS() : null;
  const isRedirecting = os === 'ios' || os === 'android';

  if (isRedirecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <p className="text-lg text-slate-600">Taking you to the store…</p>
        <p className="mt-2 text-sm text-slate-500">If you&apos;re not redirected, use the links below.</p>
        <div className="mt-8 flex flex-col gap-4">
          {APP_STORE_URL && APP_STORE_URL !== '#' && (
            <a
              href={APP_STORE_URL}
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Open App Store
            </a>
          )}
          {PLAY_STORE_URL && PLAY_STORE_URL !== '#' && (
            <a
              href={PLAY_STORE_URL}
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Open Google Play
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            Get Committed
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Download the app on your phone or open it if you already have it.
          </p>
        </div>

        <div className="mt-14 flex flex-col items-center gap-10">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
            <h2 className="text-center text-lg font-semibold text-slate-900">Open in app</h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              Tap below to open Committed on your device.
            </p>
            <div className="mt-6 flex justify-center">
              <OpenAppButton target="sign-in" label="Open App" showFallbackAfter={true} />
            </div>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row">
            {PLAY_STORE_URL && PLAY_STORE_URL !== '#' && (
              <Link
                href={PLAY_STORE_URL}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-lg shadow-slate-200/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Download className="h-10 w-10 text-violet-600" />
                <div>
                  <p className="font-semibold text-slate-900">Google Play</p>
                  <p className="text-sm text-slate-600">Download for Android</p>
                </div>
              </Link>
            )}
            {APP_STORE_URL && APP_STORE_URL !== '#' && (
              <Link
                href={APP_STORE_URL}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-lg shadow-slate-200/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Download className="h-10 w-10 text-violet-600" />
                <div>
                  <p className="font-semibold text-slate-900">App Store</p>
                  <p className="text-sm text-slate-600">Download for iOS</p>
                </div>
              </Link>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <h2 className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-900">
              <QrCode className="h-5 w-5" />
              Scan to open or install
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Point your phone camera at the QR code.
            </p>
            <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={UNIVERSAL_DOWNLOAD_URL} size={180} level="M" />
            </div>
          </div>

          <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="font-semibold text-slate-900">Troubleshooting</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-600">
              <li>If &quot;Open App&quot; doesn&apos;t open the app, you may need to install it first using the store links above.</li>
              <li>On iOS, you may need to allow the browser to open the app when prompted.</li>
              <li>If the QR code doesn&apos;t work, type the link from your email into your phone&apos;s browser.</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
