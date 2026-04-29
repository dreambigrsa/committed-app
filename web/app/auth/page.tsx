import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OpenAppButton from '@/components/OpenAppButton';
import AuthRouteGuard from '@/components/AuthRouteGuard';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <AuthRouteGuard />
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">Committed Web</p>
          <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            Continue your Committed experience online
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Use the website on this same domain, or open the mobile app when you want the native app experience.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Link
              href="/sign-up"
              className="inline-flex min-h-[56px] items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-6 py-4 font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Create Account
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-violet-200 bg-white px-6 py-4 font-semibold text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-50"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="inline-flex min-h-[56px] items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 px-6 py-4 font-semibold text-slate-800 transition-all hover:border-violet-200 hover:bg-violet-50"
            >
              Web App
            </Link>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-700">Prefer the mobile app?</p>
            <div className="mt-4">
              <OpenAppButton target="sign-in" label="Open Mobile App" variant="secondary" />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
