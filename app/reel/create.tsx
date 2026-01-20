import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { X, Video as VideoIcon, Upload, Trash2, Sparkles } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';

export default function CreateReelScreen() {
  const router = useRouter();
  const { createReel, currentUser } = useApp();
  const [caption, setCaption] = useState<string>('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const canPost = useMemo(() => !!videoUri && !isUploading, [videoUri, isUploading]);

  const pickVideo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to allow access to your videos to upload reels.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets[0] && result.assets[0].uri) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  const recordVideo = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to record videos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets[0] && result.assets[0].uri) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  const uploadVideo = async (uri: string): Promise<string> => {
    try {
      if (!uri) {
        throw new Error('Video URI is required');
      }

      const fileName = `reel_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
      
      // Convert URI to Uint8Array using legacy API (no deprecation warnings)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      const { error } = await supabase.storage
        .from('media')
        .upload(fileName, uint8Array, {
          contentType: 'video/mp4',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      if (!publicUrl) {
        throw new Error('Failed to get public URL for uploaded video');
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error; // Re-throw to be handled by handlePost
    }
  };

  const handlePost = async () => {
    if (!videoUri) {
      Alert.alert('Error', 'Please select or record a video');
      return;
    }

    setIsUploading(true);
    try {
      const uploadedVideoUrl = await uploadVideo(videoUri);
      
      await createReel(uploadedVideoUrl, caption.trim());
      
      Alert.alert('Success', 'Reel posted successfully!');
      router.back();
    } catch (error) {
      console.error('Failed to upload reel:', error);
      Alert.alert('Error', 'Failed to upload reel. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeVideo = () => {
    setVideoUri(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Create Reel',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handlePost}
              disabled={isUploading || !videoUri}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.postButton,
                    !videoUri && styles.postButtonDisabled,
                  ]}
                >
                  Post
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Creator header */}
            <View style={styles.composerHeader}>
              <View style={styles.avatarCircle}>
                {currentUser?.profilePicture ? (
                  <Image source={{ uri: currentUser.profilePicture }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>
                    {(currentUser?.fullName || currentUser?.username || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.composerTitle}>Create a Reel</Text>
                <Text style={styles.composerSubtitle}>Short video • up to 60 seconds</Text>
              </View>
              <View style={styles.pill}>
                <Sparkles size={14} color={colors.text.secondary} />
                <Text style={styles.pillText}>New</Text>
              </View>
            </View>

            {/* Video hero */}
            {videoUri ? (
              <View style={styles.videoCard}>
                <Video
                  source={{ uri: videoUri }}
                  style={styles.videoPreview}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
                <TouchableOpacity style={styles.removeButton} onPress={removeVideo}>
                  <Trash2 size={18} color={colors.text.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadCard}>
                <View style={styles.uploadIconCircle}>
                  <VideoIcon size={26} color={colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>Add a video</Text>
                <Text style={styles.uploadSubtitle}>Record now or upload from your gallery</Text>

                <View style={styles.actionRow}>
                  {Platform.OS !== 'web' ? (
                    <TouchableOpacity style={styles.actionButton} onPress={recordVideo}>
                      <VideoIcon size={18} color={colors.text.primary} />
                      <Text style={styles.actionButtonText}>Record</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity style={styles.actionButton} onPress={pickVideo}>
                    <Upload size={18} color={colors.text.primary} />
                    <Text style={styles.actionButtonText}>Upload</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Caption */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Caption</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Write something catchy…"
                placeholderTextColor={colors.text.tertiary}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={200}
              />
              <Text style={styles.captionCounter}>{caption.length}/200</Text>
            </View>

            {/* Primary action */}
            <TouchableOpacity
              style={[styles.primaryButton, !canPost && styles.primaryButtonDisabled]}
              onPress={handlePost}
              disabled={!canPost}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Post Reel</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 28,
  },
  postButton: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  postButtonDisabled: {
    color: colors.text.tertiary,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  composerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  composerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.text.secondary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  videoCard: {
    position: 'relative',
    width: '100%',
    height: 420,
    backgroundColor: colors.background.secondary,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCard: {
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: 18,
    alignItems: 'center',
  },
  uploadIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 115, 232, 0.12)',
    marginBottom: 10,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  card: {
    marginTop: 14,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 16,
    padding: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 10,
  },
  captionInput: {
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  captionCounter: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'right',
  },
  primaryButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: colors.text.white,
  },
});
