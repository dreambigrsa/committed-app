'use client';

import { BadgeCheck, ShieldCheck, Heart } from 'lucide-react';

const chips = [
  { icon: BadgeCheck, label: 'ID Verified' },
  { icon: ShieldCheck, label: 'Anti-Duplicate' },
  { icon: Heart, label: 'Trusted Support' },
];

export default function HeroTrustChips() {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start" aria-label="Trust features">
      {chips.map(({ icon: Icon, label }, i) => (
        <span
          key={label}
          className="animate-drift inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/80 px-4 py-2 text-sm font-medium text-violet-700 shadow-[var(--shadow-soft)] backdrop-blur-sm"
          style={{ animationDelay: `${i * 0.2}s` }}
        >
          <Icon className="h-4 w-4 text-violet-500" />
          {label}
        </span>
      ))}
    </div>
  );
}
