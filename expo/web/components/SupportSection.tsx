'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Users, MessageCircle, GraduationCap, Sparkles } from 'lucide-react';
import { stockImages } from '@/lib/stock-images';

const supportCards = [
  {
    icon: Users,
    title: 'Therapists',
    desc: 'Verified professionals',
    status: 'Available for private sessions',
    statusType: 'available' as const,
  },
  {
    icon: MessageCircle,
    title: 'Counselors',
    desc: 'Relationship guidance',
    status: 'Responds within 24 hours',
    statusType: 'available' as const,
  },
  {
    icon: GraduationCap,
    title: 'Pastors & Coaches',
    desc: 'Spiritual & expert support',
    status: 'Scheduled sessions available',
    statusType: 'available' as const,
  },
  {
    icon: Sparkles,
    title: 'Committed AI',
    desc: '24/7 instant guidance',
    status: 'Always available (24/7)',
    statusType: 'instant' as const,
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
});

export default function SupportSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduced = useReducedMotion();

  return (
    <section
      id="support"
      className="relative overflow-hidden border-t border-slate-200/50 bg-white py-24 md:py-32"
    >
      <div ref={ref} className="relative mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={reduced ? { hidden: {}, visible: {} } : containerVariants}
        >
          {/* 2-column layout: copy + CTA | image + chips */}
          <div className="grid gap-14 lg:grid-cols-2 lg:gap-16 lg:items-center">
            {/* LEFT: Copy + CTA */}
            <div className="order-2 space-y-8 lg:order-1">
              <motion.h2
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl"
              >
                You&apos;re Not Alone.
              </motion.h2>
              <motion.p
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="text-xl text-slate-600"
              >
                You don&apos;t have to navigate this alone.
              </motion.p>
              <motion.p
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="text-lg text-slate-600"
              >
                Support that understands what you&apos;re going through.
              </motion.p>
              <motion.div
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:shadow-violet-500/35 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
                >
                  Get support today
                </Link>
                <Link
                  href="#"
                  className="text-base font-medium text-violet-600 transition-colors hover:text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2 focus:rounded"
                >
                  How support works →
                </Link>
              </motion.div>
            </div>

            {/* RIGHT: Image + floating chips */}
            <motion.div
              variants={itemVariants(reduced)}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative order-1 lg:order-2"
            >
              <div className="relative overflow-hidden rounded-2xl shadow-[0_8px_32px_-8px_rgba(139,92,246,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08)] md:rounded-[1.5rem]">
                {/* Gradient glow behind image */}
                <div
                  className="pointer-events-none absolute -inset-4 opacity-60"
                  style={{
                    background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(236, 72, 153, 0.08), rgba(139, 92, 246, 0.06), transparent 70%)',
                  }}
                  aria-hidden
                />
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl md:rounded-[1.5rem]">
                  <Image
                    src={stockImages.supportMoment}
                    alt="Warm, supportive moment — professional care when you need it"
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, 600px"
                    priority={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                {/* Floating chips */}
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                    Confidential
                  </span>
                  <span className="rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                    Verified Professionals
                  </span>
                </div>
                <div className="absolute bottom-4 right-4">
                  <span className="rounded-full border border-white/40 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                    Human Support
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Support option cards */}
          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
            {supportCards.map(({ icon: Icon, title, desc, status, statusType }) => (
              <motion.div
                key={title}
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="group flex h-full flex-col rounded-2xl border border-slate-200/60 bg-gradient-to-b from-white to-slate-50/30 p-7 shadow-[0_4px_20px_-6px_rgba(139,92,246,0.06),0_2px_8px_-4px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-fuchsia-200/60 hover:shadow-[0_8px_28px_-8px_rgba(236,72,153,0.1),0_4px_12px_-4px_rgba(0,0,0,0.05)] md:rounded-[1.25rem] md:p-8"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-100/90 to-rose-100/90 shadow-[0_0_16px_-4px_rgba(236,72,153,0.15)] transition-shadow duration-200 group-hover:shadow-[0_0_20px_-4px_rgba(236,72,153,0.25)] md:h-16 md:w-16">
                  <Icon className="h-7 w-7 text-fuchsia-600 md:h-8 md:w-8" strokeWidth={1.75} />
                </div>
                <h3 className="mt-6 font-display text-lg font-bold text-slate-900 md:text-xl">{title}</h3>
                <p className="mt-1.5 text-slate-600">{desc}</p>
                <div className="mt-4 flex items-center gap-2">
                  {statusType === 'instant' ? (
                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                  ) : (
                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  )}
                  <span className="text-sm font-medium text-slate-600">{status}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Emotional footer line */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-16 text-center text-base italic text-slate-600/90 md:mt-20"
          >
            Support designed around real people — not algorithms.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
