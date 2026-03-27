import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface LoginPromptModalProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
}

export default function LoginPromptModal({ visible, onClose, message }: LoginPromptModalProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogin = () => {
    onClose();
    router.push('/auth' as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Log in or sign up</Text>
          <Text style={styles.message}>
            {message ?? 'Log in or sign up to like, comment, and share.'}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
              <Text style={styles.primaryButtonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleLogin}>
              <Text style={styles.secondaryButtonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Not now</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 320,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      marginBottom: 20,
      lineHeight: 22,
    },
    actions: {
      gap: 12,
      marginBottom: 16,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.text.white,
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.text.tertiary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    cancelText: {
      color: colors.text.secondary,
      fontSize: 15,
    },
  });
