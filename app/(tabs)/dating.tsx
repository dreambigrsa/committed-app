import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, X, Star, Settings, Users, Sparkles, Zap, RotateCcw, Crown, Sliders, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as DatingService from '@/lib/dating-service';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import DatingSwipeCard from '@/components/DatingSwipeCard';
import MatchCelebrationModal from '@/components/MatchCelebrationModal';
import PremiumModal from '@/components/PremiumModal';
const MAX_VISIBLE_CARDS = 3;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_COMPACT_DATING_SCREEN = SCREEN_WIDTH < 340 || SCREEN_HEIGHT < 620;
const DATING_CARD_WIDTH = SCREEN_WIDTH - (SCREEN_WIDTH < 340 ? 24 : 32);
const DATING_CARD_HEIGHT = Math.min(
  SCREEN_HEIGHT * (SCREEN_HEIGHT < 620 ? 0.64 : 0.68),
  DATING_CARD_WIDTH * (SCREEN_WIDTH < 340 ? 1.5 : 1.6)
);
const ACTION_ICON_SIZE = IS_COMPACT_DATING_SCREEN ? 22 : 32;
const SECONDARY_ACTION_ICON_SIZE = IS_COMPACT_DATING_SCREEN ? 18 : 24;

export default function DatingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [advanceAfterMatchModal, setAdvanceAfterMatchModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState<{ name?: string; description?: string }>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loadRequestIdRef = useRef(0);
  const swipingProfilesRef = useRef<Set<string>>(new Set());

  const [userProfile, setUserProfile] = useState<any>(null);
  const [discovery, setDiscovery] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDatingData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;

    if (!currentUser) {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
      return;
    }

    try {
      setIsLoading(true);
      const profile = await DatingService.getDatingProfile().catch((err) => {
        console.log('Profile check error:', err);
        return null;
      });
      
      console.log('Profile loaded:', profile ? 'Found' : 'Not found');
      if (requestId !== loadRequestIdRef.current) return;
      setUserProfile(profile);

      if (profile && profile.id) {
        // Only load discovery if profile exists
        try {
          const discoveryData = await DatingService.getDatingDiscovery();
          
          console.log('Discovery loaded:', discoveryData.profiles?.length || 0, 'profiles');
          if (requestId !== loadRequestIdRef.current) return;
          // Normalize data structure for components
          const normalizedProfiles = (discoveryData.profiles || []).map((p: any) => ({
            ...p,
            full_name: p.user?.full_name || p.full_name,
            profile_picture: p.user?.profile_picture || p.profile_picture,
            user_id: p.user?.id || p.user_id,
            verified: p.user?.verified || false,
            email_verified: p.user?.email_verified || false,
            phone_verified: p.user?.phone_verified || false,
            id_verified: p.user?.id_verified || false,
          }));
          setDiscovery(normalizedProfiles);
        } catch (discoveryError: any) {
          if (requestId !== loadRequestIdRef.current) return;
          console.error('Error loading discovery:', discoveryError);
          setDiscovery([]);
        }
      } else {
        if (requestId !== loadRequestIdRef.current) return;
        console.log('No profile found, showing setup screen');
        setDiscovery([]);
      }
    } catch (error: any) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error('Error loading dating data:', error);
      setUserProfile(null);
      setDiscovery([]);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentUser]);

  // Load/reload when screen comes into focus (e.g., after creating profile).
  useFocusEffect(
    useCallback(() => {
      loadDatingData();
    }, [loadDatingData])
  );

  // Listen for match notifications to show modal
  useEffect(() => {
    if (!currentUser?.id) return;

    // Subscribe to notifications for match events
    const channel = supabase
      .channel(`dating_matches_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        async (payload: any) => {
          const notification = payload.new;
          
          // Check if it's a match notification
          if (notification.type === 'dating_match' && notification.data?.matched_user_id) {
            const matchedUserId = notification.data.matched_user_id;
            
            try {
              // Fetch the matched user's profile info
              const { data: matchedUserData } = await supabase
                .from('users')
                .select('id, full_name, profile_picture')
                .eq('id', matchedUserId)
                .single();

              // Get their dating profile photos
              const { data: datingProfile } = await supabase
                .from('dating_profiles')
                .select('id')
                .eq('user_id', matchedUserId)
                .single();

              let photo: string | undefined;
              if (datingProfile) {
                const { data: photos } = await supabase
                  .from('dating_photos')
                  .select('photo_url')
                  .eq('dating_profile_id', datingProfile.id)
                  .eq('is_primary', true)
                  .single();
                
                photo = photos?.photo_url || matchedUserData?.profile_picture;
              } else {
                photo = matchedUserData?.profile_picture;
              }

              // Show match modal
              setMatchedUser({
                id: matchedUserId,
                name: matchedUserData?.full_name || 'Someone',
                photo: photo,
              });
              setAdvanceAfterMatchModal(false);
              setShowMatchModal(true);
            } catch (error) {
              console.error('Error loading matched user info:', error);
              // Still show modal with basic info
              setMatchedUser({
                id: matchedUserId,
                name: 'Someone',
                photo: undefined,
              });
              setAdvanceAfterMatchModal(false);
              setShowMatchModal(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const handleLike = async (likedUserId: string, isSuperLike: boolean = false) => {
    try {
      const result = await DatingService.likeUser(likedUserId, isSuperLike);
      
      if (result.isMatch) {
        // Show match celebration modal
        const matchedProfile = discovery?.find((p: any) => {
          const userId = p.user_id || p.user?.id;
          return userId === likedUserId;
        });
        
        if (matchedProfile) {
          const photos = matchedProfile.photos || [];
          setMatchedUser({
            id: likedUserId,
            name: matchedProfile.user?.full_name || matchedProfile.full_name || 'Someone',
            photo: photos[0]?.photo_url || matchedProfile.user?.profile_picture,
          });
        } else {
          setMatchedUser({
            id: likedUserId,
            name: 'Someone',
            photo: undefined,
          });
        }
        setAdvanceAfterMatchModal(true);
        setShowMatchModal(true);
        // Don't advance card yet - let user see the match
      } else {
        handleSwipeComplete();
      }
    } catch (error: any) {
      swipingProfilesRef.current.delete(likedUserId);
      setSwipedProfiles((prev) => {
        const next = new Set(prev);
        next.delete(likedUserId);
        return next;
      });
      console.error('Error liking user:', error);
      const errorMessage = error?.message || '';
      
      // Handle duplicate like error gracefully
      if (errorMessage.includes('duplicate key') || errorMessage.includes('unique_like') || error.code === '23505') {
        // Like already exists - this is fine, just proceed
        console.log('Like already exists, proceeding...');
        handleSwipeComplete();
        return;
      }
      
      // Check if it's a database ambiguous column error
      if (errorMessage.includes('ambiguous') || errorMessage.includes('user1_id') || errorMessage.includes('user2_id')) {
        // This is a known database issue - the like was likely successful, just refresh
        console.log('Database ambiguous column error detected, refreshing data...');
        handleSwipeComplete();
        // Try to reload discovery data
        setTimeout(() => {
          loadDatingData();
        }, 500);
      } else {
        // Only show error for unexpected errors
        Alert.alert('Error', errorMessage || 'Failed to like user');
      }
    }
  };

  const handlePass = async (passedUserId: string) => {
    try {
      await DatingService.passUser(passedUserId);
      handleSwipeComplete();
    } catch (error: any) {
      swipingProfilesRef.current.delete(passedUserId);
      setSwipedProfiles((prev) => {
        const next = new Set(prev);
        next.delete(passedUserId);
        return next;
      });
      Alert.alert('Error', error.message || 'Failed to pass user');
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, []);

  const handleSwipeComplete = () => {
    const completedProfile = discovery[currentIndex];
    const completedUserId = getProfileUserId(completedProfile);
    if (completedUserId) {
      swipingProfilesRef.current.delete(completedUserId);
    }
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSwipeLeft = (profile: any) => {
    const userId = getProfileUserId(profile);
    if (!userId || swipingProfilesRef.current.has(userId) || swipedProfiles.has(userId)) return;
    swipingProfilesRef.current.add(userId);
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    handlePass(userId);
  };

  const handleSwipeRight = (profile: any) => {
    const userId = getProfileUserId(profile);
    if (!userId || swipingProfilesRef.current.has(userId) || swipedProfiles.has(userId)) return;
    swipingProfilesRef.current.add(userId);
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    handleLike(userId, false);
  };

  const handleSuperLike = (profile: any) => {
    const userId = getProfileUserId(profile);
    if (!userId || swipingProfilesRef.current.has(userId) || swipedProfiles.has(userId)) return;
    swipingProfilesRef.current.add(userId);
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    handleLike(userId, true);
  };

  const handleRefresh = async () => {
    // Reset state and reload discovery profiles
    setCurrentIndex(0);
    setSwipedProfiles(new Set());
    swipingProfilesRef.current.clear();
    await loadDatingData();
  };

  const handleRewind = async () => {
    if (currentIndex > 0) {
      // Check premium for rewind
      const isPremium = await DatingService.checkPremiumSubscription();
      if (!isPremium) {
        setPremiumFeature({
          name: 'Unlimited Rewinds',
          description: 'Go back and swipe again on profiles you may have missed',
        });
        setShowPremiumModal(true);
        return;
      }

      // Calculate the previous index and get the profile before updating state
      const previousIndex = currentIndex - 1;
      const previousProfile = discovery?.[previousIndex];
      
      if (previousProfile) {
        // Get the userId before updating state
        const userId = previousProfile.user_id || previousProfile.user?.id || previousProfile.userId;
        
        // Update both state values
        setCurrentIndex(previousIndex);
        
        // Remove from swiped set so it can be swiped again
        setSwipedProfiles((prev) => {
          const newSet = new Set(prev);
          if (userId) {
            newSet.delete(userId);
            swipingProfilesRef.current.delete(userId);
          }
          return newSet;
        });
      } else {
        // Fallback: just decrement the index
        setCurrentIndex((prev) => prev - 1);
      }
    } else {
      Alert.alert('No More to Rewind', 'You\'re at the beginning!');
    }
  };

  const handleBoost = async () => {
    try {
      // Check premium subscription
      const isPremium = await DatingService.checkPremiumSubscription();
      if (!isPremium) {
        setPremiumFeature({
          name: 'Boost Your Profile',
          description: 'Get 10x more profile views for 30 minutes. Perfect for getting noticed!',
        });
        setShowPremiumModal(true);
        return;
      }

      // Check if already boosted (cooldown)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: recentBoost } = await supabase
        .from('dating_usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('feature_name', 'boost')
        .gte('period_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentBoost) {
        Alert.alert('Boost Active', 'Your profile is already boosted! Boost again in 24 hours.');
        return;
      }

      // Activate boost
      Alert.alert(
        'Boost Your Profile',
        'Boost your profile for 30 minutes to get 10x more views!',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Boost Now',
            onPress: async () => {
              try {
                // Record boost usage
                await supabase.from('dating_usage_tracking').insert({
                  user_id: user.id,
                  feature_name: 'boost',
                  usage_count: 1,
                  period_start: new Date().toISOString(),
                  period_end: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
                });

                Alert.alert('Boost Activated!', 'Your profile is now boosted for 30 minutes. Get ready for more matches!');
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to activate boost');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to boost profile');
    }
  };

  const handleViewProfile = (profile: any) => {
    const userId = profile.user_id || profile.user?.id || profile.userId;
    if (userId) {
      router.push({
        pathname: '/dating/user-profile',
        params: { userId },
      } as any);
    }
  };

  const renderDatingHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerBrand}>
        <View style={styles.headerBrandIcon}>
          <Sparkles size={18} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>Find something real</Text>
        </View>
      </View>
      <View style={styles.headerRightActions}>
        <TouchableOpacity onPress={() => router.push('/dating/matches')} style={styles.headerIconButton}>
          <Users size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/dating/likes-received')} style={styles.headerIconButton}>
          <Heart size={20} color={colors.danger} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/dating/filters')} style={styles.headerIconButton}>
          <Sliders size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/dating/profile-setup')} style={styles.headerIconButton}>
          <Settings size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding your matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user needs to create profile
  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.emptyContainer}>
            <Animated.View style={styles.iconContainer}>
              <Heart size={80} color={colors.primary} />
            </Animated.View>
            <Text style={styles.emptyTitle}>Create Your Dating Profile</Text>
            <Text style={styles.emptyText}>
              Set up your dating profile to start discovering amazing people near you!
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/dating/profile-setup')}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const handleResetPassedProfiles = async () => {
    try {
      await DatingService.clearPassedProfiles();
      // Reload discovery with passed profiles included
      await loadDatingData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reset passed profiles');
    }
  };

  if (!discovery || discovery.length === 0 || currentIndex >= discovery.length) {
    return (
      <SafeAreaView style={styles.container}>
        {renderDatingHeader()}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBadge}>
            <Sparkles size={42} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>You're All Caught Up!</Text>
          <Text style={styles.emptyText}>
            You've seen everyone in your area. Check back later for new people, adjust your preferences, or see passed profiles again!
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/dating/filters')}
            >
              <Text style={styles.secondaryButtonText}>Adjust Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRefresh}
            >
              <RefreshCw size={18} color={colors.text.primary} />
              <Text style={styles.secondaryButtonText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.resetPassedButton]}
              onPress={handleResetPassedProfiles}
            >
              <RotateCcw size={18} color={colors.text.primary} />
              <Text style={styles.secondaryButtonText}>See Passed Profiles</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Get visible cards (stack)
  const visibleProfiles = discovery.slice(currentIndex, currentIndex + MAX_VISIBLE_CARDS);
  const topProfile = visibleProfiles[0];
  const topProfileUserId = getProfileUserId(topProfile);
  const isTopProfileBusy = !!topProfileUserId && swipingProfilesRef.current.has(topProfileUserId);
  const actionButtonsDisabled = isLoading || isTopProfileBusy || !topProfile;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        {renderDatingHeader()}

        {/* Card Stack */}
        <View style={styles.cardStackContainer}>
          {visibleProfiles.map((profile: any, index: number) => {
            const isTop = index === 0;
            const userId = profile.user_id || profile.userId;
            // Use a key that includes both userId and currentIndex to force remount on rewind
            const cardKey = `${userId}-${currentIndex + index}`;
            return (
              <DatingSwipeCard
                key={cardKey}
                profile={profile}
                onSwipeLeft={() => handleSwipeLeft(profile)}
                onSwipeRight={() => handleSwipeRight(profile)}
                onSuperLike={() => handleSuperLike(profile)}
                onTap={() => handleViewProfile(profile)}
                index={index}
                isTop={isTop}
              />
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Rewind (Premium) */}
          <TouchableOpacity
            style={[styles.actionButton, styles.rewindButton, currentIndex === 0 && styles.actionButtonDisabled]}
            onPress={handleRewind}
            disabled={currentIndex === 0 || isLoading}
          >
            <View style={styles.actionButtonInner}>
              <RotateCcw size={SECONDARY_ACTION_ICON_SIZE} color={currentIndex === 0 ? colors.text.tertiary : colors.text.primary} />
            </View>
          </TouchableOpacity>

          {/* Pass */}
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton, actionButtonsDisabled && styles.actionButtonDisabled]}
            onPress={() => topProfile && handleSwipeLeft(topProfile)}
            disabled={actionButtonsDisabled}
          >
            <X size={ACTION_ICON_SIZE} color="#FFFFFF" strokeWidth={3} />
          </TouchableOpacity>

          {/* Super Like */}
          <TouchableOpacity
            style={[styles.actionButton, styles.superLikeButton, actionButtonsDisabled && styles.actionButtonDisabled]}
            onPress={() => topProfile && handleSuperLike(topProfile)}
            disabled={actionButtonsDisabled}
          >
            <Star size={IS_COMPACT_DATING_SCREEN ? 22 : 28} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>

          {/* Like */}
          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton, actionButtonsDisabled && styles.actionButtonDisabled]}
            onPress={() => topProfile && handleSwipeRight(topProfile)}
            disabled={actionButtonsDisabled}
          >
            <Heart size={ACTION_ICON_SIZE} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>

          {/* Boost (Premium) */}
          <TouchableOpacity
            style={[styles.actionButton, styles.boostButton]}
            onPress={handleBoost}
          >
            <Zap size={SECONDARY_ACTION_ICON_SIZE} color={colors.accent} fill={colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Premium Badge */}
        <TouchableOpacity
          style={styles.premiumBadge}
          onPress={() => router.push('/dating/premium')}
        >
          <Crown size={16} color={colors.accent} fill={colors.accent} />
          <Text style={styles.premiumText}>Go Premium</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Match Celebration Modal */}
      <MatchCelebrationModal
        visible={showMatchModal}
        matchedUserId={matchedUser?.id || ''}
        matchedUserName={matchedUser?.name || 'Someone'}
        matchedUserPhoto={matchedUser?.photo}
        currentUserPhoto={currentUser?.profilePicture}
        onClose={() => {
          setShowMatchModal(false);
          if (advanceAfterMatchModal) {
            handleSwipeComplete();
            setAdvanceAfterMatchModal(false);
          }
        }}
        onMessageSent={() => {
          // Optionally navigate to matches or conversation after sending message
          // router.push('/dating/matches');
        }}
      />

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

function getProfileUserId(profile: any): string | undefined {
  return profile?.user_id || profile?.user?.id || profile?.userId;
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
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: IS_COMPACT_DATING_SCREEN ? 10 : 14,
      paddingVertical: IS_COMPACT_DATING_SCREEN ? 7 : 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.primary,
      minHeight: IS_COMPACT_DATING_SCREEN ? 48 : 62,
    },
    headerBrand: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: IS_COMPACT_DATING_SCREEN ? 7 : 10,
      minWidth: 0,
    },
    headerBrandIcon: {
      width: IS_COMPACT_DATING_SCREEN ? 30 : 38,
      height: IS_COMPACT_DATING_SCREEN ? 30 : 38,
      borderRadius: IS_COMPACT_DATING_SCREEN ? 15 : 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '12',
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    headerLeft: {
      width: IS_COMPACT_DATING_SCREEN ? 32 : 44,
      alignItems: 'flex-start',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8, // Add padding to prevent overlap
    },
    headerRight: {
      minWidth: IS_COMPACT_DATING_SCREEN ? 132 : 180,
      alignItems: 'flex-end',
    },
    headerRightActions: {
      flexDirection: 'row',
      gap: IS_COMPACT_DATING_SCREEN ? 4 : 7,
    },
    headerTitle: {
      fontSize: IS_COMPACT_DATING_SCREEN ? 17 : 24,
      fontWeight: '900',
      color: colors.text.primary,
      letterSpacing: 0,
    },
    headerSubtitle: {
      fontSize: IS_COMPACT_DATING_SCREEN ? 10 : 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginTop: 1,
    },
    headerIconButton: {
      width: IS_COMPACT_DATING_SCREEN ? 30 : 38,
      height: IS_COMPACT_DATING_SCREEN ? 30 : 38,
      borderRadius: IS_COMPACT_DATING_SCREEN ? 15 : 19,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    headerButton: {
      padding: 4,
    },
    cardStackContainer: {
      height: DATING_CARD_HEIGHT + (IS_COMPACT_DATING_SCREEN ? 8 : 16),
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingHorizontal: IS_COMPACT_DATING_SCREEN ? 12 : 16,
      paddingTop: IS_COMPACT_DATING_SCREEN ? 4 : 8,
      paddingBottom: 0,
      overflow: 'hidden',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
      paddingVertical: 24,
      gap: 18,
      backgroundColor: colors.background.primary,
    },
    emptyIconBadge: {
      width: 92,
      height: 92,
      borderRadius: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '35',
    },
    iconContainer: {
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: IS_COMPACT_DATING_SCREEN ? 22 : 28,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: IS_COMPACT_DATING_SCREEN ? 14 : 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 40,
      paddingVertical: 16,
      borderRadius: 16,
      marginTop: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    emptyActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    resetPassedButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    secondaryButtonText: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: IS_COMPACT_DATING_SCREEN ? 8 : 12,
      paddingTop: IS_COMPACT_DATING_SCREEN ? 4 : 6,
      paddingBottom: IS_COMPACT_DATING_SCREEN ? 8 : 12,
      paddingHorizontal: IS_COMPACT_DATING_SCREEN ? 10 : 20,
      backgroundColor: colors.background.primary,
      zIndex: 10,
      position: 'relative',
    },
    actionButton: {
      width: IS_COMPACT_DATING_SCREEN ? 36 : 52,
      height: IS_COMPACT_DATING_SCREEN ? 36 : 52,
      borderRadius: IS_COMPACT_DATING_SCREEN ? 18 : 26,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    rewindButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    passButton: {
      backgroundColor: colors.danger,
      width: IS_COMPACT_DATING_SCREEN ? 42 : 62,
      height: IS_COMPACT_DATING_SCREEN ? 42 : 62,
      borderRadius: IS_COMPACT_DATING_SCREEN ? 21 : 31,
    },
    superLikeButton: {
      backgroundColor: colors.primary,
      width: IS_COMPACT_DATING_SCREEN ? 48 : 68,
      height: IS_COMPACT_DATING_SCREEN ? 48 : 68,
      borderRadius: IS_COMPACT_DATING_SCREEN ? 24 : 34,
    },
    likeButton: {
      backgroundColor: colors.success,
      width: IS_COMPACT_DATING_SCREEN ? 42 : 62,
      height: IS_COMPACT_DATING_SCREEN ? 42 : 62,
      borderRadius: IS_COMPACT_DATING_SCREEN ? 21 : 31,
    },
    actionButtonInner: {
      width: '100%',
      height: '100%',
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtonDisabled: {
      opacity: 0.4,
    },
    boostButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: IS_COMPACT_DATING_SCREEN ? 5 : 8,
      paddingHorizontal: 16,
      backgroundColor: colors.background.secondary,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    premiumText: {
      fontSize: IS_COMPACT_DATING_SCREEN ? 11 : 14,
      fontWeight: '600',
      color: colors.accent,
    },
  });
