import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Bell,
  Film,
  Heart,
  Home,
  MessageCircle,
  Search,
  Sparkles,
  User,
} from 'lucide-react';
import Navbar from '@/components/Navbar';

const WebModulePanels = dynamic(() => import('@/components/WebModulePanels'), {
  loading: () => (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 grid gap-3">
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </section>
  ),
});

type ModuleCopy = {
  title: string;
};

const modules: Record<string, ModuleCopy> = {
  dating: { title: 'Dating' },
  relationship: { title: 'Search' },
  messages: { title: 'Messages' },
  feed: { title: 'Feed' },
  reels: { title: 'Reels' },
  profile: { title: 'Profile' },
  professionals: { title: 'Professionals' },
  promotions: { title: 'Promotions' },
  admin: { title: 'Admin' },
  settings: { title: 'Settings' },
  notifications: { title: 'Notifications' },
};

const tabs = [
  { href: '/app/feed', label: 'Home', icon: Home },
  { href: '/app/feed', label: 'Feed', icon: Heart },
  { href: '/app/reels', label: 'Reels', icon: Film },
  { href: '/app/dating', label: 'Dating', icon: Sparkles },
  { href: '/app/relationship', label: 'Search', icon: Search },
  { href: '/app/notifications', label: 'Notify', icon: Bell },
  { href: '/app/messages', label: 'Messages', icon: MessageCircle },
  { href: '/app/profile', label: 'Profile', icon: User },
];

export default function WebAppModulePage({ params }: { params: { module: string } }) {
  const module = modules[params.module] ?? modules.feed;

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-20 md:pt-24">
        <section className="sticky top-16 z-20 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xl font-bold tracking-tight">{module.title}</p>
        </section>
        <WebModulePanels module={params.module} />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto grid max-w-5xl grid-cols-8">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = href === `/app/${params.module}` || (params.module === 'feed' && label === 'Home');
            return (
              <Link
                key={label}
                href={href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition active:scale-[0.98] ${
                  active ? 'text-violet-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
