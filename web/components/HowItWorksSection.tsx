'use client';

import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Fingerprint, Users, Heart, Shield, Lock } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Fingerprint,
    title: 'Verify Your Identity',
    desc: 'Phone, email, and ID verification. Quick, secure, and always private.',
    badge: 'Private & Secure',
    emotion: "You're protected before anything begins.",
    gradient: 'from-violet-500/10 via-fuchsia-500/5 to-transparent',
    iconBg: 'from-violet-100 to-fuchsia-100',
    border: 'border-violet-200/40',
  },
  {
    number: '02',
    icon: Users,
    title: 'Connect Safely',
    desc: "See who's verified. Meet, message, and date with confidence.",
    badge: 'Verified',
    emotion: "You're never guessing.",
    gradient: 'from-fuchsia-500/10 via-rose-500/5 to-transparent',
    iconBg: 'from-fuchsia-100 to-rose-100',
    border: 'border-fuchsia-200/40',
  },
  {
    number: '03',
    icon: Heart,
    title: 'Stay Supported',
    desc: 'Therapists, coaches, and AI — here when you need support.',
    badge: '24/7 Support',
    emotion: "You're not alone, even after you connect.",
    gradient: 'from-rose-500/10 via-fuchsia-500/5 to-transparent',
    iconBg: 'from-rose-100 to-fuchsia-100',
    border: 'border-rose-200/40',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const cardVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 32, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
});

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
});

export default function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-t border-slate-200/40 bg-gradient-to-b from-[#faf9ff] via-[#fdf4ff] to-[#faf5ff] py-32 md:py-40"
    >
      {/* Ambient background — soft radial glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 20%, rgba(167, 139, 250, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(244, 114, 182, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(236, 72, 153, 0.04) 0%, transparent 60%)
          `,
        }}
        aria-hidden
      />

      {/* Subtle grain for premium texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div ref={ref} className="relative mx-auto max-w-7xl px-6 md:px-10">
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={reduced ? { hidden: {}, visible: {} } : containerVariants}
        >
          {/* Headline — bold, spacious */}
          <div className="text-center">
            <motion.h2
              variants={itemVariants(reduced)}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="font-display text-[2.75rem] font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl md:text-[3.5rem] lg:text-6xl"
            >
              How It{' '}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-500 bg-clip-text text-transparent">
                Works
              </span>
            </motion.h2>
            <motion.p
              variants={itemVariants(reduced)}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mt-6 text-lg text-slate-600 md:text-xl lg:text-[1.25rem]"
            >
              Built around your safety — from the very first step.
            </motion.p>
          </div>

          {/* Journey cards — 3 premium glass cards with connecting path */}
          <div className="relative mt-20 md:mt-28">
            {/* Curved connecting path — desktop only */}
            <div className="absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 md:block" aria-hidden>
              <svg viewBox="0 0 1200 120" className="w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#ec4899" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                <path
                  d="M 80 60 Q 400 20 600 60 T 1120 60"
                  fill="none"
                  stroke="url(#pathGradient)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="8 6"
                />
              </svg>
            </div>

            <div className="grid gap-8 md:grid-cols-3 md:gap-10">
              {steps.map(({ number, icon: Icon, title, desc, badge, emotion, gradient, iconBg, border }, i) => (
                <motion.article
                  key={title}
                  variants={cardVariants(reduced)}
                  transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                  whileHover={reduced ? {} : { y: -6, transition: { duration: 0.25 } }}
                  className="group relative"
                >
                  {/* Card */}
                  <div
                    className={`relative overflow-hidden rounded-3xl border ${border} bg-white/80 p-8 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.04),0_0_0_1px_rgba(255,255,255,0.6)] backdrop-blur-xl transition-all duration-300 hover:border-violet-200/60 hover:bg-white/95 hover:shadow-[0_32px_64px_-16px_rgba(139,92,246,0.18),0_16px_40px_-12px_rgba(236,72,153,0.12)] md:p-10`}
                  >
                    {/* Decorative gradient wash */}
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradient} opacity-60`}
                      aria-hidden
                    />

                    {/* Huge step number — watermark */}
                    <span
                      className="pointer-events-none absolute right-6 top-6 font-display text-[6rem] font-extrabold leading-none text-slate-100/90 md:right-8 md:top-8 md:text-[7rem]"
                      aria-hidden
                    >
                      {number}
                    </span>

                    {/* Icon — large, glowing */}
                    <div className="relative z-10">
                      <div
                        className={`inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${iconBg} shadow-[0_0_32px_-8px_rgba(139,92,246,0.25)] transition-all duration-300 group-hover:shadow-[0_0_48px_-8px_rgba(139,92,246,0.35)] md:h-24 md:w-24 md:rounded-[1.25rem]`}
                      >
                        {i === 0 && <Shield className="absolute -right-1 -top-1 h-6 w-6 text-violet-400/60" strokeWidth={1.5} />}
                        {i === 1 && <Lock className="absolute -right-1 -top-1 h-5 w-5 text-fuchsia-400/50" strokeWidth={1.5} />}
                        <Icon
                          className="relative z-10 h-10 w-10 text-violet-600 md:h-12 md:w-12"
                          strokeWidth={1.75}
                          fill={i === 2 ? 'currentColor' : 'none'}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="relative z-10 mt-8">
                      {/* Badge */}
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {badge}
                      </span>

                      <h3 className="mt-6 font-display text-2xl font-bold text-slate-900 md:text-[1.75rem]">{title}</h3>
                      <p className="mt-4 text-base leading-relaxed text-slate-600">{desc}</p>
                      <p className="mt-4 text-sm font-semibold text-violet-700/90">{emotion}</p>

                      {/* Step-specific mini preview */}
                      {i === 0 && (
                        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-violet-200/40 bg-white/90 p-4 shadow-sm">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                            <svg className="h-6 w-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">ID Verified</p>
                            <p className="text-sm text-slate-500">Phone • Email • ID</p>
                          </div>
                        </div>
                      )}
                      {i === 1 && (
                        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-fuchsia-200/40 bg-white/90 p-4 shadow-sm">
                          <div className="flex -space-x-3">
                            {[1, 2, 3].map((j) => (
                              <div
                                key={j}
                                className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-violet-200 to-fuchsia-200 ring-2 ring-emerald-400/30 shadow-sm"
                              >
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
                                  <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              </div>
                            ))}
                          </div>
                          <p className="font-medium text-slate-700">Verified profiles only</p>
                        </div>
                      )}
                      {i === 2 && (
                        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-rose-200/40 bg-white/90 p-4 shadow-sm">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100">
                            <Heart className="h-6 w-6 text-rose-600" fill="currentColor" />
                          </div>
                          <p className="font-semibold text-slate-800">24/7 support</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>

          {/* Emotional footer */}
          <motion.p
            variants={itemVariants(reduced)}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mt-24 text-center text-lg italic text-slate-600/90 md:mt-32 md:text-xl"
          >
            From verification to support — everything is designed around your safety.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
