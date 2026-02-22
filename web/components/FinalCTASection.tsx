'use client';

import Link from 'next/link';
import { handleSignupClick } from '@/lib/deeplink';
import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { DownloadButton } from '@/components/DownloadCTA';
import { Check } from 'lucide-react';

const trustItems = [
  'Verified profiles only',
  'Your data stays private',
  'Join in under 2 minutes',
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
});

export default function FinalCTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-t border-slate-200/50 bg-white py-32 md:py-44">

      <div ref={ref} className="relative mx-auto max-w-3xl px-6 text-center md:px-10">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={reduced ? { hidden: {}, visible: {} } : containerVariants}
        >
          {/* Headline — emotionally stronger */}
          <motion.h2
            variants={itemVariants(reduced)}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
          >
            You deserve to know
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 bg-clip-text text-transparent">
              who’s real.
            </span>
          </motion.h2>

          {/* Subtext — trust & verification */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-6 text-lg text-slate-600 md:text-xl md:leading-relaxed"
          >
            Verified identities. No guessing. No double lives — just real connections you can trust.
          </motion.p>

          {/* Buttons */}
          <motion.div
            variants={itemVariants(reduced)}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/sign-up"
              onClick={(e) => handleSignupClick(e)}
              className="group inline-flex min-h-[56px] min-w-[180px] items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-10 py-4 text-lg font-semibold text-white shadow-[0_0_32px_-8px_rgba(139,92,246,0.4),0_4px_24px_-4px_rgba(236,72,153,0.15)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_0_48px_-8px_rgba(139,92,246,0.5),0_8px_32px_-4px_rgba(236,72,153,0.2)] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
            >
              Sign Up — It’s Free
            </Link>
            <DownloadButton
              label="Download App"
              className="min-w-[180px] !border-violet-200/80 !bg-white/95 !text-violet-700 !shadow-sm transition-all duration-200 hover:!-translate-y-0.5 hover:!border-violet-300 hover:!bg-violet-50/80"
            />
          </motion.div>

          {/* Trust reassurance row */}
          <motion.div
            variants={itemVariants(reduced)}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4"
          >
            {trustItems.map((label) => (
              <div key={label} className="flex items-center gap-2.5 text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-medium md:text-base">{label}</span>
              </div>
            ))}
          </motion.div>

          {/* Emotional closing line */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-14 text-base italic text-slate-500/90 md:mt-16 md:text-lg"
          >
            Safe. Real. Intentional.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
