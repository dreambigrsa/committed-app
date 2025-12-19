import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { 
  Radio, 
  Clock, 
  Users, 
  Shield, 
  Save,
  Circle,
  Loader,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalProfile, ProfessionalStatus } from '@/types';
import colors from '@/constants/colors';

type StatusType = 'online' | 'busy' | 'offline' | 'away';

export default function ProfessionalAvailabilityScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [status, setStatus] = useState<ProfessionalStatus | null>(null);
  
  // Status settings
  const [currentStatus, setCurrentStatus] = useState<StatusType>('offline');
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(3);
  
  // Quiet hours settings
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [quietHoursTimezone, setQuietHoursTimezone] = useState('UTC');
  
  // Availability toggles
  const [onlineAvailability, setOnlineAvailability] = useState(true);
  const [inPersonAvailability, setInPersonAvailability] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);

      // Load professional profile
      const { data: profileData, error: profileError } = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        Alert.alert(
          'Not a Professional',
          'You need to become a professional first.',
          [
            { text: 'Cancel', onPress: () => router.back() },
            { text: 'Apply Now', onPress: () => router.push('/settings/become-professional') },
          ]
        );
        return;
      }

      setProfile(profileData);
      setMaxConcurrentSessions(profileData.max_concurrent_sessions || 3);
      setQuietHoursEnabled(!!profileData.quiet_hours_start);
      setQuietHoursStart(profileData.quiet_hours_start || '22:00');
      setQuietHoursEnd(profileData.quiet_hours_end || '08:00');
      setQuietHoursTimezone(profileData.quiet_hours_timezone || 'UTC');
      setOnlineAvailability(profileData.online_availability ?? true);
      setInPersonAvailability(profileData.in_person_availability ?? false);

      // Load professional status
      const { data: statusData, error: statusError } = await supabase
        .from('professional_status')
        .select('*')
        .eq('professional_id', profileData.id)
        .maybeSingle();

      if (statusError) throw statusError;

      if (statusData) {
        setStatus(statusData);
        setCurrentStatus(statusData.status as StatusType);
      } else {
        // Create default status if it doesn't exist
        const { data: newStatusData, error: createError } = await supabase
          .from('professional_status')
          .insert({
            professional_id: profileData.id,
            status: 'offline',
          })
          .select()
          .single();

        if (!createError && newStatusData) {
          setStatus(newStatusData);
          setCurrentStatus('offline');
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load availability settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !currentUser) return;

    try {
      setSaving(true);

      // Update profile
      const { error: profileError } = await supabase
        .from('professional_profiles')
        .update({
          max_concurrent_sessions: maxConcurrentSessions,
          quiet_hours_start: quietHoursEnabled ? quietHoursStart : null,
          quiet_hours_end: quietHoursEnabled ? quietHoursEnd : null,
          quiet_hours_timezone: quietHoursEnabled ? quietHoursTimezone : 'UTC',
          online_availability: onlineAvailability,
          in_person_availability: inPersonAvailability,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Update status
      if (status) {
        const { error: statusError } = await supabase
          .from('professional_status')
          .update({
            status: currentStatus,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('professional_id', profile.id);

        if (statusError) throw statusError;
      }

      Alert.alert('Success', 'Availability settings saved successfully');
      router.back();
    } catch (error: any) {
      console.error('Error saving data:', error);
      Alert.alert('Error', 'Failed to save availability settings');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (statusType: StatusType) => {
    switch (statusType) {
      case 'online':
        return themeColors.status.verified || themeColors.secondary;
      case 'busy':
        return themeColors.accent;
      case 'away':
        return themeColors.primary;
      case 'offline':
      default:
        return themeColors.text.tertiary;
    }
  };

  const getStatusLabel = (statusType: StatusType) => {
    switch (statusType) {
      case 'online':
        return 'Online';
      case 'busy':
        return 'Busy';
      case 'away':
        return 'Away';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Professional Availability' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading availability settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Professional Availability' }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Professional profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAdminOverride = status?.statusOverride;
  const currentSessionCount = status?.currentSessionCount || 0;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Professional Availability' }} />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          
          {isAdminOverride && (
            <View style={styles.overrideWarning}>
              <Shield size={16} color={themeColors.accent} />
              <Text style={styles.overrideText}>
                Your status is currently overridden by an admin until{' '}
                {status?.statusOverrideUntil 
                  ? new Date(status.statusOverrideUntil).toLocaleString()
                  : 'further notice'}
              </Text>
            </View>
          )}

          <View style={styles.statusGrid}>
            {(['online', 'busy', 'away', 'offline'] as StatusType[]).map((statusType) => (
              <TouchableOpacity
                key={statusType}
                style={[
                  styles.statusOption,
                  currentStatus === statusType && styles.statusOptionActive,
                  isAdminOverride && styles.statusOptionDisabled,
                ]}
                onPress={() => !isAdminOverride && setCurrentStatus(statusType)}
                disabled={isAdminOverride}
              >
                <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(statusType) }]} />
                <Text style={[
                  styles.statusLabel,
                  currentStatus === statusType && styles.statusLabelActive,
                ]}>
                  {getStatusLabel(statusType)}
                </Text>
                {currentStatus === statusType && (
                  <CheckCircle2 size={16} color={themeColors.primary} style={styles.checkIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sessionInfo}>
            <Users size={16} color={themeColors.text.secondary} />
            <Text style={styles.sessionText}>
              Active Sessions: {currentSessionCount} / {maxConcurrentSessions}
            </Text>
          </View>
        </View>

        {/* Availability Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability Types</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Radio size={20} color={themeColors.text.secondary} />
              <Text style={styles.settingLabel}>Online Availability</Text>
              <Text style={styles.settingDescription}>
                Available for online chat sessions
              </Text>
            </View>
            <Switch
              value={onlineAvailability}
              onValueChange={setOnlineAvailability}
              trackColor={{ false: themeColors.border.light, true: themeColors.primary }}
              thumbColor={themeColors.text.white}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Users size={20} color={themeColors.text.secondary} />
              <Text style={styles.settingLabel}>In-Person Availability</Text>
              <Text style={styles.settingDescription}>
                Available for in-person sessions
              </Text>
            </View>
            <Switch
              value={inPersonAvailability}
              onValueChange={setInPersonAvailability}
              trackColor={{ false: themeColors.border.light, true: themeColors.primary }}
              thumbColor={themeColors.text.white}
            />
          </View>
        </View>

        {/* Session Limits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Limits</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Max Concurrent Sessions</Text>
            <View style={styles.sessionLimitControls}>
              <TouchableOpacity
                style={styles.limitButton}
                onPress={() => setMaxConcurrentSessions(Math.max(1, maxConcurrentSessions - 1))}
              >
                <Text style={styles.limitButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.limitValue}>{maxConcurrentSessions}</Text>
              <TouchableOpacity
                style={styles.limitButton}
                onPress={() => setMaxConcurrentSessions(Math.min(10, maxConcurrentSessions + 1))}
              >
                <Text style={styles.limitButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Clock size={20} color={themeColors.text.secondary} />
              <Text style={styles.settingLabel}>Quiet Hours</Text>
              <Text style={styles.settingDescription}>
                Automatically set status to busy during these hours
              </Text>
            </View>
            <Switch
              value={quietHoursEnabled}
              onValueChange={setQuietHoursEnabled}
              trackColor={{ false: themeColors.border.light, true: themeColors.primary }}
              thumbColor={themeColors.text.white}
            />
          </View>

          {quietHoursEnabled && (
            <View style={styles.quietHoursSettings}>
              <View style={styles.timeInputRow}>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>Start Time</Text>
                  <TextInput
                    style={styles.timeInputField}
                    value={quietHoursStart}
                    onChangeText={setQuietHoursStart}
                    placeholder="22:00"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>
                <View style={styles.timeInput}>
                  <Text style={styles.inputLabel}>End Time</Text>
                  <TextInput
                    style={styles.timeInputField}
                    value={quietHoursEnd}
                    onChangeText={setQuietHoursEnd}
                    placeholder="08:00"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Timezone</Text>
                <TextInput
                  style={styles.textInput}
                  value={quietHoursTimezone}
                  onChangeText={setQuietHoursTimezone}
                  placeholder="UTC"
                  placeholderTextColor={themeColors.text.tertiary}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={themeColors.text.white} />
          ) : (
            <>
              <Save size={20} color={themeColors.text.white} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        {/* View Session Requests Button */}
        <TouchableOpacity
          style={styles.sessionRequestsButton}
          onPress={() => router.push('/professional/session-requests' as any)}
        >
          <Users size={20} color={themeColors.primary} />
          <Text style={styles.sessionRequestsButtonText}>View Session Requests</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  section: {
    backgroundColor: colors.background.primary,
    padding: 20,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  overrideWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  overrideText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statusOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    gap: 8,
  },
  statusOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  statusOptionDisabled: {
    opacity: 0.5,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusLabelActive: {
    color: colors.primary,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  sessionText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  settingLeft: {
    flex: 1,
    gap: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  inputGroup: {
    marginTop: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  sessionLimitControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  limitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  limitButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  limitValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 40,
    textAlign: 'center',
  },
  quietHoursSettings: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  timeInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  timeInput: {
    flex: 1,
  },
  timeInputField: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  footer: {
    padding: 20,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.white,
  },
});

