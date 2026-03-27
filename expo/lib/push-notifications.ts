import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { getNotificationPreferences } from '@/lib/notification-preferences';

// Ensure notifications show an alert even when the app is foregrounded.
// Only set up notification handler on native platforms (not web)
if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: getNotificationPreferences().soundEnabled,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.warn('Failed to set notification handler:', error);
  }
}

function getExpoProjectId(): string | undefined {
  const anyConstants = Constants as any;
  // Try multiple paths to find projectId
  return (
    anyConstants?.expoConfig?.extra?.eas?.projectId ??
    anyConstants?.manifest2?.extra?.eas?.projectId ??
    anyConstants?.manifest?.extra?.eas?.projectId ??
    anyConstants?.easConfig?.projectId ??
    // Fallback: use the projectId from app.json if available
    '1ce53350-c138-459b-b181-9a1a06406108' // From app.json extra.eas.projectId
  );
}

export async function configureAndroidNotificationChannel(options?: { soundEnabled?: boolean }) {
  if (Platform.OS !== 'android') return;
  
  try {
    const soundEnabled = options?.soundEnabled ?? getNotificationPreferences().soundEnabled;

    // Android notification sound is tied to the channel and can't be changed after creation.
    // So we keep separate channels and select between them in the push payload.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    }).catch((error) => {
      console.warn('Error setting default notification channel:', error);
    });

    await Notifications.setNotificationChannelAsync('default-silent', {
      name: 'default-silent',
      importance: Notifications.AndroidImportance.MAX,
      sound: undefined as any,
    }).catch((error) => {
      console.warn('Error setting silent notification channel:', error);
    });

    // Also ensure the currently-selected channel exists (no-op if already created).
    // (The sender chooses the channelId; this is here for local notifications.)
    const activeId = soundEnabled ? 'default' : 'default-silent';
    await Notifications.setNotificationChannelAsync(activeId, {
      name: activeId,
      importance: Notifications.AndroidImportance.MAX,
      sound: soundEnabled ? 'default' : (undefined as any),
    }).catch((error) => {
      console.warn(`Error setting ${activeId} notification channel:`, error);
    });
  } catch (error) {
    console.warn('Error configuring Android notification channels:', error);
    // Don't throw - allow notifications to still work even if channel setup fails
  }
}

/**
 * Check if we're running in Expo Go (where remote push notifications are not supported in SDK 53+)
 */
function isRunningInExpoGo(): boolean {
  try {
    // Check appOwnership - 'expo' means Expo Go, 'standalone' means production build
    if (Constants.appOwnership === 'expo') {
      return true;
    }
    
    // Check executionEnvironment - STORE_CLIENT means Expo Go
    const executionEnvironment = Constants.executionEnvironment;
    if (executionEnvironment !== undefined) {
      // Constants.ExecutionEnvironment.STORE_CLIENT is the enum value for Expo Go
      const anyConstants = Constants as any;
      if (executionEnvironment === anyConstants?.ExecutionEnvironment?.STORE_CLIENT) {
        return true;
      }
      // Also check string value as fallback
      if (String(executionEnvironment) === 'storeClient') {
        return true;
      }
    }
    
    return false;
  } catch {
    // If we can't determine, assume it's not Expo Go to avoid breaking production builds
    return false;
  }
}

export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  try {
    // Push notifications are not available on web
    if (Platform.OS === 'web') {
      console.log('Push notifications are not available on web platform');
      return null;
    }

    // Skip push notification registration in Expo Go (not supported in SDK 53+)
    if (isRunningInExpoGo()) {
      console.log('Push notifications are not available in Expo Go. Use a development build for push notifications.');
      return null;
    }

    if (!Device.isDevice) {
      // Push tokens do not work on emulators/simulators.
      return null;
    }

    // Android: notification channel is required for visible notifications.
    if (Platform.OS === 'android') {
      try {
        await configureAndroidNotificationChannel();
      } catch (channelError) {
        console.warn('Failed to configure notification channel, continuing anyway:', channelError);
        // Continue registration even if channel setup fails
      }
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = getExpoProjectId();
    // Always pass projectId explicitly - getExpoPushTokenAsync requires it in bare workflow
    if (!projectId) {
      console.warn('Expo projectId not found. Push notifications may not work correctly.');
    }
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );
    const expoPushToken = tokenResponse.data;

    // Store/update token in Supabase so backend can send push notifications.
    // This table is created in the SQL files included in this repo.
    await supabase.from('push_notification_tokens').upsert(
      {
        user_id: userId,
        token: expoPushToken,
        platform: Platform.OS,
        active: true,
        updated_at: new Date().toISOString(),
      } as any,
      {
        onConflict: 'user_id,token',
      }
    );

    return expoPushToken;
  } catch (e) {
    // Silently handle the Expo Go error - we've already checked for it above
    // but catch it here in case the check misses it
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (errorMessage.includes('Expo Go') || errorMessage.includes('development build')) {
      console.log('Push notifications are not available in Expo Go. Use a development build for push notifications.');
      return null;
    }
    console.error('Failed to register for push notifications:', e);
    return null;
  }
}

export async function showLocalNotification(params: { title: string; body: string; data?: any }) {
  // Local notifications are not available on web
  if (Platform.OS === 'web') {
    console.log('Local notifications are not available on web platform');
    return;
  }

  try {
    // Check if the method is available (for safety)
    if (!Notifications.scheduleNotificationAsync) {
      console.warn('scheduleNotificationAsync is not available on this platform');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data ?? {},
        sound: getNotificationPreferences().soundEnabled ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    // Silently handle errors - don't crash the app
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (errorMessage.includes('not available on web') || errorMessage.includes('native dependencies')) {
      console.log('Local notifications are not available on this platform');
    } else {
      console.error('Failed to show local notification:', e);
    }
  }
}


