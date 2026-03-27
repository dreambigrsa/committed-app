'use client';

type MockupVariant = 'dashboard' | 'goals' | 'progress' | 'mobile';

const mockupContent: Record<MockupVariant, { title: string; items: string[]; accent?: string }> = {
  dashboard: {
    title: 'Your Feed',
    items: ['Recent posts', 'Relationship updates', 'Matches & messages'],
    accent: 'from-blue-500/20 to-indigo-500/20',
  },
  goals: {
    title: 'Relationships',
    items: ['Verified couples', 'Dating profiles', 'Date requests'],
    accent: 'from-emerald-500/20 to-teal-500/20',
  },
  progress: {
    title: 'Matches & Messages',
    items: ['New matches', 'Conversations', 'Date requests'],
    accent: 'from-violet-500/20 to-purple-500/20',
  },
  mobile: {
    title: 'Committed',
    items: ['Feed', 'Dating', 'Messages', 'Profile'],
    accent: 'from-primary-500/20 to-primary-600/20',
  },
};

export default function ProductMockup({ variant = 'mobile', className = '' }: { variant?: MockupVariant; className?: string }) {
  const isMobile = variant === 'mobile';
  const content = mockupContent[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/50 ${className}`}
      style={{ aspectRatio: isMobile ? '9/19' : '16/10' }}
    >
      {/* Glass header */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-white/20 bg-white/70 px-4 py-3 backdrop-blur-md">
        <div className="h-2 w-2 rounded-full bg-slate-400" />
        <span className="text-sm font-semibold text-slate-800">{content.title}</span>
        <div className="h-2 w-2 rounded-full bg-slate-400" />
      </div>

      {/* Content area */}
      <div className={`absolute inset-0 pt-12 bg-gradient-to-br ${content.accent} p-4`}>
        <div className="space-y-3">
          {content.items.map((item) => (
            <div key={item} className="rounded-lg bg-white/80 p-3 shadow-sm backdrop-blur-sm">
              <div className="h-2 w-3/4 rounded bg-slate-200" />
              <div className="mt-1 h-2 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        {/* App icon watermark */}
        <div className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg">
          <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
            <path d="M16 32L26 42L48 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
