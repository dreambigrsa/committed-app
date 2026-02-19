/**
 * Auth callback - Processes OAuth/email links. No redirects - AppGate handles routing.
 * For password recovery links (type=recovery), sets recovery flag so AppGate sends user to /reset-password.
 */
import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import { Platform , View, ActivityIndicator, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";
import { getAndClearPendingAuthUrl } from "@/lib/pending-auth-url";
import { useAuth } from "@/contexts/AuthContext";
import { setPendingPasswordRecovery } from "@/lib/pending-password-recovery";

export default function AuthCallbackScreen() {
  const [isProcessing, setIsProcessing] = useState(true);
  const { setPasswordRecovery } = useAuth();

  useEffect(() => {
    const processUrl = async (url: string) => {
      if (!url) {
        setIsProcessing(false);
        return;
      }
      const isRecoveryUrl = url.includes("type=recovery");
      try {
        if (Platform.OS === "web") {
          // Web: verification/password-recovery links use hash (#access_token=...&refresh_token=...&type=recovery)
          // or query (?code=... for PKCE). Parse and set session so AuthContext picks it up.
          const hashIdx = url.indexOf("#");
          const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : "";
          const queryIdx = url.indexOf("?");
          const query = queryIdx >= 0 ? url.slice(queryIdx + 1).replace(/#.*/, "") : "";
          const paramsFromHash = hash ? new URLSearchParams(hash) : null;
          const paramsFromQuery = query ? new URLSearchParams(query) : null;
          const accessToken = paramsFromHash?.get("access_token") ?? paramsFromQuery?.get("access_token");
          const refreshToken = paramsFromHash?.get("refresh_token") ?? paramsFromQuery?.get("refresh_token");
          const code = paramsFromQuery?.get("code");

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(url);
            if (error) console.warn("Auth callback exchange (code) error:", error.message);
            if (!error && isRecoveryUrl) {
              setPendingPasswordRecovery(true);
              setPasswordRecovery(true);
            }
          } else if (accessToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken ?? "",
            });
            if (error) console.warn("Auth callback setSession error:", error.message);
            // setSession() emits SIGNED_IN, not PASSWORD_RECOVERY — set flags so AppGate sends to /reset-password
            if (!error && isRecoveryUrl) {
              setPendingPasswordRecovery(true);
              setPasswordRecovery(true);
            }
          }
        } else {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) console.warn("Auth callback exchange error:", error.message);
          if (!error && isRecoveryUrl) {
            setPendingPasswordRecovery(true);
            setPasswordRecovery(true);
          }
        }
      } catch (e) {
        console.warn("Auth callback error:", e);
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
  }, [setPasswordRecovery]);

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
