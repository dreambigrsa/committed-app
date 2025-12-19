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
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, Save, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { rescheduleBooking } from '@/lib/professional-bookings';
import { supabase } from '@/lib/supabase';
import { ProfessionalSession } from '@/types';
import colors from '@/constants/colors';

export default function RescheduleBookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const sessionId = params.sessionId as string;
  const isProfessional = params.isProfessional === 'true';

  const [booking, setBooking] = useState<ProfessionalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    loadBooking();
  }, [sessionId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_sessions')
        .select(`
          *,
          professional:professional_profiles!professional_sessions_professional_id_fkey(
            id,
            full_name,
            role:professional_roles(id, name)
          ),
          user:users!professional_sessions_user_id_fkey(id, full_name),
          role:professional_roles(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      const session: ProfessionalSession = {
        id: data.id,
        conversationId: data.conversation_id,
        userId: data.user_id,
        professionalId: data.professional_id,
        roleId: data.role_id,
        sessionType: data.session_type,
        status: data.status,
        userConsentGiven: data.user_consent_given || false,
        escalationLevel: data.escalation_level || 0,
        aiObserverMode: data.ai_observer_mode || false,
        scheduledDate: data.scheduled_date,
        scheduledDurationMinutes: data.scheduled_duration_minutes,
        locationType: data.location_type,
        locationAddress: data.location_address,
        locationNotes: data.location_notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        professional: data.professional as any,
        user: data.user as any,
        role: data.role as any,
      };

      setBooking(session);

      if (data.scheduled_date) {
        const scheduledDate = new Date(data.scheduled_date);
        setSelectedDate(scheduledDate);
        setSelectedTime(scheduledDate);
      }
    } catch (error: any) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      // Update time to use the same date
      const newDateTime = new Date(date);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setSelectedTime(newDateTime);
    }
  };

  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) {
      setSelectedTime(time);
      // Update date to use the same time
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(time.getHours());
      newDateTime.setMinutes(time.getMinutes());
      setSelectedDate(newDateTime);
    }
  };

  const handleSave = async () => {
    if (!booking) return;

    // Combine date and time
    const newScheduledDate = new Date(selectedDate);
    newScheduledDate.setHours(selectedTime.getHours());
    newScheduledDate.setMinutes(selectedTime.getMinutes());
    newScheduledDate.setSeconds(0);
    newScheduledDate.setMilliseconds(0);

    // Validate future date
    if (newScheduledDate <= new Date()) {
      Alert.alert('Invalid Date', 'Please select a future date and time');
      return;
    }

    try {
      setSaving(true);
      const result = await rescheduleBooking({
        sessionId: booking.id,
        newScheduledDate: newScheduledDate.toISOString(),
        reason: reason.trim() || undefined,
        requestedBy: isProfessional ? 'professional' : 'user',
      });

      if (result.success) {
        Alert.alert(
          'Success',
          'Booking rescheduled successfully',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to reschedule booking');
      }
    } catch (error: any) {
      console.error('Error rescheduling booking:', error);
      Alert.alert('Error', 'Failed to reschedule booking');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Reschedule Booking' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Reschedule Booking' }} />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Reschedule Booking' }} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Booking Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Booking</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Professional</Text>
            <Text style={styles.infoValue}>
              {booking.professional?.fullName || 'Professional'}
            </Text>

            <Text style={styles.infoLabel}>Current Date & Time</Text>
            <Text style={styles.infoValue}>
              {booking.scheduledDate ? formatDateTime(new Date(booking.scheduledDate)) : 'Not scheduled'}
            </Text>

            {booking.locationAddress && (
              <>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{booking.locationAddress}</Text>
              </>
            )}
          </View>
        </View>

        {/* New Date & Time Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Date & Time</Text>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color={themeColors.primary} />
            <View style={styles.dateTimeContent}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={styles.dateTimeValue}>
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Clock size={20} color={themeColors.primary} />
            <View style={styles.dateTimeContent}>
              <Text style={styles.dateTimeLabel}>Time</Text>
              <Text style={styles.dateTimeValue}>
                {selectedTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={selectedTime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}
        </View>

        {/* Reason (Optional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Provide a reason for rescheduling..."
            placeholderTextColor={themeColors.text.tertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Combined DateTime Preview */}
        <View style={styles.previewSection}>
          <Text style={styles.previewLabel}>New Scheduled Time:</Text>
          <Text style={styles.previewValue}>
            {formatDateTime(
              new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                selectedTime.getHours(),
                selectedTime.getMinutes()
              )
            )}
          </Text>
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
              <Text style={styles.saveButtonText}>Reschedule Booking</Text>
            </>
          )}
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
  infoCard: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dateTimeContent: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 100,
  },
  previewSection: {
    backgroundColor: colors.primary + '10',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  previewValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
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

