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
import { getEffectiveProfessionalStatus, EffectiveProfessionalStatus } from '@/lib/professional-availability';
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
  const [effectiveStatus, setEffectiveStatus] = useState<EffectiveProfessionalStatus | null>(null);
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(3);
  
  // Quiet hours settings
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [quietHoursTimezone, setQuietHoursTimezone] = useState('UTC');
  
  // Availability toggles
  const [onlineAvailability, setOnlineAvailability] = useState(true);
  const [inPersonAvailability, setInPersonAvailability] = useState(false);
  
  // Pricing settings
  const [pricingEnabled, setPricingEnabled] = useState(false);
  const [pricingCurrency, setPricingCurrency] = useState('USD');
  const [pricingRate, setPricingRate] = useState('');
  const [pricingUnit, setPricingUnit] = useState('session'); // session, hour, minute

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

      // Load pricing info
      if (profileData.pricing_info && typeof profileData.pricing_info === 'object') {
        setPricingEnabled(true);
        setPricingCurrency(profileData.pricing_info.currency || 'USD');
        setPricingRate(profileData.pricing_info.rate?.toString() || '');
        setPricingUnit(profileData.pricing_info.unit || 'session');
      } else {
        setPricingEnabled(false);
        setPricingCurrency('USD');
        setPricingRate('');
        setPricingUnit('session');
      }

      // Load professional status
      const { data: statusData, error: statusError } = await supabase
        .from('professional_status')
        .select('*')
        .eq('professional_id', profileData.id)
        .maybeSingle();

      if (statusError) throw statusError;

      if (statusData) {
        // Map database fields to TypeScript type
        const mappedStatus: ProfessionalStatus = {
          id: statusData.id,
          professionalId: statusData.professional_id,
          status: statusData.status,
          currentSessionCount: statusData.current_session_count || 0,
          lastSeenAt: statusData.last_seen_at,
          statusOverride: statusData.status_override || false,
          statusOverrideBy: statusData.status_override_by,
          statusOverrideUntil: statusData.status_override_until,
          updatedAt: statusData.updated_at,
        };
        setStatus(mappedStatus);
        setCurrentStatus(statusData.status as StatusType);
        
        // Calculate effective status
        const profileUserId = (profileData as any).user_id || profile?.userId;
        if (profileUserId) {
          try {
            const effective = await getEffectiveProfessionalStatus(
              profileUserId,
              statusData.status as StatusType,
              statusData.status_override || false
            );
            setEffectiveStatus(effective);
          } catch (error) {
            console.error('Error calculating effective status:', error);
          }
        }
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
          const mappedStatus: ProfessionalStatus = {
            id: newStatusData.id,
            professionalId: newStatusData.professional_id,
            status: newStatusData.status,
            currentSessionCount: newStatusData.current_session_count || 0,
            lastSeenAt: newStatusData.last_seen_at,
            statusOverride: newStatusData.status_override || false,
            statusOverrideBy: newStatusData.status_override_by,
            statusOverrideUntil: newStatusData.status_override_until,
            updatedAt: newStatusData.updated_at,
          };
          setStatus(mappedStatus);
          setCurrentStatus('offline');
          
          // Calculate effective status for default
          const profileUserId = (profileData as any).user_id;
          if (profileUserId) {
            try {
              const effective = await getEffectiveProfessionalStatus(
                profileUserId,
                'offline',
                false
              );
              setEffectiveStatus(effective);
            } catch (error) {
              console.error('Error calculating effective status:', error);
            }
          }
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

      // Prepare pricing info
      const pricingInfo = pricingEnabled && pricingRate 
        ? {
            currency: pricingCurrency,
            rate: parseFloat(pricingRate),
            unit: pricingUnit,
          }
        : null;

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
          pricing_info: pricingInfo,
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
        {/* Status Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Preference</Text>
          
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

          {/* Show actual calculated status */}
          {effectiveStatus && !isAdminOverride && (
            <View style={styles.effectiveStatusInfo}>
              <Text style={styles.effectiveStatusLabel}>
                Actual Status: <Text style={styles.effectiveStatusValue}>{getStatusLabel(effectiveStatus.status)}</Text>
                {effectiveStatus.isAutomatic && (
                  <Text style={styles.effectiveStatusNote}> (Automatic)</Text>
                )}
                {!effectiveStatus.isAutomatic && effectiveStatus.source === 'manual_override' && (
                  <Text style={styles.effectiveStatusNote}> (Manual Override)</Text>
                )}
              </Text>
              <Text style={styles.effectiveStatusDescription}>
                {currentStatus === 'online' && 'Uses automatic status based on app activity'}
                {currentStatus === 'away' && 'Uses automatic status, defaults to away when inactive'}
                {(currentStatus === 'busy' || currentStatus === 'offline') && 'Always shows this status (manual override)'}
              </Text>
            </View>
          )}

          <View style={styles.statusGrid}>
            {(['online', 'busy', 'away', 'offline'] as StatusType[]).map((statusType) => {
              const isSelected = currentStatus === statusType;
              const statusColor = getStatusColor(statusType);
              
              return (
                <TouchableOpacity
                  key={statusType}
                  style={[
                    styles.statusOption,
                    isSelected && styles.statusOptionActive,
                    isSelected && { borderColor: statusColor, backgroundColor: statusColor + '08' },
                    isAdminOverride && styles.statusOptionDisabled,
                  ]}
                  onPress={async () => {
                    if (!isAdminOverride && profile) {
                      const profileUserId = (profile as any).user_id || profile.userId;
                      setCurrentStatus(statusType);
                      // Recalculate effective status
                      if (profileUserId) {
                        try {
                          const effective = await getEffectiveProfessionalStatus(
                            profileUserId,
                            statusType,
                            false
                          );
                          setEffectiveStatus(effective);
                        } catch (error) {
                          console.error('Error calculating effective status:', error);
                        }
                      }
                    }
                  }}
                  disabled={isAdminOverride}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.statusIndicatorContainer,
                    isSelected && { backgroundColor: statusColor + '20' },
                  ]}>
                    <View style={[
                      styles.statusIndicator,
                      { backgroundColor: statusColor },
                      isSelected && styles.statusIndicatorActive,
                    ]} />
                  </View>
                  <View style={styles.statusOptionContent}>
                    <Text style={[
                      styles.statusLabel,
                      isSelected && styles.statusLabelActive,
                      isSelected && { color: statusColor },
                    ]}>
                      {getStatusLabel(statusType)}
                    </Text>
                    {statusType === 'online' && (
                      <Text style={[
                        styles.statusOptionHint,
                        isSelected && styles.statusOptionHintActive,
                      ]}>
                        Automatic
                      </Text>
                    )}
                    {(statusType === 'busy' || statusType === 'offline') && (
                      <Text style={[
                        styles.statusOptionHint,
                        isSelected && styles.statusOptionHintActive,
                      ]}>
                        Override
                      </Text>
                    )}
                    {statusType === 'away' && (
                      <Text style={[
                        styles.statusOptionHint,
                        isSelected && styles.statusOptionHintActive,
                      ]}>
                        Auto (default away)
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <View style={[styles.checkIconContainer, { backgroundColor: statusColor }]}>
                      <CheckCircle2 size={16} color={themeColors.text.white} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
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

        {/* Pricing Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Set Pricing</Text>
              <Text style={styles.settingDescription}>
                Charge fees for your professional services
              </Text>
            </View>
            <Switch
              value={pricingEnabled}
              onValueChange={setPricingEnabled}
              trackColor={{ false: themeColors.border.light, true: themeColors.primary }}
              thumbColor={themeColors.text.white}
            />
          </View>

          {pricingEnabled && (
            <View style={styles.pricingSettings}>
              <View style={styles.pricingRow}>
                <View style={styles.pricingInputGroup}>
                  <Text style={styles.inputLabel}>Currency</Text>
                  <TextInput
                    style={styles.textInput}
                    value={pricingCurrency}
                    onChangeText={setPricingCurrency}
                    placeholder="USD"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>
                <View style={styles.pricingInputGroup}>
                  <Text style={styles.inputLabel}>Rate</Text>
                  <TextInput
                    style={styles.textInput}
                    value={pricingRate}
                    onChangeText={setPricingRate}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pricing Unit</Text>
                <View style={styles.pricingUnitRow}>
                  {(['session', 'hour', 'minute'] as const).map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.pricingUnitOption,
                        pricingUnit === unit && styles.pricingUnitOptionActive,
                      ]}
                      onPress={() => setPricingUnit(unit)}
                    >
                      <Text style={[
                        styles.pricingUnitText,
                        pricingUnit === unit && styles.pricingUnitTextActive,
                      ]}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.pricingExample}>
                  Example: {pricingRate || '0'} {pricingCurrency} per {pricingUnit}
                </Text>
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
    gap: 10,
    marginBottom: 16,
  },
  statusOption: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    backgroundColor: colors.background.primary,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statusOptionActive: {
    borderWidth: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  statusOptionDisabled: {
    opacity: 0.5,
  },
  statusIndicatorContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusIndicatorActive: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statusLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 1,
  },
  statusLabelActive: {
    fontWeight: '700',
  },
  checkIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  effectiveStatusInfo: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  effectiveStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  effectiveStatusValue: {
    color: colors.primary,
    fontWeight: '700',
  },
  effectiveStatusNote: {
    fontSize: 12,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  effectiveStatusDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  statusOptionContent: {
    flex: 1,
    gap: 2,
  },
  statusOptionHint: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '400',
    lineHeight: 14,
  },
  statusOptionHintActive: {
    color: colors.text.secondary,
    fontWeight: '500',
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
  pricingSettings: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  pricingInputGroup: {
    flex: 1,
  },
  pricingUnitRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  pricingUnitOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
  },
  pricingUnitOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  pricingUnitText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pricingUnitTextActive: {
    color: colors.primary,
  },
  pricingExample: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 8,
    fontStyle: 'italic',
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
  sessionRequestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  sessionRequestsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});

