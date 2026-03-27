'use client';

import { useScrollY } from '@/hooks/useScrollY';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export default function PhoneMockup({ children, className = '' }: Props) {
  const scrollY = useScrollY();
  const tilt = Math.min(scrollY * 0.008, 6);

  return (
    <div
      className={`relative mx-auto w-full max-w-[280px] ${className}`}
      style={{
        transform: `perspective(800px) rotateX(${tilt}deg)`,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Layered shadow under device */}
      <div
        className="absolute -bottom-8 left-1/2 h-24 w-[85%] -translate-x-1/2 rounded-full blur-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          boxShadow: '0 50px 80px -20px rgba(100, 80, 200, 0.3)',
        }}
      />
      <div className="absolute -bottom-6 left-1/2 h-16 w-[90%] -translate-x-1/2 rounded-full bg-slate-900/15 blur-xl" />

      {/* Phone frame */}
      <div className="relative rounded-[2.5rem] border-[3px] border-slate-300 bg-slate-100 p-2 shadow-[var(--shadow-device),0_0_0_1px_rgba(0,0,0,0.05)]">
        {/* Soft glare highlight on top edge */}
        <div
          className="absolute left-4 right-4 top-2 h-px rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
          style={{ boxShadow: '0 1px 2px rgba(255,255,255,0.3)' }}
        />
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-b-xl bg-slate-900 px-12 py-1.5" />
        {/* Screen - inner shadow */}
        <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem] bg-slate-900 shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)]">
          {children}
        </div>
      </div>
    </div>
  );
}
