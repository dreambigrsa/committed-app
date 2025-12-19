export type NotificationPreferences = {
  soundEnabled: boolean;
};

let prefs: NotificationPreferences = {
  soundEnabled: true,
};

export function getNotificationPreferences(): NotificationPreferences {
  return prefs;
}

export function setNotificationPreferences(next: Partial<NotificationPreferences>) {
  prefs = { ...prefs, ...next };
}


