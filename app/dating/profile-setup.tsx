import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const RELATIONSHIP_GOALS = ['Long-term', 'Short-term', 'Friendship', 'Marriage', 'Casual'];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: existingProfile, isLoading: loadingProfile } = trpc.dating.getProfile.useQuery();
  const createOrUpdateMutation = trpc.dating.createOrUpdateProfile.useMutation({
    onSuccess: () => {
      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const uploadPhotoMutation = trpc.dating.uploadPhoto.useMutation();
  const deletePhotoMutation = trpc.dating.deletePhoto.useMutation();
  const uploadVideoMutation = trpc.dating.uploadVideo.useMutation();
  const { data: interestsData } = trpc.dating.getInterests.useQuery();

  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [relationshipGoals, setRelationshipGoals] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lookingFor, setLookingFor] = useState<'men' | 'women' | 'everyone'>('everyone');
  const [ageRangeMin, setAgeRangeMin] = useState('18');
  const [ageRangeMax, setAgeRangeMax] = useState('99');
  const [maxDistanceKm, setMaxDistanceKm] = useState('50');
  const [photos, setPhotos] = useState<Array<{ id?: string; url: string; isPrimary: boolean }>>([]);
  const [videos, setVideos] = useState<Array<{ id?: string; url: string; thumbnailUrl?: string; duration?: number; isPrimary: boolean }>>([]);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (existingProfile) {
      setBio(existingProfile.bio || '');
      setAge(existingProfile.age?.toString() || '');
      setLocationCity(existingProfile.location_city || '');
      setRelationshipGoals(existingProfile.relationship_goals || []);
      setInterests(existingProfile.interests || []);
      setLookingFor(existingProfile.looking_for || 'everyone');
      setAgeRangeMin(existingProfile.age_range_min?.toString() || '18');
      setAgeRangeMax(existingProfile.age_range_max?.toString() || '99');
      setMaxDistanceKm(existingProfile.max_distance_km?.toString() || '50');
      setIsActive(existingProfile.is_active || true);
      
      if (existingProfile.photos) {
        setPhotos(
          existingProfile.photos.map((p: any) => ({
            id: p.id,
            url: p.photo_url,
            isPrimary: p.is_primary,
          }))
        );
      }
    }
  }, [existingProfile]);

  const uploadImageToStorage = async (uri: string): Promise<string> => {
    try {
      const fileName = `dating/${currentUser?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      // Check if it's a local file URI
      let fileData: Uint8Array;
      
      if (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('content://')) {
        // Read local file using FileSystem
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else {
        // Remote URL - fetch and convert to Uint8Array
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }

      const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, fileData, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error: any) {
      console.error('Failed to upload image:', error);
      throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        try {
          // Upload to Supabase Storage first
          const uploadedUrl = await uploadImageToStorage(asset.uri);
          
          // Then save to database
          uploadPhotoMutation.mutate(
            {
              photoUrl: uploadedUrl,
              displayOrder: photos.length,
              isPrimary: photos.length === 0,
            },
            {
              onSuccess: (data) => {
                setPhotos([...photos, { id: data.id, url: uploadedUrl, isPrimary: photos.length === 0 }]);
                Alert.alert('Success', 'Photo uploaded successfully!');
              },
              onError: (error: any) => {
                console.error('Upload photo error:', error);
                const errorMessage = error?.message || error?.data?.message || String(error);
                const errorString = String(error).toLowerCase();
                
                if (
                  errorMessage.includes('Failed to fetch') || 
                  errorMessage.includes('Network') || 
                  errorMessage.includes('ECONNREFUSED') ||
                  errorMessage.includes('network request failed') ||
                  errorString.includes('failed to fetch') ||
                  errorString.includes('network')
                ) {
                  Alert.alert(
                    'Connection Error',
                    'Could not connect to the backend server.\n\nFor physical devices:\n1. Find your computer\'s IP address:\n   - Windows: ipconfig\n   - Mac/Linux: ifconfig\n2. Create a .env file with:\n   EXPO_PUBLIC_COMMITTED_API_BASE_URL=http://YOUR_IP:3000\n3. Make sure the server is running:\n   bun run start:api\n4. Restart Expo and try again\n\nFor emulator/simulator:\n1. Run: bun run start:api\n2. Wait for "listening on http://localhost:3000"',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert('Error', errorMessage || 'Failed to save photo. Please try again.');
                }
              },
            }
          );
        } catch (uploadError: any) {
          console.error('Error uploading to storage:', uploadError);
          Alert.alert('Upload Error', uploadError.message || 'Failed to upload image to storage');
        }
      }
    } catch (error: any) {
      console.error('Error picking/uploading image:', error);
      Alert.alert('Error', error.message || 'Failed to upload photo. Please try again.');
    }
  };

  const uploadVideoToStorage = async (uri: string): Promise<string> => {
    try {
      const fileName = `dating/videos/${currentUser?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
      
      let fileData: Uint8Array;
      
      if (uri.startsWith('file://') || uri.startsWith('ph://') || uri.startsWith('content://')) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const binaryString = atob(base64);
        fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
      } else {
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        fileData = new Uint8Array(arrayBuffer);
      }

      const { data, error } = await supabase.storage
        .from('media')
        .upload(fileName, fileData, {
          contentType: 'video/mp4',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error: any) {
      console.error('Failed to upload video:', error);
      throw new Error(`Failed to upload video: ${error.message || 'Unknown error'}`);
    }
  };

  const handlePickVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 30, // 30 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Upload video to Supabase Storage
        const uploadedUrl = await uploadVideoToStorage(asset.uri);
        
        // Generate thumbnail (simplified - in production, use a video processing library)
        const thumbnailUrl = uploadedUrl; // Placeholder - should generate actual thumbnail
        
        // Upload video metadata
        uploadVideoMutation.mutate(
          {
            videoUrl: uploadedUrl,
            thumbnailUrl,
            durationSeconds: asset.duration ? Math.floor(asset.duration / 1000) : undefined,
            displayOrder: videos.length,
            isPrimary: videos.length === 0,
          },
          {
            onSuccess: (data) => {
              setVideos([...videos, {
                id: data.id,
                url: uploadedUrl,
                thumbnailUrl,
                duration: asset.duration ? Math.floor(asset.duration / 1000) : undefined,
                isPrimary: videos.length === 0,
              }]);
            },
            onError: (error) => {
              console.error('Upload video error:', error);
              Alert.alert('Error', error.message || 'Failed to save video.');
            },
          }
        );
      }
    } catch (error: any) {
      console.error('Error picking/uploading video:', error);
      Alert.alert('Error', error.message || 'Failed to upload video. Please try again.');
    }
  };

  const handleGetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant location permissions');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const [lat, lng] = [location.coords.latitude, location.coords.longitude];

    // Reverse geocode to get city name
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (geocode.length > 0) {
        const city = geocode[0].city || geocode[0].region || geocode[0].name || '';
        setLocationCity(city);

      createOrUpdateMutation.mutate({
        locationCity: city,
        locationLatitude: lat,
        locationLongitude: lng,
      });
    }
  };

  const handleSave = () => {
    createOrUpdateMutation.mutate({
      bio,
      age: age ? parseInt(age) : undefined,
      relationshipGoals,
      interests,
      lookingFor,
      ageRangeMin: ageRangeMin ? parseInt(ageRangeMin) : undefined,
      ageRangeMax: ageRangeMax ? parseInt(ageRangeMax) : undefined,
      maxDistanceKm: maxDistanceKm ? parseInt(maxDistanceKm) : undefined,
      isActive,
    });
  };

  const toggleGoal = (goal: string) => {
    if (relationshipGoals.includes(goal)) {
      setRelationshipGoals(relationshipGoals.filter((g) => g !== goal));
    } else if (relationshipGoals.length < 5) {
      setRelationshipGoals([...relationshipGoals, goal]);
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dating Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoItem}>
                <ExpoImage source={{ uri: photo.url }} style={styles.photo} contentFit="cover" />
                {photo.isPrimary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>Primary</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => {
                    if (photo.id) {
                      deletePhotoMutation.mutate({ photoId: photo.id });
                    }
                    setPhotos(photos.filter((_, i) => i !== index));
                  }}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 9 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImage}>
                <Plus size={32} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Tell people about yourself..."
            placeholderTextColor={colors.text.tertiary}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>

        {/* Age */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Age</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Your age"
            placeholderTextColor={colors.text.tertiary}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationRow}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              placeholder="City"
              placeholderTextColor={colors.text.tertiary}
              value={locationCity}
              onChangeText={setLocationCity}
            />
            <TouchableOpacity style={styles.locationButton} onPress={handleGetLocation}>
              <MapPin size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Relationship Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationship Goals (max 5)</Text>
          <View style={styles.tagsContainer}>
            {RELATIONSHIP_GOALS.map((goal) => (
              <TouchableOpacity
                key={goal}
                style={[
                  styles.tag,
                  relationshipGoals.includes(goal) && styles.tagSelected,
                ]}
                onPress={() => toggleGoal(goal)}
              >
                <Text
                  style={[
                    styles.tagText,
                    relationshipGoals.includes(goal) && styles.tagTextSelected,
                  ]}
                >
                  {goal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          
          {/* Category Filter */}
          {interestsData && interestsData.categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryContainer}
            >
              <TouchableOpacity
                style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
                onPress={() => setSelectedCategory('all')}
              >
                <Text style={[styles.categoryText, selectedCategory === 'all' && styles.categoryTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {interestsData.categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.tagsContainer}>
            {interestsData && (selectedCategory === 'all' 
              ? interestsData.all 
              : interestsData.grouped[selectedCategory] || []
            ).map((interest: any) => (
              <TouchableOpacity
                key={interest.id}
                style={[
                  styles.tag,
                  interests.includes(interest.name) && styles.tagSelected,
                ]}
                onPress={() => toggleInterest(interest.name)}
              >
                {interest.icon_emoji && (
                  <Text style={styles.tagIcon}>{interest.icon_emoji}</Text>
                )}
                <Text
                  style={[
                    styles.tagText,
                    interests.includes(interest.name) && styles.tagTextSelected,
                  ]}
                >
                  {interest.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Looking for:</Text>
            <View style={styles.radioGroup}>
              {(['men', 'women', 'everyone'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioOption}
                  onPress={() => setLookingFor(option)}
                >
                  <View style={[styles.radio, lookingFor === option && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Age range:</Text>
            <View style={styles.ageRangeRow}>
              <TextInput
                style={[styles.ageInput]}
                value={ageRangeMin}
                onChangeText={setAgeRangeMin}
                keyboardType="numeric"
              />
              <Text style={styles.ageRangeSeparator}>-</Text>
              <TextInput
                style={[styles.ageInput]}
                value={ageRangeMax}
                onChangeText={setAgeRangeMax}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Max distance (km):</Text>
            <TextInput
              style={[styles.ageInput]}
              value={maxDistanceKm}
              onChangeText={setMaxDistanceKm}
              keyboardType="numeric"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, createOrUpdateMutation.isPending && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={createOrUpdateMutation.isPending}
        >
          {createOrUpdateMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 12,
    },
    photosContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    photoItem: {
      width: 120,
      height: 160,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    primaryBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    primaryBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '600',
    },
    removePhotoButton: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addPhotoButton: {
      width: 120,
      height: 160,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.light,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
    },
    textInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    charCount: {
      fontSize: 12,
      color: colors.text.tertiary,
      textAlign: 'right',
      marginTop: 4,
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
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tag: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    tagSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tagText: {
      fontSize: 14,
      color: colors.text.primary,
    },
    tagTextSelected: {
      color: '#fff',
    },
    tagIcon: {
      fontSize: 16,
      marginRight: 4,
    },
    categoryScroll: {
      marginBottom: 12,
    },
    categoryContainer: {
      paddingVertical: 8,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginRight: 8,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    categoryTextActive: {
      color: '#fff',
    },
    preferenceRow: {
      marginBottom: 16,
    },
    preferenceLabel: {
      fontSize: 16,
      color: colors.text.primary,
      marginBottom: 8,
    },
    radioGroup: {
      flexDirection: 'row',
      gap: 16,
    },
    radioOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border.light,
    },
    radioSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    radioLabel: {
      fontSize: 16,
      color: colors.text.primary,
    },
    ageRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    ageInput: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
      textAlign: 'center',
    },
    ageRangeSeparator: {
      fontSize: 18,
      color: colors.text.secondary,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 40,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

