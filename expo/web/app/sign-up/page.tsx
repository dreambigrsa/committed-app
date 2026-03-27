import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OpenAppButton from '@/components/OpenAppButton';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <h1 className="font-display text-2xl font-bold text-slate-900">Sign up</h1>
          <p className="mt-2 text-slate-600">
            Create your account in the Committed app. Open the app on your phone to sign up.
          </p>
          <div className="mt-8">
            <OpenAppButton target="sign-up" label="Open App to Sign Up" variant="primary" />
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have the app?{' '}
            <Link href="/sign-in" className="font-medium text-primary-600 hover:underline">
              Sign in
            </Link>
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/download" className="text-sm text-slate-600 hover:text-primary-600">
              Download the app
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
