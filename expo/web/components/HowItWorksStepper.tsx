'use client';

import { Fingerprint, Users, Heart } from 'lucide-react';
import { AnimatedSection, StaggerContainer, StaggerItem } from '@/components/AnimatedSection';

const steps = [
  {
    icon: Fingerprint,
    title: 'Verify your identity',
    desc: 'Phone, email, and ID verification. Quick, secure, and private.',
    preview: 'verified',
  },
  {
    icon: Users,
    title: 'Connect safely',
    desc: 'See who\'s verified. Meet, message, and date with confidence.',
    preview: 'connect',
  },
  {
    icon: Heart,
    title: 'Stay supported',
    desc: 'Therapists, coaches, and Committed AI—here when you need support.',
    preview: 'support',
  },
];

function MiniPreview({ type }: { type: string }) {
  if (type === 'verified') {
    return (
      <div className="mt-4 rounded-xl border border-violet-200/80 bg-white/80 p-3 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">ID Verified</p>
            <p className="text-[10px] text-slate-500">Phone • Email • ID</p>
          </div>
        </div>
      </div>
    );
  }
  if (type === 'connect') {
    return (
      <div className="mt-4 rounded-xl border border-violet-200/80 bg-white/80 p-3 shadow-[var(--shadow-soft)]">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-200 to-fuchsia-200" />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-600">Verified profiles only</p>
      </div>
    );
  }
  if (type === 'support') {
    return (
      <div className="mt-4 rounded-xl border border-violet-200/80 bg-white/80 p-3 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-fuchsia-100 flex items-center justify-center">
            <Heart className="h-4 w-4 text-fuchsia-600" fill="currentColor" />
          </div>
          <p className="text-xs font-semibold text-slate-800">24/7 support</p>
        </div>
      </div>
    );
  }
  return null;
}

export default function HowItWorksStepper() {
  return (
    <StaggerContainer className="mx-auto mt-16 max-w-3xl space-y-0 md:mt-20">
      {steps.map(({ icon: Icon, title, desc, preview }, i) => (
        <StaggerItem key={title} className="relative">
          <div className="flex gap-6 md:gap-8">
            <div className="relative flex flex-shrink-0 flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
                <Icon className="h-7 w-7" />
              </div>
              {i < steps.length - 1 && (
                <div className="absolute left-1/2 top-full hidden h-16 w-0.5 -translate-x-1/2 bg-gradient-to-b from-violet-300 to-transparent md:block" />
              )}
            </div>
            <div className="pb-16 pt-1 md:pb-20">
              <p className="font-display text-xl font-bold text-slate-900 md:text-2xl">{title}</p>
              <p className="mt-2 text-slate-600">{desc}</p>
              <MiniPreview type={preview} />
            </div>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
