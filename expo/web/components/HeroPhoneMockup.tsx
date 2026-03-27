'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import PhoneMockup from './PhoneMockup';
import HeroVerifiedProfileScreen from './HeroVerifiedProfileScreen';

const floatingChips = [
  { label: 'ID Verified', className: '-left-6 top-[18%]' },
  { label: 'Single Verified', className: '-right-4 top-[32%]' },
  { label: 'Relationship Registered', className: '-left-8 bottom-[20%]' },
];

export default function HeroPhoneMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 15 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || reduced) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const normX = (e.clientX - centerX) / (rect.width / 2);
    const normY = (e.clientY - centerY) / (rect.height / 2);
    x.set(Math.max(-1, Math.min(1, normX)));
    y.set(Math.max(-1, Math.min(1, normY)));
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className="relative" style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={
          reduced
            ? {}
            : {
                rotateX,
                rotateY,
              }
        }
      >
      {/* Soft radial spotlight behind phone */}
      <div
        className="pointer-events-none absolute -inset-20 rounded-full opacity-60"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      {/* Device with shadow + glare */}
      <div className="relative">
        {/* Device shadow */}
        <div
          className="absolute -bottom-8 left-1/2 h-24 w-[85%] -translate-x-1/2 rounded-full bg-slate-900/30 blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <PhoneMockup className="hero-phone-frame">
            <HeroVerifiedProfileScreen />
          </PhoneMockup>
          {/* Subtle glare highlight */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-20"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.4) 0% 15%, transparent 40%, transparent 100%)',
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* Floating chips around phone - gently drifting */}
      {floatingChips.map(({ label, className }, i) => (
        <div
          key={label}
          className={`pointer-events-none absolute ${className} hidden md:block`}
          aria-hidden
        >
          <div
            className={`rounded-xl border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md ${
              i === 0 ? 'animate-drift' : i === 1 ? 'animate-drift-delayed' : 'animate-drift'
            }`}
          >
            {label}
          </div>
        </div>
      ))}
      </motion.div>
    </div>
  );
}
