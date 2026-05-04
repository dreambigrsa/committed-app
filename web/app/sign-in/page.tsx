import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WebAuthFormLoader from '@/components/WebAuthFormLoader';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50">
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <WebAuthFormLoader mode="sign-in" />
      </main>
      <Footer />
    </div>
  );
}
