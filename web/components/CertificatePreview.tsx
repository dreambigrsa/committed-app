'use client';

export default function CertificatePreview() {
  return (
    <div className="rounded-2xl border-2 border-violet-200/80 bg-gradient-to-b from-white to-violet-50/50 p-6 shadow-xl shadow-violet-200/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-violet-600">Relationship Certificate</p>
            <p className="font-display text-lg font-bold text-slate-800">Michael & Laura</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Registered
        </span>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">Anniversary: Mar 15</span>
      </div>
      <p className="mt-4 text-xs text-slate-500">Protected against duplicate registrations.</p>
    </div>
  );
}
