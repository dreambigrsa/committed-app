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
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, X, Star, Settings, Users, Sparkles, Zap, RotateCcw, Crown, Sliders, RefreshCw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as DatingService from '@/lib/dating-service';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import DatingSwipeCard from '@/components/DatingSwipeCard';
import MatchCelebrationModal from '@/components/MatchCelebrationModal';
import PremiumModal from '@/components/PremiumModal';
import { DatingDiscoveryUser } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_VISIBLE_CARDS = 3;

export default function DatingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedProfiles, setSwipedProfiles] = useState<Set<string>>(new Set());
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState<{ name?: string; description?: string }>({});
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [userProfile, setUserProfile] = useState<any>(null);
  const [discovery, setDiscovery] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDatingData = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profile = await DatingService.getDatingProfile().catch((err) => {
        console.log('Profile check error:', err);
        return null;
      });
      
      console.log('Profile loaded:', profile ? 'Found' : 'Not found');
      setUserProfile(profile);

      if (profile && profile.id) {
        // Only load discovery if profile exists
        try {
          // First try without including passed profiles
          let discoveryData = await DatingService.getDatingDiscovery();
          
          // If no profiles found, try including passed profiles
          if (!discoveryData.profiles || discoveryData.profiles.length === 0) {
            console.log('No new profiles found, loading passed profiles...');
            discoveryData = await DatingService.getDatingDiscovery({ includePassed: true });
          }
          
          console.log('Discovery loaded:', discoveryData.profiles?.length || 0, 'profiles');
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
          console.error('Error loading discovery:', discoveryError);
          setDiscovery([]);
        }
      } else {
        console.log('No profile found, showing setup screen');
        setDiscovery([]);
      }
    } catch (error: any) {
      console.error('Error loading dating data:', error);
      setUserProfile(null);
      setDiscovery([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    loadDatingData();
  }, [currentUser]);

  // Reload when screen comes into focus (e.g., after creating profile)
  useFocusEffect(
    React.useCallback(() => {
      loadDatingData();
    }, [currentUser])
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
              setShowMatchModal(true);
            } catch (error) {
              console.error('Error loading matched user info:', error);
              // Still show modal with basic info
              setMatchedUser({
                id: matchedUserId,
                name: 'Someone',
                photo: undefined,
              });
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
        setShowMatchModal(true);
        // Don't advance card yet - let user see the match
      } else {
        handleSwipeComplete();
      }
    } catch (error: any) {
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
      Alert.alert('Error', error.message || 'Failed to pass user');
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSwipeComplete = () => {
    setCurrentIndex((prev) => prev + 1);
  };

  const handleSwipeLeft = (profile: any) => {
    const userId = (profile as any).user_id || profile.user?.id || profile.userId;
    if (swipedProfiles.has(userId)) return;
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    handlePass(userId);
  };

  const handleSwipeRight = (profile: any) => {
    const userId = (profile as any).user_id || profile.user?.id || profile.userId;
    if (swipedProfiles.has(userId)) return;
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    handleLike(userId, false);
  };

  const handleSuperLike = (profile: any) => {
    const userId = (profile as any).user_id || profile.user?.id || profile.userId;
    if (swipedProfiles.has(userId)) return;
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    handleLike(userId, true);
  };

  const handleRefresh = async () => {
    // Reset state and reload discovery profiles
    setCurrentIndex(0);
    setSwipedProfiles(new Set());
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/dating/matches')} style={styles.headerButton}>
              <Users size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/dating/filters')} style={styles.headerButton}>
              <Sliders size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/dating/profile-setup')} style={styles.headerButton}>
              <Settings size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Sparkles size={64} color={colors.text.tertiary} />
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

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.push('/dating/matches')} style={styles.headerIconButton}>
              <Users size={26} color={colors.text.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Discover</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerRightActions}>
              <TouchableOpacity 
                onPress={handleRefresh}
                style={styles.headerIconButton}
                disabled={isLoading}
              >
                <RefreshCw size={24} color={isLoading ? colors.text.tertiary : colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => router.push('/dating/likes-received')} 
                style={styles.headerIconButton}
              >
                <Heart size={24} color={colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/dating/filters')} style={styles.headerIconButton}>
                <Sliders size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/dating/profile-setup')} style={styles.headerIconButton}>
                <Settings size={26} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

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
              <RotateCcw size={24} color={currentIndex === 0 ? colors.text.tertiary : colors.text.primary} />
            </View>
          </TouchableOpacity>

          {/* Pass */}
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => visibleProfiles[0] && handleSwipeLeft(visibleProfiles[0])}
            disabled={false}
          >
            <X size={32} color="#FFFFFF" strokeWidth={3} />
          </TouchableOpacity>

          {/* Super Like */}
          <TouchableOpacity
            style={[styles.actionButton, styles.superLikeButton]}
            onPress={() => visibleProfiles[0] && handleSuperLike(visibleProfiles[0])}
            disabled={false}
          >
            <Star size={28} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>

          {/* Like */}
          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => visibleProfiles[0] && handleSwipeRight(visibleProfiles[0])}
            disabled={false}
          >
            <Heart size={32} color="#FFFFFF" fill="#FFFFFF" />
          </TouchableOpacity>

          {/* Boost (Premium) */}
          <TouchableOpacity
            style={[styles.actionButton, styles.boostButton]}
            onPress={handleBoost}
          >
            <Zap size={24} color={colors.accent} fill={colors.accent} />
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
          handleSwipeComplete();
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
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.primary,
      minHeight: 56,
    },
    headerLeft: {
      width: 44,
      alignItems: 'flex-start',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 8, // Add padding to prevent overlap
    },
    headerRight: {
      minWidth: 180, // Increased to fit all buttons
      alignItems: 'flex-end',
    },
    headerRightActions: {
      flexDirection: 'row',
      gap: 6, // Reduced gap to fit more buttons
    },
    headerTitle: {
      fontSize: 28, // Slightly smaller to fit better
      fontWeight: 'bold',
      color: colors.text.primary,
      letterSpacing: -0.5,
    },
    headerIconButton: {
      width: 40, // Slightly smaller buttons
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    headerButton: {
      padding: 4,
    },
    cardStackContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 160,
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
      paddingHorizontal: 40,
      gap: 20,
    },
    iconContainer: {
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
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
      gap: 12,
      paddingVertical: 24,
      paddingBottom: 32,
      paddingHorizontal: 20,
      backgroundColor: colors.background.primary,
      zIndex: 10,
      position: 'relative',
    },
    actionButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
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
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    superLikeButton: {
      backgroundColor: colors.primary,
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    likeButton: {
      backgroundColor: colors.success,
      width: 64,
      height: 64,
      borderRadius: 32,
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
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.background.secondary,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    premiumText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
  });
