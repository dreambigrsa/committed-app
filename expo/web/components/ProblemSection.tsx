'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { HeartCrack, Search, UserX, Lock, HelpCircle } from 'lucide-react';

const problemChips = [
  { label: 'Fake profiles', icon: UserX },
  { label: 'Hidden relationships', icon: Lock },
  { label: 'Emotional uncertainty', icon: HelpCircle },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
});

export default function ProblemSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  return (
    <section
      id="problem"
      className="relative overflow-hidden py-24 md:py-32"
      style={{
        background: 'linear-gradient(180deg, rgba(250, 245, 255, 0.98) 0%, rgba(250, 249, 255, 1) 50%, rgba(253, 244, 255, 0.95) 100%)',
      }}
    >
      {/* Subtle gradient haze behind text */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.2), transparent 70%)',
        }}
        aria-hidden
      />

      <div ref={ref} className="relative mx-auto max-w-6xl px-6 text-center md:px-10">
        <div className="mx-auto max-w-3xl">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={reduced ? { hidden: {}, visible: {} } : containerVariants}
          className="flex flex-col items-center"
        >
          {/* 1. Label: THE PROBLEM */}
          <motion.div
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500/80"
          >
            <HeartCrack className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>The Problem</span>
          </motion.div>

          {/* 2. Headline with emphasis on "trust" */}
          <motion.h2
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
          >
            Dating lost{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 bg-clip-text text-transparent">
                trust
              </span>
              <span
                className="absolute -bottom-1 left-0 right-0 h-0.5"
                style={{
                  background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.6), rgba(236, 72, 153, 0.6))',
                }}
              />
            </span>
            .
          </motion.h2>

          {/* 3. Problem chips */}
          <motion.div
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-8 flex flex-wrap justify-center gap-2.5 sm:gap-3"
          >
            {problemChips.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-violet-200/80 hover:bg-white/95"
              >
                <Icon className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
                {label}
              </span>
            ))}
          </motion.div>

          {/* 4. Humor line */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-6 flex items-center justify-center gap-2 text-base font-normal text-slate-500 sm:text-[15px]"
          >
            <Search className="h-4 w-4 text-slate-400" strokeWidth={1.5} />
            No more relationship detective work.
          </motion.p>

          {/* 5. Bridge line to next section */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-8 max-w-xl text-lg font-medium tracking-tight text-violet-700/90 md:text-xl"
          >
            Committed makes trust visible — before you connect.
          </motion.p>
        </motion.div>
        </div>
      </div>

      {/* Thin gradient divider at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.15), transparent)',
        }}
        aria-hidden
      />
    </section>
  );
}
