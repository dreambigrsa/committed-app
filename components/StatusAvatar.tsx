/**
 * StatusAvatar Component
 * 
 * Reusable avatar component that shows a green ring if user has an active status
 * Makes the avatar clickable to view the status
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getUserStatuses } from '@/lib/status-queries';
import type { Status } from '@/lib/status-queries';

interface StatusAvatarProps {
  userId: string;
  avatarUrl?: string | null;
  userName?: string;
  size?: number;
  showStatusRing?: boolean;
  onPress?: () => void;
}

export default function StatusAvatar({
  userId,
  avatarUrl,
  userName,
  size = 44,
  showStatusRing = true,
  onPress: customOnPress,
}: StatusAvatarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [hasActiveStatus, setHasActiveStatus] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const styles = StyleSheet.create({
    container: {
      position: 'relative',
    },
    avatarContainer: {
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      borderWidth: hasActiveStatus && showStatusRing ? 2.5 : 0,
      borderColor: colors.primary,
    },
    avatar: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderText: {
      fontSize: size * 0.45,
      fontWeight: '600' as const,
      color: colors.text.white,
    },
  });

  useEffect(() => {
    if (!showStatusRing || !userId || userId === 'undefined' || userId === 'null') {
      return;
    }

    const checkStatus = async () => {
      setIsChecking(true);
      try {
        const statuses = await getUserStatuses(userId);
        setHasActiveStatus(statuses.length > 0);
      } catch (error) {
        console.error('Error checking user status:', error);
        setHasActiveStatus(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkStatus();
  }, [userId, showStatusRing]);

  const handlePress = () => {
    if (customOnPress) {
      customOnPress();
      return;
    }

    // Default: Navigate to status viewer if has active status
    if (hasActiveStatus) {
      router.push(`/status/${userId}` as any);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={hasActiveStatus ? 0.7 : 1}
      disabled={isChecking}
    >
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              {userName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

