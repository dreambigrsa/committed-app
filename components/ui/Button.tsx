import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, borderRadius, typography, sizes } from '@/constants/design-system';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const isDisabled = disabled || loading;

  const getButtonStyle = () => {
    const baseStyle = [
      styles.button,
      styles[`button_${size}`],
      fullWidth && styles.fullWidth,
    ];

    if (variant === 'primary') {
      return baseStyle;
    } else if (variant === 'secondary') {
      return [...baseStyle, styles.buttonSecondary];
    } else if (variant === 'outline') {
      return [...baseStyle, styles.buttonOutline];
    } else if (variant === 'ghost') {
      return [...baseStyle, styles.buttonGhost];
    } else if (variant === 'danger') {
      return [...baseStyle, styles.buttonDanger];
    }
    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text, styles[`text_${size}`]];
    
    if (variant === 'outline' || variant === 'ghost') {
      return [...baseStyle, styles[`text_${variant}`]];
    }
    if (variant === 'danger') {
      return [...baseStyle, styles.textDanger];
    }
    return [...baseStyle, styles.textPrimary];
  };

  const renderContent = () => (
    <>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? colors.text.white : colors.primary}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <>{icon}</>}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && <>{icon}</>}
        </>
      )}
    </>
  );

  if (variant === 'primary' || variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[getButtonStyle(), isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={
            variant === 'danger'
              ? [colors.danger, colors.danger + 'DD']
              : [colors.primary, colors.primary + 'DD']
          }
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.content}>
            {renderContent()}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[getButtonStyle(), isDisabled && styles.disabled, style]}
    >
      <View style={styles.content}>
        {renderContent()}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    button: {
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    button_sm: {
      height: sizes.button.sm,
      paddingHorizontal: spacing.sm,
    },
    button_md: {
      height: sizes.button.md,
      paddingHorizontal: spacing.md,
    },
    button_lg: {
      height: sizes.button.lg,
      paddingHorizontal: spacing.lg,
    },
    button_xl: {
      height: sizes.button.xl,
      paddingHorizontal: spacing.xl,
    },
    buttonSecondary: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    buttonOutline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    buttonGhost: {
      backgroundColor: 'transparent',
    },
    buttonDanger: {
      // Handled by gradient
    },
    fullWidth: {
      width: '100%',
    },
    disabled: {
      opacity: 0.5,
    },
    gradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    text: {
      fontWeight: typography.fontWeight.semibold,
    },
    text_sm: {
      fontSize: typography.fontSize.sm,
    },
    text_md: {
      fontSize: typography.fontSize.md,
    },
    text_lg: {
      fontSize: typography.fontSize.lg,
    },
    text_xl: {
      fontSize: typography.fontSize.xl,
    },
    textPrimary: {
      color: colors.text.white,
    },
    textSecondary: {
      color: colors.text.primary,
    },
    text_outline: {
      color: colors.primary,
    },
    text_ghost: {
      color: colors.primary,
    },
    textDanger: {
      color: colors.text.white,
    },
  });

