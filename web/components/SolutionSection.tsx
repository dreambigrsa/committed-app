'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Heart, UserCheck, HandHeart } from 'lucide-react';

const solutionCards = [
  {
    icon: UserCheck,
    title: 'Verify People',
    desc: "See who's truly single — before feelings get involved.",
    badge: 'Identity Confirmed',
  },
  {
    icon: Heart,
    title: 'Verify Relationships',
    desc: 'Public commitment. Digital proof. No confusion.',
    badge: 'Status Confirmed',
  },
  {
    icon: HandHeart,
    title: 'Support When Needed',
    desc: 'Real humans. Real guidance. Real help.',
    badge: 'Real Human Support',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.06,
    },
  },
};

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
});

export default function SolutionSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-t border-slate-200/50 bg-white py-24 md:py-32">
      {/* Soft gradient glow behind center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 35%, rgba(237, 233, 254, 0.4) 0%, rgba(250, 245, 255, 0.25) 45%, transparent 75%)',
        }}
        aria-hidden
      />

      <div ref={ref} className="relative mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={reduced ? { hidden: {}, visible: {} } : containerVariants}
          className="text-center"
        >
          {/* Headline with gradient on Trust */}
          <motion.h2
            variants={itemVariants(reduced)}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="font-display text-[2.75rem] font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-[3.5rem] lg:text-6xl"
          >
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
              Trust
            </span>
            {' — before you connect.'}
          </motion.h2>

          {/* Subheading */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-6 text-lg text-slate-600 md:text-xl"
          >
            Know who you&apos;re talking to — before feelings get involved.
          </motion.p>

          {/* Trust journey cards - horizontal on desktop with connecting line, vertical on mobile */}
          <div className="mt-16 flex flex-col gap-8 md:mt-20 md:flex-row md:items-stretch md:justify-center md:gap-0">
            {solutionCards.map(({ icon: Icon, title, desc, badge }, i) => (
              <div key={title} className="flex flex-1 flex-col items-center md:flex-row md:flex-1 md:basis-0 md:gap-0">
                {i > 0 && (
                  <div
                    className="hidden shrink-0 items-center md:flex md:w-8"
                    aria-hidden
                  >
                    <div className="h-px w-full border-t border-dashed border-slate-200/80" />
                  </div>
                )}
                <motion.div
                  variants={itemVariants(reduced)}
                  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="group flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50/50 p-8 shadow-[0_4px_24px_-6px_rgba(139,92,246,0.06),0_2px_10px_-4px_rgba(0,0,0,0.04)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-200/70 hover:shadow-[0_16px_48px_-12px_rgba(139,92,246,0.12),0_6px_20px_-8px_rgba(0,0,0,0.06)] md:max-w-[320px] md:rounded-[1.5rem]"
                  whileHover={reduced ? {} : { transition: { duration: 0.2 } }}
                >
                  {/* Icon - larger with glow on hover */}
                  <div className="flex items-center justify-center">
                    <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100/90 to-fuchsia-100/90 shadow-[0_0_20px_-4px_rgba(139,92,246,0.2)] transition-all duration-300 group-hover:shadow-[0_0_28px_-4px_rgba(139,92,246,0.35)] md:h-24 md:w-24 md:rounded-[1.25rem]">
                      <Icon className="h-10 w-10 text-violet-600 transition-colors md:h-11 md:w-11" strokeWidth={1.75} />
                    </div>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 flex-1 text-base leading-relaxed text-slate-600">{desc}</p>
                  {/* Badge */}
                  <div className="mt-6 flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium text-slate-700">{badge}</span>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>

          {/* Emotional statement */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-14 text-center text-lg italic text-slate-600/95 md:mt-16"
          >
            Because trust shouldn&apos;t be a risk.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
