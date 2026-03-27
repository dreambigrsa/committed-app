import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import MessageModal from '@/components/MessageModal';
import { resetPasswordWithToken } from '@/lib/auth-functions';

const MAX_SUBMIT_MS = 30000;
const MIN_PASSWORD_LENGTH = 6;
const RECOMMENDED_PASSWORD_LENGTH = 8;

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const t = typeof params.token === 'string' ? params.token : null;
    if (t && t.length >= 16) setToken(t);
    else setNoToken(true);
  }, [params.token]);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future error handling
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

    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const result = await resetPasswordWithToken(token, newPassword);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (completedRef.current) return;
      completedRef.current = true;
      setIsLoading(false);
      if (result.ok) {
        setMessageModal({
          visible: true,
          variant: 'success',
          title: 'Password updated',
          message: 'Your password has been updated. Please sign in with your new password.',
        });
      } else {
        setMessageModal({
          visible: true,
          variant: 'error',
          title: 'Couldn\'t update password',
          message: result.error || 'Link may have expired. Request a new reset from the sign-in screen.',
          showRetry: true,
        });
      }
    } catch (error: any) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (completedRef.current) return;
      completedRef.current = true;
      setIsLoading(false);
      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Couldn\'t update password',
        message: error?.message || 'Please try again or request a new reset link.',
        showRetry: true,
      });
    }
  };

  handleSubmitRef.current = handleSubmit;

  if (noToken && !token) {
    return (
      <View style={[styles.container, { padding: 24, paddingTop: 60 }]}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Lock size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Invalid or expired link</Text>
          <Text style={styles.subtitle}>
            This reset link is missing or no longer valid. Request a new link from the sign-in screen.
          </Text>
        </View>
        <TouchableOpacity style={styles.submitButton} onPress={() => router.replace('/auth')}>
          <Text style={styles.submitButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, { marginTop: 12, backgroundColor: colors.background.secondary }]}
          onPress={() => router.replace('/auth')}
        >
          <Text style={[styles.submitButtonText, { color: colors.text.primary }]}>Request new reset email</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!token) {
    return (
      <View style={[styles.container, styles.scrollContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
