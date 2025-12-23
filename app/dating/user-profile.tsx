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
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Star, MapPin, Calendar, Users, Video, Image as ImageIcon, Share2, MoreVertical, Shield, CheckCircle2, Crown, Mic, Clock, MessageCircle, TrendingUp, Smile, Coffee, Home, Church, Briefcase, Mountain, Flag } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { Image as ExpoImage } from 'expo-image';
import * as DatingService from '@/lib/dating-service';
import * as ProfileEnhancements from '@/lib/dating-profile-enhancements';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import ReportContentModal from '@/components/ReportContentModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string }>();
  const { colors } = useTheme();
  const { currentUser, reportContent } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [badges, setBadges] = useState<any[]>([]);
  const [compatibility, setCompatibility] = useState<number | null>(null);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [params.userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwnProfile(user?.id === params.userId);
      
      const [profileData, badgesData, subscriptionData] = await Promise.all([
        DatingService.getDatingProfile(params.userId),
        ProfileEnhancements.getUserBadges(params.userId).catch(() => []),
        user?.id === params.userId ? DatingService.getSubscriptionInfo().catch(() => null) : Promise.resolve(null),
      ]);
      
      setProfile(profileData);
      setBadges(badgesData);
      setSubscription(subscriptionData);
      
      // Update last_active_at when viewing someone else's profile
      if (user?.id && user.id !== params.userId && profileData) {
        try {
          await supabase
            .from('dating_profiles')
            .update({ last_active_at: new Date().toISOString() })
            .eq('user_id', params.userId);
        } catch (e) {
          console.error('Error updating last_active_at:', e);
        }
      }
      
      // Load compatibility if viewing someone else's profile
      if (user?.id && user.id !== params.userId) {
        try {
          const compat = await ProfileEnhancements.calculateCompatibility(user.id, params.userId);
          setCompatibility(compat);
        } catch (e) {
          console.error('Error calculating compatibility:', e);
        }
        
        // Load conversation starters
        try {
          const starters = await ProfileEnhancements.getConversationStarters(params.userId);
          setConversationStarters(starters);
        } catch (e) {
          console.error('Error loading conversation starters:', e);
        }
      }
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

  const handleShare = async () => {
    try {
      if (!profile) return;
      
      const shareText = `Check out ${profile.user?.full_name || 'this profile'} on Committed Dating!`;
      Alert.alert('Share Profile', shareText, [
        { text: 'OK' }
      ]);
    } catch (error: any) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share profile');
    }
  };

  const getLastSeenText = (lastActive: string) => {
    const now = new Date();
    const lastSeen = new Date(lastActive);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 5) return 'Online now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    return `Last seen ${Math.floor(diffHours / 24)}d ago`;
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
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={handleShare}
          >
            <Share2 size={22} color={colors.text.primary} />
          </TouchableOpacity>
          {!isOwnProfile && (
            <TouchableOpacity 
              style={styles.headerIconButton}
              onPress={() => setShowMenuModal(true)}
            >
              <MoreVertical size={22} color={colors.text.primary} />
            </TouchableOpacity>
          )}
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

        {/* Conversation Starters */}
        {conversationStarters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conversation Starters 💬</Text>
            <View style={styles.conversationStartersContainer}>
              {conversationStarters.map((starter, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.conversationStarterButton}
                  onPress={() => {
                    // Navigate to messages or show prompt
                    Alert.alert('Start Conversation', starter);
                  }}
                >
                  <MessageCircle size={16} color={colors.primary} />
                  <Text style={styles.conversationStarterText}>{starter}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bio Section */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* What Makes Me Different */}
        {profile.what_makes_me_different && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Makes Me Different 🔥</Text>
            <Text style={styles.bioText}>{profile.what_makes_me_different}</Text>
          </View>
        )}

        {/* Values */}
        {profile.values && profile.values.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Values ❤️</Text>
            <View style={styles.interestsContainer}>
              {profile.values.map((value: string, index: number) => (
                <View key={index} style={styles.valueTag}>
                  <Heart size={14} color={colors.primary} />
                  <Text style={styles.interestText}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Mood & Weekend Style */}
        {(profile.mood || profile.weekend_style) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vibe & Lifestyle</Text>
            <View style={styles.infoGrid}>
              {profile.mood && (
                <View style={styles.infoItem}>
                  <Smile size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Mood</Text>
                  <Text style={styles.infoValue}>
                    {profile.mood.charAt(0).toUpperCase() + profile.mood.slice(1)}
                  </Text>
                </View>
              )}
              {profile.weekend_style && (
                <View style={styles.infoItem}>
                  {profile.weekend_style === 'homebody' && <Home size={20} color={colors.primary} />}
                  {profile.weekend_style === 'out_with_friends' && <Users size={20} color={colors.primary} />}
                  {profile.weekend_style === 'church_faith' && <Church size={20} color={colors.primary} />}
                  {profile.weekend_style === 'side_hustling' && <Briefcase size={20} color={colors.primary} />}
                  {profile.weekend_style === 'exploring' && <Mountain size={20} color={colors.primary} />}
                  <Text style={styles.infoLabel}>Weekend</Text>
                  <Text style={styles.infoValue}>
                    {profile.weekend_style.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Daily Question Answer */}
        {profile.daily_question_answer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Question ✍🏽</Text>
            <Text style={styles.bioText}>{profile.daily_question_answer}</Text>
          </View>
        )}

        {/* Prompts / Short Questions */}
        {profile.prompts && Array.isArray(profile.prompts) && profile.prompts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prompts / Short Questions ✍🏽</Text>
            <View style={styles.promptsContainer}>
              {profile.prompts.map((prompt: any, index: number) => (
                <View key={index} style={styles.promptCard}>
                  <Text style={styles.promptQuestion}>{prompt.question}</Text>
                  <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* What I'm Looking For */}
        {profile.what_im_looking_for && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What I'm Looking For 💬</Text>
            <Text style={styles.bioText}>{profile.what_im_looking_for}</Text>
          </View>
        )}

        {/* Intention Tag */}
        {profile.intention_tag && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Intention 🔒</Text>
            <View style={styles.intentionContainer}>
              <View style={styles.intentionBadge}>
                <Text style={styles.intentionText}>
                  Here for: {profile.intention_tag.charAt(0).toUpperCase() + profile.intention_tag.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Local Flavor */}
        {(profile.local_food || profile.local_slang || profile.local_spot) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Local Flavor 🌍</Text>
            <View style={styles.localFlavorContainer}>
              {profile.local_food && (
                <View style={styles.localItem}>
                  <Text style={styles.localLabel}>Favorite Food</Text>
                  <Text style={styles.localValue}>{profile.local_food}</Text>
                </View>
              )}
              {profile.local_slang && (
                <View style={styles.localItem}>
                  <Text style={styles.localLabel}>Favorite Slang</Text>
                  <Text style={styles.localValue}>{profile.local_slang}</Text>
                </View>
              )}
              {profile.local_spot && (
                <View style={styles.localItem}>
                  <Text style={styles.localLabel}>Favorite Spot</Text>
                  <Text style={styles.localValue}>{profile.local_spot}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Lifestyle */}
        {(profile.kids || profile.work || profile.smoke || profile.drink) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <View style={styles.infoGrid}>
              {profile.kids && (
                <View style={styles.infoItem}>
                  <Users size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Kids</Text>
                  <Text style={styles.infoValue}>
                    {profile.kids.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                </View>
              )}
              {profile.work && (
                <View style={styles.infoItem}>
                  <Briefcase size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Work</Text>
                  <Text style={styles.infoValue}>{profile.work}</Text>
                </View>
              )}
              {profile.smoke && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Smoke</Text>
                  <Text style={styles.infoValue}>
                    {profile.smoke.charAt(0).toUpperCase() + profile.smoke.slice(1).replace('_', ' ')}
                  </Text>
                </View>
              )}
              {profile.drink && (
                <View style={styles.infoItem}>
                  <Coffee size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Drink</Text>
                  <Text style={styles.infoValue}>
                    {profile.drink.charAt(0).toUpperCase() + profile.drink.slice(1).replace('_', ' ')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Earned Badges */}
        {badges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges 🏆</Text>
            <View style={styles.badgesContainer}>
              {badges.map((badge: any) => (
                <View key={badge.id} style={styles.badgeItem}>
                  {badge.badge_type === 'verified' && <CheckCircle2 size={20} color={colors.primary} />}
                  {badge.badge_type === 'good_conversationalist' && <MessageCircle size={20} color={colors.primary} />}
                  {badge.badge_type === 'replies_fast' && <Clock size={20} color={colors.primary} />}
                  {badge.badge_type === 'respectful_member' && <Shield size={20} color={colors.primary} />}
                  {badge.badge_type === 'premium' && <Crown size={20} color={colors.accent} />}
                  <Text style={styles.badgeItemText}>
                    {badge.badge_type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>
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

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenuModal(false);
                setShowReportModal(true);
              }}
            >
              <Flag size={20} color={colors.danger} />
              <Text style={styles.menuItemText}>Report Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuCancel}
              onPress={() => setShowMenuModal(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      {profile && (
        <ReportContentModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          contentType="profile"
          reportedUserId={params.userId}
          onReport={async (contentType, contentId, reportedUserId, reason, description) => {
            if (!reportContent) return;
            await reportContent(contentType, contentId, reportedUserId, reason, description);
          }}
          colors={colors}
        />
      )}
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
    headlineText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
      marginBottom: 12,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    badgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 8,
    },
    verificationBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    premiumBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    freeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    freeBadgeText: {
      fontSize: 10,
      color: '#fff',
      fontWeight: '600',
    },
    respectBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 14,
      color: '#fff',
      opacity: 0.9,
    },
    compatibilityContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 16,
      alignSelf: 'flex-start',
    },
    compatibilityText: {
      fontSize: 14,
      color: '#fff',
      fontWeight: '700',
    },
    voiceIntroButton: {
      position: 'absolute',
      top: 20,
      left: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 20,
    },
    voiceIntroText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    conversationStartersContainer: {
      gap: 12,
    },
    conversationStarterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    conversationStarterText: {
      flex: 1,
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: '500',
    },
    valueTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    intentionContainer: {
      marginTop: 8,
    },
    intentionBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    intentionText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    localFlavorContainer: {
      gap: 12,
    },
    localItem: {
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    localLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 4,
      fontWeight: '600',
    },
    localValue: {
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: '500',
    },
    badgesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    badgeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    badgeItemText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '600',
    },
    bioVideoContainer: {
      width: '100%',
      height: 200,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
    },
    bioVideoThumbnail: {
      width: '100%',
      height: '100%',
    },
    bioVideoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    promptsContainer: {
      gap: 16,
    },
    promptCard: {
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    promptQuestion: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    promptAnswer: {
      fontSize: 15,
      color: colors.text.secondary,
      lineHeight: 22,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    menuContainer: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 20,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    menuItemText: {
      fontSize: 16,
      color: colors.text.primary,
      fontWeight: '500',
    },
    menuCancel: {
      padding: 20,
      alignItems: 'center',
    },
    menuCancelText: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '600',
    },
  });

