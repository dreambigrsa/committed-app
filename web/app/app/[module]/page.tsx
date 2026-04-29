import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarHeart,
  Film,
  Heart,
  MessageCircle,
  Megaphone,
  Newspaper,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  UserCircle2,
  Users,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OpenAppButton from '@/components/OpenAppButton';

const WebModulePanels = dynamic(() => import('@/components/WebModulePanels'), {
  loading: () => (
    <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 md:p-8">
      <div className="h-6 w-52 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 grid gap-3">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </section>
  ),
});

type ModuleAction = {
  label: string;
  href: string;
  primary?: boolean;
};

type ModuleCopy = {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Heart;
  highlights: string[];
  actions: ModuleAction[];
  mobileTarget: string;
};

const modules: Record<string, ModuleCopy> = {
  dating: {
    eyebrow: 'Dating',
    title: 'Meet people with clearer intent and safer context.',
    body: 'Dating on Committed is built around profile quality, preferences, likes, matches, conversation starters, and shared profile links. The browser keeps account access and shared profiles available, while high-touch discovery actions can continue in the mobile app.',
    icon: Heart,
    highlights: [
      'Dating profile setup and preview',
      'Preferences for gender, age, height, location, interests, intention, faith, lifestyle, and verification signals',
      'Shared dating profile links that open on web or mobile',
      'Likes, stars, matches, and conversation starters in the mobile dating flow',
    ],
    actions: [
      { label: 'Open dating home', href: '/app/dating', primary: true },
      { label: 'View shared profile route', href: '/dating/user-profile' },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'dating',
  },
  relationship: {
    eyebrow: 'Relationship registry',
    title: 'Register, verify, search, and protect relationships.',
    body: 'Committed relationship records support privacy choices, partner details, verification evidence, moderator/admin review, reports, disputes, and public search for records that are verified and visible.',
    icon: ShieldCheck,
    highlights: [
      'Relationship type, start date, privacy, partner name, invite path, and safety explanation',
      'Verified relationships remain searchable unless an admin ends or removes them',
      'User reports create review signals; they do not hide verified records by themselves',
      'Admin and moderator review flows control verification, rejection, ending, and deletion',
    ],
    actions: [
      { label: 'Search public relationships', href: '/#public-search', primary: true },
      { label: 'Open relationship module', href: '/app/relationship' },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'relationship/register',
  },
  messages: {
    eyebrow: 'Messages',
    title: 'Conversations with better support and safer limits.',
    body: 'Messaging connects dating matches, community conversations, professional help suggestions, and Committed AI support prompts. Web access explains and routes users clearly while mobile handles the richest chat experience.',
    icon: MessageCircle,
    highlights: [
      'Conversation list and direct chat continuation',
      'Committed AI consent before AI-powered support appears',
      'Professional help suggestions after meaningful repeated signals, not every declined prompt',
      'Premium or match-based limits explained before a user gets blocked',
    ],
    actions: [
      { label: 'Open messages module', href: '/app/messages', primary: true },
      { label: 'Manage AI consent', href: '/app' },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'messages',
  },
  feed: {
    eyebrow: 'Community',
    title: 'Posts, reels, comments, sharing, and status links.',
    body: 'Community content uses web-safe shared links for posts and reels, while the app provides creation, comments, status, and boosted sharing flows. Web routes keep shared content reachable from browsers.',
    icon: Newspaper,
    highlights: [
      'Shared post links at /post/[id]',
      'Shared reel links at /reel/[id]',
      'Comments, status, create post, create reel, and create status flows in mobile',
      'Promoted posts and reels connected to the advertising flow',
    ],
    actions: [
      { label: 'Open community module', href: '/app/feed', primary: true },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'feed',
  },
  reels: {
    eyebrow: 'Reels',
    title: 'Short video discovery with fast reactions and smooth loading.',
    body: 'Reels on web mirror the mobile short-video timeline with quick interactions, preview-first loading, and deep-link-safe route behavior.',
    icon: Film,
    highlights: [
      'Lazy-loaded reel cards with progressive rendering',
      'Like and comment actions from web',
      'Direct links to shared reel routes',
      'Mobile handoff for camera capture and rich editing',
    ],
    actions: [
      { label: 'Open reels module', href: '/app/reels', primary: true },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'reels',
  },
  profile: {
    eyebrow: 'Profile',
    title: 'Manage identity, visibility, and social trust from web.',
    body: 'Your web profile surfaces key account details, relationship trust context, and social activity entry points while preserving existing mobile-first flows.',
    icon: UserCircle2,
    highlights: [
      'View and update core profile details',
      'Open public profile links safely',
      'Follow/friend context through existing data',
      'Secure handoff to mobile for advanced profile actions',
    ],
    actions: [
      { label: 'Open profile module', href: '/app/profile', primary: true },
      { label: 'Open settings', href: '/app/settings' },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'profile',
  },
  professionals: {
    eyebrow: 'Professional support',
    title: 'Find help, request sessions, and manage bookings.',
    body: 'Committed supports therapists, mentors, counselors, professional profiles, availability, reviews, booking requests, and session management for users who need guided relationship help.',
    icon: CalendarHeart,
    highlights: [
      'Professional applications and admin approval',
      'Availability, booking requests, session rescheduling, and reviews',
      'Professional matching from message support signals',
      'Clear distinction between AI support and licensed professional support',
    ],
    actions: [
      { label: 'Open professionals module', href: '/app/professionals', primary: true },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'professional/bookings',
  },
  promotions: {
    eyebrow: 'Promotions',
    title: 'Promote posts, reels, and standalone campaigns.',
    body: 'The advertising system supports creative setup, targeting, call-to-action choices, invoices, payment verification, campaign status, and admin review.',
    icon: Megaphone,
    highlights: [
      'Standalone ad creation and boost-from-content entry points',
      'WhatsApp, Messenger, and website call-to-action options',
      'Invoice and payment proof review',
      'Admin advertisement management and campaign status updates',
    ],
    actions: [
      { label: 'Open promotions module', href: '/app/promotions', primary: true },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'ads/index',
  },
  admin: {
    eyebrow: 'Admin',
    title: 'Operate trust, safety, approvals, and payments.',
    body: 'Admin tools manage users, relationships, reports, disputes, professional approvals, ads, payments, legal policies, moderation, dating configuration, and verification services.',
    icon: Users,
    highlights: [
      'Relationship verification, rejection, ending, and deletion',
      'Professional applications and profile approvals',
      'Payment proofs, subscriptions, ads, reports, and disputes',
      'User roles, bans, restrictions, legal policies, and moderation queues',
    ],
    actions: [
      { label: 'Open admin module', href: '/app/admin', primary: true },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'admin',
  },
  settings: {
    eyebrow: 'Settings',
    title: 'Control account, security, privacy, and sessions.',
    body: 'Settings cover profile basics, privacy, blocked users, two-factor security, active sessions, professional availability, subscriptions, and safe account deletion.',
    icon: Settings,
    highlights: [
      'Profile and privacy controls',
      'Two-factor authentication and session management',
      'Blocked users and notification preferences',
      'Safe account deletion that signs out cleanly',
    ],
    actions: [
      { label: 'Open settings module', href: '/app/settings', primary: true },
      { label: 'Download mobile app', href: '/download' },
    ],
    mobileTarget: 'settings',
  },
};

export default function WebAppModulePage({ params }: { params: { module: string } }) {
  const module = modules[params.module] ?? modules.relationship;
  const Icon = module.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-rose-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
        <Link href="/app" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900">
          <ArrowLeft className="h-4 w-4" />
          Back to web app
        </Link>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 md:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700">
              <Icon className="h-4 w-4" />
              {module.eyebrow}
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight text-slate-950 md:text-5xl">
              {module.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">{module.body}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {module.actions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold transition-all ${
                    action.primary
                      ? 'bg-gradient-to-r from-violet-600 to-rose-500 text-white shadow-lg shadow-rose-200/60 hover:-translate-y-0.5'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                  }`}
                >
                  {action.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-7 text-white shadow-xl shadow-slate-300/40 md:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700">
                <BadgeCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-200">What this module covers</p>
                <h2 className="font-display text-2xl font-bold">Production feature map</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-3">
              {module.highlights.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <Search className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                  <span className="leading-7 text-slate-200">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-rose-300" />
                <p className="font-semibold">Continue the full mobile experience</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Mobile still has the richest native experience for camera, location, media upload, swiping, and push-driven flows.
              </p>
              <div className="mt-4">
                <OpenAppButton target={module.mobileTarget} label="Open in App" variant="secondary" />
              </div>
            </div>
          </aside>
        </section>

        <WebModulePanels module={params.module} />
      </main>
      <Footer />
    </div>
  );
}
