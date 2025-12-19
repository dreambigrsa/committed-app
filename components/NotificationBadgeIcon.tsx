import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';

interface NotificationBadgeIconProps {
  color: string;
}

export default function NotificationBadgeIcon({ color }: NotificationBadgeIconProps) {
  const { getUnreadNotificationsCount, cheatingAlerts } = useApp();
  
  const unreadCount = getUnreadNotificationsCount();
  const unreadAlerts = Array.isArray(cheatingAlerts) ? cheatingAlerts.filter(a => !a.read).length : 0;
  const totalUnread = unreadCount + unreadAlerts;

  return (
    <View style={styles.container}>
      <Bell size={24} color={color} />
      {totalUnread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

