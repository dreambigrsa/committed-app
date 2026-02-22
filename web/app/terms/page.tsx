import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="font-display text-3xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mt-2 text-slate-600">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>
        <div className="mt-10 space-y-6 text-slate-700">
          <section>
            <h2 className="font-semibold text-slate-900">1. Acceptance</h2>
            <p>By using Committed (“the app” and “the service”), you agree to these terms. If you do not agree, do not use the service.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">2. Use of the service</h2>
            <p>You will use the service only for lawful purposes and in line with these terms. You are responsible for keeping your account secure and for all activity under your account.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">3. Privacy</h2>
            <p>Your use of the service is also governed by our Privacy Policy. By using the service you consent to the collection and use of information as described there.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">4. Contact</h2>
            <p>For questions about these terms, contact us at the support email on the website.</p>
          </section>
        </div>
        <p className="mt-10">
          <Link href="/" className="text-primary-600 hover:underline">← Back to home</Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}
