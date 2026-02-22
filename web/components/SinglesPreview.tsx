'use client';

export default function SinglesPreview() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-slate-200/30">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100" />
        <div className="flex-1">
          <p className="font-semibold text-slate-800">Alex</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Verified
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">Single</span>
        <span className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-600">ID Verified</span>
      </div>
      <p className="mt-4 text-xs text-slate-500">See who&apos;s verified before you connect.</p>
    </div>
  );
}
