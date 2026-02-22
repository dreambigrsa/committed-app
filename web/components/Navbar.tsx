'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#singles', label: 'Singles' },
  { href: '#couples', label: 'Couples' },
  { href: '#trust-safety', label: 'Trust & Safety' },
  { href: '#support', label: 'Support' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isDark = !scrolled;

  return (
    <header
      className={`sticky z-50 w-full transition-all duration-300 ${
        isDark
          ? 'top-0 border-b border-white/10 bg-slate-900/90 py-3 shadow-lg backdrop-blur-xl md:py-4'
          : 'top-4 left-6 right-6 mx-auto mt-4 max-w-6xl rounded-2xl border border-slate-200/60 bg-white/95 py-3 shadow-xl shadow-slate-900/5 backdrop-blur-xl md:left-10 md:right-10 md:mt-6'
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
      <nav className="flex w-full items-center justify-between py-1" aria-label="Main navigation">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 rounded-lg"
        >
          <Image
            src="/brand/logo.png"
            alt="Committed"
            width={180}
            height={45}
            className="h-11 w-auto transition-all sm:h-12 md:h-10"
            priority
          />
        </Link>

        <ul className="hidden lg:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`group relative rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isDark ? 'text-white/95 hover:text-white' : 'text-slate-600 hover:text-violet-600'
                }`}
              >
                {label}
                <span
                  className={`absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 transition-all duration-200 group-hover:w-3/4 ${
                    isDark ? 'bg-white' : 'bg-violet-500'
                  }`}
                />
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/download"
            className={`rounded-xl border-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
              isDark
                ? 'border-white/40 text-white hover:bg-white/15'
                : 'border-violet-600 text-violet-600 hover:bg-violet-50'
            }`}
          >
            Download
          </Link>
          <Link
            href="/sign-up"
            className="btn-glow rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-violet-500/35"
          >
            Sign Up
          </Link>
        </div>

        <button
          type="button"
          className={`lg:hidden rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-violet-500 ${
            isDark ? 'text-white hover:bg-white/15' : 'text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
        </button>
      </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden lg:hidden"
          >
            <div
              className={`border-t px-6 py-6 backdrop-blur-xl md:px-10 ${
                isDark ? 'border-white/20 bg-slate-900/95' : 'border-slate-200/80 bg-white/95'
              }`}
            >
              <ul className="flex flex-col gap-1">
                {navLinks.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`block rounded-xl px-4 py-3 text-base font-medium ${
                        isDark
                          ? 'text-white hover:bg-white/15 hover:text-white'
                          : 'text-slate-700 hover:bg-violet-50 hover:text-violet-700'
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-col gap-3">
                <Link
                  href="/download"
                  className={`block rounded-xl border-2 py-3 text-center font-semibold ${
                    isDark
                      ? 'border-white/40 text-white hover:bg-white/15'
                      : 'border-violet-600 text-violet-600'
                  }`}
                  onClick={() => setOpen(false)}
                >
                  Download
                </Link>
                <Link
                  href="/sign-up"
                  className="btn-glow block rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 py-3 text-center font-semibold text-white shadow-lg"
                  onClick={() => setOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
