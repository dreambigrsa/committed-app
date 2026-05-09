import AuthPageFrame from '@/components/AuthPageFrame';
import WebAuthFormLoader from '@/components/WebAuthFormLoader';

export default function SignUpPage() {
  return (
    <AuthPageFrame
      eyebrow="Join with intention"
      title="Create your Committed account."
      subtitle="Start with a safer account foundation, then meet intentionally, register relationships, and manage trust signals from one place."
    >
      <WebAuthFormLoader mode="sign-up" />
    </AuthPageFrame>
  );
}
