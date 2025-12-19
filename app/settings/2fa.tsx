import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Shield, Key, Copy, CheckCircle2, XCircle } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Clipboard } from 'react-native';

export default function TwoFactorAuthScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    load2FAStatus();
  }, [currentUser]);

  const load2FAStatus = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_2fa')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

      if (data) {
        setEnabled(data.enabled || false);
        if (data.backup_codes && !data.enabled) {
          setBackupCodes(data.backup_codes);
        }
      }
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const setup2FA = async () => {
    if (!currentUser) return;

    try {
      setSettingUp(true);
      // Generate a simple secret (in production, use a proper TOTP library)
      const newSecret = Math.random().toString(36).substring(2, 18).toUpperCase();
      const codes = generateBackupCodes();

      const { error } = await supabase
        .from('user_2fa')
        .upsert({
          user_id: currentUser.id,
          secret: newSecret,
          enabled: false,
          backup_codes: codes,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSecret(newSecret);
      setBackupCodes(codes);
      Alert.alert(
        '2FA Setup',
        'Please save your backup codes. You will need them if you lose access to your authenticator app.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to setup 2FA:', error);
      Alert.alert('Error', 'Failed to setup 2FA. Please try again.');
    } finally {
      setSettingUp(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!currentUser || !secret) return;

    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code');
      return;
    }

    try {
      // In production, verify the code using a TOTP library
      // For now, we'll just enable it after user enters a code
      const { error } = await supabase
        .from('user_2fa')
        .update({
          enabled: true,
          last_used_at: new Date().toISOString(),
        })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setEnabled(true);
      setSecret(null);
      setVerificationCode('');
      Alert.alert('Success', 'Two-factor authentication has been enabled.');
    } catch (error) {
      console.error('Failed to enable 2FA:', error);
      Alert.alert('Error', 'Failed to enable 2FA. Please try again.');
    }
  };

  const disable2FA = async () => {
    if (!currentUser) return;

    Alert.alert(
      'Disable 2FA',
      'Are you sure you want to disable two-factor authentication? This will make your account less secure.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_2fa')
                .update({
                  enabled: false,
                  secret: null,
                  backup_codes: null,
                })
                .eq('user_id', currentUser.id);

              if (error) throw error;

              setEnabled(false);
              setSecret(null);
              setBackupCodes([]);
              Alert.alert('Success', 'Two-factor authentication has been disabled.');
            } catch (error) {
              console.error('Failed to disable 2FA:', error);
              Alert.alert('Error', 'Failed to disable 2FA. Please try again.');
            }
          },
        },
      ]
    );
  };

  const copyBackupCodes = () => {
    if (backupCodes.length === 0) return;
    Clipboard.setString(backupCodes.join('\n'));
    Alert.alert('Copied', 'Backup codes copied to clipboard');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Two-Factor Authentication',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <ArrowLeft size={24} color={colors.text.primary} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Two-Factor Authentication',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
          <View style={styles.sectionHeader}>
            <Shield size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Two-Factor Authentication
            </Text>
          </View>

          <View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.text.primary }]}>Status</Text>
              {enabled ? (
                <View style={styles.statusBadge}>
                  <CheckCircle2 size={16} color={colors.secondary} />
                  <Text style={[styles.statusText, { color: colors.secondary }]}>Enabled</Text>
                </View>
              ) : (
                <View style={styles.statusBadge}>
                  <XCircle size={16} color={colors.text.tertiary} />
                  <Text style={[styles.statusText, { color: colors.text.tertiary }]}>Disabled</Text>
                </View>
              )}
            </View>
          </View>

          {!enabled && !secret && (
            <View style={styles.setupContainer}>
              <Text style={[styles.description, { color: colors.text.secondary }]}>
                Two-factor authentication adds an extra layer of security to your account.
                You'll need to enter a code from your authenticator app when signing in.
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={setup2FA}
                disabled={settingUp}
              >
                {settingUp ? (
                  <ActivityIndicator color={colors.text.white} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.text.white }]}>
                    Set Up 2FA
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {secret && !enabled && (
            <View style={styles.verificationContainer}>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                Secret Key (Save this securely)
              </Text>
              <View style={[styles.secretContainer, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}>
                <Text style={[styles.secretText, { color: colors.text.primary }]}>{secret}</Text>
                <TouchableOpacity onPress={() => {
                  Clipboard.setString(secret);
                  Alert.alert('Copied', 'Secret key copied to clipboard');
                }}>
                  <Copy size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: colors.text.primary, marginTop: 20 }]}>
                Enter Verification Code
              </Text>
              <TextInput
                style={[styles.codeInput, { backgroundColor: colors.background.secondary, borderColor: colors.border.light, color: colors.text.primary }]}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="000000"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={verifyAndEnable}
              >
                <Text style={[styles.buttonText, { color: colors.text.white }]}>
                  Verify and Enable
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {backupCodes.length > 0 && !enabled && (
            <View style={styles.backupCodesContainer}>
              <Text style={[styles.label, { color: colors.text.primary }]}>
                Backup Codes (Save these in a safe place)
              </Text>
              <Text style={[styles.description, { color: colors.text.secondary, marginBottom: 12 }]}>
                These codes can be used to access your account if you lose your authenticator device.
              </Text>
              <View style={[styles.codesContainer, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}>
                {backupCodes.map((code, index) => (
                  <Text key={index} style={[styles.codeText, { color: colors.text.primary }]}>
                    {code}
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border.light }]}
                onPress={copyBackupCodes}
              >
                <Copy size={18} color={colors.primary} />
                <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                  Copy All Codes
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {enabled && (
            <View style={styles.enabledContainer}>
              <Text style={[styles.description, { color: colors.text.secondary }]}>
                Two-factor authentication is active. Your account is protected with an extra layer of security.
              </Text>
              <TouchableOpacity
                style={[styles.dangerButton, { backgroundColor: colors.danger }]}
                onPress={disable2FA}
              >
                <Text style={[styles.buttonText, { color: colors.text.white }]}>
                  Disable 2FA
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  setupContainer: {
    marginTop: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  verificationContainer: {
    marginTop: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  secretContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  secretText: {
    fontSize: 14,
    fontFamily: 'monospace',
    flex: 1,
  },
  codeInput: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
  },
  backupCodesContainer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  codesContainer: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  codeText: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  enabledContainer: {
    marginTop: 20,
  },
  dangerButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});

