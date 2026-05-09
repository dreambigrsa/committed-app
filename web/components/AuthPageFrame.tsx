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
  { icon: ShieldCheck, title: 'Verified tools', text: 'Relationship records and trust checks are built into the account experience.' },
  { icon: BadgeCheck, title: 'Clearer signals', text: 'Dating profiles and actions are designed around intention, not noise.' },
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

        <section className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-5 pb-12 pt-36 sm:pt-40 md:px-8 lg:grid-cols-[0.96fr_0.74fr] lg:items-center lg:gap-16 lg:pt-32">
          <div className="order-2 max-w-2xl lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-black text-teal-100 shadow-lg shadow-slate-950/10 backdrop-blur-md">
              <ShieldCheck className="h-4 w-4" />
              {eyebrow}
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.02] tracking-normal sm:text-5xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-slate-200">
              {subtitle}
            </p>

            <div className="mt-9 max-w-2xl rounded-lg border border-white/14 bg-white/10 p-2 shadow-2xl shadow-slate-950/15 backdrop-blur-md">
              {trustPoints.map(({ icon: Icon, title: pointTitle, text }, index) => (
                <div key={pointTitle} className="flex gap-4 rounded-md p-4 text-slate-100">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-teal-400 text-slate-950">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-teal-200">0{index + 1}</span>
                      <h2 className="font-black text-white">{pointTitle}</h2>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{text}</p>
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
