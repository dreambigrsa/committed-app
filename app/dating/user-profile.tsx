import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Star, MapPin, Calendar, Users, Video, Image as ImageIcon, Share2, MoreVertical, Shield, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { Image as ExpoImage } from 'expo-image';
import * as DatingService from '@/lib/dating-service';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string }>();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    loadProfile();
  }, [params.userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await DatingService.getDatingProfile(params.userId);
      setProfile(data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      const result = await DatingService.likeUser(params.userId, false);
      if (result.isMatch) {
        Alert.alert("It's a Match!", `You and ${profile?.user?.full_name || 'this person'} liked each other!`);
      } else {
        Alert.alert('Liked!', 'Your like has been sent');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to like user');
    }
  };

  const handleSuperLike = async () => {
    try {
      const result = await DatingService.likeUser(params.userId, true);
      if (result.isMatch) {
        Alert.alert("It's a Match!", `You and ${profile?.user?.full_name || 'this person'} liked each other!`);
      } else {
        Alert.alert('Super Liked!', 'Your super like has been sent');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to super like user');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = profile.photos || [];
  const videos = profile.videos || [];
  const primaryPhoto = photos.find((p: any) => p.is_primary) || photos[0];
  const displayPhotos = photos.slice(0, 6);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Share2 size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <MoreVertical size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image Section */}
        <View style={styles.heroSection}>
          {primaryPhoto ? (
            <ExpoImage
              source={{ uri: primaryPhoto.photo_url }}
              style={styles.heroImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.heroImage, styles.placeholderImage]}>
              <ImageIcon size={64} color={colors.text.tertiary} />
            </View>
          )}
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroGradient}
          />

          {/* Profile Info Overlay */}
          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.heroName}>
                {profile.user?.full_name || 'Unknown'}, {profile.age || '?'}
              </Text>
              {profile.user?.verified && (
                <CheckCircle2 size={20} color={colors.primary} fill={colors.primary} />
              )}
            </View>
            {profile.location_city && (
              <View style={styles.locationRow}>
                <MapPin size={16} color="#fff" />
                <Text style={styles.locationText}>{profile.location_city}</Text>
              </View>
            )}
          </View>

          {/* Photo Count Badge */}
          {photos.length > 0 && (
            <View style={styles.photoCountBadge}>
              <ImageIcon size={16} color="#fff" />
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => router.back()}
          >
            <Text style={styles.actionButtonText}>✕</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.superLikeButton]}
            onPress={handleSuperLike}
          >
            <Star size={28} color="#fff" fill="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={handleLike}
          >
            <Heart size={28} color="#fff" fill="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bio Section */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <View style={styles.infoGrid}>
            {profile.age && (
              <View style={styles.infoItem}>
                <Calendar size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Age</Text>
                <Text style={styles.infoValue}>{profile.age}</Text>
              </View>
            )}
            {profile.location_city && (
              <View style={styles.infoItem}>
                <MapPin size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{profile.location_city}</Text>
              </View>
            )}
            {profile.relationship_goals && profile.relationship_goals.length > 0 && (
              <View style={styles.infoItem}>
                <Heart size={20} color={colors.primary} />
                <Text style={styles.infoLabel}>Looking for</Text>
                <Text style={styles.infoValue}>{profile.relationship_goals.join(', ')}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {profile.interests.map((interest: string, index: number) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Media Tabs */}
        <View style={styles.section}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
              onPress={() => setActiveTab('photos')}
            >
              <ImageIcon size={20} color={activeTab === 'photos' ? colors.primary : colors.text.secondary} />
              <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
                Photos ({photos.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'videos' && styles.tabActive]}
              onPress={() => setActiveTab('videos')}
            >
              <Video size={20} color={activeTab === 'videos' ? colors.primary : colors.text.secondary} />
              <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>
                Videos ({videos.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Photos Grid */}
          {activeTab === 'photos' && (
            <View style={styles.mediaGrid}>
              {photos.length > 0 ? (
                photos.map((photo: any, index: number) => (
                  <TouchableOpacity
                    key={photo.id}
                    style={styles.mediaItem}
                    onPress={() => {
                      router.push({
                        pathname: '/dating/photo-gallery',
                        params: {
                          photos: JSON.stringify(photos),
                          initialIndex: index.toString(),
                          userName: profile.user?.full_name,
                        },
                      } as any);
                    }}
                  >
                    <ExpoImage
                      source={{ uri: photo.photo_url }}
                      style={styles.mediaImage}
                      contentFit="cover"
                    />
                    {photo.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Main</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyMedia}>
                  <ImageIcon size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyMediaText}>No photos yet</Text>
                </View>
              )}
            </View>
          )}

          {/* Videos Grid */}
          {activeTab === 'videos' && (
            <View style={styles.mediaGrid}>
              {videos.length > 0 ? (
                videos.map((video: any) => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.mediaItem}
                    onPress={() => {
                      // Navigate to video player
                      router.push({
                        pathname: '/dating/video-player',
                        params: { videoUrl: video.video_url },
                      } as any);
                    }}
                  >
                    {video.thumbnail_url ? (
                      <ExpoImage
                        source={{ uri: video.thumbnail_url }}
                        style={styles.mediaImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.mediaImage, styles.videoPlaceholder]}>
                        <Video size={32} color={colors.text.tertiary} />
                      </View>
                    )}
                    <View style={styles.videoOverlay}>
                      <View style={styles.playButton}>
                        <View style={styles.playIcon} />
                      </View>
                      {video.duration_seconds && (
                        <Text style={styles.videoDuration}>
                          {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyMedia}>
                  <Video size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyMediaText}>No videos yet</Text>
                </View>
              )}
            </View>
          )}
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.background.primary,
      zIndex: 10,
    },
    headerButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
    },
    heroSection: {
      width: SCREEN_WIDTH,
      height: SCREEN_WIDTH * 1.2,
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    placeholderImage: {
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
    },
    heroInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 24,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    heroName: {
      fontSize: 32,
      fontWeight: '700',
      color: '#fff',
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    locationText: {
      fontSize: 16,
      color: '#fff',
      opacity: 0.9,
    },
    photoCountBadge: {
      position: 'absolute',
      top: 20,
      right: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
    },
    photoCountText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
      paddingVertical: 24,
      paddingHorizontal: 20,
    },
    actionButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    passButton: {
      backgroundColor: colors.danger,
    },
    superLikeButton: {
      backgroundColor: colors.primary,
      width: 56,
      height: 56,
    },
    likeButton: {
      backgroundColor: colors.success,
    },
    actionButtonText: {
      fontSize: 32,
      color: '#fff',
      fontWeight: '700',
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 16,
    },
    bioText: {
      fontSize: 16,
      lineHeight: 24,
      color: colors.text.primary,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    infoItem: {
      flex: 1,
      minWidth: '45%',
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      gap: 8,
    },
    infoLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    infoValue: {
      fontSize: 16,
      color: colors.text.primary,
      fontWeight: '600',
    },
    interestsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    interestTag: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    interestText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    tabContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
    },
    tabActive: {
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    mediaItem: {
      width: (SCREEN_WIDTH - 56) / 3,
      height: (SCREEN_WIDTH - 56) / 3,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    mediaImage: {
      width: '100%',
      height: '100%',
    },
    videoPlaceholder: {
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playIcon: {
      width: 0,
      height: 0,
      borderLeftWidth: 12,
      borderTopWidth: 8,
      borderBottomWidth: 8,
      borderLeftColor: colors.primary,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      marginLeft: 4,
    },
    videoDuration: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
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
      fontWeight: '700',
    },
    emptyMedia: {
      width: '100%',
      paddingVertical: 48,
      alignItems: 'center',
      gap: 12,
    },
    emptyMediaText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
  });

