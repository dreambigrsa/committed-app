import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Sliders, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import * as DatingService from '@/lib/dating-service';
import * as Location from 'expo-location';

export default function DatingFiltersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('99');
  const [maxDistance, setMaxDistance] = useState('50');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  const handleGetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [lat, lng] = [location.coords.latitude, location.coords.longitude];
      setLatitude(lat);
      setLongitude(lng);

      // Reverse geocode to get city and country
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode.length > 0) {
        setLocationCity(geocode[0].city || geocode[0].region || '');
        setLocationCountry(geocode[0].country || '');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to get location');
    }
  };

  const handleApplyFilters = async () => {
    try {
      // Update user's profile with filter preferences
      await DatingService.createOrUpdateDatingProfile({
        age_range_min: parseInt(minAge),
        age_range_max: parseInt(maxAge),
        max_distance_km: parseInt(maxDistance),
        location_city: locationCity || undefined,
        location_country: locationCountry || undefined,
        location_latitude: latitude,
        location_longitude: longitude,
      });

      Alert.alert('Success', 'Filters applied successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to apply filters');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Filters',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Location Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Location</Text>
          </View>

          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleGetCurrentLocation}
          >
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.locationButtonText}>Use Current Location</Text>
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter city name"
              placeholderTextColor={colors.text.tertiary}
              value={locationCity}
              onChangeText={setLocationCity}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Country (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter country name"
              placeholderTextColor={colors.text.tertiary}
              value={locationCountry}
              onChangeText={setLocationCountry}
            />
          </View>

          {locationCity && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setLocationCity('');
                setLocationCountry('');
                setLatitude(undefined);
                setLongitude(undefined);
              }}
            >
              <X size={16} color={colors.danger} />
              <Text style={styles.clearButtonText}>Clear Location</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Distance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sliders size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Distance</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Maximum Distance (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              placeholderTextColor={colors.text.tertiary}
              value={maxDistance}
              onChangeText={setMaxDistance}
              keyboardType="numeric"
            />
            <Text style={styles.hint}>Show people within this distance</Text>
          </View>
        </View>

        {/* Age Range Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Age Range</Text>
          </View>

          <View style={styles.ageRow}>
            <View style={styles.ageInputGroup}>
              <Text style={styles.label}>Min Age</Text>
              <TextInput
                style={styles.input}
                placeholder="18"
                placeholderTextColor={colors.text.tertiary}
                value={minAge}
                onChangeText={setMinAge}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.ageInputGroup}>
              <Text style={styles.label}>Max Age</Text>
              <TextInput
                style={styles.input}
                placeholder="99"
                placeholderTextColor={colors.text.tertiary}
                value={maxAge}
                onChangeText={setMaxAge}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Apply Button */}
        <TouchableOpacity
          style={styles.applyButton}
          onPress={handleApplyFilters}
        >
          <Text style={styles.applyButtonText}>Apply Filters</Text>
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
    headerButton: {
      padding: 8,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 16,
    },
    locationButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
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
    hint: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 4,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    clearButtonText: {
      fontSize: 14,
      color: colors.danger,
      fontWeight: '600',
    },
    ageRow: {
      flexDirection: 'row',
      gap: 12,
    },
    ageInputGroup: {
      flex: 1,
    },
    applyButton: {
      margin: 20,
      padding: 18,
      backgroundColor: colors.primary,
      borderRadius: 16,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    applyButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#fff',
    },
  });

