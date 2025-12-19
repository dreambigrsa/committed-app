import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppContext, useApp } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { trpc, trpcClient } from "@/lib/trpc";
import NotificationToast from "../components/NotificationToast";
import BanMessageModal from "@/components/BanMessageModal";
import LegalAcceptanceEnforcer from "@/components/LegalAcceptanceEnforcer";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { banModalVisible, banModalData, setBanModalVisible, currentUser } = useApp();

  return (
    <>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="verify-email" options={{ headerShown: true, title: 'Verify Email' }} />
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

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContext>
          <ThemeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </ThemeProvider>
        </AppContext>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
