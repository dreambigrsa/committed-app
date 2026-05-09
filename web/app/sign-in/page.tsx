import AuthPageFrame from '@/components/AuthPageFrame';
import WebAuthFormLoader from '@/components/WebAuthFormLoader';

export default function SignInPage() {
  return (
    <AuthPageFrame
      eyebrow="Secure web access"
      title="Welcome back to Committed."
      subtitle="Continue into the same trust-first experience for dating, relationship records, support, and public verification checks."
    >
      <WebAuthFormLoader mode="sign-in" />
    </AuthPageFrame>
  );
}
