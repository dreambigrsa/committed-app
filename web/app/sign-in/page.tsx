import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WebAuthForm from '@/components/WebAuthForm';
import AuthRouteGuard from '@/components/AuthRouteGuard';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50">
      <AuthRouteGuard />
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <WebAuthForm mode="sign-in" />
      </main>
      <Footer />
    </div>
  );
}
