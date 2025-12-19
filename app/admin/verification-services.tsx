import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Shield, Phone, Mail, Save, Eye, EyeOff } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

interface ServiceConfig {
  id: string;
  service_type: 'sms' | 'email';
  provider: string;
  enabled: boolean;
  config: {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
    api_key?: string;
    from_email?: string;
    from_name?: string;
  };
}

export default function VerificationServicesScreen() {
  const { currentUser } = useApp();
  const [smsConfig, setSmsConfig] = useState<ServiceConfig | null>(null);
  const [emailConfig, setEmailConfig] = useState<ServiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSmsToken, setShowSmsToken] = useState(false);
  const [showEmailKey, setShowEmailKey] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('verification_service_configs')
        .select('*')
        .order('service_type');

      if (error) throw error;

      if (data) {
        const sms = data.find((c) => c.service_type === 'sms');
        const email = data.find((c) => c.service_type === 'email');
        if (sms) setSmsConfig(sms as ServiceConfig);
        if (email) setEmailConfig(email as ServiceConfig);
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
      Alert.alert('Error', 'Failed to load service configurations');
    } finally {
      setLoading(false);
    }
  };

  const saveSmsConfig = async () => {
    if (!smsConfig) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('verification_service_configs')
        .upsert({
          service_type: 'sms',
          provider: 'twilio',
          enabled: smsConfig.enabled,
          config: smsConfig.config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'service_type',
        });

      if (error) throw error;
      Alert.alert('Success', 'SMS service configuration saved');
    } catch (error) {
      console.error('Failed to save SMS config:', error);
      Alert.alert('Error', 'Failed to save SMS configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveEmailConfig = async () => {
    if (!emailConfig) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('verification_service_configs')
        .upsert({
          service_type: 'email',
          provider: 'resend',
          enabled: emailConfig.enabled,
          config: emailConfig.config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'service_type',
        });

      if (error) throw error;
      Alert.alert('Success', 'Email service configuration saved');
    } catch (error) {
      console.error('Failed to save email config:', error);
      Alert.alert('Error', 'Failed to save email configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser || currentUser.role !== 'super_admin') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Verification Services', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only Super Admins can configure services</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Verification Services', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading configurations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Verification Services', 
          headerShown: true,
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.text.white,
        }} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SMS Configuration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Phone size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>SMS Service (Twilio)</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Configure Twilio for phone number verification via SMS
          </Text>

          <View style={styles.configCard}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable SMS Service</Text>
              <Switch
                value={smsConfig?.enabled || false}
                onValueChange={(value) =>
                  setSmsConfig({ ...smsConfig!, enabled: value })
                }
                trackColor={{ false: colors.text.tertiary, true: colors.primary }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account SID</Text>
              <TextInput
                style={styles.input}
                value={smsConfig?.config.account_sid || ''}
                onChangeText={(text) =>
                  setSmsConfig({
                    ...smsConfig!,
                    config: { ...smsConfig!.config, account_sid: text },
                  })
                }
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Auth Token</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={smsConfig?.config.auth_token || ''}
                  onChangeText={(text) =>
                    setSmsConfig({
                      ...smsConfig!,
                      config: { ...smsConfig!.config, auth_token: text },
                    })
                  }
                  placeholder="Your Twilio Auth Token"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showSmsToken}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowSmsToken(!showSmsToken)}
                  style={styles.eyeButton}
                >
                  {showSmsToken ? (
                    <EyeOff size={20} color={colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={colors.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Twilio Phone Number</Text>
              <TextInput
                style={styles.input}
                value={smsConfig?.config.phone_number || ''}
                onChangeText={(text) =>
                  setSmsConfig({
                    ...smsConfig!,
                    config: { ...smsConfig!.config, phone_number: text },
                  })
                }
                placeholder="+1234567890"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="phone-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveSmsConfig}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <>
                  <Save size={20} color={colors.text.white} />
                  <Text style={styles.saveButtonText}>Save SMS Config</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Email Configuration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Mail size={24} color={colors.primary} />
            <Text style={styles.sectionTitle}>Email Service (Resend)</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Configure Resend for email verification codes
          </Text>

          <View style={styles.configCard}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Email Service</Text>
              <Switch
                value={emailConfig?.enabled || false}
                onValueChange={(value) =>
                  setEmailConfig({ ...emailConfig!, enabled: value })
                }
                trackColor={{ false: colors.text.tertiary, true: colors.primary }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API Key</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={emailConfig?.config.api_key || ''}
                  onChangeText={(text) =>
                    setEmailConfig({
                      ...emailConfig!,
                      config: { ...emailConfig!.config, api_key: text },
                    })
                  }
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry={!showEmailKey}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowEmailKey(!showEmailKey)}
                  style={styles.eyeButton}
                >
                  {showEmailKey ? (
                    <EyeOff size={20} color={colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={colors.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>From Email</Text>
              <TextInput
                style={styles.input}
                value={emailConfig?.config.from_email || ''}
                onChangeText={(text) =>
                  setEmailConfig({
                    ...emailConfig!,
                    config: { ...emailConfig!.config, from_email: text },
                  })
                }
                placeholder="noreply@yourdomain.com"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>From Name</Text>
              <TextInput
                style={styles.input}
                value={emailConfig?.config.from_name || ''}
                onChangeText={(text) =>
                  setEmailConfig({
                    ...emailConfig!,
                    config: { ...emailConfig!.config, from_name: text },
                  })
                }
                placeholder="Committed"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveEmailConfig}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <>
                  <Save size={20} color={colors.text.white} />
                  <Text style={styles.saveButtonText}>Save Email Config</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📝 Setup Instructions</Text>
          <Text style={styles.infoText}>
            • For SMS: Get your credentials from Twilio dashboard{'\n'}
            • For Email: Get your API key from Resend dashboard{'\n'}
            • Make sure to verify your domain in Resend{'\n'}
            • Test the services after configuration
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  configCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: 14,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  infoBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 20,
    margin: 20,
    marginTop: 0,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
});

