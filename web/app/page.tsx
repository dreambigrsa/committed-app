import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { Briefcase, CheckCircle2, Film, Heart, MessageCircle, Search, Shield, Sparkles, User } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { PLAY_STORE_URL, APK_DOWNLOAD_URL } from '@/lib/appLinks';

const PublicRelationshipSearch = nextDynamic(() => import('@/components/PublicRelationshipSearch'), { ssr: false });

export const dynamic = 'force-static';

const appTabs = [
  { label: 'Home', icon: Shield },
  { label: 'Feed', icon: Heart },
  { label: 'Reels', icon: Film },
  { label: 'Dating', icon: Sparkles },
  { label: 'Search', icon: Search },
  { label: 'Messages', icon: MessageCircle },
  { label: 'Profile', icon: User },
];

const featureCards = [
  {
    icon: Shield,
    title: 'Register relationships',
    text: 'Create a verified relationship record with partner confirmation and admin review when needed.',
  },
  {
    icon: Sparkles,
    title: 'Find love safely',
    text: 'Dating profiles, likes, matches, preferences, and safer messaging in the same app.',
  },
  {
    icon: Briefcase,
    title: 'Book professionals',
    text: 'Connect with approved relationship professionals and mentors when support is needed.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0b1020] text-white">
      <Navbar />
      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.25),transparent_40%),radial-gradient(circle_at_80%_75%,rgba(139,92,246,0.22),transparent_40%)]" />
          <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-10 px-5 pb-14 pt-24 md:grid-cols-[1fr_420px] md:px-8">
          <div className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl motion-safe:animate-pulse" />
          <div className="pointer-events-none absolute -right-16 bottom-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl motion-safe:animate-pulse" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-black text-blue-100 transition duration-200 hover:bg-white/15">
              <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
              Verified love, dating, and trust tools
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight sm:text-6xl">
              Committed
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-300">
              The same mobile-first experience in your browser: verify relationships, discover intentional dating, share your journey, and get support safely.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className="rounded-[20px] bg-gradient-to-r from-blue-600 to-violet-600 px-7 py-4 text-center text-base font-black text-white shadow-xl shadow-blue-700/25 transition duration-200 hover:-translate-y-0.5 hover:opacity-95 active:translate-y-0">
                Create account
              </Link>
              <Link href={PLAY_STORE_URL !== '#' ? PLAY_STORE_URL : APK_DOWNLOAD_URL} className="rounded-[20px] border border-white/20 bg-white/10 px-7 py-4 text-center text-base font-black text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/15 active:translate-y-0">
                Download app
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs font-bold text-slate-200">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Deep links preserved</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Shared post/reel links active</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Verification routes unchanged</span>
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-[360px] rounded-[34px] border border-white/15 bg-white/10 p-3 shadow-2xl shadow-blue-950/50 backdrop-blur transition duration-300 hover:-translate-y-1">
            <div className="overflow-hidden rounded-[28px] bg-slate-50 text-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-slate-400">Welcome back,</p>
                  <p className="text-xl font-black">Committed</p>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-blue-600 font-black text-white">C</div>
              </div>
              <div className="space-y-3 p-4">
                <div className="rounded-[24px] bg-blue-600 p-4 text-white">
                  <Shield className="h-7 w-7" />
                  <p className="mt-4 text-lg font-black">Relationship Status</p>
                  <p className="text-sm text-blue-100">Register, verify, and protect your relationship record.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <Sparkles className="h-6 w-6 text-blue-600" />
                    <p className="mt-3 font-black">Dating</p>
                  </div>
                  <div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <Briefcase className="h-6 w-6 text-blue-600" />
                    <p className="mt-3 font-black">Professionals</p>
                  </div>
                </div>
                <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                  <p className="text-sm font-black text-slate-900">One app experience</p>
                  <p className="mt-1 text-sm text-slate-500">Feed, reels, messages, dating, and profile with the same flows.</p>
                </div>
              </div>
              <div className="grid grid-cols-7 border-t border-slate-200 bg-white py-2">
                {appTabs.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex flex-col items-center gap-1 text-[9px] font-bold text-slate-400">
                    <Icon className={`h-4 w-4 ${label === 'Dating' ? 'text-blue-600' : ''}`} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          </div>
        </section>

        <section id="trust-safety" className="bg-gradient-to-b from-[#0b1020] to-slate-100 py-16 text-slate-950">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <PublicRelationshipSearch />
          </div>
        </section>

        <section id="how-it-works" className="bg-slate-100 py-16 text-slate-950">
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="mb-8">
              <p className="text-sm font-black uppercase tracking-wide text-blue-600">How it works</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Built like the mobile journey</h2>
              <p className="mt-2 max-w-2xl text-slate-600">From discovery to commitment, the web landing now mirrors the mobile app tone, hierarchy, and trust-first flow.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <Icon className="h-9 w-9 text-blue-600" />
                  <h2 className="mt-5 text-2xl font-black">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>

            <div id="singles" className="mt-10 rounded-[28px] border border-rose-200 bg-gradient-to-r from-rose-50 to-violet-50 p-6">
              <p className="text-sm font-black uppercase tracking-wide text-rose-600">Singles</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Date intentionally, not randomly.</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                Create a dating profile, apply meaningful filters, match with people who want serious connection, and move into a verified relationship when ready.
              </p>
            </div>

            <div id="couples" className="mt-6 rounded-[28px] border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
              <p className="text-sm font-black uppercase tracking-wide text-blue-600">Couples</p>
              <h3 className="mt-2 text-2xl font-black text-slate-950">Protect what you have built.</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                Register and verify your relationship with partner confirmation and moderation review support. Keep privacy control over what the public can see.
              </p>
            </div>

            <div id="support" className="mt-10 rounded-[28px] bg-slate-950 p-6 text-white md:flex md:items-center md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-lg font-black">
                  <CheckCircle2 className="h-6 w-6 text-blue-300" />
                  One Committed experience across mobile and web
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Shared posts, reels, profiles, verification links, and deep links stay active while the landing visual system now follows the mobile app style.
                </p>
              </div>
              <Link href="/auth" className="mt-5 inline-flex rounded-[18px] bg-blue-600 px-6 py-3 font-black text-white transition hover:bg-blue-500 md:mt-0">
                Open web app
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
