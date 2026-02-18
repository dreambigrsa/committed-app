import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppContext, useApp } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotificationToast from "../components/NotificationToast";
import BanMessageModal from "@/components/BanMessageModal";
import LegalAcceptanceEnforcer from "@/components/LegalAcceptanceEnforcer";
import AppGate from "@/components/AppGate";
import { setPendingAuthUrl } from "@/lib/pending-auth-url";
import { setPendingRoute } from "@/lib/pending-route";
import { parseDeepLink } from "@/lib/deep-links";
import { setStoredReferralCode } from "@/lib/referral-storage";

function RootLayoutNav() {
  const router = useRouter();
  const { banModalVisible, banModalData, setBanModalVisible, currentUser, isLoading, session } = useApp();
  const isAuthenticated = !!session;

  // Web cold start: recovery hash → auth-callback so hash is processed.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const href = window.location.href;
    const hash = window.location.hash || "";
    const hasRecovery = hash.includes("type=recovery") || hash.includes("access_token=");
    const isAuthCallbackPath = href.includes("/auth-callback");
    if (hasRecovery && !isAuthCallbackPath) {
      router.replace("/auth-callback" + hash);
    }
  }, []);

  // Deep link handler: run only after auth hydration to avoid races. Auth links handled immediately; post/reel when authenticated or store as pending.
  const handleUrl = (url: string, afterHydration: boolean) => {
    const parsed = parseDeepLink(url);
    if (!parsed) return;
    if (parsed.type === "auth") {
      setPendingAuthUrl(url);
      router.replace("/auth-callback");
      return;
    }
    if (parsed.type === "referral" && parsed.referralCode) {
      setStoredReferralCode(parsed.referralCode).catch(() => {});
      if (afterHydration) router.replace("/");
      return;
    }
    if (parsed.type === "post" && parsed.postId) {
      const route = `/post/${parsed.postId}`;
      if (afterHydration && isAuthenticated) {
        router.replace(route as any);
      } else {
        setPendingRoute(route);
      }
      return;
    }
    if (parsed.type === "reel" && parsed.reelId) {
      const route = `/reel/${parsed.reelId}`;
      if (afterHydration && isAuthenticated) {
        router.replace(route as any);
      } else {
        setPendingRoute(route);
      }
      return;
    }
  };

  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url, !isLoading);
    });
    return () => sub.remove();
  }, [router, isLoading, isAuthenticated]);

  // Cold start: process initial URL only after auth hydration to prevent flicker and wrong route.
  useEffect(() => {
    if (isLoading) return;
    (async () => {
      const initial = await Linking.getInitialURL();
      if (initial) {
        handleUrl(initial, true);
        return;
      }
      if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.href) {
        handleUrl(window.location.href, true);
      }
    })();
  }, [isLoading]);

  return (
    <AppGate>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="legal/[slug]" options={{ headerShown: true, title: 'Legal Document' }} />
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
    </AppGate>
  );
}

export default function RootLayout() {
  return (
    <AppContext>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <RootLayoutNav />
        </GestureHandlerRootView>
      </ThemeProvider>
    </AppContext>
  );
}
