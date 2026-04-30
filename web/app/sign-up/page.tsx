import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WebAuthForm from '@/components/WebAuthForm';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-rose-50">
      <Navbar />
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <WebAuthForm mode="sign-up" />
      </main>
      <Footer />
    </div>
  );
}
