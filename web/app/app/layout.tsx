import WebAppGate from '@/components/WebAppGate';

export default function AppAreaLayout({ children }: { children: React.ReactNode }) {
  return <WebAppGate>{children}</WebAppGate>;
}
