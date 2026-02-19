/**
 * Auth callback - Processes OAuth/email links. No redirects - AppGate handles routing.
 */
import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { getAndClearPendingAuthUrl } from "@/lib/pending-auth-url";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function AuthCallbackScreen() {
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processUrl = async (url: string) => {
      if (!url) {
        setIsProcessing(false);
        return;
      }
      if (Platform.OS !== "web") {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) {
            console.warn("Auth callback exchange error:", error.message);
          }
        } catch (e) {
          console.warn("Auth callback error:", e);
        }
      }
      setIsProcessing(false);
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      processUrl(url);
    });

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
      else setIsProcessing(false);
    });

    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A73E8",
  },
});
