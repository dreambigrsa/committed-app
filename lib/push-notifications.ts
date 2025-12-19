import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { getNotificationPreferences } from '@/lib/notification-preferences';

// Ensure notifications show an alert even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    // Play sound while foregrounded if the user has sounds enabled.
    // (Background sound behavior is controlled by OS + Android channel + payload)
    shouldPlaySound: getNotificationPreferences().soundEnabled,
    shouldSetBadge: false,
  }),
});

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
  const soundEnabled = options?.soundEnabled ?? getNotificationPreferences().soundEnabled;

  // Android notification sound is tied to the channel and can't be changed after creation.
  // So we keep separate channels and select between them in the push payload.
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('default-silent', {
    name: 'default-silent',
    importance: Notifications.AndroidImportance.MAX,
    sound: undefined as any,
  });

  // Also ensure the currently-selected channel exists (no-op if already created).
  // (The sender chooses the channelId; this is here for local notifications.)
  const activeId = soundEnabled ? 'default' : 'default-silent';
  await Notifications.setNotificationChannelAsync(activeId, {
    name: activeId,
    importance: Notifications.AndroidImportance.MAX,
    sound: soundEnabled ? 'default' : (undefined as any),
  });
}

export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      // Push tokens do not work on emulators/simulators.
      return null;
    }

    // Android: notification channel is required for visible notifications.
    if (Platform.OS === 'android') {
      await configureAndroidNotificationChannel();
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
    console.error('Failed to register for push notifications:', e);
    return null;
  }
}

export async function showLocalNotification(params: { title: string; body: string; data?: any }) {
  try {
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
    console.error('Failed to show local notification:', e);
  }
}


