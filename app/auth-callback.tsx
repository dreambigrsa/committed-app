import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { getAndClearPendingAuthUrl } from "@/lib/pending-auth-url";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useApp } from "@/contexts/AppContext";

export default function AuthCallback() {
  const router = useRouter();
  const { currentUser, hasCompletedOnboarding, isLoading, isPasswordRecoveryFlow } = useApp();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processUrl = async (url: string) => {
      if (!url) return;
      setIsProcessing(true);
      // On native: we must call exchangeCodeForSession (Supabase doesn't auto-detect deep links)
      // On web: Supabase auto-exchanges via detectSessionInUrl - do NOT call again (code is single-use)
      if (Platform.OS !== "web") {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.log("Auth callback exchange error:", error.message);
            router.replace("/auth");
            return;
          }
        } catch (error) {
          console.error("Error processing auth callback:", error);
          router.replace("/auth");
          return;
        }
      }
      // Session established (or will be via detectSessionInUrl on web); wait for user + redirect
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      processUrl(url);
    });

    // Get URL: pending (app was open, we navigated here from layout), cold start, or web
    const getUrl = async (): Promise<string | null> => {
      const pending = getAndClearPendingAuthUrl();
      if (pending) return pending;
      const initial = await Linking.getInitialURL();
      if (initial) return initial;
      if (typeof window !== "undefined" && window.location?.href) {
        const full = window.location.href;
        if (full.includes("code=") || full.includes("access_token=") || full.includes("#")) {
          return full;
        }
      }
      return null;
    };

    getUrl().then((url) => {
      if (url) processUrl(url);
      else setIsProcessing(false); // No URL to process
    });

    return () => subscription.remove();
  }, []);

  // Once user data is loaded, redirect appropriately
  useEffect(() => {
    if (!isProcessing || isLoading) return;
    
    if (currentUser) {
      // Password reset: user clicked reset link → send to set-new-password screen
      if (isPasswordRecoveryFlow) {
        router.replace("/reset-password");
        setIsProcessing(false);
        return;
      }
      if (hasCompletedOnboarding === null) {
        // Still loading onboarding status
        return;
      }
      if (hasCompletedOnboarding === false) {
        router.replace("/onboarding");
      } else if (hasCompletedOnboarding === true) {
        router.replace("/(tabs)/home");
      }
      setIsProcessing(false);
    } else {
      // No user after processing, might be an error
      // Give it a bit more time, then redirect to auth
      setTimeout(() => {
        if (!currentUser) {
          router.replace("/auth");
        }
      }, 2000);
    }
  }, [currentUser, hasCompletedOnboarding, isLoading, isProcessing, isPasswordRecoveryFlow, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A73E8' }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

