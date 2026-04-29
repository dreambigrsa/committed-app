import Link from 'next/link';
import { CalendarHeart, Heart, MessageCircle, Newspaper, Settings, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const modules = [
  { href: '/app/dating', icon: Heart, title: 'Dating', body: 'Discover, likes, matches, filters, and dating profiles.' },
  { href: '/app/relationship', icon: ShieldCheck, title: 'Relationships', body: 'Register, verify, search, and protect relationships.' },
  { href: '/app/messages', icon: MessageCircle, title: 'Messages', body: 'Chats, support prompts, and Committed AI assistance.' },
  { href: '/app/feed', icon: Newspaper, title: 'Feed and reels', body: 'Posts, reels, comments, shares, status, and boosted ads.' },
  { href: '/app/professionals', icon: CalendarHeart, title: 'Professionals', body: 'Bookings, sessions, professional profiles, and reviews.' },
  { href: '/app/admin', icon: Users, title: 'Admin', body: 'Approvals, verifications, reports, users, payments, and safety controls.' },
  { href: '/app/settings', icon: Settings, title: 'Settings', body: 'Profile, privacy, account, sessions, security, and subscriptions.' },
  { href: '/auth', icon: Sparkles, title: 'Start here', body: 'Sign in or create an account on web.' },
];

export default function WebAppHomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-20 md:px-10 md:pt-28">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-[0_30px_100px_-50px_rgba(0,0,0,0.9)] backdrop-blur md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-200">Committed Web App</p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-tight md:text-6xl">
            The browser version of Committed starts here.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            This route keeps the same website deployment and gives us a clean home for bringing the mobile app
            experience to web module by module.
          </p>
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
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
