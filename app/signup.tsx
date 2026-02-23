import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Redirect route: committed://signup → /auth?mode=signup */
export default function SignupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth?mode=signup' as any);
  }, [router]);
  return null;
}
