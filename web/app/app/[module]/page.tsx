import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const moduleCopy: Record<string, { title: string; body: string; next: string[] }> = {
  dating: {
    title: 'Dating on web',
    body: 'This is where Discover, profile setup, likes, matches, filters, shared profiles, and dating messages will come into the browser experience.',
    next: ['Bring over dating auth guard', 'Add profile setup and preview', 'Add Discover cards and filters'],
  },
  relationship: {
    title: 'Relationship registry on web',
    body: 'This will host relationship registration, public search, verification status, reports, disputes, and certificates.',
    next: ['Create relationship form', 'Add public and member search', 'Add verification and report flows'],
  },
  messages: {
    title: 'Messages on web',
    body: 'This will support conversations, Committed AI, professional help suggestions, and safe messaging limits.',
    next: ['Add conversation list', 'Add chat room', 'Add AI/professional help prompts'],
  },
  feed: {
    title: 'Feed and reels on web',
    body: 'This will bring posts, reels, comments, status, shares, and promotions into the browser.',
    next: ['Add feed stream', 'Add shared CommentSheet behavior', 'Add reels viewer'],
  },
  professionals: {
    title: 'Professionals on web',
    body: 'This will support professional discovery, availability, bookings, session requests, and reviews.',
    next: ['Add professional directory', 'Add booking flow', 'Add session management'],
  },
  admin: {
    title: 'Admin on web',
    body: 'This will become the browser dashboard for users, relationships, reports, ads, payments, professionals, and safety operations.',
    next: ['Add admin layout', 'Add approval queues', 'Add fast optimistic actions'],
  },
  settings: {
    title: 'Settings on web',
    body: 'This will cover account, privacy, security, sessions, subscriptions, blocked users, and delete account flows.',
    next: ['Add account settings', 'Add privacy/security', 'Add safe delete account flow'],
  },
};

export default function WebAppModulePage({ params }: { params: { module: string } }) {
  const module = moduleCopy[params.module] ?? {
    title: 'Committed web module',
    body: 'This module is ready to be built into the browser experience.',
    next: ['Define data needs', 'Build the screen', 'Connect Supabase actions'],
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-20 md:px-10 md:py-28">
        <Link href="/app" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900">
          <ArrowLeft className="h-4 w-4" />
          Back to web app
        </Link>
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">In progress</p>
          <h1 className="mt-4 font-display text-4xl font-extrabold text-slate-950 md:text-5xl">{module.title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">{module.body}</p>
          <div className="mt-8 grid gap-3">
            {module.next.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
