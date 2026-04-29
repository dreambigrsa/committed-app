'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Globe2, Smartphone, Workflow } from 'lucide-react';
import WebAppButton from '@/components/WebAppButton';

const phases = [
  {
    label: 'Access',
    title: 'Start on web or mobile',
    body: 'Visitors can sign up, sign in, verify email, download the app, or open shared content from the same trusted domain.',
  },
  {
    label: 'Account',
    title: 'Protected onboarding',
    body: 'Signed-in users are guided through email verification, required legal documents, and Committed AI consent before entering the product.',
  },
  {
    label: 'Product',
    title: 'Feature modules',
    body: 'Dating, relationship verification, messages, feed, reels, professionals, promotions, settings, and admin tools are organized as browser modules.',
  },
];

const webRoutes = [
  '/auth',
  '/app',
  '/app/dating',
  '/app/messages',
  '/app/relationship',
  '/app/feed',
  '/app/reels',
  '/app/professionals',
  '/app/admin',
];

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
});

export default function WebPlatformRoadmapSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  return (
    <section id="web-app" className="relative overflow-hidden bg-white py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6 md:px-10" ref={ref}>
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center"
        >
          <div>
            <motion.div
              variants={itemVariants(reduced)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              <Globe2 className="h-4 w-4 text-violet-600" />
              Same website deployment
            </motion.div>
            <motion.h2
              variants={itemVariants(reduced)}
              className="mt-5 font-display text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl"
            >
              One domain for public pages, shared links, and the web app.
            </motion.h2>
            <motion.p variants={itemVariants(reduced)} className="mt-5 text-lg leading-8 text-slate-600">
              committed.dreambig.org.za remains the public front door. It also hosts logged-in web routes,
              while existing mobile deep-link pages for posts, reels, dating profiles, downloads, referrals,
              password reset, and email verification keep working.
            </motion.p>

            <motion.div variants={itemVariants(reduced)} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <WebAppButton path="/auth" label="Open Web Entry" />
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-6 py-3 font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
              >
                <Smartphone className="h-5 w-5" />
                Keep App Download
              </Link>
            </motion.div>
          </div>

          <motion.div
            variants={itemVariants(reduced)}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_32px_90px_-42px_rgba(15,23,42,0.9)]"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                committed.dreambig.org.za
              </span>
            </div>

            <div className="mt-5 grid gap-3">
              {webRoutes.map((route) => (
                <div key={route} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                  <span className="font-mono text-sm text-slate-200">{route}</span>
                  <ArrowRight className="h-4 w-4 text-rose-300" />
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {phases.map(({ label, title, body }) => (
            <motion.article
              key={title}
              variants={itemVariants(reduced)}
              initial="hidden"
              animate={inView ? 'visible' : 'hidden'}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-violet-600 shadow-sm">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">{label}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-slate-950">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{body}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-center text-sm font-medium text-violet-900">
          <Workflow className="hidden h-5 w-5 shrink-0 sm:block" />
          The website now supports browser entry while preserving the mobile app ecosystem and shared links.
        </div>
      </div>
    </section>
  );
}
