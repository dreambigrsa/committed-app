/**
 * Auth callback – single handler for email verification and password recovery deep links.
 * Uses global auth-link state so ResetPassword does not show "expired" before exchange completes.
 * - Resolve URL: web = window.location.href first; native = pendingAuthUrl else getInitialURL.
 * - Parse query + hash; exchange session; poll getSession up to 2s; then navigate.
 * - Clear pendingAuthUrl only after successful navigation.
 */
import { useEffect, useState, useRef } from "react";
import * as Linking from "expo-linking";
import { Platform, View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { getPendingAuthUrl, clearPendingAuthUrl } from "@/lib/pending-auth-url";
import {
  setAuthLinkProcessing,
  setAuthLinkSuccess,
  setAuthLinkError,
  resetAuthLinkState,
} from "@/lib/auth-link-state";
import { useAuth } from "@/contexts/AuthContext";
import { setPendingPasswordRecovery } from "@/lib/pending-password-recovery";
import {
  setCallbackProcessing,
  getProcessingTimeoutMs,
  wasUrlProcessed,
  markUrlProcessed,
} from "@/lib/auth-callback-state";

type CallbackUIState = "loading" | "error" | "done";

const SESSION_POLL_MS = 200;
const SESSION_POLL_MAX_MS = 2000;

function parseAuthParams(url: string) {
  const hashIdx = url.indexOf("#");
  const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : "";
  const queryIdx = url.indexOf("?");
  const query = queryIdx >= 0 ? url.slice(queryIdx + 1).replace(/#.*/, "") : "";
  const fromHash = hash ? new URLSearchParams(hash) : null;
  const fromQuery = query ? new URLSearchParams(query) : null;
  const code = fromQuery?.get("code") ?? fromHash?.get("code") ?? null;
  const accessToken = fromHash?.get("access_token") ?? fromQuery?.get("access_token") ?? null;
  const refreshToken = fromHash?.get("refresh_token") ?? fromQuery?.get("refresh_token") ?? null;
  const typeRecovery =
    url.includes("type=recovery") ||
    fromHash?.get("type") === "recovery" ||
    fromQuery?.get("type") === "recovery";
  return { code, accessToken, refreshToken, typeRecovery };
}

function redactUrl(url: string): string {
  try {
    const u = url.replace(/access_token=[^&]+/, "access_token=***").replace(/refresh_token=[^&]+/, "refresh_token=***");
    return u.length > 120 ? u.slice(0, 120) + "…" : u;
  } catch {
    return "[invalid url]";
  }
}

async function waitForSession(maxMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data } = await supabase.auth.getSession();
    if (data?.session) return true;
    await new Promise((r) => setTimeout(r, SESSION_POLL_MS));
  }
  return false;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [uiState, setUiState] = useState<CallbackUIState>("loading");
  const { setPasswordRecovery } = useAuth();
  const navigatedRef = useRef(false);
  const processedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const navigateOnce = (route: string) => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      setCallbackProcessing(false);
      setAuthLinkSuccess();
      clearPendingAuthUrl();
      if (__DEV__) console.log("[AUTH_CALLBACK] final navigation target:", route);
      router.replace(route as any);
    };

    const showError = (message?: string) => {
      if (cancelled) return;
      setCallbackProcessing(false);
      setAuthLinkError(message ?? "Link expired or invalid");
      setUiState("error");
    };

    const processUrl = async (url: string) => {
      if (!url || cancelled) return;

      const redacted = redactUrl(url);
      if (__DEV__) console.log("[AUTH_CALLBACK] full URL received (redacted):", redacted);

      const { code, accessToken, refreshToken, typeRecovery } = parseAuthParams(url);
      const hasCode = !!code;
      const hasToken = !!accessToken;
      const intent = typeRecovery ? ("recovery" as const) : ("verify" as const);

      if (__DEV__) {
        console.log("[AUTH_CALLBACK] parsed params: type=" + intent + ", code=" + hasCode + ", token=" + hasToken);
      }

      setAuthLinkProcessing(intent);
      setCallbackProcessing(true);
      if (typeRecovery) {
        setPendingPasswordRecovery(true);
        setPasswordRecovery(true);
      }

      if (wasUrlProcessed(url)) {
        if (__DEV__) console.log("[AUTH_CALLBACK] idempotent skip, routing by intent");
        const hasSession = await waitForSession(800);
        if (hasSession) {
          if (typeRecovery) navigateOnce("/reset-password");
          else navigateOnce("/verify-email");
        } else {
          if (typeRecovery) navigateOnce("/reset-password");
          else navigateOnce("/verify-email");
        }
        return;
      }

      if (!hasCode && !hasToken) {
        if (__DEV__) console.warn("[AUTH_CALLBACK] no code or token in URL");
        showError("No token or code in URL");
        return;
      }

      try {
        if (__DEV__) {
          const { data: before } = await supabase.auth.getSession();
          console.log("[AUTH_CALLBACK] session state before exchange:", before?.session ? "exists" : "null");
        }

        let error: { message: string } | null = null;
        if (__DEV__) {
          const exchangePath = code ? "code" : hasToken ? "tokens" : "code-fallback";
          console.log("[AUTH_CALLBACK] exchange path chosen:", exchangePath);
        }

        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(url);
          error = result.error;
          if (__DEV__) console.log("[AUTH_CALLBACK] exchange path: code, result:", error ? error.message : "ok");
        } else if (accessToken) {
          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? "",
          });
          error = result.error;
          if (__DEV__) console.log("[AUTH_CALLBACK] exchange path: tokens, result:", error ? error.message : "ok");
        } else if (Platform.OS !== "web") {
          const result = await supabase.auth.exchangeCodeForSession(url);
          error = result.error;
          if (__DEV__) console.log("[AUTH_CALLBACK] exchange path: code-fallback, result:", error ? error.message : "ok");
        }

        if (cancelled) return;
        if (error) {
          if (__DEV__) console.warn("[AUTH_CALLBACK] exchange error:", error.message);
          showError(error.message);
          return;
        }

        const hasSession = await waitForSession(SESSION_POLL_MAX_MS);
        if (__DEV__) console.log("[AUTH_CALLBACK] session after exchange:", hasSession ? "exists" : "missing after poll");

        if (cancelled) return;

        markUrlProcessed(url);
        if (typeRecovery) {
          navigateOnce("/reset-password");
        } else {
          navigateOnce("/verify-email");
        }
      } catch (e: any) {
        if (__DEV__) console.warn("[AUTH_CALLBACK] exception:", e?.message ?? e);
        if (!cancelled) showError(e?.message ?? "Exchange failed");
      } finally {
        if (!cancelled && !navigatedRef.current) setCallbackProcessing(false);
      }
    };

    const getUrl = (): string | null => {
      const pending = getPendingAuthUrl();
      if (pending) return pending;
      if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.href) {
        const href = window.location.href;
        if (href.includes("auth-callback") || href.includes("code=") || href.includes("access_token=") || href.includes("#")) {
          return href;
        }
      }
      return null;
    };

    const getUrlAsync = async (): Promise<string | null> => {
      const sync = getUrl();
      if (sync) return sync;
      const initial = await Linking.getInitialURL();
      if (initial) return initial;
      return null;
    };

    const run = async () => {
      if (processedRef.current || cancelled) return;
      let url = await getUrlAsync();
      if (Platform.OS !== "web" && !url) {
        await new Promise((r) => setTimeout(r, 400));
        url = await Linking.getInitialURL();
      }
      if (cancelled) return;
      if (url) {
        processedRef.current = true;
        await processUrl(url);
      } else {
        if (!processedRef.current) {
          setCallbackProcessing(false);
          setAuthLinkError("No auth URL");
          setUiState("error");
        }
      }
    };

    run();

    timeoutId = setTimeout(() => {
      if (cancelled) return;
      if (!navigatedRef.current) {
        if (__DEV__) console.warn("[AUTH_CALLBACK] timeout, showing error UI");
        showError("Timeout");
      }
    }, getProcessingTimeoutMs());

    const sub = Linking.addEventListener("url", ({ url: eventUrl }) => {
      if (processedRef.current) return;
      const { typeRecovery } = parseAuthParams(eventUrl);
      if (__DEV__) console.log("[AUTH_CALLBACK] runtime url, intent:", typeRecovery ? "recovery" : "verify");
      processedRef.current = true;
      processUrl(eventUrl);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
      if (!navigatedRef.current) setCallbackProcessing(false);
    };
  }, [router, setPasswordRecovery]);

  if (uiState === "error") {
    return (
      <View style={[styles.container, styles.errorBox]}>
        <Text style={styles.errorTitle}>Link expired or invalid</Text>
        <Text style={styles.errorText}>
          This link may have been used already or has expired. Request a new reset email from the sign-in screen.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => { resetAuthLinkState(); router.replace("/auth"); }}>
          <Text style={styles.primaryBtnText}>Back to Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => { resetAuthLinkState(); router.replace("/auth"); }}>
          <Text style={styles.secondaryBtnText}>Request new reset email</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
  errorBox: {
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  primaryBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: "stretch",
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A73E8",
  },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "stretch",
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
