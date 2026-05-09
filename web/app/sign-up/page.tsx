import AuthPageFrame from '@/components/AuthPageFrame';
import WebAuthFormLoader from '@/components/WebAuthFormLoader';

export default function SignUpPage() {
  return (
    <AuthPageFrame
      eyebrow="Why trust comes first"
      title="Why Committed starts with trust."
      subtitle="Your account connects dating, relationship records, and privacy controls so every interaction starts with clearer signals."
    >
      <WebAuthFormLoader mode="sign-up" />
    </AuthPageFrame>
  );
}
