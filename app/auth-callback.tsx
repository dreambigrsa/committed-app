import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { getAndClearPendingAuthUrl } from "@/lib/pending-auth-url";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useApp } from "@/contexts/AppContext";
import { getResolvedRoute } from "@/lib/auth-gate";
import { getAndClearPendingRouteIfContent } from "@/lib/pending-route";

export default function AuthCallback() {
  const router = useRouter();
  const { session, currentUser, hasCompletedOnboarding, isLoading, isPasswordRecoveryFlow, legalAcceptanceStatus } = useApp();
  const [isProcessing, setIsProcessing] = useState(true);
  const emailVerified = Boolean(currentUser?.verifications?.email);

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
      // Session established (native: exchangeCodeForSession; web: detectSessionInUrl). Allow redirect effect to run.
      setIsProcessing(false);
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

  // Central gate: redirect only after auth hydration (tokens stored, user + legal + onboarding loaded).
  useEffect(() => {
    if (!isProcessing || isLoading) return;
    if (currentUser) {
      if (isPasswordRecoveryFlow) {
        router.replace("/reset-password");
        setIsProcessing(false);
        return;
      }
      if (hasCompletedOnboarding === null) return;
      let route = getResolvedRoute({
        session,
        currentUser,
        legalAcceptanceStatus,
        hasCompletedOnboarding,
        isPasswordRecoveryFlow,
        emailVerified,
      });
      if (route === '/(tabs)/home') {
        const pending = getAndClearPendingRouteIfContent();
        if (pending) route = pending as any;
      }
      router.replace(route as any);
      setIsProcessing(false);
    } else {
      setTimeout(() => {
        if (!currentUser) router.replace("/auth");
      }, 2000);
    }
  }, [currentUser, hasCompletedOnboarding, isLoading, isProcessing, isPasswordRecoveryFlow, legalAcceptanceStatus, session, emailVerified, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A73E8' }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

