import Image from 'next/image';
import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarHeart,
  CheckCircle2,
  ClipboardCheck,
  HeartHandshake,
  IdCard,
  LockKeyhole,
  MessageCircleHeart,
  MessagesSquare,
  Radar,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { APK_DOWNLOAD_URL, PLAY_STORE_URL } from '@/lib/appLinks';

const PublicRelationshipSearch = nextDynamic(() => import('@/components/PublicRelationshipSearch'), { ssr: false });

export const dynamic = 'force-static';

const promises = [
  'Dating profiles built around intention, not endless noise.',
  'Relationship records with consent, review, and visibility controls.',
  'Public checks for verified relationships only when privacy allows it.',
];

const productMoments = [
  {
    icon: MessageCircleHeart,
    title: 'Meet with intention',
    text: 'Create a dating profile, set what you are looking for, match, chat, and move with clearer signals.',
  },
  {
    icon: BadgeCheck,
    title: 'Verify the relationship',
    text: 'Register a relationship, invite your partner, and complete confirmation through partner or admin review.',
  },
  {
    icon: Bell,
    title: 'Stay accountable',
    text: 'Integrity alerts and moderation flows help protect people when relationship records conflict.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Get support',
    text: 'Book approved professionals and mentors when a relationship needs guidance or repair.',
  },
];

const appPreviews = [
  {
    icon: MessageCircleHeart,
    title: 'Dating profile',
    eyebrow: 'Intentions first',
    lines: ['Verified profile signals', 'Relationship goals', 'Conversation starters'],
    accent: 'bg-rose-500',
  },
  {
    icon: ClipboardCheck,
    title: 'Relationship record',
    eyebrow: 'Consent and review',
    lines: ['Partner confirmation', 'Privacy level', 'Admin review path'],
    accent: 'bg-teal-500',
  },
  {
    icon: IdCard,
    title: 'Verification',
    eyebrow: 'Trust signals',
    lines: ['Phone verified', 'Email verified', 'ID review status'],
    accent: 'bg-blue-500',
  },
  {
    icon: MessagesSquare,
    title: 'Support',
    eyebrow: 'Help when needed',
    lines: ['Professional bookings', 'Guided conversations', 'Safety alerts'],
    accent: 'bg-slate-900',
  },
];

const trustLayers = [
  ['ID and profile signals', 'Verification status helps people understand who they are connecting with.'],
  ['Private by default', 'Pending and private relationship records stay out of public search.'],
  ['Human review paths', 'Sensitive records can move through partner, moderator, and admin review.'],
  ['Clear next steps', 'Dating, registration, support, and search are connected in one experience.'],
];

const journeys = [
  {
    label: 'Singles',
    title: 'A calmer way to date',
    text: 'Discover intentional people, use filters that matter, and start conversations with context instead of guesswork.',
    href: '/auth',
    cta: 'Start dating',
    icon: Sparkles,
  },
  {
    label: 'Couples',
    title: 'Protect what is real',
    text: 'Register a relationship, choose visibility, and keep a verified record that respects privacy.',
    href: '/auth',
    cta: 'Register a relationship',
    icon: HeartHandshake,
  },
];

function ProductScreenPreview({ preview }: { preview: (typeof appPreviews)[number] }) {
  const Icon = preview.icon;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="overflow-hidden rounded-md border border-slate-200 bg-[#f7f8f3]">
        <div className={`${preview.accent} px-4 py-4 text-white`}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase text-white/80">{preview.eyebrow}</p>
            <Icon className="h-6 w-6" />
          </div>
          <h3 className="mt-8 text-2xl font-black">{preview.title}</h3>
        </div>
        <div className="space-y-3 p-4">
          {preview.lines.map((line, index) => (
            <div key={line} className="rounded-md bg-white p-3 ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-teal-50 text-xs font-black text-teal-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">{line}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-400" style={{ width: `${72 - index * 12}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['Trust', 'Privacy', 'Care'].map((item) => (
              <span key={item} className="rounded-md bg-slate-100 px-2 py-2 text-center text-[11px] font-black text-slate-600">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HomePage() {
  const downloadHref = PLAY_STORE_URL && PLAY_STORE_URL !== '#' ? PLAY_STORE_URL : APK_DOWNLOAD_URL;

  return (
    <div className="min-h-screen bg-[#f8faf7] text-slate-950">
      <Navbar />
      <main>
        <section className="relative min-h-[92svh] overflow-hidden bg-slate-950 text-white">
          <Image
            src="/hero/committed-trust-hero.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/68" />
          <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(2,6,23,0.88),rgba(2,6,23,0.62)_42%,rgba(2,6,23,0.14)_100%)]" />

          <div className="relative mx-auto flex min-h-[92svh] max-w-7xl flex-col justify-end px-5 pb-10 pt-32 md:px-8 md:pb-14">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/22 bg-white/10 px-3 py-2 text-sm font-black text-teal-100 backdrop-blur-md">
                <ShieldCheck className="h-4 w-4" />
                Trust-first dating and verified relationships
              </div>
              <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.95] tracking-normal sm:text-7xl lg:text-8xl">
                Committed
              </h1>
              <p className="mt-6 max-w-2xl text-xl leading-8 text-slate-100 md:text-2xl md:leading-10">
                A safer place to meet, register, verify, and protect meaningful connections.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth" className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-teal-400 px-6 font-black text-slate-950 transition hover:bg-teal-300">
                  Open web app
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/sign-up" className="inline-flex h-14 items-center justify-center rounded-md border border-white/28 bg-white/10 px-6 font-black text-white backdrop-blur-md transition hover:bg-white/18">
                  Create account
                </Link>
                <Link href={downloadHref} className="inline-flex h-14 items-center justify-center rounded-md border border-white/28 px-6 font-black text-white transition hover:bg-white/10">
                  Download app
                </Link>
              </div>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-3">
              {promises.map((promise) => (
                <div key={promise} className="rounded-md border border-white/16 bg-white/10 p-4 text-sm font-semibold leading-6 text-slate-100 backdrop-blur-md">
                  <CheckCircle2 className="mb-3 h-5 w-5 text-teal-300" />
                  {promise}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="experience" className="border-b border-slate-200 bg-[#f8faf7] py-16">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <p className="text-sm font-black uppercase text-teal-700">The Experience</p>
                <h2 className="mt-3 text-4xl font-black tracking-normal md:text-5xl">
                  Built for the moments where trust matters.
                </h2>
              </div>
              <p className="text-lg leading-8 text-slate-600">
                Committed connects dating, public relationship checks, verification, support, and privacy controls into one human system.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {productMoments.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <Icon className="h-8 w-8 text-teal-700" />
                  <h3 className="mt-5 text-xl font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <PublicRelationshipSearch />

        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase text-teal-700">Inside the app</p>
                <h2 className="mt-3 text-4xl font-black tracking-normal md:text-5xl">
                  The app feels clear because every step has a purpose.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Every major path points back to trust: who someone is, what they want, what has been verified, and what can remain private.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <span className="rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white">Dating</span>
                  <span className="rounded-md bg-teal-50 px-3 py-2 text-sm font-black text-teal-800">Verification</span>
                  <span className="rounded-md bg-rose-50 px-3 py-2 text-sm font-black text-rose-800">Relationship records</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {appPreviews.map((preview) => (
                  <ProductScreenPreview key={preview.title} preview={preview} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="singles" className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="grid gap-5 lg:grid-cols-2">
              {journeys.map(({ label, title, text, href, cta, icon: Icon }) => (
                <article key={label} className="rounded-lg border border-slate-200 bg-[#fbfbf6] p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="rounded-md bg-slate-950 px-3 py-2 text-sm font-black text-white">{label}</span>
                    <Icon className="h-10 w-10 text-rose-500" />
                  </div>
                  <h2 className="mt-8 text-3xl font-black tracking-normal md:text-4xl">{title}</h2>
                  <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">{text}</p>
                  <Link href={href} className="mt-7 inline-flex h-12 items-center gap-2 rounded-md bg-teal-500 px-5 font-black text-slate-950 transition hover:bg-teal-300">
                    {cta}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="couples" className="bg-slate-950 py-16 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase text-teal-300">Trust and safety</p>
              <h2 className="mt-3 text-4xl font-black tracking-normal md:text-5xl">
                Safety should feel present, not performative.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Committed helps people connect with more care and less ambiguity, while making privacy and verification visible at the moments they matter.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {trustLayers.map(([title, text]) => (
                <article key={title} className="rounded-lg border border-white/12 bg-white/10 p-5">
                  <LockKeyhole className="h-6 w-6 text-teal-300" />
                  <h3 className="mt-4 font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="support" className="bg-[#f8faf7] py-16">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
              <div className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
                <UsersRound className="h-10 w-10 text-teal-700" />
                <h2 className="mt-6 text-4xl font-black tracking-normal">One place for the whole relationship journey.</h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  Start by meeting intentionally, continue with private or public relationship records, and bring in support when a connection needs guidance.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-5 font-black text-white">
                    Enter Committed
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link href="/download" className="inline-flex h-12 items-center justify-center rounded-md border border-slate-200 px-5 font-black text-slate-950">
                    Download
                  </Link>
                </div>
              </div>
              <div className="grid gap-3">
                {[
                  [Radar, 'Search public verified relationships'],
                  [CalendarHeart, 'Register and manage relationship records'],
                  [MessageCircleHeart, 'Meet intentional singles'],
                  [BriefcaseBusiness, 'Find professional support'],
                ].map(([Icon, text]) => (
                  <div key={String(text)} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="grid h-12 w-12 place-items-center rounded-md bg-teal-50 text-teal-700">
                      <Icon className="h-6 w-6" />
                    </span>
                    <p className="font-black text-slate-900">{String(text)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-16 md:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-lg bg-slate-950 text-white">
            <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-black text-teal-200">
                  <UserRoundCheck className="h-4 w-4" />
                  Trust before connection
                </div>
                <h2 className="mt-5 max-w-3xl text-4xl font-black tracking-normal md:text-5xl">
                  Meet, verify, protect, and get support in one place.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                  Committed gives singles and couples a practical way to move with more clarity, privacy, and accountability.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/auth" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-teal-400 px-5 font-black text-slate-950">
                  Open web app
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href={downloadHref} className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 px-5 font-black text-white">
                  Download app
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
