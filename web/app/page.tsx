import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import {
  ArrowRight,
  Award,
  Bell,
  Briefcase,
  CheckCircle2,
  Heart,
  Lock,
  MessageCircleHeart,
  Search,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { APK_DOWNLOAD_URL, PLAY_STORE_URL } from '@/lib/appLinks';

const PublicRelationshipSearch = nextDynamic(() => import('@/components/PublicRelationshipSearch'), { ssr: false });

export const dynamic = 'force-static';

const features = [
  {
    icon: Shield,
    title: 'Verified Relationships',
    text: 'Register your relationship, invite your partner, and complete review through partner or admin/moderator verification.',
    tag: 'Trust',
  },
  {
    icon: MessageCircleHeart,
    title: 'Committed Dating',
    text: 'Create a dating profile, discover intentional singles, match, chat, and plan real dates with trust signals built in.',
    tag: 'Love',
  },
  {
    icon: Briefcase,
    title: 'Professional Support',
    text: 'Book approved professionals and mentors when a relationship needs guidance, accountability, or deeper help.',
    tag: 'Care',
  },
  {
    icon: Bell,
    title: 'Integrity Alerts',
    text: 'If someone tries to register another relationship while already verified, alerts and review flows create accountability.',
    tag: 'Safety',
  },
  {
    icon: Lock,
    title: 'Privacy Control',
    text: 'Choose private, verified-people, or public visibility so records are protected unless you decide otherwise.',
    tag: 'Privacy',
  },
  {
    icon: Award,
    title: 'Digital Proof',
    text: 'Verified couples can show badges, certificates, and relationship status without exposing unnecessary personal details.',
    tag: 'Proof',
  },
];

const steps = [
  {
    icon: Search,
    title: 'Search or discover',
    text: 'Check public records, create a dating profile, or start by inviting your partner.',
  },
  {
    icon: Heart,
    title: 'Build the connection',
    text: 'Match, chat, register the relationship type, choose privacy, and preview before submitting.',
  },
  {
    icon: Shield,
    title: 'Verify and protect',
    text: 'Partner, admin, or moderator checks confirm the record while privacy settings control visibility.',
  },
];

export default function HomePage() {
  const downloadHref = PLAY_STORE_URL && PLAY_STORE_URL !== '#' ? PLAY_STORE_URL : APK_DOWNLOAD_URL;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Navbar />
      <main>
        <section className="bg-blue-700 text-white">
          <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-6xl gap-8 px-5 pb-12 pt-16 md:grid-cols-[1fr_380px] md:items-center md:px-8 md:pt-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-black text-blue-50 ring-1 ring-white/20">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                Build trust. Meet intentionally. Stay accountable.
              </div>
              <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight sm:text-6xl">
                Committed
              </h1>
              <p className="mt-5 max-w-2xl text-xl leading-8 text-blue-50">
                Verified relationships, trusted dating, and safer love in one app.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[18px] bg-white px-6 font-black text-blue-700 shadow-lg shadow-blue-950/20 transition hover:bg-blue-50"
                >
                  Open web app
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex min-h-14 items-center justify-center rounded-[18px] bg-blue-950/35 px-6 font-black text-white ring-1 ring-white/25 transition hover:bg-blue-950/50"
                >
                  Create account
                </Link>
                <Link
                  href={downloadHref}
                  className="inline-flex min-h-14 items-center justify-center rounded-[18px] bg-white/12 px-6 font-black text-white ring-1 ring-white/25 transition hover:bg-white/18"
                >
                  Download app
                </Link>
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-center">
                <div className="rounded-[18px] bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="text-2xl font-black">Public</p>
                  <p className="mt-1 text-xs font-bold text-blue-100">Registry checks</p>
                </div>
                <div className="rounded-[18px] bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="text-2xl font-black">Dating</p>
                  <p className="mt-1 text-xs font-bold text-blue-100">Find love</p>
                </div>
                <div className="rounded-[18px] bg-white/10 p-4 ring-1 ring-white/15">
                  <p className="text-2xl font-black">24/7</p>
                  <p className="mt-1 text-xs font-bold text-blue-100">Trust tools</p>
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[360px] rounded-[34px] bg-slate-950 p-3 shadow-2xl shadow-blue-950/40 ring-1 ring-white/20">
              <div className="overflow-hidden rounded-[28px] bg-slate-50 text-slate-950">
                <div className="bg-blue-600 p-5 text-white">
                  <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/16">
                    <Shield className="h-12 w-12" />
                    <div className="absolute -right-1 bottom-1 grid h-9 w-9 place-items-center rounded-full bg-white text-pink-500">
                      <Heart className="h-5 w-5 fill-pink-500" />
                    </div>
                  </div>
                  <h2 className="mt-5 text-center text-2xl font-black">Verify love</h2>
                  <p className="mt-2 text-center text-sm leading-6 text-blue-50">
                    Search, date, register, verify, and protect meaningful connections.
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  {[
                    ['Relationship record', 'Partner confirmation and admin review'],
                    ['Dating profile', 'Intentions, filters, matches, chat'],
                    ['Professional help', 'Approved support when needed'],
                  ].map(([title, text]) => (
                    <div key={title} className="rounded-[18px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                      <p className="font-black">{title}</p>
                      <p className="mt-1 text-sm text-slate-500">{text}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-5 border-t border-slate-200 bg-white py-3 text-center text-[10px] font-black text-slate-400">
                  <span>Home</span>
                  <span>Feed</span>
                  <span className="text-blue-600">Dating</span>
                  <span>Search</span>
                  <span>Profile</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PublicRelationshipSearch />

        <section id="how-it-works" className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase text-blue-600">How it works</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">From curiosity to clarity</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                Whether you are single, dating, or already committed, the app guides every step with privacy and verification controls.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <article key={title} className="rounded-[22px] bg-slate-50 p-5 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-600">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-3xl font-black text-slate-200">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="singles" className="bg-slate-50 py-14">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 md:grid-cols-[0.9fr_1.1fr] md:items-center md:px-8">
            <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-pink-50 text-pink-600">
                  <MessageCircleHeart className="h-7 w-7" />
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <SlidersHorizontal className="h-7 w-7" />
                </div>
                <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Shield className="h-7 w-7" />
                </div>
              </div>
              <h2 className="mt-5 text-3xl font-black">Find love with more confidence</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Committed is not only for verifying couples. Singles can create dating profiles, discover people nearby, match, chat, use filters, and move toward real relationships with safety signals built in.
              </p>
              <Link href="/auth" className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-[16px] bg-blue-600 px-5 font-black text-white">
                Start dating
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map(({ icon: Icon, title, text, tag }) => (
                <article key={title} className="rounded-[22px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="h-7 w-7 text-blue-600" />
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{tag}</span>
                  </div>
                  <h3 className="mt-4 font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="couples" className="bg-white py-14">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-[28px] bg-blue-600 p-6 text-white">
                <Heart className="h-10 w-10 fill-white" />
                <h2 className="mt-5 text-3xl font-black">Protect what you have built</h2>
                <p className="mt-3 text-sm leading-6 text-blue-50">
                  Register and verify your relationship with partner confirmation and moderation review support. Keep control over what the public can see.
                </p>
              </div>
              <div id="support" className="rounded-[28px] bg-slate-950 p-6 text-white">
                <Users className="h-10 w-10 text-blue-300" />
                <h2 className="mt-5 text-3xl font-black">Support when it matters</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  The app combines AI guidance, professional booking, alerts, admin review, and clear records so people can act before trust breaks.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-[24px] bg-slate-50 p-5 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 font-black">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Existing links stay active
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Email verification, password reset, shared posts, shared reels, dating profile links, download buttons, and app-opening links keep their same public URLs.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
