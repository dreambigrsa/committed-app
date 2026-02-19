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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { X, Image as ImageIcon, Video as VideoIcon, Plus, Trash2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { colors } from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';

type PickedMedia = {
  uri: string;
  kind: 'image' | 'video';
};

export default function CreatePostScreen() {
  const router = useRouter();
  const { createPost, currentUser } = useApp();
  const [content, setContent] = useState<string>('');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const canPost = useMemo(() => !!content.trim() || media.length > 0, [content, media.length]);

  const pickMedia = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to allow access to your photos and videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && Array.isArray(result.assets)) {
        const picked: PickedMedia[] = result.assets
          .filter((asset) => asset && asset.uri) // Filter out invalid assets
          .map((asset) => ({
            uri: asset.uri,
            kind: asset.type === 'video' ? 'video' : 'image',
          }));
        if (picked.length > 0) {
          setMedia((prev) => [...prev, ...picked]);
        }
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const removeMediaAt = (index: number) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  const uploadMedia = async (items: PickedMedia[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const item of items) {
      try {
        if (!item || !item.uri) {
          console.warn('Skipping invalid media item:', item);
          continue;
        }

        const ext = item.kind === 'video' ? 'mp4' : 'jpg';
        const contentType = item.kind === 'video' ? 'video/mp4' : 'image/jpeg';
        const fileName = `post_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        
        // Convert URI to Uint8Array using legacy API (no deprecation warnings)
        const base64 = await FileSystem.readAsStringAsync(item.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        
        const { error, data: uploadData } = await supabase.storage
          .from('media')
          .upload(fileName, uint8Array, {
            contentType,
            upsert: false,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(uploadData?.path || fileName);

        if (publicUrl) {
          uploadedUrls.push(publicUrl);
        } else {
          console.warn('Failed to get public URL for uploaded media');
        }
      } catch (error) {
        console.error('Failed to upload media item:', error);
        // Continue with other items instead of failing completely
        // This allows partial success
      }
    }
    
    return uploadedUrls;
  };

  const handlePost = async () => {
    if (!canPost) {
      Alert.alert('Error', 'Please add some content or images to your post');
      return;
    }

    setIsLoading(true);
    try {
      let uploadedMediaUrls: string[] = [];
      if (media.length > 0) {
        uploadedMediaUrls = await uploadMedia(media);
      }
      
      const hasVideo = media.some(m => m.kind === 'video');
      const hasImage = media.some(m => m.kind === 'image');
      let mediaType: 'image' | 'video' | 'mixed' = 'image';
      if (hasVideo && hasImage) {
        mediaType = 'mixed';
      } else if (hasVideo) {
        mediaType = 'video';
      }
      await createPost(content.trim(), uploadedMediaUrls, mediaType);
      
      Alert.alert('Success', 'Post created successfully!');
      router.back();
    } catch (error) {
      console.error('Failed to create post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Create Post',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handlePost}
              disabled={isLoading || !canPost}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.postButton,
                    !canPost && styles.postButtonDisabled,
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
                <Text style={styles.composerTitle}>Share something</Text>
                <Text style={styles.composerSubtitle}>Post to your feed</Text>
              </View>
            </View>

            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.text.tertiary}
                value={content}
                onChangeText={setContent}
                multiline
                autoFocus
              />
              <View style={styles.cardFooter}>
                <Text style={styles.counter}>{content.length}/1000</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Media</Text>
              {media.length > 0 ? (
                <TouchableOpacity onPress={() => setMedia([])} style={styles.clearButton}>
                  <Trash2 size={16} color={colors.danger} />
                  <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.mediaGrid}>
              <TouchableOpacity style={styles.addTile} onPress={pickMedia}>
                <View style={styles.addTileIcon}>
                  <Plus size={22} color={colors.primary} />
                </View>
                <Text style={styles.addTileText}>Add</Text>
                <Text style={styles.addTileSubtext}>Photos/Videos</Text>
              </TouchableOpacity>

              {media.map((m, index) => (
                <View key={`${m.uri}_${index}`} style={styles.mediaTile}>
                  <Image 
                    source={{ uri: m.uri }} 
                    style={styles.mediaTileImage} 
                    contentFit="cover"
                    onError={(error) => {
                      console.error('Error loading media preview:', error);
                    }}
                  />
                  <View style={styles.mediaBadge}>
                    {m.kind === 'video' ? (
                      <VideoIcon size={14} color={colors.text.white} />
                    ) : (
                      <ImageIcon size={14} color={colors.text.white} />
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeMediaAt(index)}
                  >
                    <X size={16} color={colors.text.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (!canPost || isLoading) && styles.primaryButtonDisabled]}
              onPress={handlePost}
              disabled={!canPost || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Post</Text>
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
  card: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 16,
    padding: 14,
  },
  input: {
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  cardFooter: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  counter: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  clearButton: {
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
  clearButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.danger,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addTile: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26, 115, 232, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addTileText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  addTileSubtext: {
    marginTop: 2,
    fontSize: 11,
    color: colors.text.secondary,
  },
  mediaTile: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  mediaTileImage: {
    width: '100%',
    height: '100%',
  },
  mediaBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
