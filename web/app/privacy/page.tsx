import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 className="font-display text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-slate-600">Last updated: {new Date().toLocaleDateString('en-ZA')}</p>
        <div className="mt-10 space-y-6 text-slate-700">
          <section>
            <h2 className="font-semibold text-slate-900">1. Information we collect</h2>
            <p>We collect information you provide when you sign up and use the app (e.g. email, profile data, goals and check-ins). We may also collect device and usage information to operate and improve the service.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">2. How we use it</h2>
            <p>We use your information to provide, secure, and improve the service; to communicate with you; and to comply with law. We do not sell your personal data.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">3. Sharing</h2>
            <p>We may share data with service providers that help us run the service, under strict confidentiality. We may disclose data when required by law.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">4. Security and retention</h2>
            <p>We use industry-standard measures to protect your data. We retain data as long as needed to provide the service and as required by law.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">5. Your rights</h2>
            <p>You may access, correct, or delete your data through the app or by contacting us. Applicable law may give you additional rights.</p>
          </section>
          <section>
            <h2 className="font-semibold text-slate-900">6. Contact</h2>
            <p>For privacy questions or requests, use the support email on the website.</p>
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
