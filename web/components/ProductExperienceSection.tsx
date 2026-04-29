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
    title: 'Dating with intention',
    body: 'Create a dating profile, set preferences, discover people, react with likes or stars, match when the interest is mutual, and continue the conversation safely.',
    accent: 'from-rose-500 to-pink-500',
  },
  {
    icon: ShieldCheck,
    title: 'Relationship verification',
    body: 'Register a relationship, invite or name a partner, choose privacy, upload verification details, and let trusted review flows confirm the relationship.',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    icon: MessageCircleHeart,
    title: 'Messaging and support',
    body: 'Message matches and connections, receive thoughtful Committed AI support prompts, and get guided access to professionals when deeper help is needed.',
    accent: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: Newspaper,
    title: 'Community, posts, and reels',
    body: 'Share posts, reels, comments, statuses, and promoted content so members can learn, connect, celebrate, and support one another.',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    icon: CalendarHeart,
    title: 'Professionals and bookings',
    body: 'Find therapists, mentors, counselors, and relationship professionals, then request sessions, manage availability, reviews, and bookings.',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    icon: Users,
    title: 'Admin trust operations',
    body: 'Review users, relationships, reports, professional requests, ads, payments, moderation queues, and safety decisions from one operational system.',
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
                Built for real relationship trust
              </motion.div>
              <motion.h2
                variants={itemVariants(reduced)}
                className="mt-5 font-display text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl"
              >
                One platform for dating, verification, support, and community.
              </motion.h2>
            </div>
            <motion.p variants={itemVariants(reduced)} className="text-lg leading-8 text-slate-600">
              Committed helps people meet intentionally, verify relationship status, protect public trust,
              get relationship support, and use the same shared links across web and mobile.
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
                Use Committed in the browser or continue in the mobile app. Shared posts, reels, dating profiles,
                downloads, and verification links stay on committed.dreambig.org.za.
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
