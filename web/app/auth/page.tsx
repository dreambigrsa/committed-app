import Link from 'next/link';
import { ArrowRight, Smartphone } from 'lucide-react';
import AuthPageFrame from '@/components/AuthPageFrame';
import OpenAppButton from '@/components/OpenAppButton';

export default function AuthPage() {
  return (
    <AuthPageFrame
      eyebrow="Committed Web"
      title="Choose how you want to continue."
      subtitle="Use the website on this same domain, create an account, or open the mobile app when you want the native experience."
    >
      <div className="p-5 sm:p-6">
        <p className="text-sm font-black uppercase text-teal-700">Account access</p>
        <h2 className="mt-3 text-2xl font-black tracking-normal text-slate-950">
          Continue your Committed experience online.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Pick the path that matches where you are in the journey.
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/sign-up"
            className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-md bg-teal-500 px-5 font-black text-slate-950 transition hover:bg-teal-300"
          >
            Create account
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex min-h-[54px] items-center justify-center rounded-md border border-slate-200 bg-white px-5 font-black text-slate-950 transition hover:border-teal-400 hover:bg-teal-50"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="inline-flex min-h-[54px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-5 font-black text-slate-950 transition hover:border-teal-400 hover:bg-teal-50"
          >
            Open web app
          </Link>
        </div>

        <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-black text-slate-800">
            <Smartphone className="h-4 w-4 text-teal-700" />
            Prefer the mobile app?
          </p>
          <div className="mt-4">
            <OpenAppButton target="sign-in" label="Open Mobile App" variant="secondary" />
          </div>
        </div>
      </div>
    </AuthPageFrame>
  );
}
