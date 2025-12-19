import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Bell, X, Heart, MessageCircle, UserPlus, AlertTriangle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Notification, NotificationType } from '@/types';

export default function NotificationToast() {
  const router = useRouter();
  const { notifications, markNotificationAsRead } = useApp();
  const { colors } = useTheme();
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const previousNotificationsRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -200,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      setCurrentNotification(null);
    });
  }, [slideAnim, opacityAnim]);

  const showToast = useCallback(() => {
    setIsVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after 5 seconds
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, 5000);
  }, [slideAnim, opacityAnim, hideToast]);

  // Watch for new notifications
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;

    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const latestNotification = unreadNotifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    if (latestNotification && !previousNotificationsRef.current.has(latestNotification.id)) {
      previousNotificationsRef.current.add(latestNotification.id);
      setCurrentNotification(latestNotification);
      showToast();
    }
  }, [notifications, showToast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePress = () => {
    if (currentNotification) {
      markNotificationAsRead(currentNotification.id);
      router.push('/(tabs)/notifications' as any);
      hideToast();
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'relationship_request':
        return <Heart size={20} color={colors.danger} fill={colors.danger} />;
      case 'cheating_alert':
        return <AlertTriangle size={20} color={colors.accent} />;
      case 'post_like':
        return <Heart size={20} color={colors.danger} />;
      case 'post_comment':
        return <MessageCircle size={20} color={colors.primary} />;
      case 'message':
        return <MessageCircle size={20} color={colors.primary} />;
      case 'follow':
        return <UserPlus size={20} color={colors.secondary} />;
      default:
        return <Bell size={20} color={colors.text.secondary} />;
    }
  };

  if (!isVisible || !currentNotification) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.toast, { backgroundColor: colors.background.primary, borderColor: colors.border.light }]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.background.secondary }]}>
          {getNotificationIcon(currentNotification.type)}
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
            {currentNotification.title}
          </Text>
          <Text style={[styles.message, { color: colors.text.secondary }]} numberOfLines={2}>
            {currentNotification.message}
          </Text>
        </View>
        <TouchableOpacity
          onPress={hideToast}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color={colors.text.tertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  message: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeButton: {
    padding: 4,
  },
});

