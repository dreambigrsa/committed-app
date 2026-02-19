import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import MessageModal from '@/components/MessageModal';
import { UpdatePasswordTimeoutError, UpdatePasswordAbortedError } from '@/lib/supabase-auth-api';

const MAX_SUBMIT_MS = 30000; // Safety: stop loading and allow retry after 30s
const MIN_PASSWORD_LENGTH = 6;
const RECOMMENDED_PASSWORD_LENGTH = 8;

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { updatePassword, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messageModal, setMessageModal] = useState<{
    visible: boolean;
    variant: 'success' | 'error';
    title: string;
    message: string;
    showRetry?: boolean;
  }>({ visible: false, variant: 'error', title: '', message: '' });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const handleSubmitRef = useRef<() => void>(() => {});
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      paddingTop: 60,
    },
    header: {
      marginBottom: 32,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.text.secondary,
      lineHeight: 24,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
    },
    passwordInput: {
      flex: 1,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
    },
    passwordToggle: {
      padding: 16,
    },
    submitButton: {
      backgroundColor: colors.primary,
      padding: 18,
      borderRadius: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

  const clearLoadingAndShowError = (title: string, message: string) => {
    setIsLoading(false);
    setMessageModal({ visible: true, variant: 'error', title, message });
  };

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Missing fields',
        message: 'Please fill in both password fields.',
      });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Password too short',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters. We recommend ${RECOMMENDED_PASSWORD_LENGTH} or more for security.`,
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Passwords don\'t match',
        message: 'New password and confirm password must match.',
      });
      return;
    }

    setIsLoading(true);
    setMessageModal((prev) => ({ ...prev, visible: false }));
    completedRef.current = false;

    // Safety: always stop loading and give feedback after MAX_SUBMIT_MS; allow retry
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (completedRef.current) return;
      completedRef.current = true;
      setIsLoading(false);
      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Request timed out',
        message: 'The request took too long. Check your connection and try again, or request a new reset link from the sign-in screen.',
        showRetry: true,
      });
    }, MAX_SUBMIT_MS);

    const submitStart = __DEV__ ? Date.now() : 0;
    try {
      await updatePassword(newPassword);
      if (__DEV__) {
        console.log('[ResetPassword] updatePassword completed in_ms=', Date.now() - submitStart);
      }
      await signOut();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (completedRef.current) return;
      completedRef.current = true;
      setIsLoading(false);
      setMessageModal({
        visible: true,
        variant: 'success',
        title: 'Password updated',
        message: 'Your password has been updated. Please sign in with your new password.',
      });
    } catch (error: any) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (completedRef.current) return;
      completedRef.current = true;
      console.error('Reset password error:', error);
      const raw = error?.message ?? (typeof error === 'string' ? error : '') ?? '';
      const lower = raw.toLowerCase();
      let title = 'Couldn\'t update password';
      let message: string;
      let showRetry = false;

      if (error?.name === 'UpdatePasswordTimeoutError' || error?.message === 'UPDATE_PASSWORD_TIMEOUT') {
        title = 'Request timed out';
        message = 'The request took too long. Check your connection and try again.';
        showRetry = true;
      } else if (error?.name === 'UpdatePasswordAbortedError' || lower.includes('cancelled')) {
        title = 'Request cancelled';
        message = 'Request was cancelled. You can try again.';
      } else if (lower.includes('expired') || raw.includes('reset link')) {
        message = 'This reset link has expired. Please request a new password reset from the sign-in screen.';
      } else if (lower.includes('api key') || lower.includes('apikey') || lower.includes('configuration')) {
        message = 'There was a configuration issue. Please try again later or request a new reset link.';
      } else {
        message = raw || 'Failed to update password. Please try again or request a new reset link.';
      }
      setIsLoading(false);
      setMessageModal({ visible: true, variant: 'error', title, message, showRetry });
    }
  };

  handleSubmitRef.current = handleSubmit;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Lock size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.subtitle}>
            Enter your new password below. Use at least 6 characters.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>New password</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter new password"
              placeholderTextColor={colors.text.tertiary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
              activeOpacity={0.7}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.text.secondary} />
              ) : (
                <Eye size={20} color={colors.text.secondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Confirm password</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm new password"
              placeholderTextColor={colors.text.tertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.text.white} />
          ) : (
            <Text style={styles.submitButtonText}>Update password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <MessageModal
        visible={messageModal.visible}
        onClose={() => {
          setMessageModal((prev) => {
            if (prev.variant === 'success') router.replace('/auth');
            return { ...prev, visible: false };
          });
        }}
        variant={messageModal.variant}
        title={messageModal.title}
        message={messageModal.message}
        buttonText="OK"
        secondaryButtonText={messageModal.showRetry ? 'Retry' : undefined}
        onSecondaryPress={messageModal.showRetry ? () => handleSubmitRef.current() : undefined}
      />
    </KeyboardAvoidingView>
  );
}
