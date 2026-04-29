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
  Share,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Heart, Star, MapPin, Calendar, Users, Video, Image as ImageIcon, Share2, MoreVertical, Shield, CheckCircle2, Crown, Clock, MessageCircle, Smile, Coffee, Home, Church, Briefcase, Mountain, Flag, BookOpen, Ruler, Dumbbell, PawPrint, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { Image as ExpoImage } from 'expo-image';
import * as DatingService from '@/lib/dating-service';
import * as ProfileEnhancements from '@/lib/dating-profile-enhancements';
import * as DatingMessageLimits from '@/lib/dating-message-limits';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import ReportContentModal from '@/components/ReportContentModal';
import PremiumModal from '@/components/PremiumModal';
import { AdaptiveMediaProfile, getAdaptiveImageUrl, getAdaptiveMediaProfile } from '@/lib/adaptive-media';
import { buildDatingProfileLink } from '@/lib/deep-link-service';
import { navigateToDatingHome } from '@/lib/dating-navigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatProfileValue = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string }>();
  const { colors } = useTheme();
  const { currentUser, reportContent, createOrGetConversation, sendMessage } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');
  const [badges, setBadges] = useState<any[]>([]);
  const [, setCompatibility] = useState<number | null>(null);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [, setSubscription] = useState<any>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState<{ name?: string; description?: string }>({});
  const [mediaProfile, setMediaProfile] = useState<AdaptiveMediaProfile | null>(null);
  const [reactionInFlight, setReactionInFlight] = useState<'like' | 'superLike' | null>(null);
  const [reactionFeedback, setReactionFeedback] = useState<null | {
    type: 'like' | 'superLike' | 'match';
    name: string;
  }>(null);
  const [reactionState, setReactionState] = useState({
    liked: false,
    superLiked: false,
    matched: false,
  });

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount/params change
  }, [params.userId]);

  useEffect(() => {
    let isMounted = true;
    void getAdaptiveMediaProfile()
      .then((profile) => {
        if (isMounted) setMediaProfile(profile);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const adaptImage = (url: string | null | undefined, kind: 'avatar' | 'feed' | 'full' = 'feed') => {
    if (!url || !mediaProfile) return url || '';
    return getAdaptiveImageUrl(url, mediaProfile, kind);
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwnProfile(user?.id === params.userId);
      
      const [profileData, badgesData, subscriptionData, reactionData] = await Promise.all([
        DatingService.getDatingProfile(params.userId),
        ProfileEnhancements.getUserBadges(params.userId).catch(() => []),
        user?.id === params.userId ? DatingService.getSubscriptionInfo().catch(() => null) : Promise.resolve(null),
        user?.id && user.id !== params.userId
          ? DatingService.getDatingReactionState(params.userId).catch(() => ({ liked: false, superLiked: false, matched: false }))
          : Promise.resolve({ liked: false, superLiked: false, matched: false }),
      ]);
      
      setProfile(profileData);
      setBadges(badgesData);
      setSubscription(subscriptionData);
      setReactionState(reactionData);
      
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
      navigateToDatingHome(router);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      if (reactionInFlight) return;
      setReactionInFlight('like');
      const result = await DatingService.likeUser(params.userId, false);
      if (result.isMatch) {
        setReactionState({ liked: true, superLiked: !!result.like?.is_super_like, matched: true });
        setReactionFeedback({
          type: 'match',
          name: profile?.user?.full_name || 'this profile',
        });
      } else {
        setReactionState((prev) => ({ ...prev, liked: true }));
        setReactionFeedback({
          type: 'like',
          name: profile?.user?.full_name || 'this profile',
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to like user');
    } finally {
      setReactionInFlight(null);
    }
  };

  const handleSuperLike = async () => {
    try {
      if (reactionInFlight) return;
      setReactionInFlight('superLike');
      const result = await DatingService.likeUser(params.userId, true);
      if (result.isMatch) {
        setReactionState({ liked: true, superLiked: true, matched: true });
        setReactionFeedback({
          type: 'match',
          name: profile?.user?.full_name || 'this profile',
        });
      } else {
        setReactionState((prev) => ({ ...prev, liked: true, superLiked: true }));
        setReactionFeedback({
          type: 'superLike',
          name: profile?.user?.full_name || 'this profile',
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to super like user');
    } finally {
      setReactionInFlight(null);
    }
  };

  const handleShare = async () => {
    try {
      if (!profile) return;

      const { web: webLink } = buildDatingProfileLink(params.userId);
      const displayName = profile.user?.full_name || 'this profile';
      const shareText = `Check out ${displayName} on Committed Dating.\n\nView profile: ${webLink}`;
      await Share.share({
        message: shareText,
        url: webLink,
        title: `${displayName} on Committed Dating`,
      });
    } catch (error: any) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share profile');
    }
  };

  const handleMessageMatch = async () => {
    try {
      const conversation = await createOrGetConversation(params.userId);
      if (!conversation) {
        Alert.alert('Error', 'Could not open conversation');
        return;
      }
      router.push(`/messages/${conversation.id}` as any);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to open conversation');
    }
  };

  const handleConversationStarter = async (starter: string) => {
    try {
      if (!currentUser) return;

      // Check if user can send conversation starter (limit: 1 per user)
      const limitCheck = await DatingMessageLimits.checkConversationStarterLimit(params.userId);
      if (!limitCheck.allowed) {
        setPremiumFeature({
          name: 'Unlimited Messaging',
          description: limitCheck.error || 'Upgrade to Premium to send unlimited conversation starters and messages!',
        });
        setShowPremiumModal(true);
        return;
      }

      // First, like the user (if not already liked) - this acts as an "opener"
      try {
        await DatingService.likeUser(params.userId, false);
      } catch (error: any) {
        // If already liked, that's okay - continue to send message
        if (!error.message?.includes('already')) {
          console.warn('Could not like user before sending starter:', error);
        }
      }

      // Convert conversation starter to actual question in second person
      // e.g., "Ask about their weekend style" -> "Tell me about your weekend style"
      let message = starter.replace(/^Ask about /i, '').trim();
      
      // Replace third person pronouns with second person for direct address
      message = message
        .replace(/\btheir\b/gi, 'your')
        .replace(/\bthey\b/gi, 'you')
        .replace(/\bthem\b/gi, 'you')
        .replace(/\btheirs\b/gi, 'yours');
      
      // Format as a question if not already
      const question = message.endsWith('?') 
        ? message 
        : `Tell me about ${message.startsWith('your ') ? message : message.replace(/^(a |an |the )/i, 'your ')}`;

      // Create or get conversation
      const conversation = await createOrGetConversation(params.userId);
      if (!conversation) {
        Alert.alert('Error', 'Could not create conversation');
        return;
      }

      // Send the conversation starter as a message
      await sendMessage(
        conversation.id,
        params.userId,
        question,
        undefined, // no media
        undefined, // no document
        undefined, // no document name
        'text',
        undefined // no sticker
      );

      // Navigate to the conversation
      router.push(`/messages/${conversation.id}` as any);
    } catch (error: any) {
      console.error('Error sending conversation starter:', error);
      Alert.alert('Error', error.message || 'Failed to send conversation starter');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future last-seen display
  const _getLastSeenText = (lastActive: string) => {
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
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = profile.photos || [];
  const videos = profile.videos || [];
  const primaryPhoto = photos.find((p: any) => p.is_primary) || photos[0];
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateToDatingHome(router)} style={styles.headerButton}>
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
              source={{ uri: adaptImage(primaryPhoto.photo_url, 'full') }}
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
            onPress={() => navigateToDatingHome(router)}
          >
            <Text style={styles.actionButtonText}>✕</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.superLikeButton,
              reactionState.superLiked && styles.actionButtonSelected,
              (reactionInFlight || reactionState.superLiked || reactionState.matched) && styles.actionButtonDisabled,
            ]}
            onPress={handleSuperLike}
            disabled={!!reactionInFlight || reactionState.superLiked || reactionState.matched}
          >
            {reactionState.superLiked ? (
              <CheckCircle2 size={28} color="#fff" fill="#fff" />
            ) : (
              <Star size={28} color="#fff" fill="#fff" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.likeButton,
              reactionState.liked && styles.actionButtonSelected,
              (reactionInFlight || reactionState.liked || reactionState.matched) && styles.actionButtonDisabled,
            ]}
            onPress={handleLike}
            disabled={!!reactionInFlight || reactionState.liked || reactionState.matched}
          >
            {reactionState.liked ? (
              <CheckCircle2 size={28} color="#fff" fill="#fff" />
            ) : (
              <Heart size={28} color="#fff" fill="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {!isOwnProfile && (reactionState.liked || reactionState.matched) && (
          <View style={styles.reactionStatusCard}>
            <View style={styles.reactionStatusIcon}>
              {reactionState.matched ? (
                <MessageCircle size={20} color="#fff" />
              ) : reactionState.superLiked ? (
                <Star size={20} color="#fff" fill="#fff" />
              ) : (
                <Heart size={20} color="#fff" fill="#fff" />
              )}
            </View>
            <View style={styles.reactionStatusCopy}>
              <Text style={styles.reactionStatusTitle}>
                {reactionState.matched
                  ? "It's a match"
                  : reactionState.superLiked
                    ? 'Super like sent'
                    : 'You liked this profile'}
              </Text>
              <Text style={styles.reactionStatusText}>
                {reactionState.matched
                  ? 'You can start a conversation whenever you are ready.'
                  : reactionState.superLiked
                    ? 'They will see that you are extra interested.'
                    : 'If they like you back, you will become a match.'}
              </Text>
            </View>
            {reactionState.matched && (
              <TouchableOpacity style={styles.reactionStatusButton} onPress={handleMessageMatch}>
                <Text style={styles.reactionStatusButtonText}>Message</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Conversation Starters */}
        {conversationStarters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Conversation Starters 💬</Text>
            <View style={styles.conversationStartersContainer}>
              {conversationStarters.map((starter, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.conversationStarterButton}
                  onPress={() => handleConversationStarter(starter)}
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
        {(profile.kids || profile.work || profile.religion || profile.education || profile.height_cm || profile.exercise || profile.pets || profile.smoke || profile.drink) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <View style={styles.infoGrid}>
              {profile.kids && (
                <View style={styles.infoItem}>
                  <Users size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Kids</Text>
                  <Text style={styles.infoValue}>{formatProfileValue(profile.kids)}</Text>
                </View>
              )}
              {profile.work && (
                <View style={styles.infoItem}>
                  <Briefcase size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Work</Text>
                  <Text style={styles.infoValue}>{profile.work}</Text>
                </View>
              )}
              {profile.religion && (
                <View style={styles.infoItem}>
                  <Church size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Faith</Text>
                  <Text style={styles.infoValue}>{profile.religion}</Text>
                </View>
              )}
              {profile.education && (
                <View style={styles.infoItem}>
                  <BookOpen size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Education</Text>
                  <Text style={styles.infoValue}>{profile.education}</Text>
                </View>
              )}
              {profile.height_cm && (
                <View style={styles.infoItem}>
                  <Ruler size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Height</Text>
                  <Text style={styles.infoValue}>{profile.height_cm} cm</Text>
                </View>
              )}
              {profile.exercise && (
                <View style={styles.infoItem}>
                  <Dumbbell size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Exercise</Text>
                  <Text style={styles.infoValue}>{formatProfileValue(profile.exercise)}</Text>
                </View>
              )}
              {profile.pets && (
                <View style={styles.infoItem}>
                  <PawPrint size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Pets</Text>
                  <Text style={styles.infoValue}>{formatProfileValue(profile.pets)}</Text>
                </View>
              )}
              {profile.smoke && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Smoke</Text>
                  <Text style={styles.infoValue}>{formatProfileValue(profile.smoke)}</Text>
                </View>
              )}
              {profile.drink && (
                <View style={styles.infoItem}>
                  <Coffee size={20} color={colors.primary} />
                  <Text style={styles.infoLabel}>Drink</Text>
                  <Text style={styles.infoValue}>{formatProfileValue(profile.drink)}</Text>
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
                      source={{ uri: adaptImage(photo.photo_url, 'full') }}
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
                        source={{ uri: adaptImage(video.thumbnail_url, 'feed') }}
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

      <Modal
        visible={!!reactionFeedback}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setReactionFeedback(null)}
      >
        <View style={styles.reactionOverlay}>
          <View style={styles.reactionCard}>
            <LinearGradient
              colors={
                reactionFeedback?.type === 'match'
                  ? [colors.danger, colors.primary]
                  : reactionFeedback?.type === 'superLike'
                  ? [colors.primary, colors.accent]
                  : [colors.success, colors.primary]
              }
              style={styles.reactionHero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.reactionIconRing}>
                {reactionFeedback?.type === 'match' ? (
                  <Sparkles size={46} color="#fff" fill="#fff" />
                ) : reactionFeedback?.type === 'superLike' ? (
                  <Star size={44} color="#fff" fill="#fff" />
                ) : (
                  <Heart size={48} color="#fff" fill="#fff" />
                )}
              </View>
            </LinearGradient>
            <View style={styles.reactionContent}>
              <Text style={styles.reactionTitle}>
                {reactionFeedback?.type === 'match'
                  ? "It's a match"
                  : reactionFeedback?.type === 'superLike'
                    ? 'Super Like sent'
                    : 'Liked'}
              </Text>
              <Text style={styles.reactionText}>
                {reactionFeedback?.type === 'match'
                  ? `You and ${reactionFeedback?.name} liked each other. Time to start a real conversation.`
                  : reactionFeedback?.type === 'superLike'
                  ? `${reactionFeedback?.name} will see that you are extra interested.`
                  : `${reactionFeedback?.name} will see your like if they check their dating likes.`}
              </Text>
              <TouchableOpacity
                style={styles.reactionButton}
                onPress={() => {
                  if (reactionFeedback?.type === 'match') {
                    setReactionFeedback(null);
                    void handleMessageMatch();
                    return;
                  }
                  setReactionFeedback(null);
                }}
              >
                <Text style={styles.reactionButtonText}>
                  {reactionFeedback?.type === 'match' ? 'Send a message' : 'Keep exploring'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Premium Modal */}
      <PremiumModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        featureName={premiumFeature.name}
        featureDescription={premiumFeature.description}
      />
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
    actionButtonSelected: {
      borderWidth: 3,
      borderColor: 'rgba(255, 255, 255, 0.86)',
      shadowOpacity: 0.18,
    },
    actionButtonDisabled: {
      opacity: 0.78,
    },
    actionButtonText: {
      fontSize: 32,
      color: '#fff',
      fontWeight: '700',
    },
    reactionStatusCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      padding: 16,
      borderRadius: 20,
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '28',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    reactionStatusIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    reactionStatusCopy: {
      flex: 1,
      gap: 3,
    },
    reactionStatusTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.primary,
    },
    reactionStatusText: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.text.secondary,
    },
    reactionStatusButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    reactionStatusButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '800',
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
    reactionOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: 'rgba(0, 0, 0, 0.58)',
    },
    reactionCard: {
      width: '100%',
      maxWidth: 360,
      overflow: 'hidden',
      borderRadius: 28,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.35,
      shadowRadius: 28,
      elevation: 18,
    },
    reactionHero: {
      height: 136,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionIconRing: {
      width: 86,
      height: 86,
      borderRadius: 43,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.55)',
    },
    reactionContent: {
      padding: 22,
      alignItems: 'center',
      gap: 12,
    },
    reactionTitle: {
      fontSize: 25,
      fontWeight: '800',
      color: colors.text.primary,
      textAlign: 'center',
      letterSpacing: 0,
    },
    reactionText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    reactionButton: {
      marginTop: 8,
      width: '100%',
      paddingVertical: 15,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    reactionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
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

