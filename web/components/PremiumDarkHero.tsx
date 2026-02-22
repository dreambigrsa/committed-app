'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Shield, Heart, ShieldCheck } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { GetStartedButton, DownloadButton } from '@/components/DownloadCTA';
import ProfileScreenMockup from '@/components/ProfileScreenMockup';

const TILT_Y_MAX = 16;
const TILT_X_MAX = 10;

/** Mouse + gyroscope 3D tilt for phone - 360° immersive feel */
function usePhoneTilt() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springConfig = { damping: 28, stiffness: 180 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  // Tilt-reactive shadow offset (shadow follows "light source")
  const shadowX = useTransform(springRotateY, [-TILT_Y_MAX, TILT_Y_MAX], [18, -18]);
  const shadowY = useTransform(springRotateX, [-TILT_X_MAX, TILT_X_MAX], [-12, 12]);
  const shadowBlur = useTransform(springRotateX, [-TILT_X_MAX, 0, TILT_X_MAX], [70, 95, 70]);
  const shadowFilter = useTransform(shadowBlur, (v) => `blur(${v}px)`);
  const shadowFilterSoft = useTransform(shadowBlur, (v) => `blur(${v * 0.6}px)`);

  const setTilt = useCallback(
    (x: number, y: number) => {
      rotateX.set(Math.max(-TILT_X_MAX, Math.min(TILT_X_MAX, x)));
      rotateY.set(Math.max(-TILT_Y_MAX, Math.min(TILT_Y_MAX, y)));
    },
    [rotateX, rotateY]
  );

  useEffect(() => {
    if (reduced) return;

    const el = ref.current;
    if (!el) return;

    let rafId: number | null = null;
    let pending = false;

    // Desktop: mouse tracking (throttled via rAF)
    const handleMove = (e: MouseEvent) => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(() => {
        pending = false;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const x = (e.clientX - centerX) / (rect.width / 2);
        const y = (e.clientY - centerY) / (rect.height / 2);
        setTilt(-y * TILT_X_MAX, x * TILT_Y_MAX);
      });
    };

    const handleLeave = () => setTilt(0, 0);

    // Mobile: gyroscope (throttled via rAF)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(() => {
        pending = false;
        const beta = e.beta ?? 0;
        const gamma = e.gamma ?? 0;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobile) return;
        const y = Math.max(-TILT_X_MAX, Math.min(TILT_X_MAX, (beta - 45) * 0.5));
        const x = Math.max(-TILT_Y_MAX, Math.min(TILT_Y_MAX, gamma * 0.8));
        setTilt(y, x);
      });
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('deviceorientation', handleOrientation);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [reduced, setTilt]);

  return {
    ref,
    style: { rotateX: springRotateX, rotateY: springRotateY },
    shadowStyle: { x: shadowX, y: shadowY, filter: shadowFilter, filterSoft: shadowFilterSoft },
    rotateX: springRotateX,
    rotateY: springRotateY,
  };
}

/** Inner content parallax - subtle depth when phone tilts */
function useScreenParallax(rotateX: ReturnType<typeof useSpring>, rotateY: ReturnType<typeof useSpring>) {
  const x = useTransform(rotateY, [-TILT_Y_MAX, TILT_Y_MAX], [8, -8]);
  const y = useTransform(rotateX, [-TILT_X_MAX, TILT_X_MAX], [-6, 6]);
  return { x, y };
}

/** Realistic phone mockup - enlarged, 3D tilt, mouse + gyro, premium */
function HeroPhoneMockup() {
  const reduced = useReducedMotion();
  const { ref, style, shadowStyle, rotateX, rotateY } = usePhoneTilt();
  const parallax = useScreenParallax(rotateX, rotateY);

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[360px] sm:max-w-[400px] lg:max-w-[460px] xl:max-w-[520px]"
      style={{ perspective: '1400px' }}
    >
      {/* Tilt-reactive ambient shadow */}
      <motion.div
        className="absolute -bottom-16 left-1/2 h-44 w-[100%] -translate-x-1/2 rounded-full"
        style={{
          x: shadowStyle.x,
          y: shadowStyle.y,
          filter: shadowStyle.filter,
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.35) 0%, rgba(236, 72, 153, 0.14) 40%, transparent 70%)',
        }}
      />
      <motion.div
        className="absolute -bottom-14 left-1/2 h-32 w-[95%] -translate-x-1/2 rounded-full bg-slate-900/50"
        style={{ x: shadowStyle.x, y: shadowStyle.y, filter: shadowStyle.filterSoft }}
      />

      {/* Phone container - 3D transform */}
      <motion.div
        className="relative origin-center"
        style={{
          rotateX: style.rotateX,
          rotateY: style.rotateY,
          transformStyle: 'preserve-3d',
        }}
      >
        <motion.div
          className="relative rounded-[2.75rem] border-[3px] border-slate-400/90 bg-gradient-to-b from-slate-100 to-slate-200 p-2.5 shadow-[0_80px_160px_-30px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.1)]"
          animate={reduced ? {} : { y: [0, -8, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Top-edge glass reflection */}
          <div
            className="absolute left-4 right-4 top-2 z-10 h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent opacity-90"
            style={{ boxShadow: '0 2px 8px rgba(255,255,255,0.5)' }}
          />
          {/* Subtle screen glow + alive feel */}
          <div className="absolute inset-2 rounded-[2.25rem] bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          <motion.div
            className="absolute inset-2 rounded-[2.25rem] pointer-events-none"
            animate={reduced ? {} : { opacity: [0.03, 0.06, 0.03] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.15), transparent 60%)' }}
          />
          {/* Notch */}
          <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-b-xl bg-slate-900 px-14 py-2" />
          {/* Screen with parallax depth */}
          <div className="relative aspect-[9/19] overflow-hidden rounded-[2.25rem] bg-slate-900 shadow-[inset_0_3px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <motion.div
              className="h-full w-full"
              style={{ x: parallax.x, y: parallax.y }}
            >
              <ProfileScreenMockup />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating glass chip: ID Verified */}
      <motion.div
        className="absolute -right-4 top-[18%] z-20 flex cursor-default items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-3 shadow-xl backdrop-blur-xl transition-shadow duration-300 hover:shadow-2xl hover:shadow-emerald-500/10"
        animate={reduced ? {} : { x: [0, 5, 0], y: [0, -5, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={reduced ? {} : { scale: 1.03, transition: { duration: 0.2 } }}
      >
        <Shield className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-semibold text-white">ID Verified</span>
      </motion.div>

      {/* Floating glass chip: Single Verified */}
      <motion.div
        className="absolute -left-4 bottom-[22%] z-20 flex cursor-default items-center gap-2 rounded-full border border-white/25 bg-white/15 px-5 py-3 shadow-xl backdrop-blur-xl transition-shadow duration-300 hover:shadow-2xl hover:shadow-rose-500/10"
        animate={reduced ? {} : { x: [0, -4, 0], y: [0, -4, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        whileHover={reduced ? {} : { scale: 1.03, transition: { duration: 0.2 } }}
      >
        <Heart className="h-5 w-5 text-rose-400" fill="currentColor" />
        <span className="text-sm font-semibold text-white">Single Verified</span>
      </motion.div>
    </div>
  );
}

/** Phone visual - glow, premium mockup */
function HeroPhoneWithHand() {
  const reduced = useReducedMotion();

  return (
    <div className="relative flex items-center justify-center py-4">
      {/* Strong glow behind phone - clearly visible halo */}
      <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
        <motion.div
          className="absolute h-[100%] w-[90%] max-w-[480px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.7) 0%, rgba(167, 139, 250, 0.5) 25%, rgba(236, 72, 153, 0.35) 50%, rgba(139, 92, 246, 0.15) 70%, transparent 85%)',
            filter: 'blur(40px)',
          }}
          animate={reduced ? {} : { opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute h-[75%] w-[65%] max-w-[360px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(196, 181, 253, 0.9) 0%, rgba(251, 113, 133, 0.6) 40%, rgba(139, 92, 246, 0.3) 65%, transparent 85%)',
            filter: 'blur(24px)',
          }}
          animate={reduced ? {} : { opacity: [0.9, 1, 0.9] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />
        <div
          className="absolute h-[55%] w-[45%] max-w-[260px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(221, 214, 254, 1) 0%, rgba(251, 207, 232, 0.8) 35%, transparent 70%)',
            filter: 'blur(16px)',
          }}
        />
      </div>

      {/* Phone mockup - on top */}
      <div className="relative z-10">
        <HeroPhoneMockup />
      </div>
    </div>
  );
}

export default function PremiumDarkHero() {
  const reduced = useReducedMotion();

  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden md:min-h-[90vh]">
      {/* Background */}
      <div className="absolute inset-0 bg-hero-dark" />
      <div className="hero-nebula-glow" aria-hidden />
      <div className="grain-overlay grain-overlay-dark" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-12 px-6 pb-20 pt-28 md:px-10 md:pb-24 lg:flex-row lg:items-center lg:gap-20 lg:pt-32">
        {/* Left: Typography */}
        <div className="order-2 flex flex-1 flex-col items-center text-center lg:order-1 lg:items-start lg:text-left">
          <motion.h1
            className="font-display text-[3rem] font-extrabold leading-[1.02] tracking-tight text-white sm:text-[3.75rem] md:text-[4.5rem] lg:text-[4.75rem] xl:text-[5.5rem]"
            initial={reduced ? {} : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            Love.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-rose-200 bg-clip-text text-transparent">
              Verified.
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-md text-lg leading-relaxed text-slate-300 sm:text-xl md:mt-8 md:text-2xl"
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Verified singles. Verified relationships. Real connection — safely.
          </motion.p>

          <motion.div
            className="mt-10 flex w-full max-w-sm flex-col gap-4 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start"
            initial={reduced ? {} : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <GetStartedButton label="Get Started" variant="primary" />
            <DownloadButton
              label="Download App"
              variant="secondary"
              className="!min-w-0 !border-white/30 !bg-white/5 !text-white hover:!border-white/50 hover:!bg-white/10"
            />
          </motion.div>

          {/* Trust chips row */}
          <motion.div
            className="mt-10 flex flex-wrap justify-center gap-3 lg:justify-start"
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            {['ID Verified', 'Single Verified', 'Anti-Duplicate'].map((label, i) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 backdrop-blur-xl"
              >
                {i === 0 && <ShieldCheck className="h-4 w-4 text-emerald-400" />}
                {i === 1 && <Heart className="h-4 w-4 text-rose-400" fill="currentColor" />}
                {i === 2 && <Shield className="h-4 w-4 text-violet-400" />}
                {label}
              </span>
            ))}
          </motion.div>

          <motion.p
            className="mt-6 text-sm text-slate-500"
            initial={reduced ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            Because love shouldn&apos;t feel risky.
          </motion.p>
        </div>

        {/* Right: Phone visual - larger, 3D */}
        <motion.div
          className="order-1 w-full flex-shrink-0 lg:order-2 lg:w-auto"
          initial={reduced ? {} : { opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <HeroPhoneWithHand />
        </motion.div>
      </div>
    </section>
  );
}
