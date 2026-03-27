'use client';

export default function AppScreenMockup() {
  const coupleFeatures = [
    'Digital relationship certificate',
    'Anniversary reminders',
    'Protection against duplicate registrations',
  ];
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-slate-50">
      <div className="flex-1 overflow-y-auto p-4 pt-14">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-violet-500">Verified Couple</p>
          <h2 className="mt-1 text-lg font-bold text-slate-800">Michael & Laura</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">For anniversary and relationship reminders</p>
          <div className="mt-2 space-y-2">
            {coupleFeatures.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </span>
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-around border-t border-slate-200 bg-white/90 p-3 backdrop-blur-sm">
        {['Feed', 'Dating', 'Chat', 'Me'].map((label) => (
          <span key={label} className="text-xs font-medium text-slate-500">{label}</span>
        ))}
      </div>
    </div>
  );
}
