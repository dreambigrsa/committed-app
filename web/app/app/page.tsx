import Link from 'next/link';
import {
  BadgeCheck,
  CalendarHeart,
  Heart,
  Film,
  MessageCircle,
  Megaphone,
  Newspaper,
  UserCircle2,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const modules = [
  {
    href: '/app/dating',
    icon: Heart,
    title: 'Dating',
    body: 'Set up your profile, tune preferences, open shared profiles, and continue discovery on mobile.',
  },
  {
    href: '/app/relationship',
    icon: ShieldCheck,
    title: 'Relationships',
    body: 'Register relationships, explain verification, search public records, and manage relationship trust.',
  },
  {
    href: '/app/messages',
    icon: MessageCircle,
    title: 'Messages',
    body: 'Open conversations, understand message limits, and continue chats with Committed AI support.',
  },
  {
    href: '/app/feed',
    icon: Newspaper,
    title: 'Community',
    body: 'Access posts, reels, status, comments, shares, and content links from web and mobile.',
  },
  {
    href: '/app/reels',
    icon: Film,
    title: 'Reels',
    body: 'Browse short videos, react quickly, and continue creation/editing flows on mobile.',
  },
  {
    href: '/app/profile',
    icon: UserCircle2,
    title: 'Profile',
    body: 'View and update your public profile, follower signals, and account highlights on web.',
  },
  {
    href: '/app/professionals',
    icon: CalendarHeart,
    title: 'Professionals',
    body: 'Find professional support, understand bookings, and continue session flows in the app.',
  },
  {
    href: '/app/promotions',
    icon: Megaphone,
    title: 'Promotions',
    body: 'Create ad campaigns, review boosted content, invoices, targeting, and campaign performance.',
  },
  {
    href: '/app/admin',
    icon: Users,
    title: 'Admin',
    body: 'Review users, relationships, approvals, reports, payments, ads, professionals, and safety queues.',
  },
  {
    href: '/app/settings',
    icon: Settings,
    title: 'Settings',
    body: 'Manage profile, privacy, security, sessions, subscriptions, blocked users, and account actions.',
  },
];

export default function WebAppHomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-20 md:px-10 md:pt-28">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_100px_-50px_rgba(0,0,0,0.9)] backdrop-blur md:p-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-sm font-semibold text-rose-100">
            <BadgeCheck className="h-4 w-4" />
            Committed Web App
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-tight md:text-6xl">
            Manage love, trust, support, and safety from the browser.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Use the same Committed account on web to access relationship verification, dating support,
            community features, professional help, settings, and admin operations. Mobile app deep links and
            downloads stay available for flows that are still best completed on the phone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-slate-200">
            {['Email verified access', 'Legal consent gate', 'Committed AI consent', 'Mobile links preserved'].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(({ href, icon: Icon, title, body }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-2xl border border-white/10 bg-white/[0.06] p-5 transition-all hover:-translate-y-1 hover:border-rose-300/40 hover:bg-white/[0.09]"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-600 shadow-lg">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 font-display text-xl font-bold">{title}</h2>
              <p className="mt-2 leading-7 text-slate-300">{body}</p>
              <span className="mt-5 inline-flex text-sm font-semibold text-rose-200 group-hover:text-white">
                Open module
              </span>
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
