import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Check, X, AlertTriangle, MessageCircle, Bell, UserPlus, CheckCircle2, Trash2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Notification, NotificationType } from '@/types';
import { supabase } from '@/lib/supabase';

export default function NotificationsScreen() {
  const router = useRouter();
  const { 
    getPendingRequests, 
    acceptRelationshipRequest, 
    rejectRelationshipRequest,
    notifications,
    cheatingAlerts,
    markNotificationAsRead,
    deleteNotification,
    clearAllNotifications,
    posts,
    reels,
  } = useApp();
  const { colors } = useTheme();
  const pendingRequests = getPendingRequests();
  const [activeTab, setActiveTab] = useState<'all' | 'requests'>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [userCache, setUserCache] = useState<Record<string, string>>({});

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const getRelationshipTypeLabel = (type: string) => {
    const labels = {
      married: 'Married',
      engaged: 'Engaged',
      serious: 'Serious Relationship',
      dating: 'Dating',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const handleAccept = async (requestId: string) => {
    await acceptRelationshipRequest(requestId);
  };

  const handleReject = async (requestId: string) => {
    await rejectRelationshipRequest(requestId);
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'relationship_request':
        return <Heart size={24} color={colors.danger} fill={colors.danger} />;
      case 'cheating_alert':
        return <AlertTriangle size={24} color={colors.accent} />;
      case 'relationship_verified':
        return <CheckCircle2 size={24} color={colors.secondary} />;
      case 'relationship_ended':
        return <Heart size={24} color={colors.text.tertiary} />;
      case 'post_like':
        return <Heart size={24} color={colors.danger} />;
      case 'post_comment':
        return <MessageCircle size={24} color={colors.primary} />;
      case 'message':
        return <MessageCircle size={24} color={colors.primary} />;
      case 'follow':
        return <UserPlus size={24} color={colors.secondary} />;
      default:
        return <Bell size={24} color={colors.text.secondary} />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadNotifications = notifications.filter(n => !n.read);
  const unreadAlerts = cheatingAlerts.filter(a => !a.read);

  const allNotifications = [
    ...notifications.map(n => ({ ...n, source: 'notification' as const })),
    ...cheatingAlerts.map(a => ({
      id: a.id,
      userId: a.userId,
      type: 'cheating_alert' as NotificationType,
      title: 'Cheating Alert',
      message: a.description,
      data: { partnerUserId: a.partnerUserId, alertType: a.alertType },
      read: a.read,
      createdAt: a.createdAt,
      source: 'alert' as const,
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleNotificationPress = async (notification: Notification & { source: 'notification' | 'alert' }) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    // Navigate based on notification type
    const data = notification.data || {};
    
    switch (notification.type) {
      case 'post_like':
        // Check if it's a reel like (has reelId) or post like
        if (data.reelId) {
          router.push('/(tabs)/reels' as any);
        } else if (data.postId) {
          router.push('/(tabs)/feed' as any);
        }
        break;
      case 'post_comment':
        // Check if it's a reel comment
        if (data.reelId) {
          router.push('/(tabs)/reels' as any);
        } else if (data.postId) {
          router.push('/(tabs)/feed' as any);
        }
        break;
      case 'message':
        if (data.conversationId) {
          router.push(`/messages/${data.conversationId}` as any);
        }
        break;
      case 'follow':
        if (data.followerId) {
          router.push(`/profile/${data.followerId}` as any);
        }
        break;
      case 'status_reaction':
        // Navigate to the status owner's status viewer (the person who owns the status that was reacted to)
        // data.statusOwnerId is the owner of the status, data.userId is the person who reacted
        if (data.statusOwnerId) {
          router.push(`/status/${data.statusOwnerId}` as any);
        } else if (data.statusId) {
          // Fallback: if statusOwnerId not available, we need to fetch it from the status
          // But for now, we can't navigate without the owner ID, so just show an error
          console.warn('Status owner ID not available in notification data');
        }
        break;
      case 'relationship_request':
        setActiveTab('requests');
        break;
      default:
        // For other types, just mark as read
        break;
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteNotification(notificationId);
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllNotifications();
          },
        },
      ]
    );
  };

  const fetchUserName = async (userId: string): Promise<string | null> => {
    // Check cache first
    if (userCache[userId]) {
      return userCache[userId];
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (error || !data) return null;

      const fullName = data.full_name;
      setUserCache(prev => ({ ...prev, [userId]: fullName }));
      return fullName;
    } catch (error) {
      console.error('Error fetching user name:', error);
      return null;
    }
  };

  const extractUsername = async (message: string, notification: Notification & { source: 'notification' | 'alert' }): Promise<{ username: string; userId: string } | null> => {
    const data = notification.data || {};
    
    // First, try to get userId from notification data (most reliable)
    const userId = data.userId || data.followerId || data.senderId;
    
      if (userId) {
        // Try cache first
        let username: string | null = userCache[userId] || null;
        
        if (!username) {
          // Try to find username from posts/reels
          const post = posts.find(p => p.userId === userId);
          const reel = reels.find(r => r.userId === userId);
          username = post?.userName || reel?.userName || null;
          
          // If still not found, fetch from database
          if (!username) {
            username = await fetchUserName(userId);
          }
        }
        
        if (username) {
          return { username, userId };
        }
      }
    
    // Fallback: Try to extract from message text
    const match = message.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (match) {
      const fullName = match[1];
      // Try to find user by name in posts/reels
      const allUsers = new Set<string>();
      posts.forEach(p => {
        if (p.userName === fullName) allUsers.add(p.userId);
      });
      reels.forEach(r => {
        if (r.userName === fullName) allUsers.add(r.userId);
      });
      const foundUserId = allUsers.size === 1 ? Array.from(allUsers)[0] : null;
      if (foundUserId) {
        return { username: fullName, userId: foundUserId };
      }
    }
    return null;
  };

  const NotificationMessage = ({ message, notification }: { message: string; notification: Notification & { source: 'notification' | 'alert' } }) => {
    const [usernameInfo, setUsernameInfo] = useState<{ username: string; userId: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const loadUsername = async () => {
        const info = await extractUsername(message, notification);
        setUsernameInfo(info);
        setIsLoading(false);
      };
      loadUsername();
    }, [message, notification]);

    if (isLoading) {
      return (
        <Text style={[styles.notificationText, !notification.read && styles.unreadText]}>
          {message}
        </Text>
      );
    }

    if (usernameInfo && usernameInfo.userId && usernameInfo.username) {
      // Split message by username, handling case-insensitive matching
      const usernameRegex = new RegExp(usernameInfo.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const parts = message.split(usernameRegex);
      const match = message.match(usernameRegex);
      
      if (match && parts.length >= 2) {
        return (
          <Text style={[styles.notificationText, !notification.read && styles.unreadText]}>
            {parts[0]}
            <Text
              style={[styles.notificationText, !notification.read && styles.unreadText, styles.clickableUsername]}
              onPress={() => router.push(`/profile/${usernameInfo.userId}` as any)}
            >
              {match[0]}
            </Text>
            {parts.slice(1).join(match[0])}
          </Text>
        );
      }
    }

    return (
      <Text style={[styles.notificationText, !notification.read && styles.unreadText]}>
        {message}
      </Text>
    );
  };

  const renderNotificationItem = ({ item }: { item: Notification & { source: 'notification' | 'alert' } }) => (
    <View style={[styles.notificationCard, !item.read && styles.unreadNotification]}>
      <TouchableOpacity
        style={styles.notificationContentWrapper}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, !item.read && styles.unreadIconContainer]}>
          {getNotificationIcon(item.type)}
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          <NotificationMessage message={item.message} notification={item} />
          <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteNotification(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Trash2 size={18} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  );

  const renderRequestItem = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestHeaderLeft}>
          <View style={styles.requestIconContainer}>
            <Heart size={28} color={colors.danger} fill={colors.danger} />
          </View>
          <View style={styles.requestInfo}>
            <Text style={styles.requestTitle}>Relationship Request</Text>
            <Text style={styles.requestText}>
              <Text style={styles.requestName}>{item.fromUserName}</Text> wants to
              register you as their partner in a{' '}
              {getRelationshipTypeLabel(item.relationshipType).toLowerCase()}
            </Text>
            <Text style={styles.requestDate}>
              {new Date(item.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
        >
          <X size={20} color={colors.text.white} />
          <Text style={styles.rejectButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAccept(item.id)}
        >
          <Check size={20} color={colors.text.white} />
          <Text style={styles.acceptButtonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Notifications</Text>
          {allNotifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.clearAllButton}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        <Animated.View style={[styles.tabs, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              All {unreadNotifications.length + unreadAlerts.length > 0 && `(${unreadNotifications.length + unreadAlerts.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
              Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {activeTab === 'all' ? (
        allNotifications.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <Bell size={80} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>
              You&apos;ll be notified about important events and updates here
            </Text>
          </Animated.View>
        ) : (
          <FlatList
            data={allNotifications}
            renderItem={renderNotificationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        pendingRequests.length === 0 ? (
          <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
            <Heart size={80} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyText}>
              You&apos;ll be notified when someone sends you a relationship request
            </Text>
          </Animated.View>
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderRequestItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.background.primary,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.text.white,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  requestCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  requestHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 14,
  },
  requestIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.badge.pending,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flex: 1,
    gap: 4,
  },
  requestTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  requestText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  requestName: {
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  requestDate: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rejectButton: {
    backgroundColor: colors.text.tertiary,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  acceptButton: {
    backgroundColor: colors.secondary,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  clearAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearAllText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.danger,
  },
  notificationCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  notificationContentWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  clickableUsername: {
    fontWeight: '700' as const,
    color: colors.primary,
  },
  deleteButton: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadNotification: {
    backgroundColor: colors.badge.pending,
    borderColor: colors.primary + '40',
    borderWidth: 2,
  },
  unreadIconContainer: {
    backgroundColor: colors.background.primary,
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  notificationText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  unreadText: {
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
