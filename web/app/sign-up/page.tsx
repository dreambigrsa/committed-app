import AuthPageFrame from '@/components/AuthPageFrame';
import WebAuthFormLoader from '@/components/WebAuthFormLoader';

export default function SignUpPage() {
  return (
    <AuthPageFrame
      eyebrow="Join with intention"
      title="Start safer. Meet with intention."
      subtitle="Create a trust-first account for intentional dating, verified relationship records, and privacy-aware connection tools."
    >
      <WebAuthFormLoader mode="sign-up" />
    </AuthPageFrame>
  );
}
