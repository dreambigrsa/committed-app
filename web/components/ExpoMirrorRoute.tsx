import { Suspense } from 'react';
import MobileWebAppShellLoader from '@/components/MobileWebAppShellLoader';

type ExpoMirrorRouteProps = {
  initialTab?: 'home' | 'feed' | 'reels' | 'dating' | 'search' | 'notifications' | 'messages' | 'profile';
};

export default function ExpoMirrorRoute({ initialTab = 'home' }: ExpoMirrorRouteProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-600">
          Loading Committed...
        </div>
      }
    >
      <MobileWebAppShellLoader initialTab={initialTab} />
    </Suspense>
  );
}
