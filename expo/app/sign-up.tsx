import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Redirect route: committed://sign-up → /auth?mode=signup */
export default function SignUpRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth?mode=signup' as any);
  }, [router]);
  return null;
}
