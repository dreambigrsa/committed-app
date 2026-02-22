import Link from 'next/link';
import Image from 'next/image';
import { SUPPORT_EMAIL, APP_STORE_URL, PLAY_STORE_URL } from '@/lib/env';
import { APK_DOWNLOAD_URL } from '@/lib/appLinks';

export default function Footer() {
  return (
    <footer
      className="border-t border-slate-200/80 py-14 md:py-16"
      style={{
        background: 'linear-gradient(180deg, rgba(250, 245, 255, 0.98) 0%, rgba(250, 249, 255, 1) 50%, rgba(253, 244, 255, 0.95) 100%)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-20">
          {/* Left: Brand + nav */}
          <div>
            <Link href="/" className="inline-flex transition-opacity hover:opacity-90">
              <Image
                src="/brand/logo.png"
                alt="Committed"
                width={180}
                height={45}
                className="h-12 w-auto md:h-11"
              />
            </Link>
            <p className="mt-3 text-base text-slate-600">
              Verified relationships. Real connections.
            </p>
            <nav
              className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-200/60 pt-6"
              aria-label="Footer navigation"
            >
              <Link
                href="/privacy"
                className="text-base font-medium text-slate-600 transition hover:text-violet-600"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-base font-medium text-slate-600 transition hover:text-violet-600"
              >
                Terms
              </Link>
              <Link
                href="/download"
                className="text-base font-medium text-slate-600 transition hover:text-violet-600"
              >
                Safety
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-base font-medium text-slate-600 transition hover:text-violet-600"
              >
                Support
              </a>
              <Link
                href="/download"
                className="text-base font-medium text-slate-600 transition hover:text-violet-600"
              >
                Contact
              </Link>
            </nav>
          </div>

          {/* Right: Get the app + Need help */}
          <div className="flex flex-col gap-8 md:items-end md:text-right">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Get the app
              </h3>
              <div className="mt-4 flex flex-wrap gap-3 md:justify-end">
                {APP_STORE_URL && APP_STORE_URL !== '#' && (
                  <a
                    href={APP_STORE_URL}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/80 hover:text-violet-700"
                  >
                    App Store
                  </a>
                )}
                {PLAY_STORE_URL && PLAY_STORE_URL !== '#' && (
                  <a
                    href={PLAY_STORE_URL}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/80 hover:text-violet-700"
                  >
                    Google Play
                  </a>
                )}
                <a
                  href={APK_DOWNLOAD_URL}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/80 hover:text-violet-700"
                >
                  Direct APK
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Need help?
              </h3>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-2 inline-block text-base font-medium text-violet-600 transition hover:text-violet-700"
              >
                {SUPPORT_EMAIL}
              </a>
              <p className="mt-1 text-sm text-slate-500">
                We&apos;re here for you.
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <p className="mt-14 border-t border-slate-200/80 pt-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Committed. Verified relationships, real connections.
        </p>
      </div>
    </footer>
  );
}
