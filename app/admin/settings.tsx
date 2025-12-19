import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { Stack } from 'expo-router';
import { Settings as SettingsIcon, Save, Shield, KeyRound, TestTubeDiagonal, Sparkles, ChevronDown, ChevronUp, Search } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { refreshOpenAIKeyCache } from '@/lib/ai-service';

export default function AdminSettingsScreen() {
  const { currentUser } = useApp();
  const isSuperAdmin = useMemo(() => !!currentUser && currentUser.role === 'super_admin', [currentUser]);
  const [settings, setSettings] = useState({
    appName: 'Committed',
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: true,
    requirePhoneVerification: false,
    requireIDVerification: false,
    autoResolveDisputes: true,
    disputeResolveTime: '7',
    maxPostsPerDay: '10',
    maxReelsPerDay: '5',
    enableCheatingAlerts: true,
    enableNotifications: true,
  });
  const initialSettingsRef = useRef<string>(JSON.stringify(settings));
  const hasUnsavedConfigChanges = useMemo(() => JSON.stringify(settings) !== initialSettingsRef.current, [settings]);
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    openai: true,
    messaging: false,
    ai: true,
    verification: false,
    relationships: false,
    content: false,
    features: false,
  });
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiKeyLoaded, setOpenaiKeyLoaded] = useState(false);
  const [savingOpenaiKey, setSavingOpenaiKey] = useState(false);
  const [testingOpenaiKey, setTestingOpenaiKey] = useState(false);

  // Messaging provider settings (stored server-side in app_settings; used by Edge Functions)
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [resendFromEmail, setResendFromEmail] = useState('');
  const [resendFromName, setResendFromName] = useState('Committed');
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [savingProviders, setSavingProviders] = useState(false);
  const [testingSms, setTestingSms] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testSmsTo, setTestSmsTo] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');

  // AI prompt management
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiPromptLoaded, setAiPromptLoaded] = useState(false);
  const [aiPromptRollout, setAiPromptRollout] = useState('100');
  const [savingAiPrompt, setSavingAiPrompt] = useState(false);
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false);
  const [promptSuggestions, setPromptSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [reviewingSuggestionId, setReviewingSuggestionId] = useState<string | null>(null);

  const handleSaveSettings = () => {
    // NOTE: This screen currently only stores these config values locally.
    // If/when you persist them in DB, swap this to a save call.
    initialSettingsRef.current = JSON.stringify(settings);
    Alert.alert('Saved', 'App configuration saved (local).');
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const matches = (text: string) => {
    if (!normalizedQuery) return true;
    return text.toLowerCase().includes(normalizedQuery);
  };

  const shouldShowSection = (sectionKey: string, keywords: string[]) => {
    if (!normalizedQuery) return true;
    return matches(sectionKey) || keywords.some((k) => matches(k));
  };

  useEffect(() => {
    if (!isSuperAdmin || openaiKeyLoaded) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'openai_api_key')
          .maybeSingle();
        setOpenaiKey(data?.value ? String(data.value) : '');
      } catch {
        // ignore
      } finally {
        setOpenaiKeyLoaded(true);
      }
    })();
  }, [isSuperAdmin, openaiKeyLoaded]);

  useEffect(() => {
    if (!isSuperAdmin || providersLoaded) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key,value')
          .in('key', [
            'twilio_account_sid',
            'twilio_auth_token',
            'twilio_from_number',
            'resend_api_key',
            'resend_from_email',
            'resend_from_name',
          ]);
        const map = new Map<string, string>();
        (data || []).forEach((r: any) => map.set(String(r.key), r.value ? String(r.value) : ''));
        setTwilioAccountSid(map.get('twilio_account_sid') || '');
        setTwilioAuthToken(map.get('twilio_auth_token') || '');
        setTwilioFromNumber(map.get('twilio_from_number') || '');
        setResendApiKey(map.get('resend_api_key') || '');
        setResendFromEmail(map.get('resend_from_email') || '');
        setResendFromName(map.get('resend_from_name') || 'Committed');
      } catch {
        // ignore
      } finally {
        // Pre-fill test recipients if available on the current user object
        const u: any = currentUser as any;
        const phone = u?.phone_number || u?.phoneNumber || '';
        const email = u?.email || '';
        if (phone && !testSmsTo) setTestSmsTo(String(phone));
        if (email && !testEmailTo) setTestEmailTo(String(email));
        setProvidersLoaded(true);
      }
    })();
  }, [isSuperAdmin, providersLoaded, currentUser, testSmsTo, testEmailTo]);

  const upsertSetting = async (key: string, value: string) => {
    return await supabase.from('app_settings').upsert({
      key,
      value,
      updated_by: currentUser?.id ?? null,
      updated_at: new Date().toISOString(),
    } as any);
  };

  const handleSaveMessagingProviders = async () => {
    if (!isSuperAdmin) return;
    setSavingProviders(true);
    try {
      // Save non-empty fields; allow clearing by saving empty string.
      const ops = await Promise.all([
        upsertSetting('twilio_account_sid', twilioAccountSid.trim()),
        upsertSetting('twilio_auth_token', twilioAuthToken.trim()),
        upsertSetting('twilio_from_number', twilioFromNumber.trim()),
        upsertSetting('resend_api_key', resendApiKey.trim()),
        upsertSetting('resend_from_email', resendFromEmail.trim()),
        upsertSetting('resend_from_name', resendFromName.trim() || 'Committed'),
      ]);
      const firstErr = ops.find((r: any) => r?.error)?.error;
      if (firstErr) throw firstErr;
      Alert.alert('Saved', 'Messaging provider settings saved.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save messaging provider settings.');
    } finally {
      setSavingProviders(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin || aiPromptLoaded) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('ai_prompt_versions')
          .select('prompt, rollout_percent')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
        const v = data?.[0];
        if (v?.prompt) setAiPrompt(String(v.prompt));
        if (typeof v?.rollout_percent === 'number') setAiPromptRollout(String(v.rollout_percent));
      } catch {
        // ignore
      } finally {
        setAiPromptLoaded(true);
      }
    })();
  }, [isSuperAdmin, aiPromptLoaded]);

  const loadPromptSuggestions = async () => {
    if (!isSuperAdmin) return;
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from('ai_prompt_suggestions')
        .select('id, suggested_prompt, rationale, stats, status, created_at, created_by, reviewed_at, reviewed_by')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPromptSuggestions(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load prompt suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadPromptSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const handleApproveSuggestion = async (suggestion: any) => {
    if (!isSuperAdmin) return;
    const suggestedPrompt = String(suggestion?.suggested_prompt ?? '').trim();
    if (!suggestedPrompt) {
      Alert.alert('Error', 'Suggestion is empty.');
      return;
    }

    Alert.alert(
      'Approve Suggestion?',
      'This will save the suggested prompt as a NEW active prompt version.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setReviewingSuggestionId(String(suggestion.id));
            try {
              const rollout = Math.max(0, Math.min(100, parseInt(aiPromptRollout || '100', 10)));

              const { error: insertErr } = await supabase.from('ai_prompt_versions').insert({
                name: 'default',
                prompt: suggestedPrompt,
                rollout_percent: rollout,
                is_active: true,
                created_by: currentUser?.id ?? null,
              } as any);
              if (insertErr) throw insertErr;

              const { error: updErr } = await supabase
                .from('ai_prompt_suggestions')
                .update({
                  status: 'approved',
                  reviewed_at: new Date().toISOString(),
                  reviewed_by: currentUser?.id ?? null,
                })
                .eq('id', suggestion.id);
              if (updErr) throw updErr;

              setAiPrompt(suggestedPrompt);
              Alert.alert('Approved', 'New prompt version saved and suggestion marked approved.');
              await loadPromptSuggestions();
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to approve suggestion.');
            } finally {
              setReviewingSuggestionId(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectSuggestion = async (suggestion: any) => {
    if (!isSuperAdmin) return;
    Alert.alert('Reject Suggestion?', 'This will mark the suggestion as rejected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setReviewingSuggestionId(String(suggestion.id));
          try {
            const { error } = await supabase
              .from('ai_prompt_suggestions')
              .update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: currentUser?.id ?? null,
              })
              .eq('id', suggestion.id);
            if (error) throw error;
            Alert.alert('Rejected', 'Suggestion marked rejected.');
            await loadPromptSuggestions();
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to reject suggestion.');
          } finally {
            setReviewingSuggestionId(null);
          }
        },
      },
    ]);
  };

  const handleSaveOpenAIKey = async () => {
    if (!isSuperAdmin) return;
    const trimmed = openaiKey.trim();
    if (!trimmed) {
      Alert.alert('Missing Key', 'Please paste your OpenAI API key first.');
      return;
    }
    setSavingOpenaiKey(true);
    try {
      const { error } = await supabase.from('app_settings').upsert({
        key: 'openai_api_key',
        value: trimmed,
        updated_by: currentUser?.id ?? null,
        updated_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      await refreshOpenAIKeyCache();
      Alert.alert('Saved', 'OpenAI API key saved successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save OpenAI key.');
    } finally {
      setSavingOpenaiKey(false);
    }
  };

  const handleTestOpenAIKey = async () => {
    if (!isSuperAdmin) return;
    const trimmed = openaiKey.trim();
    if (!trimmed) {
      Alert.alert('Missing Key', 'Please paste your OpenAI API key first.');
      return;
    }
    setTestingOpenaiKey(true);
    try {
      // Save the key first so we test the same path production uses (Edge Function reads app_settings)
      const { error: upsertErr } = await supabase.from('app_settings').upsert({
        key: 'openai_api_key',
        value: trimmed,
        updated_by: currentUser?.id ?? null,
        updated_at: new Date().toISOString(),
      } as any);
      if (upsertErr) throw upsertErr;

      // Test via server-side Edge Function (no direct OpenAI calls from the client)
      const { data, error } = await supabase.functions.invoke('openai-chat', {
        body: {
          messages: [{ role: 'user', content: 'Say: OK' }],
          temperature: 0,
          max_tokens: 10,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'OpenAI test failed');
      Alert.alert('Success', 'OpenAI key is valid and working (server-side).');
    } catch (e: any) {
      Alert.alert('Test Failed', e?.message ?? 'OpenAI key test failed.');
    } finally {
      setTestingOpenaiKey(false);
    }
  };

  const handleTestSms = async () => {
    if (!isSuperAdmin) return;
    const to = String(testSmsTo || '').trim();
    if (!to) {
      Alert.alert('Missing Phone', 'Enter a phone number to send the test SMS to.');
      return;
    }
    setTestingSms(true);
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { phoneNumber: to, code },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'SMS test failed');
      Alert.alert('Sent', `Test SMS sent to ${to}.`);
    } catch (e: any) {
      Alert.alert('SMS Test Failed', e?.message ?? 'Failed to send test SMS.');
    } finally {
      setTestingSms(false);
    }
  };

  const handleTestEmail = async () => {
    if (!isSuperAdmin) return;
    const to = String(testEmailTo || '').trim();
    if (!to) {
      Alert.alert('Missing Email', 'Enter an email address to send the test email to.');
      return;
    }
    setTestingEmail(true);
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { email: to, code },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Email test failed');
      Alert.alert('Sent', `Test email sent to ${to}.`);
    } catch (e: any) {
      Alert.alert('Email Test Failed', e?.message ?? 'Failed to send test email.');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveAiPrompt = async () => {
    if (!isSuperAdmin) return;
    const promptText = aiPrompt.trim();
    const rollout = Math.max(0, Math.min(100, parseInt(aiPromptRollout || '100', 10)));
    if (!promptText) {
      Alert.alert('Missing Prompt', 'Please enter the AI system prompt.');
      return;
    }
    setSavingAiPrompt(true);
    try {
      const { error } = await supabase.from('ai_prompt_versions').insert({
        name: 'default',
        prompt: promptText,
        rollout_percent: rollout,
        is_active: true,
        created_by: currentUser?.id ?? null,
      } as any);
      if (error) throw error;
      Alert.alert('Saved', 'New AI prompt version saved.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save AI prompt.');
    } finally {
      setSavingAiPrompt(false);
    }
  };

  const getEdgeFunctionErrorMessage = async (e: any): Promise<string> => {
    // Supabase Functions errors often include a generic message ("Edge Function returned a non-2xx status code")
    // with useful details in `context` (Response / { status, body } / etc).
    const fallback = e?.message || 'Edge Function failed';

    try {
      const ctx = e?.context;
      if (!ctx) return fallback;

      // Case 1: context is a fetch Response
      if (typeof ctx?.json === 'function') {
        const payload = await ctx.json().catch(() => null);
        const msg = payload?.error || payload?.message;
        return (msg && String(msg)) || fallback;
      }
      if (typeof ctx?.text === 'function') {
        const t = await ctx.text().catch(() => '');
        if (!t) return fallback;
        try {
          const payload = JSON.parse(t);
          const msg = payload?.error || payload?.message;
          return (msg && String(msg)) || t;
        } catch {
          return t;
        }
      }

      // Case 2: context is a plain object with body
      if (typeof ctx === 'object' && ctx?.body) {
        const body = ctx.body;
        if (typeof body === 'string') {
          try {
            const payload = JSON.parse(body);
            const msg = payload?.error || payload?.message;
            return (msg && String(msg)) || fallback;
          } catch {
            return body || fallback;
          }
        }
        if (typeof body === 'object') {
          const msg = body?.error || body?.message;
          return (msg && String(msg)) || fallback;
        }
      }
    } catch {
      // ignore
    }

    return fallback;
  };

  const handleGeneratePromptSuggestion = async () => {
    if (!isSuperAdmin) return;
    setGeneratingSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest-prompts', { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Suggestion failed');
      Alert.alert('Suggestion created', 'A new prompt suggestion is saved for review in the database.');
    } catch (e: any) {
      const msg = await getEdgeFunctionErrorMessage(e);
      Alert.alert('Error', msg || 'Failed to generate suggestion.');
    } finally {
      setGeneratingSuggestion(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'App Settings', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only Super Admins can change settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'App Settings', headerShown: true }} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <SettingsIcon size={24} color={colors.primary} />
          <Text style={styles.headerTitle}>Application Settings</Text>
          <Text style={styles.headerSubtitle}>Configure app behavior</Text>
        </View>

        <View style={styles.searchWrap}>
          <Search size={18} color={colors.text.tertiary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search settings…"
            placeholderTextColor={colors.text.tertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearPill}>
              <Text style={styles.clearPillText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {shouldShowSection('general', ['maintenance', 'registration', 'app name']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          
          <View style={[styles.settingItem, { borderTopWidth: 0, paddingTop: 0 }]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>App Name</Text>
              <Text style={styles.settingDescription}>Display name of the application</Text>
            </View>
            <TextInput
              style={styles.textInput}
              value={settings.appName}
              onChangeText={(text) => setSettings({ ...settings, appName: text })}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Maintenance Mode</Text>
              <Text style={styles.settingDescription}>Block all users except admins</Text>
            </View>
            <Switch
              value={settings.maintenanceMode}
              onValueChange={(value) => setSettings({ ...settings, maintenanceMode: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Allow Registration</Text>
              <Text style={styles.settingDescription}>Enable new user signups</Text>
            </View>
            <Switch
              value={settings.allowRegistration}
              onValueChange={(value) => setSettings({ ...settings, allowRegistration: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>
        </View>
        )}

        {shouldShowSection('openai', ['openai', 'api key', 'chatgpt', 'ai']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>OpenAI</Text>

          <View style={styles.settingItemColumn}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>OpenAI API Key</Text>
              <Text style={styles.settingDescription}>
                Used by Committed in messages (chat, image generation, documents). Stored in Supabase and only visible to Super Admins.
              </Text>
            </View>

            <View style={styles.openaiRow}>
              <KeyRound size={18} color={colors.text.secondary} />
              <TextInput
                style={styles.openaiInput}
                value={openaiKey}
                onChangeText={setOpenaiKey}
                placeholder="sk-..."
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.openaiActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, (savingOpenaiKey || testingOpenaiKey) && styles.buttonDisabled]}
                onPress={handleTestOpenAIKey}
                disabled={savingOpenaiKey || testingOpenaiKey}
              >
                <TestTubeDiagonal size={18} color={colors.text.primary} />
              <Text style={styles.secondaryButtonText}>{testingOpenaiKey ? 'Testing…' : 'Test (Server)'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, (savingOpenaiKey || testingOpenaiKey) && styles.buttonDisabled]}
                onPress={handleSaveOpenAIKey}
                disabled={savingOpenaiKey || testingOpenaiKey}
              >
                <Save size={18} color={colors.text.primary} />
                <Text style={styles.secondaryButtonText}>{savingOpenaiKey ? 'Saving…' : 'Save Key'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        )}

        {shouldShowSection('messaging', ['twilio', 'sms', 'resend', 'email']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Messaging Providers</Text>

          <View style={styles.settingItemColumn}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Twilio (SMS)</Text>
              <Text style={styles.settingDescription}>
                Stored in Supabase app settings and used server-side by the send-sms Edge Function. Never shipped in the app build.
              </Text>
            </View>

            <TextInput
              style={styles.fullWidthInput}
              value={twilioAccountSid}
              onChangeText={setTwilioAccountSid}
              placeholder="TWILIO_ACCOUNT_SID"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.fullWidthInput}
              value={twilioAuthToken}
              onChangeText={setTwilioAuthToken}
              placeholder="TWILIO_AUTH_TOKEN"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.fullWidthInput}
              value={twilioFromNumber}
              onChangeText={setTwilioFromNumber}
              placeholder="TWILIO_FROM_NUMBER (e.g. +1234567890)"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.settingItemColumn, { marginTop: 14 }]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Resend (Email)</Text>
              <Text style={styles.settingDescription}>
                Stored in Supabase app settings and used server-side by the send-email Edge Function.
              </Text>
            </View>

            <TextInput
              style={styles.fullWidthInput}
              value={resendApiKey}
              onChangeText={setResendApiKey}
              placeholder="RESEND_API_KEY"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.fullWidthInput}
              value={resendFromEmail}
              onChangeText={setResendFromEmail}
              placeholder="From email (e.g. no-reply@yourdomain.com)"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.fullWidthInput}
              value={resendFromName}
              onChangeText={setResendFromName}
              placeholder="From name (e.g. Committed)"
              placeholderTextColor={colors.text.tertiary}
            />
          </View>

          <View style={[styles.settingItemColumn, { marginTop: 14 }]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Test Recipients</Text>
              <Text style={styles.settingDescription}>
                These tests send a real SMS/email using your saved provider settings.
              </Text>
            </View>

            <TextInput
              style={styles.fullWidthInput}
              value={testSmsTo}
              onChangeText={setTestSmsTo}
              placeholder="Test SMS to (e.g. +1234567890)"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.fullWidthInput}
              value={testEmailTo}
              onChangeText={setTestEmailTo}
              placeholder="Test Email to (e.g. you@domain.com)"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.openaiActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, savingProviders && styles.buttonDisabled]}
              onPress={handleSaveMessagingProviders}
              disabled={savingProviders}
            >
              <Save size={18} color={colors.text.primary} />
              <Text style={styles.secondaryButtonText}>{savingProviders ? 'Saving…' : 'Save Providers'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, (testingSms || savingProviders) && styles.buttonDisabled]}
              onPress={handleTestSms}
              disabled={testingSms || savingProviders}
            >
              <TestTubeDiagonal size={18} color={colors.text.primary} />
              <Text style={styles.secondaryButtonText}>{testingSms ? 'Testing…' : 'Test SMS'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, (testingEmail || savingProviders) && styles.buttonDisabled]}
              onPress={handleTestEmail}
              disabled={testingEmail || savingProviders}
            >
              <TestTubeDiagonal size={18} color={colors.text.primary} />
              <Text style={styles.secondaryButtonText}>{testingEmail ? 'Testing…' : 'Test Email'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {shouldShowSection('committed ai', ['system prompt', 'rollout', 'suggestion', 'ai']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Committed</Text>

          <View style={styles.settingItemColumn}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>System Prompt</Text>
              <Text style={styles.settingDescription}>
                This controls how Committed talks, helps users, and troubleshoots the app. New versions can roll out gradually.
              </Text>
            </View>

            <TextInput
              style={styles.promptInput}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              placeholder="Enter the AI system prompt..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Rollout (%)</Text>
                <Text style={styles.settingDescription}>Percent of users who get this new prompt version</Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={aiPromptRollout}
                onChangeText={setAiPromptRollout}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.openaiActions}>
              <TouchableOpacity
                style={[styles.secondaryButton, (savingAiPrompt || generatingSuggestion) && styles.buttonDisabled]}
                onPress={handleGeneratePromptSuggestion}
                disabled={savingAiPrompt || generatingSuggestion}
              >
                <Sparkles size={18} color={colors.text.primary} />
                <Text style={styles.secondaryButtonText}>
                  {generatingSuggestion ? 'Generating…' : 'Generate Suggestion'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, (savingAiPrompt || generatingSuggestion) && styles.buttonDisabled]}
                onPress={handleSaveAiPrompt}
                disabled={savingAiPrompt || generatingSuggestion}
              >
                <Save size={18} color={colors.text.primary} />
                <Text style={styles.secondaryButtonText}>{savingAiPrompt ? 'Saving…' : 'Save Version'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { marginTop: 16, marginBottom: 0 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Prompt Suggestions</Text>
                <TouchableOpacity
                  style={[styles.secondaryButton, loadingSuggestions && styles.buttonDisabled]}
                  onPress={loadPromptSuggestions}
                  disabled={loadingSuggestions}
                >
                  <Text style={styles.secondaryButtonText}>{loadingSuggestions ? 'Loading…' : 'Refresh'}</Text>
                </TouchableOpacity>
              </View>

              {promptSuggestions.length === 0 ? (
                <Text style={{ color: colors.text.secondary, marginTop: 8 }}>
                  No pending suggestions yet. Tap “Generate Suggestion” to create one.
                </Text>
              ) : (
                <View style={{ marginTop: 12, gap: 12 }}>
                  {promptSuggestions.map((s: any) => {
                    const busy = reviewingSuggestionId === String(s.id);
                    return (
                      <View
                        key={String(s.id)}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border.light,
                          borderRadius: 12,
                          padding: 12,
                          backgroundColor: colors.background.secondary,
                        }}
                      >
                        {!!s?.rationale && (
                          <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>
                            {String(s.rationale)}
                          </Text>
                        )}

                        <Text
                          style={{
                            color: colors.text.primary,
                            fontFamily: 'monospace',
                            fontSize: 13,
                            lineHeight: 18,
                          }}
                        >
                          {String(s.suggested_prompt ?? '')}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                          <TouchableOpacity
                            style={[styles.secondaryButton, busy && styles.buttonDisabled, { flex: 1 }]}
                            onPress={() => handleRejectSuggestion(s)}
                            disabled={busy}
                          >
                            <Text style={styles.secondaryButtonText}>{busy ? 'Working…' : 'Reject'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.saveButton, busy && styles.buttonDisabled, { flex: 1 }]}
                            onPress={() => handleApproveSuggestion(s)}
                            disabled={busy}
                          >
                            <Text style={styles.saveButtonText}>{busy ? 'Working…' : 'Approve'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
        )}

        {shouldShowSection('verification', ['email verification', 'phone verification', 'id verification']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Require Email Verification</Text>
              <Text style={styles.settingDescription}>Users must verify email</Text>
            </View>
            <Switch
              value={settings.requireEmailVerification}
              onValueChange={(value) => setSettings({ ...settings, requireEmailVerification: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Require Phone Verification</Text>
              <Text style={styles.settingDescription}>Users must verify phone</Text>
            </View>
            <Switch
              value={settings.requirePhoneVerification}
              onValueChange={(value) => setSettings({ ...settings, requirePhoneVerification: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Require ID Verification</Text>
              <Text style={styles.settingDescription}>Users must verify government ID</Text>
            </View>
            <Switch
              value={settings.requireIDVerification}
              onValueChange={(value) => setSettings({ ...settings, requireIDVerification: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>
        </View>
        )}

        {shouldShowSection('relationships', ['disputes', 'cheating', 'resolve']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationships</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-Resolve Disputes</Text>
              <Text style={styles.settingDescription}>Automatically resolve after time period</Text>
            </View>
            <Switch
              value={settings.autoResolveDisputes}
              onValueChange={(value) => setSettings({ ...settings, autoResolveDisputes: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Dispute Resolve Time (days)</Text>
              <Text style={styles.settingDescription}>Days before auto-resolve</Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={settings.disputeResolveTime}
              onChangeText={(text) => setSettings({ ...settings, disputeResolveTime: text })}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Cheating Alerts</Text>
              <Text style={styles.settingDescription}>Notify on duplicate relationships</Text>
            </View>
            <Switch
              value={settings.enableCheatingAlerts}
              onValueChange={(value) => setSettings({ ...settings, enableCheatingAlerts: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>
        </View>
        )}

        {shouldShowSection('content limits', ['posts', 'reels', 'limits']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Limits</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Max Posts Per Day</Text>
              <Text style={styles.settingDescription}>Maximum posts per user daily</Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={settings.maxPostsPerDay}
              onChangeText={(text) => setSettings({ ...settings, maxPostsPerDay: text })}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Max Reels Per Day</Text>
              <Text style={styles.settingDescription}>Maximum reels per user daily</Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={settings.maxReelsPerDay}
              onChangeText={(text) => setSettings({ ...settings, maxReelsPerDay: text })}
              keyboardType="number-pad"
            />
          </View>
        </View>
        )}

        {shouldShowSection('features', ['notifications', 'features']) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>Push notifications to users</Text>
            </View>
            <Switch
              value={settings.enableNotifications}
              onValueChange={(value) => setSettings({ ...settings, enableNotifications: value })}
              trackColor={{ false: colors.text.tertiary, true: colors.primary }}
            />
          </View>
        </View>
        )}

      </ScrollView>

      <View style={styles.stickySaveBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stickyTitle}>App configuration</Text>
          <Text style={styles.stickySubtitle}>
            {hasUnsavedConfigChanges ? 'Unsaved changes' : 'All changes saved'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, !hasUnsavedConfigChanges && styles.buttonDisabled, { marginTop: 0 }]}
          onPress={handleSaveSettings}
          disabled={!hasUnsavedConfigChanges}
        >
          <Save size={20} color={colors.text.white} />
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
  content: {
    flex: 1,
  },
  header: {
    padding: 24,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  settingItemColumn: {
    paddingTop: 12,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  textInput: {
    width: 150,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  fullWidthInput: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginTop: 10,
  },
  numberInput: {
    width: 80,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    textAlign: 'center',
  },
  openaiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  openaiInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
  },
  openaiActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  clearPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  clearPillText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  stickySaveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  stickyTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  stickySubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.text.secondary,
  },
  promptInput: {
    marginTop: 12,
    minHeight: 160,
    backgroundColor: colors.background.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    flex: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});
