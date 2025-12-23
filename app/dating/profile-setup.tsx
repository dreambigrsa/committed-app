import React, { useState, useMemo, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { ArrowLeft, Plus, X, MapPin, Eye, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
// Removed trpc import - using Supabase directly
import * as DatingService from '@/lib/dating-service';
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

  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [interestsData, setInterestsData] = useState<{
    all: any[];
    grouped: Record<string, any[]>;
    categories: string[];
  } | null>(null);

  // Load profile and interests on mount
  const loadData = async () => {
    try {
      setLoadingProfile(true);
      const [profile, interests] = await Promise.all([
        DatingService.getDatingProfile().catch(() => null),
        DatingService.getDatingInterests(),
      ]);
      setExistingProfile(profile);
      setInterestsData(interests);
    } catch (error: any) {
      console.error('Error loading data:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Load data when screen comes into focus (auto-refresh)
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  // Photo deletion now handled directly with Supabase

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
  
  // New comprehensive profile features
  const [headline, setHeadline] = useState('');
  const [introVoiceUrl, setIntroVoiceUrl] = useState('');
  const [values, setValues] = useState<string[]>([]);
  const [mood, setMood] = useState<'chill' | 'romantic' | 'fun' | 'serious' | 'adventurous' | ''>('');
  const [whatMakesMeDifferent, setWhatMakesMeDifferent] = useState('');
  const [weekendStyle, setWeekendStyle] = useState<'homebody' | 'out_with_friends' | 'church_faith' | 'side_hustling' | 'exploring' | ''>('');
  const [dailyQuestionAnswer, setDailyQuestionAnswer] = useState('');
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [intentionTag, setIntentionTag] = useState<'friendship' | 'dating' | 'serious' | 'marriage' | ''>('');
  const [respectFirstBadge, setRespectFirstBadge] = useState(false);
  const [localFood, setLocalFood] = useState('');
  const [localSlang, setLocalSlang] = useState('');
  const [localSpot, setLocalSpot] = useState('');
  const [whatImLookingFor, setWhatImLookingFor] = useState('');
  const [kids, setKids] = useState<'have_kids' | 'want_kids' | 'dont_want_kids' | 'have_and_want_more' | 'not_sure' | ''>('');
  const [work, setWork] = useState('');
  const [smoke, setSmoke] = useState<'yes' | 'no' | 'sometimes' | 'prefer_not_to_say' | ''>('');
  const [drink, setDrink] = useState<'yes' | 'no' | 'sometimes' | 'prefer_not_to_say' | ''>('');
  const [prompts, setPrompts] = useState<Array<{ question: string; answer: string }>>([]);

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
      
      // Load new comprehensive features
      setHeadline(existingProfile.headline || '');
      setIntroVoiceUrl(existingProfile.intro_voice_url || '');
      setValues(existingProfile.values || []);
      setMood(existingProfile.mood || '');
      setWhatMakesMeDifferent(existingProfile.what_makes_me_different || '');
      setWeekendStyle(existingProfile.weekend_style || '');
      setDailyQuestionAnswer(existingProfile.daily_question_answer || '');
      setIntentionTag(existingProfile.intention_tag || '');
      setRespectFirstBadge(existingProfile.respect_first_badge || false);
      setLocalFood(existingProfile.local_food || '');
      setLocalSlang(existingProfile.local_slang || '');
      setLocalSpot(existingProfile.local_spot || '');
      setWhatImLookingFor(existingProfile.what_im_looking_for || '');
      setKids(existingProfile.kids || '');
      setWork(existingProfile.work || '');
      setSmoke(existingProfile.smoke || '');
      setDrink(existingProfile.drink || '');
      setPrompts(existingProfile.prompts || []);
      
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
          
          // Get or create dating profile
          let { data: profile, error: profileError } = await supabase
            .from('dating_profiles')
            .select('id')
            .eq('user_id', currentUser?.id)
            .single();

          // If profile doesn't exist, create a minimal one
          if (profileError || !profile) {
            const { data: newProfile, error: createError } = await supabase
              .from('dating_profiles')
              .insert({
                user_id: currentUser?.id,
                is_active: true,
              })
              .select('id')
              .single();

            if (createError || !newProfile) {
              throw new Error('Failed to create dating profile. Please try again.');
            }

            profile = newProfile;
          }

          const isPrimary = photos.length === 0;

          // Check for duplicate photo URL to prevent duplicates
          const { data: existingPhoto } = await supabase
            .from('dating_photos')
            .select('id')
            .eq('dating_profile_id', profile.id)
            .eq('photo_url', uploadedUrl)
            .single();

          if (existingPhoto) {
            Alert.alert('Duplicate Photo', 'This photo is already in your profile');
            return;
          }

          // If setting as primary, unset other primary photos
          if (isPrimary) {
            await supabase
              .from('dating_photos')
              .update({ is_primary: false })
              .eq('dating_profile_id', profile.id);
          }

          // Insert photo directly into database using Supabase
          const { data: photo, error: photoError } = await supabase
            .from('dating_photos')
            .insert({
              dating_profile_id: profile.id,
              photo_url: uploadedUrl,
              display_order: photos.length,
              is_primary: isPrimary,
            })
            .select('id')
            .single();

          if (photoError) {
            throw photoError;
          }

          // Reload photos from database to ensure consistency
          const { data: allPhotos } = await supabase
            .from('dating_photos')
            .select('*')
            .eq('dating_profile_id', profile.id)
            .order('display_order', { ascending: true });

          if (allPhotos) {
            setPhotos(
              allPhotos.map((p: any) => ({
                id: p.id,
                url: p.photo_url,
                isPrimary: p.is_primary,
              }))
            );
          }
          Alert.alert('Success', 'Photo uploaded successfully!');
        } catch (uploadError: any) {
          console.error('Error uploading photo:', uploadError);
          Alert.alert('Upload Error', uploadError.message || 'Failed to upload photo. Please try again.');
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
        
        try {
          // Upload video to Supabase Storage
          const uploadedUrl = await uploadVideoToStorage(asset.uri);
          
          // Generate thumbnail (simplified - in production, use a video processing library)
          const thumbnailUrl = uploadedUrl; // Placeholder - should generate actual thumbnail
          
          // Get or create dating profile
          let { data: profile, error: profileError } = await supabase
            .from('dating_profiles')
            .select('id')
            .eq('user_id', currentUser?.id)
            .single();

          // If profile doesn't exist, create a minimal one
          if (profileError || !profile) {
            const { data: newProfile, error: createError } = await supabase
              .from('dating_profiles')
              .insert({
                user_id: currentUser?.id,
                is_active: true,
              })
              .select('id')
              .single();

            if (createError || !newProfile) {
              throw new Error('Failed to create dating profile. Please try again.');
            }

            profile = newProfile;
          }

          const isPrimary = videos.length === 0;
          const durationSeconds = asset.duration ? Math.floor(asset.duration / 1000) : undefined;

          // If setting as primary, unset other primary videos
          if (isPrimary) {
            await supabase
              .from('dating_videos')
              .update({ is_primary: false })
              .eq('dating_profile_id', profile.id);
          }

          // Insert video directly into database using Supabase
          const { data: video, error: videoError } = await supabase
            .from('dating_videos')
            .insert({
              dating_profile_id: profile.id,
              video_url: uploadedUrl,
              thumbnail_url: thumbnailUrl,
              duration_seconds: durationSeconds,
              display_order: videos.length,
              is_primary: isPrimary,
            })
            .select('id')
            .single();

          if (videoError) {
            throw videoError;
          }

          // Update local state
          setVideos([...videos, {
            id: video.id,
            url: uploadedUrl,
            thumbnailUrl,
            duration: durationSeconds,
            isPrimary,
          }]);
          Alert.alert('Success', 'Video uploaded successfully!');
        } catch (uploadError: any) {
          console.error('Error uploading video:', uploadError);
          Alert.alert('Upload Error', uploadError.message || 'Failed to upload video. Please try again.');
        }
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

        await DatingService.createOrUpdateDatingProfile({
          location_city: city,
          location_latitude: lat,
          location_longitude: lng,
        });
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await DatingService.createOrUpdateDatingProfile({
        bio,
        age: age ? parseInt(age) : undefined,
        location_city: locationCity || undefined,
        relationship_goals: relationshipGoals,
        interests,
        looking_for: lookingFor,
        age_range_min: ageRangeMin ? parseInt(ageRangeMin) : undefined,
        age_range_max: ageRangeMax ? parseInt(ageRangeMax) : undefined,
        max_distance_km: maxDistanceKm ? parseInt(maxDistanceKm) : undefined,
        is_active: isActive,
        headline: headline || undefined,
        intro_voice_url: introVoiceUrl || undefined,
        values: values.length > 0 ? values : undefined,
        mood: mood || undefined,
        what_makes_me_different: whatMakesMeDifferent || undefined,
        weekend_style: weekendStyle || undefined,
        daily_question_answer: dailyQuestionAnswer || undefined,
        daily_question_id: dailyQuestion?.id || undefined,
        intention_tag: intentionTag || undefined,
        respect_first_badge: respectFirstBadge,
        local_food: localFood || undefined,
        local_slang: localSlang || undefined,
        local_spot: localSpot || undefined,
        what_im_looking_for: whatImLookingFor || undefined,
        kids: kids || undefined,
        work: work || undefined,
        smoke: smoke || undefined,
        drink: drink || undefined,
        prompts: prompts.length > 0 ? prompts : undefined,
      });
      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
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
                  onPress={async () => {
                    if (photo.id) {
                      try {
                        // Delete from Supabase
                        await DatingService.deleteDatingPhoto(photo.id);
                        // Reload photos from database
                        const profile = await DatingService.getDatingProfile();
                        if (profile?.photos) {
                          setPhotos(
                            profile.photos.map((p: any) => ({
                              id: p.id,
                              url: p.photo_url,
                              isPrimary: p.is_primary,
                            }))
                          );
                        } else {
                          setPhotos(photos.filter((_, i) => i !== index));
                        }
                      } catch (error: any) {
                        Alert.alert('Error', error.message || 'Failed to delete photo');
                      }
                    } else {
                      // If no ID, just remove from local state (not yet saved)
                      setPhotos(photos.filter((_, i) => i !== index));
                    }
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
              {interestsData.categories.map((cat: string) => (
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

        {/* Headline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Headline ✨</Text>
          <Text style={styles.sectionHint}>A short catchy line that captures who you are</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., 'Serious about love, fun about life'"
            placeholderTextColor={colors.text.tertiary}
            value={headline}
            onChangeText={setHeadline}
            maxLength={100}
          />
          <Text style={styles.charCount}>{headline.length}/100</Text>
        </View>

        {/* What I'm Looking For */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What I'm Looking For 💬</Text>
          <Text style={styles.sectionHint}>Describe the person you're looking for</Text>
          <TextInput
            style={[styles.textInput, { minHeight: 100 }]}
            placeholder="Describe the kind of person you're looking for..."
            placeholderTextColor={colors.text.tertiary}
            value={whatImLookingFor}
            onChangeText={setWhatImLookingFor}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.charCount}>{whatImLookingFor.length}/500</Text>
        </View>

        {/* Values Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Values ❤️</Text>
          <Text style={styles.sectionHint}>What matters most to you (select all that apply)</Text>
          <View style={styles.tagsContainer}>
            {['Family', 'Faith', 'Growth', 'Honesty', 'Adventure'].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.tag,
                  values.includes(value) && styles.tagSelected,
                ]}
                onPress={() => {
                  if (values.includes(value)) {
                    setValues(values.filter(v => v !== value));
                  } else {
                    setValues([...values, value]);
                  }
                }}
              >
                <Text
                  style={[
                    styles.tagText,
                    values.includes(value) && styles.tagTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Mood/Vibe Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mood / Vibe 😊</Text>
          <Text style={styles.sectionHint}>Pick one that best describes you</Text>
          <View style={styles.moodContainer}>
            {[
              { value: 'chill', emoji: '😌', label: 'Chill' },
              { value: 'romantic', emoji: '❤️', label: 'Romantic' },
              { value: 'fun', emoji: '😂', label: 'Fun' },
              { value: 'serious', emoji: '🎯', label: 'Serious' },
              { value: 'adventurous', emoji: '🌍', label: 'Adventurous' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.moodOption,
                  mood === item.value && styles.moodOptionSelected,
                ]}
                onPress={() => setMood(item.value as any)}
              >
                <Text style={styles.moodEmoji}>{item.emoji}</Text>
                <Text style={[styles.moodLabel, mood === item.value && styles.moodLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* What Makes Me Different */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What Makes Me Different 🔥</Text>
          <Text style={styles.sectionHint}>Share what makes you unique</Text>
          <TextInput
            style={[styles.textInput, { minHeight: 80 }]}
            placeholder="e.g., 'I never give up on people I care about'"
            placeholderTextColor={colors.text.tertiary}
            value={whatMakesMeDifferent}
            onChangeText={setWhatMakesMeDifferent}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
          <Text style={styles.charCount}>{whatMakesMeDifferent.length}/200</Text>
        </View>

        {/* Weekend Style */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekend Style 🕒</Text>
          <Text style={styles.sectionHint}>How do you typically spend your weekends?</Text>
          <View style={styles.weekendContainer}>
            {[
              { value: 'homebody', emoji: '🛋️', label: 'Homebody' },
              { value: 'out_with_friends', emoji: '🍔', label: 'Out with Friends' },
              { value: 'church_faith', emoji: '⛪', label: 'Church/Faith' },
              { value: 'side_hustling', emoji: '💻', label: 'Side Hustling' },
              { value: 'exploring', emoji: '🌄', label: 'Exploring' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.weekendOption,
                  weekendStyle === item.value && styles.weekendOptionSelected,
                ]}
                onPress={() => setWeekendStyle(item.value as any)}
              >
                <Text style={styles.weekendEmoji}>{item.emoji}</Text>
                <Text style={[styles.weekendLabel, weekendStyle === item.value && styles.weekendLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Daily Question */}
        {dailyQuestion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Question ✍🏽</Text>
            <Text style={styles.dailyQuestionText}>{dailyQuestion.question}</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 80 }]}
              placeholder="Share your answer..."
              placeholderTextColor={colors.text.tertiary}
              value={dailyQuestionAnswer}
              onChangeText={setDailyQuestionAnswer}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
            <Text style={styles.charCount}>{dailyQuestionAnswer.length}/300</Text>
          </View>
        )}

        {/* Safety + Intention Tag */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intention & Safety 🔒</Text>
          <Text style={styles.sectionHint}>What are you here for?</Text>
          <View style={styles.tagsContainer}>
            {['friendship', 'dating', 'serious', 'marriage'].map((intention) => (
              <TouchableOpacity
                key={intention}
                style={[
                  styles.tag,
                  intentionTag === intention && styles.tagSelected,
                ]}
                onPress={() => setIntentionTag(intention as any)}
              >
                <Text
                  style={[
                    styles.tagText,
                    intentionTag === intention && styles.tagTextSelected,
                  ]}
                >
                  {intention.charAt(0).toUpperCase() + intention.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.checkboxRow, respectFirstBadge && styles.checkboxRowSelected]}
            onPress={() => setRespectFirstBadge(!respectFirstBadge)}
          >
            <View style={[styles.checkbox, respectFirstBadge && styles.checkboxChecked]}>
              {respectFirstBadge && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Respect First Badge</Text>
          </TouchableOpacity>
        </View>

        {/* Local Flavor */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Local Flavor 🌍</Text>
          <Text style={styles.sectionHint}>Share your favorite local things</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Favorite local food (e.g., Sadza & nyama)"
            placeholderTextColor={colors.text.tertiary}
            value={localFood}
            onChangeText={setLocalFood}
            maxLength={50}
          />
          <TextInput
            style={[styles.textInput, { marginTop: 12 }]}
            placeholder="Favorite slang word"
            placeholderTextColor={colors.text.tertiary}
            value={localSlang}
            onChangeText={setLocalSlang}
            maxLength={30}
          />
          <TextInput
            style={[styles.textInput, { marginTop: 12 }]}
            placeholder="Favorite local spot"
            placeholderTextColor={colors.text.tertiary}
            value={localSpot}
            onChangeText={setLocalSpot}
            maxLength={50}
          />
        </View>

        {/* Prompts / Short Questions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prompts / Short Questions ✍🏽</Text>
          <Text style={styles.sectionHint}>Answer fun questions to help others get to know you</Text>
          
          {prompts.map((prompt, index) => (
            <View key={index} style={styles.promptItem}>
              <Text style={styles.promptQuestion}>{prompt.question}</Text>
              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                placeholder="Your answer..."
                placeholderTextColor={colors.text.tertiary}
                value={prompt.answer}
                onChangeText={(text) => {
                  const newPrompts = [...prompts];
                  newPrompts[index].answer = text;
                  setPrompts(newPrompts);
                }}
                multiline
                maxLength={200}
              />
              <TouchableOpacity
                style={styles.removePromptButton}
                onPress={() => setPrompts(prompts.filter((_, i) => i !== index))}
              >
                <X size={16} color={colors.danger} />
                <Text style={styles.removePromptText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
          
          {prompts.length < 3 && (
            <TouchableOpacity
              style={styles.addPromptButton}
              onPress={() => {
                const questions = [
                  'What\'s your ideal first date?',
                  'What\'s something you\'re passionate about?',
                  'What makes you laugh?',
                  'What\'s your favorite way to spend a weekend?',
                  'What\'s a goal you\'re working towards?',
                ];
                const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
                setPrompts([...prompts, { question: randomQuestion, answer: '' }]);
              }}
            >
              <Plus size={18} color={colors.primary} />
              <Text style={styles.addPromptText}>Add Prompt</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Lifestyle Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle</Text>
          
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Kids:</Text>
            <View style={styles.radioGroup}>
              {[
                { value: 'have_kids', label: 'Have Kids' },
                { value: 'want_kids', label: 'Want Kids' },
                { value: 'dont_want_kids', label: "Don't Want" },
                { value: 'have_and_want_more', label: 'Have & Want More' },
                { value: 'not_sure', label: 'Not Sure' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.radioOption}
                  onPress={() => setKids(option.value as any)}
                >
                  <View style={[styles.radio, kids === option.value && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Work:</Text>
            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder="What do you do?"
              placeholderTextColor={colors.text.tertiary}
              value={work}
              onChangeText={setWork}
              maxLength={100}
            />
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Smoke:</Text>
            <View style={styles.radioGroup}>
              {['yes', 'no', 'sometimes', 'prefer_not_to_say'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioOption}
                  onPress={() => setSmoke(option as any)}
                >
                  <View style={[styles.radio, smoke === option && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>{option.charAt(0).toUpperCase() + option.slice(1).replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Drink:</Text>
            <View style={styles.radioGroup}>
              {['yes', 'no', 'sometimes', 'prefer_not_to_say'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioOption}
                  onPress={() => setDrink(option as any)}
                >
                  <View style={[styles.radio, drink === option && styles.radioSelected]} />
                  <Text style={styles.radioLabel}>{option.charAt(0).toUpperCase() + option.slice(1).replace('_', ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>
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

        <View style={styles.saveButtonsRow}>
          <TouchableOpacity
            style={[styles.saveButton, styles.previewButton]}
            onPress={() => router.push('/dating/profile-preview')}
          >
            <Eye size={18} color={colors.primary} />
            <Text style={[styles.saveButtonText, { color: colors.primary }]}>
              Preview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Delete Profile Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(
                'Delete Dating Profile',
                'Are you sure you want to permanently delete your dating profile? This will remove all your photos, videos, matches, and likes. This action cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await DatingService.deleteDatingProfile();
                        Alert.alert('Success', 'Your dating profile has been deleted');
                        router.back();
                      } catch (error: any) {
                        Alert.alert('Error', error.message || 'Failed to delete profile');
                      }
                    },
                  },
                ]
              );
            }}
          >
            <Trash2 size={18} color={colors.danger} />
            <Text style={styles.deleteButtonText}>Delete Dating Profile</Text>
          </TouchableOpacity>
        </View>
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
    sectionHint: {
      fontSize: 13,
      color: colors.text.secondary,
      marginBottom: 12,
      fontStyle: 'italic',
    },
    moodContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    moodOption: {
      flex: 1,
      minWidth: '30%',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.light,
    },
    moodOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    moodEmoji: {
      fontSize: 32,
      marginBottom: 8,
    },
    moodLabel: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '600',
    },
    moodLabelSelected: {
      color: colors.primary,
    },
    weekendContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    weekendOption: {
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.light,
    },
    weekendOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    weekendEmoji: {
      fontSize: 28,
      marginBottom: 8,
    },
    weekendLabel: {
      fontSize: 13,
      color: colors.text.primary,
      fontWeight: '600',
      textAlign: 'center',
    },
    weekendLabelSelected: {
      color: colors.primary,
    },
    dailyQuestionText: {
      fontSize: 16,
      color: colors.text.primary,
      fontWeight: '600',
      marginBottom: 12,
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
    },
    checkboxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 16,
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    checkboxRowSelected: {
      backgroundColor: colors.primary + '15',
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    checkboxLabel: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '600',
    },
    promptItem: {
      marginBottom: 20,
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    promptQuestion: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    removePromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    removePromptText: {
      fontSize: 14,
      color: colors.danger,
      fontWeight: '600',
    },
    addPromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    addPromptText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
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
    saveButtonsRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
      marginBottom: 40,
    },
    saveButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    previewButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors.danger + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.danger,
    },
  });

