import React, { useState, useMemo, useEffect } from 'react';
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
import { Stack, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Baby,
  Check,
  GraduationCap,
  Heart,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as DatingService from '@/lib/dating-service';
import type { DatingDiscoveryFilters } from '@/lib/dating-service';
import * as Location from 'expo-location';
import { navigateToDatingHome } from '@/lib/dating-navigation';

const INTENTION_OPTIONS = [
  { value: 'friendship', label: 'Friendship' },
  { value: 'dating', label: 'Dating' },
  { value: 'serious', label: 'Serious' },
  { value: 'marriage', label: 'Marriage' },
];

const RELIGION_OPTIONS = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Traditional', 'Spiritual', 'Agnostic', 'Atheist', 'Other'];
const EDUCATION_OPTIONS = ['High school', 'Diploma', 'Bachelor\'s', 'Master\'s', 'Doctorate', 'Trade/Technical', 'Self-taught'];
const KIDS_OPTIONS = [
  { value: 'have_kids', label: 'Has kids' },
  { value: 'want_kids', label: 'Wants kids' },
  { value: 'dont_want_kids', label: 'No kids' },
  { value: 'have_and_want_more', label: 'Has and wants more' },
  { value: 'not_sure', label: 'Not sure' },
];
const LIFESTYLE_OPTIONS = [
  { key: 'drink' as const, value: 'no', label: 'Does not drink' },
  { key: 'drink' as const, value: 'sometimes', label: 'Drinks socially' },
  { key: 'smoke' as const, value: 'no', label: 'Non-smoker' },
  { key: 'exercise' as const, value: 'often', label: 'Active often' },
  { key: 'exercise' as const, value: 'sometimes', label: 'Sometimes active' },
  { key: 'pets' as const, value: 'have_pets', label: 'Has pets' },
  { key: 'pets' as const, value: 'want_pets', label: 'Likes pets' },
];
const INTEREST_OPTIONS = ['Music', 'Travel', 'Food', 'Family', 'Faith', 'Fitness', 'Movies', 'Books', 'Business', 'Adventure', 'Art', 'Dancing'];

type LookingFor = 'men' | 'women' | 'everyone';
type LifestyleKey = 'drink' | 'smoke' | 'exercise' | 'pets';

export default function DatingFiltersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [minAge, setMinAge] = useState('18');
  const [maxAge, setMaxAge] = useState('99');
  const [maxDistance, setMaxDistance] = useState('50');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [lookingFor, setLookingFor] = useState<LookingFor>('everyone');
  const [intentionTags, setIntentionTags] = useState<string[]>([]);
  const [religions, setReligions] = useState<string[]>([]);
  const [educationLevels, setEducationLevels] = useState<string[]>([]);
  const [kids, setKids] = useState<string[]>([]);
  const [drink, setDrink] = useState<string[]>([]);
  const [smoke, setSmoke] = useState<string[]>([]);
  const [exercise, setExercise] = useState<string[]>([]);
  const [pets, setPets] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [minHeightCm, setMinHeightCm] = useState('');
  const [maxHeightCm, setMaxHeightCm] = useState('');
  const [hasPhotos, setHasPhotos] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeRecently, setActiveRecently] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const activeFilterCount = useMemo(() => {
    return [
      minAge !== '18' || maxAge !== '99',
      maxDistance !== '50',
      locationCity || locationCountry,
      lookingFor !== 'everyone',
      intentionTags.length,
      religions.length,
      educationLevels.length,
      kids.length,
      drink.length + smoke.length + exercise.length + pets.length,
      interests.length,
      minHeightCm || maxHeightCm,
      hasPhotos,
      verifiedOnly,
      activeRecently,
    ].filter(Boolean).length;
  }, [
    minAge,
    maxAge,
    maxDistance,
    locationCity,
    locationCountry,
    lookingFor,
    intentionTags,
    religions,
    educationLevels,
    kids,
    drink,
    smoke,
    exercise,
    pets,
    interests,
    minHeightCm,
    maxHeightCm,
    hasPhotos,
    verifiedOnly,
    activeRecently,
  ]);

  const loadSavedFilters = async () => {
    try {
      setIsLoading(true);
      const [profile, savedFilters] = await Promise.all([
        DatingService.getDatingProfile(),
        DatingService.getSavedDatingDiscoveryFilters(),
      ]);

      setMinAge(String(savedFilters.minAge ?? profile?.age_range_min ?? 18));
      setMaxAge(String(savedFilters.maxAge ?? profile?.age_range_max ?? 99));
      setMaxDistance(String(savedFilters.maxDistance ?? profile?.max_distance_km ?? 50));
      setLocationCity(savedFilters.locationCity ?? profile?.location_city ?? '');
      setLocationCountry(savedFilters.locationCountry ?? profile?.location_country ?? '');
      setLatitude(savedFilters.latitude ?? profile?.location_latitude);
      setLongitude(savedFilters.longitude ?? profile?.location_longitude);
      setLookingFor(savedFilters.lookingFor ?? profile?.looking_for ?? 'everyone');
      setIntentionTags(savedFilters.intentionTags ?? []);
      setReligions(savedFilters.religions ?? []);
      setEducationLevels(savedFilters.educationLevels ?? []);
      setKids(savedFilters.kids ?? []);
      setDrink(savedFilters.drink ?? []);
      setSmoke(savedFilters.smoke ?? []);
      setExercise(savedFilters.exercise ?? []);
      setPets(savedFilters.pets ?? []);
      setInterests(savedFilters.interests ?? []);
      setMinHeightCm(savedFilters.minHeightCm ? String(savedFilters.minHeightCm) : '');
      setMaxHeightCm(savedFilters.maxHeightCm ? String(savedFilters.maxHeightCm) : '');
      setHasPhotos(!!savedFilters.hasPhotos);
      setVerifiedOnly(!!savedFilters.verifiedOnly);
      setActiveRecently(!!savedFilters.activeRecently);
    } catch (error) {
      console.error('Error loading saved filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleValue = (value: string, selected: string[], setSelected: (next: string[]) => void) => {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  };

  const toggleLifestyle = (key: LifestyleKey, value: string) => {
    const setters = { drink: setDrink, smoke: setSmoke, exercise: setExercise, pets: setPets };
    const values = { drink, smoke, exercise, pets };
    toggleValue(value, values[key], setters[key]);
  };

  const lifestyleSelected = (key: LifestyleKey, value: string) => {
    const values = { drink, smoke, exercise, pets };
    return values[key].includes(value);
  };

  const handleGetCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Allow location to show people close to you.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [lat, lng] = [location.coords.latitude, location.coords.longitude];
      setLatitude(lat);
      setLongitude(lng);

      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode.length > 0) {
        setLocationCity(geocode[0].city || geocode[0].region || '');
        setLocationCountry(geocode[0].country || '');
      }
    } catch {
      Alert.alert('Location unavailable', 'We could not read your location. You can type your city instead.');
    }
  };

  const getParsedFilters = (): DatingDiscoveryFilters | null => {
    const parsedMinAge = parseInt(minAge, 10);
    const parsedMaxAge = parseInt(maxAge, 10);
    const parsedDistance = parseInt(maxDistance, 10);
    const parsedMinHeight = minHeightCm ? parseInt(minHeightCm, 10) : undefined;
    const parsedMaxHeight = maxHeightCm ? parseInt(maxHeightCm, 10) : undefined;

    if (!Number.isFinite(parsedMinAge) || !Number.isFinite(parsedMaxAge) || parsedMinAge < 18 || parsedMaxAge > 99) {
      Alert.alert('Check age range', 'Age filters must be between 18 and 99.');
      return null;
    }
    if (parsedMinAge > parsedMaxAge) {
      Alert.alert('Check age range', 'Minimum age cannot be higher than maximum age.');
      return null;
    }
    if (!Number.isFinite(parsedDistance) || parsedDistance < 1 || parsedDistance > 500) {
      Alert.alert('Check distance', 'Maximum distance must be between 1 and 500 km.');
      return null;
    }
    if (parsedMinHeight !== undefined && (parsedMinHeight < 90 || parsedMinHeight > 250)) {
      Alert.alert('Check height', 'Minimum height must be between 90 and 250 cm.');
      return null;
    }
    if (parsedMaxHeight !== undefined && (parsedMaxHeight < 90 || parsedMaxHeight > 250)) {
      Alert.alert('Check height', 'Maximum height must be between 90 and 250 cm.');
      return null;
    }
    if (parsedMinHeight !== undefined && parsedMaxHeight !== undefined && parsedMinHeight > parsedMaxHeight) {
      Alert.alert('Check height', 'Minimum height cannot be higher than maximum height.');
      return null;
    }

    return {
      minAge: parsedMinAge,
      maxAge: parsedMaxAge,
      maxDistance: parsedDistance,
      locationCity: locationCity.trim(),
      locationCountry: locationCountry.trim(),
      latitude,
      longitude,
      lookingFor,
      intentionTags,
      religions,
      educationLevels,
      kids,
      drink,
      smoke,
      exercise,
      pets,
      interests,
      minHeightCm: parsedMinHeight,
      maxHeightCm: parsedMaxHeight,
      hasPhotos,
      verifiedOnly,
      activeRecently,
    };
  };

  const handleApplyFilters = async () => {
    if (isApplying) return;
    const filters = getParsedFilters();
    if (!filters) return;

    try {
      setIsApplying(true);
      await Promise.all([
        DatingService.saveDatingDiscoveryFilters(filters),
        DatingService.createOrUpdateDatingProfile({
          age_range_min: filters.minAge,
          age_range_max: filters.maxAge,
          max_distance_km: filters.maxDistance,
          location_city: filters.locationCity,
          location_country: filters.locationCountry,
          location_latitude: filters.latitude,
          location_longitude: filters.longitude,
          looking_for: filters.lookingFor,
        }),
      ]);

      Alert.alert('Preferences saved', 'Discovery will now use your updated dating preferences.', [
        { text: 'See Matches', onPress: () => navigateToDatingHome(router) },
      ]);
    } catch (error: any) {
      Alert.alert('Could not apply filters', error.message || 'Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleResetFilters = async () => {
    try {
      await DatingService.clearDatingDiscoveryFilters();
      setMinAge('18');
      setMaxAge('99');
      setMaxDistance('50');
      setLocationCity('');
      setLocationCountry('');
      setLatitude(undefined);
      setLongitude(undefined);
      setLookingFor('everyone');
      setIntentionTags([]);
      setReligions([]);
      setEducationLevels([]);
      setKids([]);
      setDrink([]);
      setSmoke([]);
      setExercise([]);
      setPets([]);
      setInterests([]);
      setMinHeightCm('');
      setMaxHeightCm('');
      setHasPhotos(false);
      setVerifiedOnly(false);
      setActiveRecently(false);
    } catch (error: any) {
      Alert.alert('Could not reset filters', error.message || 'Please try again.');
    }
  };

  const renderChip = (label: string, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {selected && <Check size={14} color="#fff" />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderToggle = (label: string, description: string, selected: boolean, onPress: () => void, icon: React.ReactNode) => (
    <TouchableOpacity style={[styles.toggleCard, selected && styles.toggleCardSelected]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.toggleIcon}>{icon}</View>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected && <Check size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Dating Preferences',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigateToDatingHome(router)} style={styles.headerButton}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your preferences...</Text>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Sliders size={26} color={colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle}>Find a better fit</Text>
                <Text style={styles.heroText}>Tune who appears in Discover. Keep it broad for more people, or narrow it when you know what matters.</Text>
              </View>
              <Text style={styles.activeCount}>{activeFilterCount}</Text>
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<Heart size={20} color={colors.primary} />} title="Who you want to meet" />
              <View style={styles.segmentedControl}>
                {(['men', 'women', 'everyone'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.segment, lookingFor === option && styles.segmentSelected]}
                    onPress={() => setLookingFor(option)}
                  >
                    <Text style={[styles.segmentText, lookingFor === option && styles.segmentTextSelected]}>
                      {option === 'everyone' ? 'Everyone' : option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.hint}>Discovery also checks mutual compatibility, so both sides are more likely to be interested.</Text>
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<Search size={20} color={colors.primary} />} title="Basics" />
              <View style={styles.doubleRow}>
                <InputBox label="Min age" value={minAge} onChangeText={setMinAge} keyboardType="numeric" colors={colors} />
                <InputBox label="Max age" value={maxAge} onChangeText={setMaxAge} keyboardType="numeric" colors={colors} />
              </View>
              <View style={styles.doubleRow}>
                <InputBox label="Min height" value={minHeightCm} onChangeText={setMinHeightCm} placeholder="Any" keyboardType="numeric" colors={colors} suffix="cm" />
                <InputBox label="Max height" value={maxHeightCm} onChangeText={setMaxHeightCm} placeholder="Any" keyboardType="numeric" colors={colors} suffix="cm" />
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<MapPin size={20} color={colors.primary} />} title="Location" />
              <TouchableOpacity style={styles.locationButton} onPress={handleGetCurrentLocation}>
                <MapPin size={20} color={colors.primary} />
                <Text style={styles.locationButtonText}>Use current location</Text>
              </TouchableOpacity>
              <InputBox label="City" value={locationCity} onChangeText={setLocationCity} placeholder="Enter city" colors={colors} />
              <InputBox label="Country" value={locationCountry} onChangeText={setLocationCountry} placeholder="Enter country" colors={colors} />
              <InputBox label="Maximum distance" value={maxDistance} onChangeText={setMaxDistance} keyboardType="numeric" colors={colors} suffix="km" />
              {(locationCity || locationCountry) && (
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
                  <Text style={styles.clearButtonText}>Clear location</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<Sparkles size={20} color={colors.primary} />} title="Relationship intention" />
              <View style={styles.chipWrap}>
                {INTENTION_OPTIONS.map((option) => renderChip(option.label, intentionTags.includes(option.value), () => toggleValue(option.value, intentionTags, setIntentionTags)))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<ShieldCheck size={20} color={colors.primary} />} title="Trust and activity" />
              {renderToggle('Verified profiles', 'Show people with at least one verified signal.', verifiedOnly, () => setVerifiedOnly(!verifiedOnly), <ShieldCheck size={20} color={colors.primary} />)}
              {renderToggle('Has photos', 'Prioritize profiles that feel complete enough to view.', hasPhotos, () => setHasPhotos(!hasPhotos), <Sparkles size={20} color={colors.primary} />)}
              {renderToggle('Recently active', 'Show people active in the last 14 days.', activeRecently, () => setActiveRecently(!activeRecently), <RefreshCw size={20} color={colors.primary} />)}
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<Baby size={20} color={colors.primary} />} title="Family and lifestyle" />
              <Text style={styles.preferenceLabel}>Kids</Text>
              <View style={styles.chipWrap}>
                {KIDS_OPTIONS.map((option) => renderChip(option.label, kids.includes(option.value), () => toggleValue(option.value, kids, setKids)))}
              </View>
              <Text style={styles.preferenceLabel}>Lifestyle</Text>
              <View style={styles.chipWrap}>
                {LIFESTYLE_OPTIONS.map((option) => renderChip(option.label, lifestyleSelected(option.key, option.value), () => toggleLifestyle(option.key, option.value)))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<GraduationCap size={20} color={colors.primary} />} title="Faith and education" />
              <Text style={styles.preferenceLabel}>Religion / faith</Text>
              <View style={styles.chipWrap}>
                {RELIGION_OPTIONS.map((option) => renderChip(option, religions.includes(option), () => toggleValue(option, religions, setReligions)))}
              </View>
              <Text style={styles.preferenceLabel}>Education</Text>
              <View style={styles.chipWrap}>
                {EDUCATION_OPTIONS.map((option) => renderChip(option, educationLevels.includes(option), () => toggleValue(option, educationLevels, setEducationLevels)))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader icon={<Ruler size={20} color={colors.primary} />} title="Interests" />
              <Text style={styles.hint}>Shared interests are good conversation starters. Select only the ones that matter.</Text>
              <View style={styles.chipWrap}>
                {INTEREST_OPTIONS.map((option) => renderChip(option, interests.includes(option), () => toggleValue(option, interests, setInterests)))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetButton} onPress={handleResetFilters}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.applyButton, isApplying && styles.applyButtonDisabled]} onPress={handleApplyFilters} disabled={isApplying}>
              {isApplying ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyButtonText}>Apply preferences</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  const { colors } = useTheme();

  return (
    <View style={sectionHeaderStyles.row}>
      {icon}
      <Text style={[sectionHeaderStyles.title, { color: colors.text.primary }]}>{title}</Text>
    </View>
  );
}

function InputBox({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  suffix?: string;
  colors: any;
}) {
  return (
    <View style={inputBoxStyles.group}>
      <Text style={[inputBoxStyles.label, { color: colors.text.secondary }]}>{label}</Text>
      <View style={[inputBoxStyles.inputWrap, { backgroundColor: colors.background.secondary, borderColor: colors.border.light }]}>
        <TextInput
          style={[inputBoxStyles.input, { color: colors.text.primary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
        />
        {suffix && <Text style={[inputBoxStyles.suffix, { color: colors.text.tertiary }]}>{suffix}</Text>}
      </View>
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
});

const inputBoxStyles = StyleSheet.create({
  group: {
    flex: 1,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  suffix: {
    fontSize: 13,
    fontWeight: '700',
  },
});

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
    scrollContent: {
      padding: 16,
      paddingBottom: 104,
      gap: 14,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderRadius: 18,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    heroIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.primary,
    },
    heroCopy: {
      flex: 1,
    },
    heroTitle: {
      fontSize: 22,
      fontWeight: '900',
      color: colors.text.primary,
      marginBottom: 4,
    },
    heroText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.text.secondary,
    },
    activeCount: {
      minWidth: 34,
      height: 34,
      borderRadius: 17,
      textAlign: 'center',
      textAlignVertical: 'center',
      overflow: 'hidden',
      backgroundColor: colors.primary,
      color: '#fff',
      fontSize: 16,
      fontWeight: '900',
    },
    section: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    segmentedControl: {
      flexDirection: 'row',
      gap: 8,
      padding: 4,
      borderRadius: 16,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    segment: {
      flex: 1,
      minHeight: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentSelected: {
      backgroundColor: colors.primary,
    },
    segmentText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text.secondary,
    },
    segmentTextSelected: {
      color: '#fff',
    },
    doubleRow: {
      flexDirection: 'row',
      gap: 12,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 15,
      backgroundColor: colors.primary + '14',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary + '45',
      marginBottom: 14,
    },
    locationButtonText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.primary,
    },
    hint: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.text.tertiary,
      marginTop: 8,
    },
    clearButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    clearButtonText: {
      fontSize: 14,
      color: colors.danger,
      fontWeight: '700',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 6,
    },
    chip: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.primary,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.secondary,
    },
    chipTextSelected: {
      color: '#fff',
    },
    toggleCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.primary,
      marginBottom: 10,
    },
    toggleCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '12',
    },
    toggleIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '12',
    },
    toggleTextWrap: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.primary,
      marginBottom: 2,
    },
    toggleDescription: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.text.secondary,
    },
    checkCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCircleSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    preferenceLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text.secondary,
      marginTop: 8,
      marginBottom: 10,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      paddingBottom: 20,
      backgroundColor: colors.background.primary,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    resetButton: {
      minWidth: 94,
      minHeight: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.medium,
      backgroundColor: colors.background.secondary,
    },
    resetButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text.primary,
    },
    applyButton: {
      flex: 1,
      minHeight: 52,
      backgroundColor: colors.primary,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    applyButtonDisabled: {
      opacity: 0.7,
    },
    applyButtonText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#fff',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.text.secondary,
    },
  });
