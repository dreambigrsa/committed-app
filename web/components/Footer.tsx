import Link from 'next/link';
import Image from 'next/image';
import { SUPPORT_EMAIL, APP_STORE_URL, PLAY_STORE_URL } from '@/lib/env';

export default function Footer() {
  return (
    <footer
      className="border-t border-slate-200/60 py-12 md:py-14"
      style={{
        background: 'linear-gradient(180deg, rgba(250, 245, 255, 0.98) 0%, rgba(250, 249, 255, 1) 50%, rgba(253, 244, 255, 0.95) 100%)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-flex">
              <Image
                src="/brand/logo.png"
                alt="Committed"
                width={130}
                height={32}
                className="h-7 w-auto"
              />
            </Link>
            <p className="max-w-xs text-sm text-slate-600">
              Verified relationships. Real connections.
            </p>
            <div className="flex gap-3">
              {APP_STORE_URL && APP_STORE_URL !== '#' && (
                <a
                  href={APP_STORE_URL}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-violet-200 hover:bg-violet-50"
                >
                  App Store
                </a>
              )}
              {PLAY_STORE_URL && PLAY_STORE_URL !== '#' && (
                <a
                  href={PLAY_STORE_URL}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-violet-200 hover:bg-violet-50"
                >
                  Google Play
                </a>
              )}
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-4" aria-label="Footer navigation">
            <Link href="/privacy" className="text-sm text-slate-600 transition hover:text-violet-600">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-slate-600 transition hover:text-violet-600">
              Terms
            </Link>
            <Link href="/download" className="text-sm text-slate-600 transition hover:text-violet-600">
              Safety
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-slate-600 transition hover:text-violet-600">
              Support
            </a>
            <Link href="/download" className="text-sm text-slate-600 transition hover:text-violet-600">
              Contact
            </Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-slate-200/80 pt-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Committed. Verified relationships, real connections.
        </p>
      </div>
    </footer>
  );
}
