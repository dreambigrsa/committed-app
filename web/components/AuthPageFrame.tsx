import Image from 'next/image';
import type { ReactNode } from 'react';
import { BadgeCheck, HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type AuthPageFrameProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const trustPoints = [
  { icon: ShieldCheck, title: 'Verified tools', text: 'Relationship records and trust checks are part of the same account experience.' },
  { icon: BadgeCheck, title: 'Clearer signals', text: 'Dating profiles and account actions are designed around intention, not noise.' },
  { icon: LockKeyhole, title: 'Privacy controls', text: 'Visibility and consent stay part of the journey from the beginning.' },
];

export default function AuthPageFrame({ eyebrow, title, subtitle, children }: AuthPageFrameProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />
      <main className="relative min-h-[calc(100svh-1px)] overflow-hidden">
        <Image
          src="/hero/committed-trust-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-slate-950/76" />
        <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,rgba(2,6,23,0.92),rgba(2,6,23,0.72)_48%,rgba(2,6,23,0.32)_100%)]" />

        <section className="relative mx-auto grid min-h-screen max-w-7xl gap-9 px-4 pb-12 pt-32 sm:gap-10 sm:px-5 sm:pt-36 md:px-8 lg:grid-cols-[0.96fr_0.74fr] lg:items-center lg:gap-16 lg:pt-32">
          <div className="order-2 w-full max-w-2xl min-w-0 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-normal text-teal-100 shadow-lg shadow-slate-950/10 backdrop-blur-md sm:text-sm">
              <ShieldCheck className="h-4 w-4" />
              {eyebrow}
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-black leading-[1.13] tracking-normal text-balance sm:mt-6 sm:text-5xl sm:leading-[1.08] lg:text-7xl lg:leading-[1.03]">
              {title}
            </h1>
            <p className="mt-4 max-w-xl text-base font-semibold leading-8 text-slate-200 sm:mt-6 sm:text-lg sm:leading-8">
              {subtitle}
            </p>

            <div className="mt-7 w-full max-w-full overflow-hidden rounded-lg border border-white/14 bg-white/10 p-2 shadow-2xl shadow-slate-950/15 backdrop-blur-md sm:mt-9 sm:max-w-2xl">
              {trustPoints.map(({ icon: Icon, title: pointTitle, text }, index) => (
                <div key={pointTitle} className="grid gap-3 rounded-md p-4 text-slate-100 min-[360px]:grid-cols-[2.75rem_minmax(0,1fr)] sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4 sm:p-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-teal-400 text-slate-950 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-black uppercase leading-none text-teal-200">0{index + 1}</span>
                      <h2 className="text-base font-black leading-6 text-white sm:text-lg">{pointTitle}</h2>
                    </div>
                    <p className="mt-2 break-words text-sm font-semibold leading-7 text-slate-300">{text}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 inline-flex items-center gap-2 text-sm font-black text-teal-200">
              <HeartHandshake className="h-4 w-4" />
              Built for trust before connection.
            </p>
          </div>

          <div className="order-1 mx-auto w-full max-w-full overflow-hidden rounded-xl border border-white/18 bg-white/95 p-2 text-slate-950 shadow-2xl shadow-slate-950/35 backdrop-blur-xl sm:max-w-[460px] lg:order-2">
            {children}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
