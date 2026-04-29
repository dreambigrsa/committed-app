'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import {
  CalendarHeart,
  Heart,
  MessageCircleHeart,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import WebAppButton from '@/components/WebAppButton';
import { DownloadButton } from '@/components/DownloadCTA';

const experiences = [
  {
    icon: Heart,
    title: 'Dating that feels safer',
    body: 'Verified profiles, intentional matching, likes, matches, dates, and playful ways to start real conversations.',
    accent: 'from-rose-500 to-pink-500',
  },
  {
    icon: ShieldCheck,
    title: 'Relationship registry',
    body: 'Register, verify, search, and protect relationships with privacy controls and clear verification status.',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    icon: MessageCircleHeart,
    title: 'Messages with support',
    body: 'Chat naturally, with Committed AI and professional help available when users genuinely need it.',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Newspaper,
    title: 'Community feed',
    body: 'Posts, reels, comments, status updates, sharing, boosted promotions, and moments people can engage with.',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    icon: CalendarHeart,
    title: 'Professionals and bookings',
    body: 'Therapists, mentors, counselors, session requests, bookings, reviews, and guided support flows.',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Users,
    title: 'Admin trust controls',
    body: 'Approvals, reports, relationship verification, professionals, ads, payments, users, and safety tools.',
    accent: 'from-slate-700 to-slate-950',
  },
];

const itemVariants = (reduced: boolean | null) => ({
  hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
});

export default function ProductExperienceSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduced = useReducedMotion();

  return (
    <section id="experience" className="relative overflow-hidden bg-[#fff8fb] py-24 md:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#fff8fb_0%,#f8fbff_48%,#fff_100%)]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 md:px-10" ref={ref}>
        <motion.div
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
        >
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <motion.div
                variants={itemVariants(reduced)}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm"
              >
                <Sparkles className="h-4 w-4" />
                More than a landing page
              </motion.div>
              <motion.h2
                variants={itemVariants(reduced)}
                className="mt-5 font-display text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl"
              >
                A full trust-first relationship platform, now coming to web.
              </motion.h2>
            </div>
            <motion.p variants={itemVariants(reduced)} className="text-lg leading-8 text-slate-600">
              The website should show the real product: verified dating, relationship protection, support,
              community, professionals, and admin trust tools. Users can still download the app, but they can
              also start from the browser on the same domain.
            </motion.p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {experiences.map(({ icon: Icon, title, body, accent }) => (
              <motion.article
                key={title}
                variants={itemVariants(reduced)}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-34px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_70px_-36px_rgba(15,23,42,0.55)]"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} aria-hidden />
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-lg`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold text-slate-950">{title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{body}</p>
              </motion.article>
            ))}
          </div>

          <motion.div
            variants={itemVariants(reduced)}
            className="mt-12 flex flex-col items-center justify-between gap-5 rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_28px_80px_-36px_rgba(15,23,42,0.8)] md:flex-row md:p-8"
          >
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-rose-200">Same domain, same trust</p>
              <p className="mt-2 max-w-2xl text-lg text-slate-200">
                Keep shared links, app downloads, and deep links working while adding the browser app inside this website.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <WebAppButton path="/auth" label="Continue on Web" className="!bg-white !text-slate-950 hover:!bg-rose-50" />
              <DownloadButton
                label="Download App"
                className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/15"
              />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
