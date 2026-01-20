import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, borderRadius, typography, sizes } from '@/constants/design-system';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'filled';
  fullWidth?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export default function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  size = 'md',
  variant = 'default',
  fullWidth = true,
  containerStyle,
  inputStyle,
  ...textInputProps
}: InputProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const getInputStyle = () => {
    const baseStyle = [
      styles.input,
      styles[`input_${size}`],
      styles[`input_${variant}`],
      leftIcon && styles.inputWithLeftIcon,
      rightIcon && styles.inputWithRightIcon,
    ];

    if (error) {
      baseStyle.push(styles.inputError);
    }

    return baseStyle;
  };

  return (
    <View style={[styles.container, fullWidth && styles.fullWidth, containerStyle]}>
      {label && (
        <Text style={[styles.label, error && styles.labelError]}>
          {label}
        </Text>
      )}
      <View style={styles.inputContainer}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[getInputStyle(), inputStyle]}
          placeholderTextColor={colors.text.tertiary}
          {...textInputProps}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {(error || helperText) && (
        <Text style={[styles.helperText, error && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    fullWidth: {
      width: '100%',
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.xs,
    },
    labelError: {
      color: colors.danger,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    input: {
      flex: 1,
      color: colors.text.primary,
      fontSize: typography.fontSize.md,
    },
    input_sm: {
      height: sizes.input.sm,
      paddingHorizontal: spacing.sm,
      fontSize: typography.fontSize.sm,
    },
    input_md: {
      height: sizes.input.md,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.md,
    },
    input_lg: {
      height: sizes.input.lg,
      paddingHorizontal: spacing.lg,
      fontSize: typography.fontSize.lg,
    },
    input_default: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    input_outlined: {
      backgroundColor: colors.background.primary,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    input_filled: {
      backgroundColor: colors.background.tertiary,
      borderRadius: borderRadius.md,
      borderWidth: 0,
    },
    inputWithLeftIcon: {
      paddingLeft: sizes.icon.md + spacing.md + spacing.sm,
    },
    inputWithRightIcon: {
      paddingRight: sizes.icon.md + spacing.md + spacing.sm,
    },
    inputError: {
      borderColor: colors.danger,
    },
    leftIcon: {
      position: 'absolute',
      left: spacing.md,
      zIndex: 1,
    },
    rightIcon: {
      position: 'absolute',
      right: spacing.md,
      zIndex: 1,
    },
    helperText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      marginTop: spacing.xs,
    },
    errorText: {
      color: colors.danger,
    },
  });

