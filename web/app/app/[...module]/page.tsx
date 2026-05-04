import MobileWebAppShellLoader from '@/components/MobileWebAppShellLoader';

export default function WebAppModulePage({ params }: { params: { module: string[] } }) {
  return <MobileWebAppShellLoader initialTab={params.module[0] || 'home'} />;
}
