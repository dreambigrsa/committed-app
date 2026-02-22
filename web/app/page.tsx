import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PremiumDarkHero from '@/components/PremiumDarkHero';
import SinglesPreview from '@/components/SinglesPreview';
import CertificatePreview from '@/components/CertificatePreview';
import HowItWorksSection from '@/components/HowItWorksSection';
import TrustSafetySection from '@/components/TrustSafetySection';
import SupportSection from '@/components/SupportSection';
import ProblemSection from '@/components/ProblemSection';
import SolutionSection from '@/components/SolutionSection';
import FinalCTASection from '@/components/FinalCTASection';
import { AnimatedSection, StaggerContainer, StaggerItem } from '@/components/AnimatedSection';
import { stockImages } from '@/lib/stock-images';

/* Committed: Trust-first dating & relationship platform. Human, warm, premium, mobile-first. */

const singlesItems = [
  'Create verified profile',
  'Check if someone is truly single',
  'Meet & message safely',
  'Explore community posts',
];

const couplesItems = [
  'Register your relationship',
  'Digital certificate',
  'Anniversary reminders',
  'Protection against duplicate registrations',
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0b0b14]">
      <Navbar />

      <main className="overflow-x-hidden">
        {/* Premium Dark Hero - negative margin pulls it under nav for seamless dark */}
        <div className="-mt-16 md:-mt-[4.5rem]">
          <PremiumDarkHero />
        </div>

        {/* Curved divider */}
        <div className="relative -mt-px h-16 overflow-hidden bg-[#faf9ff]">
          <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 60" preserveAspectRatio="none">
            <path
              fill="#faf5ff"
              d="M0 60V20C360 0 720 0 1080 20 1260 30 1350 40 1440 50V60H0Z"
            />
          </svg>
        </div>

        {/* Section 1 — The Problem (premium, emotional) */}
        <ProblemSection />

        {/* Section 2 — The Solution (premium, emotional) */}
        <SolutionSection />

        {/* Curved divider */}
        <div className="relative h-12 overflow-hidden bg-[#faf9fc]">
          <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 48" preserveAspectRatio="none">
            <path fill="#fdf4ff" d="M0 48V0h1440v24c-240 12-480 24-720 24S480 36 240 48H0Z" />
          </svg>
        </div>

        {/* Section 3 — For Singles */}
        <section id="singles" className="relative overflow-hidden bg-gradient-to-b from-[#fdf4ff] to-[#faf9ff] py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6 md:px-10">
            <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
              <AnimatedSection className="order-2 lg:order-1">
                <h2 className="font-display text-4xl font-bold text-slate-900 sm:text-5xl">For Singles</h2>
                <ul className="mt-8 space-y-4">
                  {singlesItems.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-lg text-slate-600">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100">
                        <svg className="h-3.5 w-3.5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-slate-600">Know who&apos;s verified before you fall.</p>
                <Link
                  href="/sign-up"
                  className="btn-glow mt-8 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40"
                >
                  Create Verified Profile
                </Link>
              </AnimatedSection>
              <AnimatedSection delay={0.1} className="order-1 lg:order-2">
                <div className="relative">
                  <div className="overflow-hidden rounded-3xl shadow-[var(--shadow-float)]">
                    <Image
                      src={stockImages.single}
                      alt="Confident single person"
                      width={600}
                      height={400}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                  <div className="mt-6 lg:absolute lg:bottom-6 lg:right-6 lg:mt-0 lg:max-w-[220px]">
                    <SinglesPreview />
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* Section 4 — For Couples */}
        <section className="border-t border-slate-200/50 bg-white py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6 md:px-10">
            <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
              <AnimatedSection className="order-2 lg:order-2">
                <h2 className="font-display text-4xl font-bold text-slate-900 sm:text-5xl">For Couples</h2>
                <ul className="mt-8 space-y-4">
                  {couplesItems.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-lg text-slate-600">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100">
                        <svg className="h-3.5 w-3.5 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 font-medium text-violet-600">Because &quot;It&apos;s complicated&quot; isn&apos;t a verification status.</p>
                <Link
                  href="/sign-up"
                  className="btn-glow mt-8 inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40"
                >
                  Register Relationship
                </Link>
              </AnimatedSection>
              <AnimatedSection delay={0.1} className="order-1 lg:order-1">
                <div className="relative">
                  <div className="overflow-hidden rounded-3xl shadow-[var(--shadow-float)]">
                    <Image
                      src={stockImages.couple}
                      alt="Happy couple together"
                      width={600}
                      height={400}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                  <div className="mt-6 lg:absolute lg:bottom-6 lg:left-6 lg:mt-0 lg:max-w-[240px]">
                    <CertificatePreview />
                  </div>
                </div>
              </AnimatedSection>
            </div>
          </div>
        </section>

        {/* Section 5 — Trust & Safety (premium, trust-focused) */}
        <TrustSafetySection />

        {/* Section 6 — Support (premium, emotionally reassuring) */}
        <SupportSection />

        {/* Section 7 — How It Works (premium emotional timeline) */}
        <HowItWorksSection />

        {/* Final CTA */}
        <FinalCTASection />
      </main>

      <Footer />
    </div>
  );
}
