import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppContext, useApp } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppGate from "@/components/AppGate";
import NotificationToast from "../components/NotificationToast";
import BanMessageModal from "@/components/BanMessageModal";
import LegalAcceptanceEnforcer from "@/components/LegalAcceptanceEnforcer";
import { setPendingAuthUrl } from "@/lib/pending-auth-url";
import { setPendingPasswordRecovery } from "@/lib/pending-password-recovery";
import { setPendingDeepLink, isAuthLink } from "@/lib/deep-link-service";
import { isAbortLikeError } from "@/lib/abort-error";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();

  // Cold start: capture initial URL (auth -> auth-callback; content/referral -> store for AppGate)
  useEffect(() => {
    (async () => {
      const initial = await Linking.getInitialURL();
      if (Platform.OS === "web" && typeof window !== "undefined" && !initial) {
        const href = window.location.href;
        if (href && (href.includes("post/") || href.includes("reel/") || href.includes("referral") || href.includes("access_token=") || href.includes("type=recovery") || href.includes("code="))) {
          if (href.includes("type=recovery") || href.includes("access_token=")) {
            if (href.includes("type=recovery")) setPendingPasswordRecovery(true);
            const isAuthCallbackPath = href.includes("/auth-callback");
            if (!isAuthCallbackPath) router.replace("/auth-callback" + (window.location.hash || ""));
          } else {
            setPendingDeepLink(href);
          }
          return;
        }
      }
      if (!initial) return;
      if (isAuthLink(initial)) {
        if (initial.includes("type=recovery")) setPendingPasswordRecovery(true);
        setPendingAuthUrl(initial);
        router.replace("/auth-callback");
      } else {
        setPendingDeepLink(initial);
      }
    })();
  }, [router]);

  // Background / already open: same split — auth vs content/referral
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (isAuthLink(url)) {
        setPendingAuthUrl(url);
        router.replace("/auth-callback");
      } else {
        setPendingDeepLink(url);
      }
    });
    return () => sub.remove();
  }, [router]);

  return <StackContent />;
}

function StackContent() {
  const { banModalVisible, banModalData, setBanModalVisible, currentUser } = useApp();

  return (
    <>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="legal/[slug]" options={{ headerShown: true, title: "Legal Document" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[userId]" options={{ headerShown: true, title: "Profile" }} />
        <Stack.Screen name="relationship/register" options={{ presentation: "modal", title: "Register Relationship" }} />
        <Stack.Screen name="messages/[conversationId]" options={{ headerShown: true, title: "Chat" }} />
        <Stack.Screen name="admin/index" options={{ headerShown: true, title: "Admin Dashboard" }} />
        <Stack.Screen name="admin/advertisements" options={{ headerShown: true, title: "Advertisements" }} />
        <Stack.Screen name="admin/stickers" options={{ headerShown: true, title: "Sticker Management" }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: "Settings" }} />
        <Stack.Screen name="settings/2fa" options={{ headerShown: true, title: "Two-Factor Authentication" }} />
        <Stack.Screen name="settings/sessions" options={{ headerShown: true, title: "Active Sessions" }} />
        <Stack.Screen name="settings/blocked-users" options={{ headerShown: true, title: "Blocked Users" }} />
        <Stack.Screen name="settings/become-professional" options={{ headerShown: true, title: "Become a Professional" }} />
        <Stack.Screen name="settings/professional-availability" options={{ headerShown: true, title: "Professional Availability" }} />
        <Stack.Screen name="professional/session-requests" options={{ headerShown: true, title: "Session Requests" }} />
        <Stack.Screen name="dating/premium" options={{ headerShown: true, title: "Go Premium" }} />
        <Stack.Screen name="dating/payment-submit" options={{ headerShown: true, title: "Submit Payment" }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <NotificationToast />
      {banModalVisible && banModalData && currentUser && (
        <BanMessageModal
          visible={banModalVisible}
          onClose={() => setBanModalVisible(false)}
          banReason={banModalData.reason}
          restrictionType={banModalData.restrictionType}
          restrictedFeature={banModalData.restrictedFeature}
          restrictionId={banModalData.restrictionId}
          userId={currentUser.id}
        />
      )}
      <LegalAcceptanceEnforcer />
    </>
  );
}

function isAuthAbortError(e: unknown): boolean {
  return isAbortLikeError(e);
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Supabase auth-js can throw "signal is aborted without reason" from a setTimeout in locks.js;
  // it escapes our promise catches. Suppress it so onboarding and other flows don't show a red box.
  useEffect(() => {
    let teardown: (() => void) | undefined;

    // React Native: ErrorUtils reports setTimeout/async errors (e.g. from locks.js); suppresses red box.
    const ErrorUtils = (globalThis as any).ErrorUtils;
    if (ErrorUtils?.getGlobalHandler) {
      const prev = ErrorUtils.getGlobalHandler();
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        if (isAuthAbortError(error)) return;
        prev?.(error, isFatal);
      });
      teardown = () => ErrorUtils.setGlobalHandler(prev);
    }

    // Web: promise rejections and window errors
    if (typeof (globalThis as any).addEventListener === 'function') {
      const onUnhandledRejection = (event: PromiseRejectionEvent) => {
        if (isAuthAbortError(event?.reason)) {
          event.preventDefault();
          event.stopPropagation?.();
        }
      };
      const onError = (event: ErrorEvent) => {
        if (event?.message && isAbortLikeError(new Error(event.message))) {
          event.preventDefault();
          return true;
        }
        return false;
      };
      (globalThis as any).addEventListener('unhandledrejection', onUnhandledRejection, true);
      (globalThis as any).addEventListener('error', onError, true);
      const prevTeardown = teardown;
      teardown = () => {
        (globalThis as any).removeEventListener('unhandledrejection', onUnhandledRejection, true);
        (globalThis as any).removeEventListener('error', onError, true);
        prevTeardown?.();
      };
    }

    return () => teardown?.();
  }, []);

  return (
    <AuthProvider>
    <AppContext>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AppGate>
          <RootLayoutNav />
            </AppGate>
        </GestureHandlerRootView>
      </ThemeProvider>
    </AppContext>
    </AuthProvider>
  );
}
