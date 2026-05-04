'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';
import { buildWebAppUrl } from '@/lib/appLinks';

const publicLinks = [
  { href: '#experience', label: 'Experience' },
  { href: '#trust-safety', label: 'Trust check' },
  { href: '#singles', label: 'Singles' },
  { href: '#couples', label: 'Couples' },
  { href: '#support', label: 'Support' },
];

const appLinks = [
  { href: '/app/feed', label: 'Feed' },
  { href: '/app/reels', label: 'Reels' },
  { href: '/app/dating', label: 'Dating' },
  { href: '/app/messages', label: 'Messages' },
  { href: '/app/profile', label: 'Profile' },
];

async function getNavbarSupabaseClient() {
  const { getSupabaseBrowser } = await import('@/lib/supabase-client');
  return getSupabaseBrowser() as any;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const inApp = pathname.startsWith('/app');
  const links = inApp ? appLinks : publicLinks;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const supabase = await getNavbarSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (mounted) setIsAuthenticated(Boolean(user));
    };
    void check();
    let unsubscribe: (() => void) | undefined;
    void getNavbarSupabaseClient().then((supabase) => {
      if (!mounted) return;
      const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
        if (mounted) setIsAuthenticated(Boolean(session?.user));
      });
      unsubscribe = () => sub?.subscription?.unsubscribe?.();
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const onSignOut = async () => {
    const supabase = await getNavbarSupabaseClient();
    await supabase.auth.signOut();
    router.replace('/sign-in');
  };

  const appHref = isAuthenticated ? buildWebAppUrl('/app') : buildWebAppUrl('/auth');

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6">
      <nav
        aria-label="Main navigation"
        className={`mx-auto flex max-w-7xl items-center justify-between border px-4 py-3 backdrop-blur-2xl transition ${
          scrolled
            ? 'rounded-lg border-slate-200/80 bg-white/90 shadow-lg shadow-slate-950/10'
            : 'rounded-lg border-white/20 bg-slate-950/25 text-white shadow-lg shadow-slate-950/10'
        }`}
      >
        <Link href="/" className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white shadow-sm">
            <Image src="/brand/icon.png" alt="" width={32} height={32} className="h-8 w-8" priority />
          </span>
          <Image src="/brand/committed-wordmark.svg" alt="Committed" width={132} height={28} className={scrolled ? 'h-7 w-auto' : 'h-7 w-auto brightness-0 invert'} priority />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                scrolled ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-950' : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={appHref}
            className={`inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-black transition ${
              scrolled
                ? 'border-slate-200 bg-white text-slate-950 hover:border-teal-500'
                : 'border-white/28 bg-white/10 text-white hover:bg-white/18'
            }`}
          >
            Open app
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/download" className="inline-flex h-11 items-center rounded-md bg-teal-500 px-4 text-sm font-black text-slate-950 transition hover:bg-teal-300">
            Download
          </Link>
          {isAuthenticated ? (
            <button type="button" onClick={() => void onSignOut()} className="h-11 rounded-md px-4 text-sm font-black text-rose-500 hover:bg-rose-50">
              Sign out
            </button>
          ) : (
            <Link href="/sign-up" className="h-11 rounded-md bg-rose-500 px-4 pt-3 text-sm font-black text-white transition hover:bg-rose-400">
              Sign up
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className={`grid h-11 w-11 place-items-center rounded-md lg:hidden ${scrolled ? 'bg-slate-100 text-slate-950' : 'bg-white/12 text-white'}`}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <div className="mx-auto mt-2 max-w-7xl rounded-lg border border-slate-200 bg-white p-3 shadow-xl shadow-slate-950/10 lg:hidden">
          <div className="grid gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
            <Link href={appHref} onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-3 py-3 text-center text-sm font-black text-slate-950">
              Open app
            </Link>
            <Link href="/download" onClick={() => setOpen(false)} className="rounded-md bg-teal-500 px-3 py-3 text-center text-sm font-black text-slate-950">
              Download
            </Link>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void onSignOut();
                }}
                className="rounded-md px-3 py-3 text-sm font-black text-rose-600"
              >
                Sign out
              </button>
            ) : (
              <Link href="/sign-up" onClick={() => setOpen(false)} className="rounded-md bg-rose-500 px-3 py-3 text-center text-sm font-black text-white">
                Sign up
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
