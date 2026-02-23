import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Redirect route: committed://sign-in → /auth?mode=signin */
export default function SignInRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth?mode=signin' as any);
  }, [router]);
  return null;
}
