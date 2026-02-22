'use client';

import Image from 'next/image';
import { stockImages } from '@/lib/stock-images';

/** Real app UI for hero phone: verified profile with photo, badges, buttons, community row */
export default function HeroVerifiedProfileScreen() {
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Status bar */}
      <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-medium text-slate-800">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <span>●●●</span>
          <span>100%</span>
        </div>
      </div>

      {/* Profile header */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="relative -mx-2 mt-2 aspect-[4/3] overflow-hidden rounded-2xl">
          <Image
            src={stockImages.profilePortrait}
            alt="Profile"
            fill
            className="object-cover"
            sizes="280px"
          />
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            <div>
              <h2 className="font-bold text-white text-shadow drop-shadow-lg">Alex, 28</h2>
              <p className="text-xs text-white/90 drop-shadow">Cape Town</p>
            </div>
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
              Single – Verified
            </span>
          </div>
        </div>

        {/* ID Verified badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            ID Verified
          </span>
        </div>

        {/* Message / Follow buttons */}
        <div className="mt-3 flex gap-2">
          <button type="button" className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-semibold text-white">
            Message
          </button>
          <button type="button" className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-700">
            Follow
          </button>
        </div>

        {/* Community row */}
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Community</p>
        <div className="mt-2 flex gap-2">
          {[stockImages.communityThumb1, stockImages.communityThumb2, stockImages.communityThumb3].map((src, i) => (
            <div key={i} className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl">
              <Image src={src} alt="" fill className="object-cover" sizes="56px" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-around border-t border-slate-100 bg-slate-50/80 px-2 py-2.5">
        {['Feed', 'Dating', 'Chat', 'Me'].map((label) => (
          <span
            key={label}
            className={`text-[10px] font-medium ${label === 'Dating' ? 'text-violet-600' : 'text-slate-400'}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
