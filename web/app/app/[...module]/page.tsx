import MobileWebAppShell from '@/components/MobileWebAppShell';

export default function WebAppModulePage({ params }: { params: { module: string[] } }) {
  return <MobileWebAppShell initialTab={params.module[0] || 'home'} />;
}
