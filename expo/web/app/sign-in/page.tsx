import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OpenAppButton from '@/components/OpenAppButton';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h1 className="font-display text-2xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-2 text-slate-600">
            Sign-in happens in the Committed app. Open the app on your phone to sign in.
          </p>
          <div className="mt-8">
            <OpenAppButton target="sign-in" label="Open App to Sign In" variant="primary" />
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Don’t have the app?{' '}
            <Link href="/download" className="font-medium text-primary-600 hover:underline">
              Download it here
            </Link>
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/download" className="text-sm text-slate-600 hover:text-primary-600">
              View download page & QR code
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
