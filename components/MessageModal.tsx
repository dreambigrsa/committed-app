import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { CheckCircle, AlertCircle, Mail } from 'lucide-react-native';

export type MessageModalVariant = 'success' | 'error' | 'info';

export interface MessageModalProps {
  visible: boolean;
  onClose: () => void;
  variant: MessageModalVariant;
  title: string;
  message: string;
  buttonText?: string;
  /** Optional secondary action (e.g. Retry). When set, shown as outline button below primary. */
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
}

export default function MessageModal({
  visible,
  onClose,
  variant,
  title,
  message,
  buttonText = 'OK',
  secondaryButtonText,
  onSecondaryPress,
}: MessageModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const Icon = variant === 'success' ? CheckCircle : variant === 'error' ? AlertCircle : Mail;
  const iconColor =
    variant === 'success'
      ? colors.status?.verified ?? colors.success ?? colors.secondary
      : variant === 'error'
        ? colors.danger
        : colors.primary;
  const iconBg =
    variant === 'success'
      ? (colors.badge?.verified ?? `${colors.status?.verified ?? colors.secondary}20`)
      : variant === 'error'
        ? `${colors.danger}18`
        : `${colors.primary}18`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
        >
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Icon size={44} color={iconColor} strokeWidth={2} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {secondaryButtonText && onSecondaryPress ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.primaryButton, styles.primaryButtonFlex]}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={buttonText}
              >
                <Text style={styles.primaryButtonText}>{buttonText}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.secondaryButtonFlex]}
                onPress={() => { onClose(); onSecondaryPress(); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={secondaryButtonText}
              >
                <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onClose}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={buttonText}
            >
              <Text style={styles.primaryButtonText}>{buttonText}</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.background?.overlay ?? 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors.background.primary,
      borderRadius: 20,
      padding: 28,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 12,
      borderWidth: 1,
      borderColor: colors.border?.light ?? 'rgba(0,0,0,0.06)',
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 10,
      textAlign: 'center',
    },
    message: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 14,
      alignSelf: 'stretch',
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: colors.text.white,
      fontSize: 17,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      alignSelf: 'stretch',
    },
    primaryButtonFlex: {
      flex: 1,
    },
    secondaryButton: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: 'transparent',
    },
    secondaryButtonFlex: {
      flex: 1,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 17,
      fontWeight: '600',
    },
  });
