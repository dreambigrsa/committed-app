import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Calendar, MapPin, Clock, DollarSign, Shirt, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';

const DEFAULT_DRESS_CODES = ['casual', 'smart_casual', 'formal', 'beach', 'outdoor'];
const DEFAULT_BUDGET_RANGES = ['low', 'medium', 'high'];

export default function CreateDateRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const matchId = params.matchId as string;
  const { data: match } = trpc.dating.getMatches.useQuery(undefined, {
    select: (matches) => matches?.find((m: any) => m.id === matchId),
  });

  const { data: dateOptions } = trpc.dating.getDateOptions.useQuery();
  
  const dressCodes = dateOptions?.dressCodes || DEFAULT_DRESS_CODES.map(code => ({
    option_value: code,
    display_label: code.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  }));
  
  const budgetRanges = dateOptions?.budgetRanges || DEFAULT_BUDGET_RANGES.map(budget => ({
    option_value: budget,
    display_label: budget.charAt(0).toUpperCase() + budget.slice(1) + ' Budget',
  }));

  const expenseHandlingOptions = dateOptions?.expenseHandling || [
    { option_value: 'split', display_label: 'Split the Bill' },
    { option_value: 'initiator_pays', display_label: 'I\'ll Pay' },
    { option_value: 'acceptor_pays', display_label: 'You Pay' },
  ];

  const [dateTitle, setDateTitle] = useState('');
  const [dateDescription, setDateDescription] = useState('');
  const [dateLocation, setDateLocation] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateDurationHours, setDateDurationHours] = useState('2');
  const [dressCode, setDressCode] = useState<string>('');
  const [budgetRange, setBudgetRange] = useState<string>('');
  const [expenseHandling, setExpenseHandling] = useState<string>('split');
  const [numberOfPeople, setNumberOfPeople] = useState('2');
  const [genderPreference, setGenderPreference] = useState<'men' | 'women' | 'everyone'>('everyone');
  const [specialRequests, setSpecialRequests] = useState('');
  const [suggestedActivities, setSuggestedActivities] = useState<string[]>([]);
  const [activityInput, setActivityInput] = useState('');

  const createMutation = trpc.dating.createDateRequest.useMutation({
    onSuccess: () => {
      Alert.alert('Success', 'Date request sent!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant location permissions');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode.length > 0) {
        const address = [
          geocode[0].street,
          geocode[0].city,
          geocode[0].region,
        ].filter(Boolean).join(', ');
        setDateLocation(address);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const addActivity = () => {
    if (activityInput.trim() && suggestedActivities.length < 5) {
      setSuggestedActivities([...suggestedActivities, activityInput.trim()]);
      setActivityInput('');
    }
  };

  const removeActivity = (index: number) => {
    setSuggestedActivities(suggestedActivities.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!dateTitle.trim()) {
      Alert.alert('Error', 'Please enter a date title');
      return;
    }
    if (!dateLocation.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }
    if (!matchId) {
      Alert.alert('Error', 'Match not found');
      return;
    }

    createMutation.mutate({
      matchId,
      dateTitle: dateTitle.trim(),
      dateDescription: dateDescription.trim() || undefined,
      dateLocation: dateLocation.trim(),
      dateTime: dateTime.toISOString(),
      dateDurationHours: parseInt(dateDurationHours) || 2,
      dressCode: dressCode && ['casual', 'smart_casual', 'formal', 'beach', 'outdoor'].includes(dressCode)
        ? (dressCode as 'casual' | 'smart_casual' | 'formal' | 'beach' | 'outdoor')
        : undefined,
      budgetRange: budgetRange && ['low', 'medium', 'high'].includes(budgetRange)
        ? (budgetRange as 'low' | 'medium' | 'high')
        : undefined,
      expenseHandling: expenseHandling as 'split' | 'initiator_pays' | 'acceptor_pays',
      numberOfPeople: parseInt(numberOfPeople) || 2,
      genderPreference: genderPreference,
      specialRequests: specialRequests.trim() || undefined,
      suggestedActivities: suggestedActivities.length > 0 ? suggestedActivities : undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Create Date Request',
          headerShown: true,
        }} 
      />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Date Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Date Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Coffee & Conversation"
            placeholderTextColor={colors.text.tertiary}
            value={dateTitle}
            onChangeText={setDateTitle}
            maxLength={100}
          />
        </View>

        {/* Date Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell them about the date..."
            placeholderTextColor={colors.text.tertiary}
            value={dateDescription}
            onChangeText={setDateDescription}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>Location *</Text>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter location or use current"
              placeholderTextColor={colors.text.tertiary}
              value={dateLocation}
              onChangeText={setDateLocation}
            />
            <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
              <MapPin size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time */}
        <View style={styles.section}>
          <Text style={styles.label}>Date & Time *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={20} color={colors.primary} />
            <Text style={styles.dateText}>
              {dateTime.toLocaleString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dateTime}
              mode="datetime"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDateTime(selectedDate);
                }
              }}
            />
          )}
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={styles.label}>Duration (hours)</Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            placeholderTextColor={colors.text.tertiary}
            value={dateDurationHours}
            onChangeText={setDateDurationHours}
            keyboardType="numeric"
          />
        </View>

        {/* Suggested Activities */}
        <View style={styles.section}>
          <Text style={styles.label}>Suggested Activities (optional)</Text>
          <View style={styles.activityInputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Add activity..."
              placeholderTextColor={colors.text.tertiary}
              value={activityInput}
              onChangeText={setActivityInput}
              onSubmitEditing={addActivity}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={addActivity}
              disabled={!activityInput.trim() || suggestedActivities.length >= 5}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          {suggestedActivities.length > 0 && (
            <View style={styles.activitiesContainer}>
              {suggestedActivities.map((activity, index) => (
                <View key={index} style={styles.activityTag}>
                  <Text style={styles.activityText}>{activity}</Text>
                  <TouchableOpacity onPress={() => removeActivity(index)}>
                    <X size={16} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Dress Code */}
        <View style={styles.section}>
          <Text style={styles.label}>Dress Code</Text>
          <View style={styles.optionsRow}>
            {dressCodes.map((option: any) => {
              const code = option.option_value || option;
              const label = option.display_label || (typeof option === 'string' ? option.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '');
              return (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.optionChip,
                    dressCode === code && styles.optionChipActive,
                  ]}
                  onPress={() => setDressCode(dressCode === code ? '' : code)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      dressCode === code && styles.optionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Budget Range */}
        <View style={styles.section}>
          <Text style={styles.label}>Budget Range</Text>
          <View style={styles.optionsRow}>
            {budgetRanges.map((option: any) => {
              const budget = option.option_value || option;
              const label = option.display_label || (typeof option === 'string' ? budget.charAt(0).toUpperCase() + budget.slice(1) : '');
              return (
                <TouchableOpacity
                  key={budget}
                  style={[
                    styles.optionChip,
                    budgetRange === budget && styles.optionChipActive,
                  ]}
                  onPress={() => setBudgetRange(budgetRange === budget ? '' : budget)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      budgetRange === budget && styles.optionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Expense Handling */}
        <View style={styles.section}>
          <Text style={styles.label}>Who Pays?</Text>
          <View style={styles.optionsRow}>
            {expenseHandlingOptions.map((option: any) => {
              const value = option.option_value || option;
              const label = option.display_label || (typeof option === 'string' ? option : '');
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.optionChip,
                    expenseHandling === value && styles.optionChipActive,
                  ]}
                  onPress={() => setExpenseHandling(value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      expenseHandling === value && styles.optionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Number of People */}
        <View style={styles.section}>
          <Text style={styles.label}>Number of People</Text>
          <Text style={styles.hintText}>
            {parseInt(numberOfPeople) === 2 
              ? 'Just the two of you' 
              : `Group date with ${parseInt(numberOfPeople)} people`}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="2"
            placeholderTextColor={colors.text.tertiary}
            value={numberOfPeople}
            onChangeText={(text) => {
              const num = parseInt(text) || 2;
              if (num >= 2 && num <= 20) {
                setNumberOfPeople(text);
              }
            }}
            keyboardType="numeric"
          />
        </View>

        {/* Gender Preference (for group dates) */}
        {parseInt(numberOfPeople) > 2 && (
          <View style={styles.section}>
            <Text style={styles.label}>Gender Preference (for group)</Text>
            <View style={styles.optionsRow}>
              {(['men', 'women', 'everyone'] as const).map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.optionChip,
                    genderPreference === gender && styles.optionChipActive,
                  ]}
                  onPress={() => setGenderPreference(gender)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      genderPreference === gender && styles.optionTextActive,
                    ]}
                  >
                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Special Requests */}
        <View style={styles.section}>
          <Text style={styles.label}>Special Requests</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special requests or notes..."
            placeholderTextColor={colors.text.tertiary}
            value={specialRequests}
            onChangeText={setSpecialRequests}
            multiline
            numberOfLines={3}
            maxLength={300}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, createMutation.isPending && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Send Date Request</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    locationRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    locationButton: {
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    dateText: {
      fontSize: 16,
      color: colors.text.primary,
    },
    activityInputRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    addButton: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
    },
    addButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    activitiesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    activityTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    activityText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '500',
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    optionChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '500',
    },
    optionTextActive: {
      color: '#fff',
    },
    hintText: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 8,
      fontStyle: 'italic',
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 40,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
  });

