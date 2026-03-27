'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import {
  Phone,
  Mail,
  CreditCard,
  Shield,
  Check,
  Lock,
  ShieldCheck,
  Zap,
  FileSearch,
} from 'lucide-react';

const trustBullets = [
  { icon: Shield, text: 'Every profile undergoes phone, email, and ID verification' },
  { icon: ShieldCheck, text: 'Verified profiles gain higher credibility' },
  { icon: Lock, text: 'Your ID is never shown publicly' },
];

const verificationSteps = [
  { icon: Phone, label: 'Phone verification', sub: 'OTP sent, 30 sec', done: true },
  { icon: Mail, label: 'Email verification', sub: 'Link verified', done: true },
  { icon: CreditCard, label: 'ID verification', sub: 'Reviewed in 2–5 minutes', done: true },
];

const trustTiers = [
  { name: 'Basic', desc: 'Browse + limited messaging', highlighted: false },
  { name: 'Verified', desc: 'Full messaging + meet safely', highlighted: true },
  { name: 'Pro Verified', desc: 'Featured profile · Priority matching', highlighted: false },
];

const trustProofChips = [
  { icon: Lock, label: 'Encrypted data' },
  { icon: ShieldCheck, label: 'Anti-fraud checks' },
  { icon: Zap, label: 'Fast verification' },
  { icon: FileSearch, label: 'Manual ID review' },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
});

function TrustScoreGauge({ score = 92 }: { score?: number }) {
  const reduced = useReducedMotion();
  const circumference = Math.PI * 42;
  const filled = (score / 100) * circumference;
  const needleRotation = 180 - (score / 100) * 180;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-32">
        <svg viewBox="0 0 100 60" className="h-full w-full">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path
            d="M 8 52 A 42 42 0 0 1 92 52"
            fill="none"
            stroke="rgb(226 232 240)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <motion.path
            d="M 8 52 A 42 42 0 0 1 92 52"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={reduced ? { strokeDashoffset: circumference - filled } : { strokeDashoffset: circumference }}
            whileInView={reduced ? {} : { strokeDashoffset: circumference - filled }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <g transform={`translate(50, 52) rotate(${needleRotation})`}>
            <line x1="0" y1="0" x2="0" y2="-36" stroke="rgb(100 116 139)" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-center">
          <span className="font-display text-2xl font-bold text-slate-900">{score}</span>
          <span className="text-sm text-slate-500">/100</span>
        </div>
      </div>
      <p className="mt-1 text-sm font-medium text-slate-700">Trust Score</p>
    </div>
  );
}

export default function TrustSafetySection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduced = useReducedMotion();

  return (
    <section
      id="trust-safety"
      className="relative overflow-hidden bg-gradient-to-b from-[#f5f3ff] via-[#faf9ff] to-[#eff6ff] py-24 md:py-32"
    >
      <div ref={ref} className="relative mx-auto max-w-6xl px-6 md:px-10">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={reduced ? { hidden: {}, visible: {} } : containerVariants}
        >
          {/* 1. Two-column layout */}
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-start">
            {/* LEFT */}
            <div className="space-y-8">
              <motion.h2
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl"
              >
                Trust & Safety First.
              </motion.h2>
              <motion.p
                variants={itemVariants(reduced)}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="text-xl text-slate-600"
              >
                Only verified profiles can connect and message — safely.
              </motion.p>
              <ul className="space-y-4">
                {trustBullets.map(({ icon: Icon, text }) => (
                  <motion.li
                    key={text}
                    variants={itemVariants(reduced)}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="text-slate-700">{text}</span>
                  </motion.li>
                ))}
              </ul>
              <motion.div variants={itemVariants(reduced)} transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>
                <Link
                  href="#"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 transition-colors hover:text-violet-700"
                >
                  Learn how verification works
                  <span aria-hidden>→</span>
                </Link>
              </motion.div>
            </div>

            {/* RIGHT - Verification Journey Stepper Card */}
            <motion.div
              variants={itemVariants(reduced)}
              transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-8 shadow-[0_8px_32px_-8px_rgba(139,92,246,0.12),0_4px_16px_-4px_rgba(0,0,0,0.06)] backdrop-blur-sm md:p-10"
            >
              <div
                className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-violet-200/20 blur-3xl"
                aria-hidden
              />
              <div className="relative">
                {/* Desktop: vertical stepper */}
                <div className="hidden md:block">
                  {verificationSteps.map(({ icon: Icon, label, sub, done }, i) => (
                    <div key={label} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <motion.div
                          className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md"
                          whileHover={reduced ? {} : { scale: 1.02 }}
                        >
                          <Icon className="h-5 w-5 text-violet-600" strokeWidth={2} />
                        </motion.div>
                        {i < verificationSteps.length - 1 && (
                          <div className="mt-1 h-12 w-px border-l-2 border-dashed border-slate-200" aria-hidden />
                        )}
                      </div>
                      <div className="flex-1 pb-8 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">{label}</p>
                          {done && (
                            <motion.span
                              initial={reduced ? false : { scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </motion.span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500">{sub}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-4">
                    <div className="flex w-12 shrink-0 justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                        <Shield className="h-4 w-4 text-emerald-600" />
                      </div>
                    </div>
                    <p className="pt-2 font-medium text-slate-800">Verified badge appears on profile</p>
                  </div>
                </div>
                {/* Mobile: horizontal simplified stepper */}
                <div className="flex flex-col gap-4 md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    {verificationSteps.map(({ icon: Icon, label, sub, done }) => (
                      <div key={label} className="flex flex-1 flex-col items-center gap-2">
                        <motion.div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white shadow-sm"
                          whileHover={reduced ? {} : { scale: 1.02 }}
                        >
                          <Icon className="h-5 w-5 text-violet-600" strokeWidth={2} />
                        </motion.div>
                        <p className="text-center text-xs font-semibold text-slate-800">{label.split(' ')[0]}</p>
                        <p className="text-center text-[10px] text-slate-500">{sub}</p>
                        {done && (
                          <motion.span
                            initial={reduced ? false : { scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                          >
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          </motion.span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-sm font-medium text-slate-700">Verified badge appears on profile</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 2. Trust Score Component */}
          <motion.div
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-16 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm md:mt-20 md:p-8"
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-8">
                <TrustScoreGauge score={92} />
                <div className="hidden sm:block">
                  <p className="text-lg font-semibold text-slate-900">Your verification level</p>
                  <p className="mt-1 text-sm text-slate-600">Complete all steps to message and meet safely</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                {trustTiers.map(({ name, desc, highlighted }) => (
                  <div
                    key={name}
                    className={`flex flex-col rounded-xl border px-5 py-4 transition-all duration-200 ${
                      highlighted
                        ? 'border-violet-300/80 bg-violet-50/80 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.2)]'
                        : 'border-slate-200/70 bg-white/80 hover:border-slate-300/80'
                    }`}
                  >
                    <p className={`font-semibold ${highlighted ? 'text-violet-800' : 'text-slate-800'}`}>{name}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* 3. Trust Proof Strip */}
          <motion.div
            variants={itemVariants(reduced)}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-10 flex flex-wrap justify-center gap-3 md:mt-12"
          >
            {trustProofChips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-violet-200/60 hover:shadow-[0_4px_12px_-2px_rgba(139,92,246,0.15)]"
              >
                <Icon className="h-4 w-4 text-violet-600" strokeWidth={2} />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
