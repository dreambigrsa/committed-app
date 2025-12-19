import { useEffect } from "react";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const processUrl = async (url: string) => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);

      if (error) {
        console.log("Error exchanging code:", error);
        router.replace("/auth");
        return;
      }

      router.replace("/(tabs)/home");
    };

    // App is already running
    const subscription = Linking.addEventListener("url", ({ url }) => {
      processUrl(url);
    });

    // App opened from email (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) processUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return null;
}

