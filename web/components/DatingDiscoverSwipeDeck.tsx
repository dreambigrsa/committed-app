'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Heart, Image as ImageIcon, MapPin, Shield, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDisplayName as getUserDisplayName } from '@/lib/identity';
import { resolveProfilePictureUrl, resolveProfilePictureUrlWithSupabase } from '@/lib/profile-media-url';

const SWIPE_THRESHOLD_PX = 88;
const VELOCITY_THRESHOLD = 0.42;
const ROT_DEG_PER_PX = 0.06;

export type DatingDiscoveryCardProfile = {
  user_id: string;
  bio?: string | null;
  age?: number | null;
  location_city?: string | null;
  location_country?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  distance_km?: number;
  intention_tag?: string | null;
  religion?: string | null;
  interests?: unknown[] | null;
  users?: {
    full_name?: string | null;
    username?: string | null;
    email?: string | null;
    profile_picture?: string | null;
    id_verified?: boolean | null;
    email_verified?: boolean | null;
    phone_verified?: boolean | null;
  } | null;
  /** Expo/mobile discovery uses `user` singular — accept both. */
  user?: DatingDiscoveryCardProfile['users'];
  dating_photos?: { photo_url: string; is_primary?: boolean | null }[] | null;
  /** Same shape as native discovery `profile.photos` from `DatingService.getDatingDiscovery`. */
  photos?: { photo_url?: string | null; photoUrl?: string | null; is_primary?: boolean | null }[] | null;
};

function datingInterestLabel(interest: unknown): string {
  if (typeof interest === 'string') return interest;
  if (interest && typeof interest === 'object' && 'name' in (interest as object)) {
    return String((interest as { name?: string }).name || '').trim();
  }
  return '';
}

function cardInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

type DatingDiscoveryCardFaceProps = {
  profile: DatingDiscoveryCardProfile;
  supabase: SupabaseClient | null;
};

export function DatingDiscoveryCardFace({ profile, supabase }: DatingDiscoveryCardFaceProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    setPhotoIndex(0);
  }, [profile.user_id]);

  const mergeDiscoveryPhotos = (): { photo_url: string; is_primary?: boolean | null }[] => {
    const out: { photo_url: string; is_primary?: boolean | null }[] = [];
    const seen = new Set<string>();
    const add = (url: unknown, isPrimary?: boolean | null) => {
      const u = String(url ?? '').trim();
      if (!u || seen.has(u)) return;
      seen.add(u);
      out.push({ photo_url: u, is_primary: isPrimary });
    };
    const dating = [...(profile.dating_photos || [])];
    dating.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
    dating.forEach((p) => add(p.photo_url, p.is_primary));
    const legacy = profile.photos;
    if (Array.isArray(legacy)) {
      legacy.forEach((p) => add(p.photo_url ?? (p as { photoUrl?: string }).photoUrl, p.is_primary));
    }
    const uPic = (profile.users ?? profile.user)?.profile_picture;
    if (uPic) add(uPic, false);
    return out;
  };
  const photoRows = mergeDiscoveryPhotos();
  const photoUrlsRaw: string[] = photoRows.map((p) => String(p.photo_url || '').trim()).filter(Boolean);

  const resolveDatingPhoto = (raw: string) => {
    const r = raw.trim();
    if (!r) return '';
    return supabase
      ? resolveProfilePictureUrlWithSupabase(supabase, r) || resolveProfilePictureUrl(r) || r
      : resolveProfilePictureUrl(r) || r;
  };

  const photoCount = photoUrlsRaw.length;
  const safeIdx = photoCount ? Math.min(photoIndex, photoCount - 1) : 0;
  const currentPhotoRaw = photoCount ? photoUrlsRaw[safeIdx] : '';
  const currentPhoto = currentPhotoRaw ? resolveDatingPhoto(String(currentPhotoRaw)) : '';

  const u = profile.users ?? profile.user ?? null;
  const name =
    getUserDisplayName(
      u ? { full_name: u.full_name, username: u.username ?? null, email: u.email ?? null } : null
    ) ||
    u?.full_name?.trim() ||
    u?.username?.trim() ||
    'Member';

  const interests = (profile.interests || []).map((x) => datingInterestLabel(x)).filter(Boolean);
  const interestChips = interests.slice(0, 4);
  const interestOverflow = interests.length > 4 ? interests.length - 4 : 0;

  const locationCity =
    profile.location_city?.trim() || String((profile as { locationCity?: string }).locationCity || '').trim();
  const locationCountry = profile.location_country?.trim();
  let locationLine = [locationCity, locationCountry].filter(Boolean).join(', ');
  if (typeof profile.distance_km === 'number' && !Number.isNaN(profile.distance_km)) {
    const km = `${Math.round(profile.distance_km)} km`;
    locationLine = locationLine ? `${locationLine} • ${km}` : km;
  }

  const phoneVerified = !!u?.phone_verified;
  const emailVerified = !!u?.email_verified;
  const idVerified = !!u?.id_verified;

  return (
    <div className="relative h-full min-h-[470px] overflow-hidden rounded-[24px] bg-slate-900 text-left shadow-2xl shadow-slate-950/30">
      {currentPhoto ? (
        <img src={currentPhoto} alt="" className="h-full min-h-[470px] w-full object-cover" />
      ) : (
        <div className="grid h-full min-h-[470px] place-items-center bg-violet-600">
          {cardInitials(name) ? (
            <span className="select-none text-8xl font-black tracking-tight text-white drop-shadow-md sm:text-9xl">{cardInitials(name)}</span>
          ) : (
            <ImageIcon className="h-16 w-16 text-white/90" aria-hidden />
          )}
        </div>
      )}

      {/* Match native `DatingSwipeCard`: bottom-half gradient + readable overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />

      {photoCount > 1 ? (
        <div className="absolute left-0 right-0 top-4 z-20 flex justify-center gap-1.5 px-4" data-swipe-ignore>
          {photoUrlsRaw.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPhotoIndex(i)}
              className={`pointer-events-auto h-1.5 rounded-full transition-all ${i === safeIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
              aria-label={`Photo ${i + 1}`}
            />
          ))}
        </div>
      ) : null}

      {photoCount > 0 ? (
        <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-sm font-bold text-white backdrop-blur-sm" data-swipe-ignore>
          <ImageIcon className="h-4 w-4" aria-hidden />
          {photoCount}
        </div>
      ) : null}

      <div className="absolute right-3 top-12 z-20 flex flex-wrap justify-end gap-1.5 sm:top-14">
        {phoneVerified ? (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-emerald-600 shadow-md" title="Phone verified">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        ) : null}
        {emailVerified ? (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-emerald-600 shadow-md" title="Email verified">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        ) : null}
        {idVerified ? (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-violet-600 shadow-md" title="ID verified">
            <Shield className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-black/40 px-4 pb-5 pt-6 text-white sm:px-[18px]">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="max-w-[85%] text-2xl font-bold leading-tight drop-shadow sm:text-[28px]">{name}</h2>
          {profile.age != null && !Number.isNaN(Number(profile.age)) ? (
            <span className="text-xl font-semibold text-white/90 sm:text-[26px]">{profile.age}</span>
          ) : null}
        </div>
        {locationLine ? (
          <p className="mt-2 flex items-center gap-1 text-sm font-medium text-white/90">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{locationLine}</span>
          </p>
        ) : null}
        {profile.bio?.trim() ? (
          <p className="mt-3 line-clamp-2 text-sm leading-snug text-white drop-shadow-sm sm:text-[15px]">{profile.bio.trim()}</p>
        ) : null}
        {interestChips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {interestChips.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/30 bg-white/25 px-3 py-1.5 text-[10px] font-semibold text-white sm:text-xs"
              >
                {tag}
              </span>
            ))}
            {interestOverflow > 0 ? (
              <span className="rounded-full border border-white/30 bg-white/25 px-3 py-1.5 text-[10px] font-semibold text-white sm:text-xs">
                +{interestOverflow}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type DatingDiscoverSwipeDeckProps = {
  profileKey: string;
  front: ReactNode;
  back: ReactNode | null;
  disabled?: boolean;
  onSwipeLeft: () => Promise<void>;
  onSwipeRight: () => Promise<void>;
  /** Fired on a light tap (no swipe), same as native `DatingSwipeCard` `onTap` → full dating profile. */
  onCardTap?: () => void;
};

export function DatingDiscoverSwipeDeck({ profileKey, front, back, disabled, onSwipeLeft, onSwipeRight, onCardTap }: DatingDiscoverSwipeDeckProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    samples: [] as { t: number; x: number }[],
  });
  const [, setTick] = useState(0);
  const flush = () => setTick((n) => n + 1);

  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    drag.current = { active: false, pointerId: -1, startX: 0, startY: 0, x: 0, y: 0, samples: [] };
    setExitDir(null);
    const el = layerRef.current;
    if (el) {
      el.style.transform = 'translate3d(0,0,0) rotate(0deg)';
      el.style.transition = '';
    }
  }, [profileKey]);

  const applyTransform = useCallback((x: number, y: number, transition: string) => {
    const el = layerRef.current;
    if (!el) return;
    const rot = Math.max(-14, Math.min(14, x * ROT_DEG_PER_PX));
    el.style.transition = transition;
    el.style.transform = `translate3d(${x}px,${y}px,0) rotate(${rot}deg)`;
  }, []);

  const likeOpacity = Math.min(Math.max(drag.current.x, 0) / SWIPE_THRESHOLD_PX, 1);
  const passOpacity = Math.min(Math.abs(Math.min(0, drag.current.x)) / SWIPE_THRESHOLD_PX, 1);

  const endDrag = useCallback(() => {
    drag.current.active = false;
    drag.current.pointerId = -1;
    drag.current.samples = [];
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || exitDir) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-swipe-ignore]')) return;
    const el = layerRef.current;
    if (!el) return;
    drag.current.active = true;
    drag.current.pointerId = e.pointerId;
    drag.current.startX = e.clientX;
    drag.current.startY = e.clientY;
    drag.current.x = 0;
    drag.current.y = 0;
    drag.current.samples = [{ t: e.timeStamp, x: e.clientX }];
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    applyTransform(0, 0, 'none');
    flush();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || drag.current.pointerId !== e.pointerId || exitDir) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    drag.current.x = dx;
    drag.current.y = dy;
    const s = drag.current.samples;
    s.push({ t: e.timeStamp, x: e.clientX });
    while (s.length > 6) s.shift();
    applyTransform(dx, dy, 'none');
    flush();
  };

  const resetCenter = () => {
    applyTransform(0, 0, 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)');
    drag.current.x = 0;
    drag.current.y = 0;
    flush();
  };

  const flyOff = (dir: 'left' | 'right', then: () => Promise<void>) => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 420;
    const targetX = dir === 'right' ? w + 120 : -(w + 120);
    setExitDir(dir);
    applyTransform(targetX, drag.current.y * 0.3, 'transform 0.22s ease-out');
    window.setTimeout(() => {
      void (async () => {
        await then();
        setExitDir(null);
        drag.current.x = 0;
        drag.current.y = 0;
        applyTransform(0, 0, 'none');
        flush();
      })();
    }, 230);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active || drag.current.pointerId !== e.pointerId || exitDir) return;
    const el = layerRef.current;
    try {
      el?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const dx = drag.current.x;
    const dy = drag.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < 12 && absDy < 12) {
      endDrag();
      resetCenter();
      onCardTap?.();
      return;
    }

    const s = drag.current.samples;
    let vx = 0;
    if (s.length >= 2) {
      const a = s[s.length - 1];
      const b = s[0];
      const dt = Math.max(1, a.t - b.t);
      vx = (a.x - b.x) / dt;
    }

    const meetsDist = absDx > SWIPE_THRESHOLD_PX;
    const meetsVel = Math.abs(vx) > VELOCITY_THRESHOLD && absDx > 24;

    if (dx > 0 && (meetsDist || meetsVel)) {
      endDrag();
      flyOff('right', onSwipeRight);
      return;
    }
    if (dx < 0 && (meetsDist || meetsVel)) {
      endDrag();
      flyOff('left', onSwipeLeft);
      return;
    }

    endDrag();
    resetCenter();
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (drag.current.pointerId !== e.pointerId) return;
    try {
      layerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    endDrag();
    resetCenter();
  };

  return (
    <div className="relative min-h-[470px] flex-1 touch-pan-y">
      {back ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 scale-[0.96] opacity-[0.92] transition-transform duration-300"
          aria-hidden
        >
          {back}
        </div>
      ) : null}

      <div className="absolute inset-0 z-10 overflow-visible rounded-[26px]">
        <div
          ref={layerRef}
          className="relative h-full min-h-[470px] w-full cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {front}

          <div
            className="pointer-events-none absolute left-6 top-[18%] z-30 -rotate-12 rounded-lg border-4 border-emerald-500 bg-amber-300 px-4 py-3 shadow-xl"
            style={{ opacity: exitDir === 'right' ? 1 : likeOpacity }}
          >
            <Heart className="mx-auto h-8 w-8 fill-white text-white" />
            <p className="text-center text-3xl font-black tracking-widest text-emerald-500">LIKE</p>
          </div>
          <div
            className="pointer-events-none absolute left-6 top-[18%] z-30 -rotate-12 rounded-lg border-4 border-white bg-rose-500 px-4 py-3 shadow-xl"
            style={{ opacity: exitDir === 'left' ? 1 : passOpacity }}
          >
            <X className="mx-auto h-8 w-8 text-white" strokeWidth={3} />
            <p className="text-center text-3xl font-black tracking-wide text-white">NOPE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
