import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { Heart, X, Star, Settings, Users, Sparkles, Zap, RotateCcw, Crown } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import * as DatingService from '@/lib/dating-service';
import { useApp } from '@/contexts/AppContext';
import DatingSwipeCard from '@/components/DatingSwipeCard';
import MatchCelebrationModal from '@/components/MatchCelebrationModal';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Get discovery feed
  const { data: discovery, isLoading, refetch } = trpc.dating.getDiscovery.useQuery(
    { limit: 50 },
    { enabled: !!currentUser }
  );

  // Get user's dating profile
  const { data: userProfile } = trpc.dating.getProfile.useQuery(undefined, {
    enabled: !!currentUser,
  });

  // Get subscription status (for premium features)
  const { data: subscription } = trpc.dating.getProfile.useQuery(undefined, {
    enabled: !!currentUser,
    select: (data) => data, // Will check subscription later
  });

  // Mutations
  const likeMutation = trpc.dating.likeUser.useMutation({
    onSuccess: (data, variables) => {
      if (data.isMatch) {
        // Show match celebration modal
        const matchedProfile = discovery?.find((p: any) => {
          const userId = p.user_id || p.userId;
          return userId === variables.likedUserId;
        });
        
        if (matchedProfile) {
          const photos = matchedProfile.photos || [];
          setMatchedUser({
            name: matchedProfile.full_name || matchedProfile.fullName || 'Someone',
            photo: photos[0]?.photo_url || photos[0]?.photoUrl || matchedProfile.profile_picture || matchedProfile.profilePicture,
          });
        } else {
          setMatchedUser({
            name: 'Someone',
            photo: undefined,
          });
        }
        setShowMatchModal(true);
        // Don't advance card yet - let user see the match
      } else {
        handleSwipeComplete();
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
      // Don't advance if error
    },
  });

  const passMutation = trpc.dating.passUser.useMutation({
    onSuccess: () => {
      handleSwipeComplete();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

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
    const userId = (profile as any).user_id || profile.userId;
    if (swipedProfiles.has(userId)) return;
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    passMutation.mutate({ passedUserId: userId });
  };

  const handleSwipeRight = (profile: any) => {
    const userId = (profile as any).user_id || profile.userId;
    if (swipedProfiles.has(userId)) return;
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    likeMutation.mutate({
      likedUserId: userId,
      isSuperLike: false,
    });
  };

  const handleSuperLike = (profile: any) => {
    const userId = (profile as any).user_id || profile.userId;
    if (swipedProfiles.has(userId)) return;
    setSwipedProfiles((prev) => new Set(prev).add(userId));
    likeMutation.mutate({
      likedUserId: userId,
      isSuperLike: true,
    });
  };

  const handleRewind = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      // Remove from swiped set
      if (discovery && discovery[currentIndex - 1]) {
        setSwipedProfiles((prev) => {
          const newSet = new Set(prev);
          const userId = (discovery[currentIndex - 1] as any).user_id || discovery[currentIndex - 1].userId;
          newSet.delete(userId);
          return newSet;
        });
      }
    } else {
      Alert.alert('No More to Rewind', 'You\'re at the beginning!');
    }
  };

  const handleBoost = () => {
    Alert.alert('Boost Profile', 'Boost your profile to be seen by more people!', [
      { text: 'Upgrade to Premium', onPress: () => router.push('/dating/premium') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleViewPhotoGallery = (profile: any) => {
    const photos = profile.photos || [];
    if (photos.length > 0) {
      router.push({
        pathname: '/dating/photo-gallery',
        params: {
          photos: JSON.stringify(photos),
          userName: profile.full_name || profile.fullName,
          userAge: (profile.age || profile.age)?.toString(),
        },
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

  if (!discovery || discovery.length === 0 || currentIndex >= discovery.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/dating/matches')} style={styles.headerButton}>
              <Users size={24} color={colors.text.primary} />
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
            You've seen everyone in your area. Check back later for new people or adjust your preferences!
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setCurrentIndex(0);
              setSwipedProfiles(new Set());
              refetch();
            }}
          >
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </TouchableOpacity>
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
                onPress={() => router.push('/dating/likes-received')} 
                style={styles.headerIconButton}
              >
                <Heart size={24} color={colors.danger} />
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
            return (
              <DatingSwipeCard
                key={userId}
                profile={profile}
                onSwipeLeft={() => handleSwipeLeft(profile)}
                onSwipeRight={() => handleSwipeRight(profile)}
                onSuperLike={() => handleSuperLike(profile)}
                onTap={() => handleViewPhotoGallery(profile)}
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
            style={[styles.actionButton, styles.rewindButton]}
            onPress={handleRewind}
            disabled={currentIndex === 0 || likeMutation.isPending || passMutation.isPending}
          >
            <RotateCcw size={24} color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Pass */}
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => visibleProfiles[0] && handleSwipeLeft(visibleProfiles[0])}
            disabled={likeMutation.isPending || passMutation.isPending}
          >
            <X size={32} color={colors.danger} strokeWidth={3} />
          </TouchableOpacity>

          {/* Super Like */}
          <TouchableOpacity
            style={[styles.actionButton, styles.superLikeButton]}
            onPress={() => visibleProfiles[0] && handleSuperLike(visibleProfiles[0])}
            disabled={likeMutation.isPending || passMutation.isPending}
          >
            <Star size={28} color={colors.primary} fill={colors.primary} />
          </TouchableOpacity>

          {/* Like */}
          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => visibleProfiles[0] && handleSwipeRight(visibleProfiles[0])}
            disabled={likeMutation.isPending || passMutation.isPending}
          >
            <Heart size={32} color={colors.success} fill={colors.success} />
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
        matchedUserName={matchedUser?.name || 'Someone'}
        matchedUserPhoto={matchedUser?.photo}
        currentUserPhoto={currentUser?.profilePicture}
        onClose={() => {
          setShowMatchModal(false);
          handleSwipeComplete();
        }}
        onSendMessage={() => {
          setShowMatchModal(false);
          router.push('/dating/matches');
        }}
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
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.primary,
    },
    headerLeft: {
      width: 50,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerRight: {
      width: 100,
      alignItems: 'flex-end',
    },
    headerRightActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text.primary,
      letterSpacing: -0.5,
    },
    headerIconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
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
    secondaryButton: {
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 14,
      marginTop: 8,
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
      backgroundColor: '#fff',
      borderWidth: 3,
      borderColor: colors.danger,
      width: 64,
      height: 64,
      borderRadius: 32,
    },
    superLikeButton: {
      backgroundColor: '#fff',
      borderWidth: 3,
      borderColor: colors.primary,
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    likeButton: {
      backgroundColor: colors.success,
      width: 64,
      height: 64,
      borderRadius: 32,
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
