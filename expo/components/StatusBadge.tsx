import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserStatusType } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

interface StatusBadgeProps {
  status: UserStatusType;
  customStatusText?: string;
  showText?: boolean;
}

export default function StatusBadge({ 
  status, 
  customStatusText,
  showText = true 
}: StatusBadgeProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors, status);

  const getStatusLabel = () => {
    if (customStatusText) return customStatusText;
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  if (!showText) return null;

  return (
    <View style={styles.badge}>
      <View style={styles.dot} />
      <Text style={styles.text}>{getStatusLabel()}</Text>
    </View>
  );
}

const createStyles = (colors: any, status: UserStatusType) => {
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return '#4CAF50';
      case 'away':
        return '#FFC107';
      case 'busy':
        return '#F44336';
      case 'offline':
      default:
        return '#9E9E9E';
    }
  };

  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      alignSelf: 'flex-start',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: getStatusColor(),
    },
    text: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.text.secondary,
    },
  });
};

