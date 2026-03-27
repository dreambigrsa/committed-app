'use client';

export default function TrustVerificationLevel() {
  const levels = [
    { label: 'Phone', done: true },
    { label: 'Email', done: true },
    { label: 'ID', done: true },
  ];
  return (
    <div className="mt-8 rounded-2xl border border-violet-200/60 bg-white/60 p-6 shadow-[var(--shadow-soft)] backdrop-blur-sm md:mt-12">
      <p className="text-center text-sm font-medium text-slate-600">Verification levels</p>
      <div className="mt-4 flex justify-center gap-6">
        {levels.map(({ label, done }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? (
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="text-xs font-bold">{label.charAt(0)}</span>
              )}
            </div>
            <span className="text-xs font-medium text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
