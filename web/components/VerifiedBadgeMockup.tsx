'use client';

export default function VerifiedBadgeMockup() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-xl backdrop-blur-sm md:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
          <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <p className="font-display text-lg font-bold text-slate-900">Verified</p>
          <p className="text-sm text-slate-500">Profile confirmed</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {['Phone verified', 'Email verified', 'ID verified'].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-3 w-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="text-sm text-slate-700">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
