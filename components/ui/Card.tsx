import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, borderRadius, shadows } from '@/constants/design-system';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: ViewStyle;
  activeOpacity?: number;
}

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  onPress,
  style,
  activeOpacity = 0.7,
}: CardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getCardStyle = () => {
    const baseStyle = [styles.card, styles[`padding_${padding}`]];
    
    if (variant === 'elevated') {
      return [...baseStyle, styles.elevated];
    } else if (variant === 'outlined') {
      return [...baseStyle, styles.outlined];
    } else if (variant === 'flat') {
      return [...baseStyle, styles.flat];
    }
    return [...baseStyle, styles.default];
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        style={[getCardStyle(), style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[getCardStyle(), style]}>
      {children}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background.secondary,
    },
    default: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    elevated: {
      backgroundColor: colors.background.secondary,
      ...shadows.md,
    },
    outlined: {
      backgroundColor: colors.background.primary,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    flat: {
      backgroundColor: colors.background.secondary,
    },
    padding_none: {
      padding: 0,
    },
    padding_sm: {
      padding: spacing.sm,
    },
    padding_md: {
      padding: spacing.md,
    },
    padding_lg: {
      padding: spacing.lg,
    },
  });

