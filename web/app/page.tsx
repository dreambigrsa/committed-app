import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { Bell, Briefcase, CheckCircle2, Film, Heart, MessageCircle, Search, Shield, Sparkles, User } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main>
        <section className="mx-auto grid min-h-[calc(100vh-72px)] max-w-6xl items-center gap-10 px-5 pb-14 pt-24 md:grid-cols-[1fr_420px] md:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-blue-100">
              <Heart className="h-4 w-4 fill-pink-500 text-pink-500" />
              Relationships, dating, community, and support
            </div>
            <h1 className="mt-6 max-w-3xl text-5xl font-black tracking-tight sm:text-6xl">
              Committed
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-8 text-slate-300">
              Verify relationships, find meaningful love, share community moments, message safely, and get help from trusted professionals.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className="rounded-[20px] bg-blue-600 px-7 py-4 text-center text-base font-black text-white shadow-xl shadow-blue-600/25">
                Create account
              </Link>
              <Link href={PLAY_STORE_URL !== '#' ? PLAY_STORE_URL : APK_DOWNLOAD_URL} className="rounded-[20px] border border-white/15 bg-white/10 px-7 py-4 text-center text-base font-black text-white">
                Download app
              </Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[360px] rounded-[34px] border border-white/10 bg-slate-100 p-3 shadow-2xl shadow-blue-950/40">
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
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-pink-100 text-pink-600">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black">One app experience</p>
                      <p className="text-sm text-slate-500">Feed, reels, messages, dating, and profile.</p>
                    </div>
                  </div>
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
        </section>

        <section className="bg-slate-50 py-14 text-slate-950">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <PublicRelationshipSearch />
          </div>
        </section>

        <section className="bg-white py-16 text-slate-950">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <Icon className="h-9 w-9 text-blue-600" />
                  <h2 className="mt-5 text-2xl font-black">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 rounded-[28px] bg-slate-950 p-6 text-white md:flex md:items-center md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-lg font-black">
                  <CheckCircle2 className="h-6 w-6 text-blue-300" />
                  Same Committed experience
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Use the app on mobile, open shared links on the web, and keep verification, dating, search, and messaging connected.
                </p>
              </div>
              <Link href="/auth" className="mt-5 inline-flex rounded-[18px] bg-blue-600 px-6 py-3 font-black text-white md:mt-0">
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
