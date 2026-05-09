import Image from 'next/image';
import type { ReactNode } from 'react';
import { BadgeCheck, LockKeyhole, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

type AuthPageFrameProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const trustPoints = [
  { icon: ShieldCheck, text: 'Verified relationship tools' },
  { icon: BadgeCheck, text: 'Dating with clearer trust signals' },
  { icon: LockKeyhole, text: 'Privacy-first account controls' },
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

        <section className="relative mx-auto grid min-h-screen max-w-7xl gap-10 px-5 pb-12 pt-32 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-black text-teal-100 backdrop-blur-md">
              <ShieldCheck className="h-4 w-4" />
              {eyebrow}
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">
              {subtitle}
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {trustPoints.map(({ icon: Icon, text }) => (
                <div key={text} className="rounded-md border border-white/14 bg-white/10 p-4 text-sm font-bold leading-6 text-slate-100 backdrop-blur-md">
                  <Icon className="mb-3 h-5 w-5 text-teal-300" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md rounded-lg border border-white/18 bg-white p-3 text-slate-950 shadow-2xl shadow-slate-950/30">
            {children}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
