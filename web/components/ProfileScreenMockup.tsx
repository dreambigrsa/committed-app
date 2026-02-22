'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';

const profileImage = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=500&fit=crop';
const postThumbnails = [
  'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1529636798458-92182e662485?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=200&h=200&fit=crop',
];

const fadeUp = { opacity: 0, y: 8 };
const fadeUpReady = { opacity: 1, y: 0 };
const transition = { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] };

export default function ProfileScreenMockup() {
  const reduced = useReducedMotion();

  return (
    <div className="flex h-full flex-col bg-[#f8fafc]">
      {/* Status bar with live pulse */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] font-medium text-slate-500">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <motion.span
            className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            animate={reduced ? {} : { boxShadow: ['0 0 0 0 rgba(16, 185, 129, 0.4)', '0 0 0 6px rgba(16, 185, 129, 0)'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          <span className="h-1.5 w-4 rounded-sm bg-slate-400" />
          <span className="h-1.5 w-3 rounded-sm bg-slate-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pt-2">
        {/* Cover / avatar area */}
        <motion.div
          className="relative -mx-1 -mt-1 overflow-hidden rounded-2xl bg-gradient-to-b from-violet-100 to-fuchsia-50"
          initial={reduced ? false : fadeUp}
          animate={fadeUpReady}
          transition={{ ...transition, delay: 0.05 }}
        >
          <div className="relative aspect-[4/3]">
            <Image
              src={profileImage}
              alt="Profile"
              fill
              className="object-cover"
              sizes="(max-width: 320px) 280px, 300px"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border-2 border-white shadow-lg ring-2 ring-white/50">
                <Image
                  src={profileImage}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white drop-shadow-md">Alex, 28</h2>
                <p className="text-xs text-white/90 drop-shadow">Cape Town</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Single – Verified
                </span>
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          className="mt-4 flex gap-2"
          initial={reduced ? false : fadeUp}
          animate={fadeUpReady}
          transition={{ ...transition, delay: 0.15 }}
        >
          <button type="button" className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm">
            Message
          </button>
          <button type="button" className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700">
            Follow
          </button>
        </motion.div>

        {/* Mini stats */}
        <motion.div
          className="mt-4 flex justify-around rounded-xl border border-slate-200/80 bg-white/80 py-3"
          initial={reduced ? false : fadeUp}
          animate={fadeUpReady}
          transition={{ ...transition, delay: 0.25 }}
        >
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">24</p>
            <p className="text-[10px] text-slate-500">Posts</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">156</p>
            <p className="text-[10px] text-slate-500">Followers</p>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">89</p>
            <p className="text-[10px] text-slate-500">Following</p>
          </div>
        </motion.div>

        {/* Post thumbnails */}
        <motion.p
          className="mt-4 text-xs font-semibold text-slate-500 uppercase tracking-wider"
          initial={reduced ? false : fadeUp}
          animate={fadeUpReady}
          transition={{ ...transition, delay: 0.35 }}
        >
          Community
        </motion.p>
        <motion.div
          className="mt-2 grid grid-cols-3 gap-1.5"
          initial={reduced ? false : fadeUp}
          animate={fadeUpReady}
          transition={{ ...transition, delay: 0.4 }}
        >
          {postThumbnails.map((src, i) => (
            <motion.div
              key={i}
              className="aspect-square overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100"
              initial={reduced ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...transition, delay: 0.45 + i * 0.05 }}
            >
              <Image src={src} alt="" width={80} height={80} className="h-full w-full object-cover" />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur-sm">
        {['Feed', 'Dating', 'Chat', 'Me'].map((label, i) => (
          <span
            key={label}
            className={`text-[11px] font-medium ${i === 1 ? 'text-violet-600' : 'text-slate-400'}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
