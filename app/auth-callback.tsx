import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useApp } from "@/contexts/AppContext";

export default function AuthCallback() {
  const router = useRouter();
  const { currentUser, hasCompletedOnboarding, isLoading } = useApp();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processUrl = async (url: string) => {
      try {
        setIsProcessing(true);
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);

        if (error) {
          console.log("Error exchanging code:", error);
          router.replace("/auth");
          return;
        }

        // Wait for user data to load
        // The auth state change will trigger loadUserData in AppContext
        // We'll wait for that to complete before redirecting
      } catch (error) {
        console.error("Error processing auth callback:", error);
        router.replace("/auth");
      }
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

  // Once user data is loaded, redirect appropriately
  useEffect(() => {
    if (!isProcessing || isLoading) return;
    
    if (currentUser) {
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
  }, [currentUser, hasCompletedOnboarding, isLoading, isProcessing, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A73E8' }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

