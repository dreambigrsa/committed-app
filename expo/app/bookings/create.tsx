import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  User,
  Save,
  Check,
  DollarSign,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { createProfessionalBooking } from '@/lib/professional-bookings';
import { findMatchingProfessionals , ProfessionalMatch } from '@/lib/professional-matching';
import { supabase } from '@/lib/supabase';
import { ProfessionalRole } from '@/types';

type LocationType = 'online' | 'in_person' | 'phone' | 'video';

export default function CreateBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentUser, createOrGetConversation } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  // Pre-filled professional if coming from a conversation
  const professionalIdParam = params.professionalId as string | undefined;
  const conversationIdParam = params.conversationId as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<ProfessionalRole | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalMatch[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<ProfessionalMatch | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState('60'); // minutes
  const [locationType, setLocationType] = useState<LocationType>('online');
  const [address, setAddress] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [pricing, setPricing] = useState<{ rate?: number; currency?: string } | null>(null);

  const locationTypes: { value: LocationType; label: string; icon: typeof Video }[] = [
    { value: 'online', label: 'Online', icon: Video },
    { value: 'in_person', label: 'In-Person', icon: MapPin },
    { value: 'phone', label: 'Phone Call', icon: Phone },
    { value: 'video', label: 'Video Call', icon: Video },
  ];

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  }, []);

  useEffect(() => {
    if (professionalIdParam && selectedRole) {
      loadProfessionalDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when params change
  }, [professionalIdParam, selectedRole]);

  useEffect(() => {
    if (selectedProfessional) {
      loadPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when professional selected
  }, [selectedProfessional]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_roles')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      setRoles(data || []);

      // If professional ID is provided, try to find their role
      if (professionalIdParam) {
        const { data: profile } = await supabase
          .from('professional_profiles')
          .select('role_id, role:professional_roles(*)')
          .eq('id', professionalIdParam)
          .single();

        if (profile?.role_id) {
          const role = data?.find((r) => r.id === profile.role_id);
          if (role) {
            setSelectedRole(role);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading roles:', error);
      Alert.alert('Error', 'Failed to load professional roles');
    } finally {
      setLoading(false);
    }
  };

  const loadProfessionalDetails = async () => {
    if (!professionalIdParam || !selectedRole) return;

    try {
      const matches = await findMatchingProfessionals(
        {
          roleId: selectedRole.id,
          requiresOnlineOnly: false, // Include offline professionals for bookings
        },
        10
      );

      const professional = matches.find((m) => m.profile.id === professionalIdParam);
      if (professional) {
        setSelectedProfessional(professional);
        setProfessionals([professional]);
      } else {
        // Load professional directly if not found in matches
        const { data } = await supabase
          .from('professional_profiles')
          .select(
            `
            *,
            role:professional_roles(*),
            status:professional_status(*)
          `
          )
          .eq('id', professionalIdParam)
          .single();

        if (data && selectedRole) {
          const statusData = Array.isArray(data.status) ? data.status[0] : data.status;
          const match: ProfessionalMatch = {
            profile: data as any,
            role: selectedRole,
            status: statusData || { status: 'offline', current_session_count: 0 } as any,
            matchScore: 100,
            matchReasons: ['Selected professional'],
          };
          setSelectedProfessional(match);
          setProfessionals([match]);
        }
      }
    } catch (error: any) {
      console.error('Error loading professional:', error);
    }
  };

  const loadPricing = async () => {
    if (!selectedProfessional) return;

    try {
      const profile = selectedProfessional.profile;
      if (profile.pricingInfo) {
        setPricing({
          rate: profile.pricingInfo.rate,
          currency: profile.pricingInfo.currency || 'USD',
        });
      } else {
        setPricing(null);
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const handleRoleSelect = async (role: ProfessionalRole) => {
    setSelectedRole(role);
    setSelectedProfessional(null);
    setProfessionals([]);
    setPricing(null);

    if (professionalIdParam) {
      // Professional already selected, just load details
      await loadProfessionalDetails();
    } else {
      // Load available professionals for this role
      try {
        const matches = await findMatchingProfessionals(
          {
            roleId: role.id,
            requiresOnlineOnly: false, // Include offline professionals for bookings
          },
          10
        );
        setProfessionals(matches);
      } catch (error: any) {
        console.error('Error loading professionals:', error);
        Alert.alert('Error', 'Failed to load available professionals');
      }
    }
  };

  const handleProfessionalSelect = (professional: ProfessionalMatch) => {
    setSelectedProfessional(professional);
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      // Update time picker to use same date
      const newDateTime = new Date(date);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setSelectedTime(newDateTime);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (time) {
      setSelectedTime(time);
      // Update date to use same time
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(time.getHours());
      newDateTime.setMinutes(time.getMinutes());
      setSelectedDate(newDateTime);
    }
  };

  const getScheduledDateTime = () => {
    const datetime = new Date(selectedDate);
    datetime.setHours(selectedTime.getHours());
    datetime.setMinutes(selectedTime.getMinutes());
    datetime.setSeconds(0);
    datetime.setMilliseconds(0);
    return datetime;
  };

  const handleCreateBooking = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'Please log in to create a booking');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Error', 'Please select a professional role');
      return;
    }

    if (!selectedProfessional) {
      Alert.alert('Error', 'Please select a professional');
      return;
    }

    if (!duration || isNaN(parseInt(duration))) {
      Alert.alert('Error', 'Please enter a valid duration');
      return;
    }

    if (locationType === 'in_person' && !address.trim()) {
      Alert.alert('Error', 'Please enter an address for in-person sessions');
      return;
    }

    const scheduledDateTime = getScheduledDateTime();
    if (scheduledDateTime < new Date()) {
      Alert.alert('Error', 'Please select a future date and time');
      return;
    }

    setSaving(true);
    try {
      // Get or create conversation
      let conversationId = conversationIdParam;
      if (!conversationId) {
        // Create conversation with professional's user account
        const { data: profile } = await supabase
          .from('professional_profiles')
          .select('user_id')
          .eq('id', selectedProfessional.profile.id)
          .single();

        if (!profile?.user_id) {
          throw new Error('Professional user not found');
        }

        const conversation = await createOrGetConversation(profile.user_id);
        if (!conversation) {
          throw new Error('Failed to create conversation');
        }
        conversationId = conversation.id;
      }

      const result = await createProfessionalBooking({
        conversationId,
        userId: currentUser.id,
        professionalId: selectedProfessional.profile.id,
        roleId: selectedRole.id,
        scheduledDate: scheduledDateTime.toISOString(),
        scheduledDurationMinutes: parseInt(duration),
        locationType,
        locationAddress: locationType === 'in_person' ? address : undefined,
        locationNotes: locationNotes.trim() || undefined,
        bookingNotes: bookingNotes.trim() || undefined,
      });

      if (result.session) {
        Alert.alert(
          'Booking Created',
          `Your booking with ${selectedProfessional.profile.fullName} has been created. They will be notified.`,
          [
            {
              text: 'OK',
              onPress: () => {
                router.back();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to create booking');
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      Alert.alert('Error', error.message || 'Failed to create booking');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Create Booking' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Create Booking' }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {/* Role Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Professional Role</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleScroll}>
            {roles.map((role) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleChip,
                  selectedRole?.id === role.id && styles.roleChipSelected,
                ]}
                onPress={() => handleRoleSelect(role)}
              >
                <Text
                  style={[
                    styles.roleChipText,
                    selectedRole?.id === role.id && styles.roleChipTextSelected,
                  ]}
                >
                  {role.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Professional Selection */}
        {selectedRole && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Professional</Text>
            {professionalIdParam && professionals.length === 1 ? (
              <View style={styles.professionalCard}>
                <View style={styles.professionalInfo}>
                  <View style={styles.professionalAvatar}>
                    <User size={24} color={themeColors.primary} />
                  </View>
                  <View style={styles.professionalDetails}>
                    <Text style={styles.professionalName}>
                      {selectedProfessional?.profile.fullName || 'Professional'}
                    </Text>
                    <Text style={styles.professionalRole}>{selectedRole.name}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.professionalsList}>
                {professionals.map((professional) => (
                  <TouchableOpacity
                    key={professional.profile.id}
                    style={[
                      styles.professionalCard,
                      selectedProfessional?.profile.id === professional.profile.id &&
                        styles.professionalCardSelected,
                    ]}
                    onPress={() => handleProfessionalSelect(professional)}
                  >
                    <View style={styles.professionalInfo}>
                      <View style={styles.professionalAvatar}>
                        <User size={24} color={themeColors.primary} />
                      </View>
                      <View style={styles.professionalDetails}>
                        <Text style={styles.professionalName}>
                          {professional.profile.fullName}
                        </Text>
                        <Text style={styles.professionalRole}>{selectedRole.name}</Text>
                        {(professional.profile.ratingAverage && professional.profile.ratingAverage > 0) && (
                          <Text style={styles.rating}>
                            ⭐ {professional.profile.ratingAverage.toFixed(1)} ({String(professional.profile.ratingCount || 0)})
                          </Text>
                        )}
                      </View>
                    </View>
                    {selectedProfessional?.profile.id === professional.profile.id && (
                      <Check size={20} color={themeColors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                {professionals.length === 0 && (
                  <Text style={styles.emptyText}>
                    No professionals available for this role
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Date & Time Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>

          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color={themeColors.primary} />
            <Text style={styles.inputButtonText}>
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}

          <TouchableOpacity
            style={styles.inputButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Clock size={20} color={themeColors.primary} />
            <Text style={styles.inputButtonText}>
              {selectedTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </TouchableOpacity>

          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          <View style={styles.durationRow}>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.durationInput}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="60"
            />
          </View>
        </View>

        {/* Location Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Type</Text>
          <View style={styles.locationTypesGrid}>
            {locationTypes.map((type) => {
              const Icon = type.icon;
              return (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.locationTypeButton,
                    locationType === type.value && styles.locationTypeButtonSelected,
                  ]}
                  onPress={() => setLocationType(type.value)}
                >
                  <Icon
                    size={24}
                    color={
                      locationType === type.value
                        ? themeColors.primary
                        : themeColors.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.locationTypeText,
                      locationType === type.value && styles.locationTypeTextSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {locationType === 'in_person' && (
            <TextInput
              style={styles.textInput}
              placeholder="Enter address"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />
          )}

          <TextInput
            style={styles.textInput}
            placeholder="Location notes (optional)"
            value={locationNotes}
            onChangeText={setLocationNotes}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Pricing */}
        {selectedProfessional && pricing && pricing.rate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pricing</Text>
            <View style={styles.pricingCard}>
              <DollarSign size={20} color={themeColors.primary} />
              <Text style={styles.pricingText}>
                {pricing.currency} {pricing.rate.toFixed(2)} per session
              </Text>
            </View>
          </View>
        )}

        {/* Booking Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Any additional information for the professional..."
            value={bookingNotes}
            onChangeText={setBookingNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, saving && styles.createButtonDisabled]}
          onPress={handleCreateBooking}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Save size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Booking</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 24,
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
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    roleScroll: {
      marginHorizontal: -16,
      paddingHorizontal: 16,
    },
    roleChip: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      marginRight: 8,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    roleChipSelected: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    roleChipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    roleChipTextSelected: {
      color: colors.primary,
    },
    professionalsList: {
      gap: 12,
    },
    professionalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    professionalCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    professionalInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    professionalAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    professionalDetails: {
      flex: 1,
    },
    professionalName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    professionalRole: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    rating: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 4,
    },
    inputButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    inputButtonText: {
      fontSize: 16,
      color: colors.text.primary,
      flex: 1,
    },
    durationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    durationInput: {
      width: 100,
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
      fontSize: 16,
      color: colors.text.primary,
      textAlign: 'center',
    },
    locationTypesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    locationTypeButton: {
      flex: 1,
      minWidth: '45%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    locationTypeButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    locationTypeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    locationTypeTextSelected: {
      color: colors.primary,
    },
    textInput: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      fontSize: 16,
      color: colors.text.primary,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    pricingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary + '10',
    },
    pricingText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 18,
      borderRadius: 12,
      backgroundColor: colors.primary,
      marginTop: 8,
      marginBottom: 32,
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      padding: 16,
    },
  });
}

