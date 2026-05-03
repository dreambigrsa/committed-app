import Image from 'next/image';
import Link from 'next/link';
import { Mail, ShieldCheck } from 'lucide-react';
import { SUPPORT_EMAIL, APP_STORE_URL, PLAY_STORE_URL } from '@/lib/env';
import { APK_DOWNLOAD_URL } from '@/lib/appLinks';

const footerLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/download', label: 'Download' },
  { href: '/auth', label: 'Open app' },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
              <span className="grid h-11 w-11 place-items-center rounded-md bg-white">
                <Image src="/brand/icon.png" alt="" width={34} height={34} className="h-8 w-8" />
              </span>
              <Image src="/brand/committed-wordmark.svg" alt="Committed" width={150} height={32} className="h-8 w-auto brightness-0 invert" />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
              Verified relationships, intentional dating, public trust checks, and safer support for meaningful connections.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-slate-400">Explore</h3>
            <div className="mt-4 grid gap-3">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-sm font-bold text-slate-200 hover:text-teal-300">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase text-slate-400">Get the app</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {APP_STORE_URL && APP_STORE_URL !== '#' ? (
                <a href={APP_STORE_URL} className="rounded-md border border-white/14 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">
                  App Store
                </a>
              ) : null}
              {PLAY_STORE_URL && PLAY_STORE_URL !== '#' ? (
                <a href={PLAY_STORE_URL} className="rounded-md border border-white/14 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">
                  Google Play
                </a>
              ) : null}
              <a href={APK_DOWNLOAD_URL} className="rounded-md border border-white/14 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">
                APK
              </a>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-teal-300">
              <Mail className="h-4 w-4" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Committed. Built for trust before connection.</p>
          <p className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-300" />
            Privacy-first public records
          </p>
        </div>
      </div>
    </footer>
  );
}
