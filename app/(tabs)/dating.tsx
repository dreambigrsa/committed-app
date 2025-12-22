import React, { useState, useMemo, useEffect } from 'react';
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
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Heart, X, Star, MapPin, Shield, CheckCircle2, Settings, Users } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import { useApp } from '@/contexts/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.7;
const SWIPE_THRESHOLD = 120;

export default function DatingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [position] = useState(new Animated.ValueXY());

  // Get discovery feed
  const { data: discovery, isLoading, refetch } = trpc.dating.getDiscovery.useQuery(
    { limit: 20 },
    { enabled: !!currentUser }
  );

  // Get user's dating profile
  const { data: userProfile } = trpc.dating.getProfile.useQuery(undefined, {
    enabled: !!currentUser,
  });

  // Mutations
  const likeMutation = trpc.dating.likeUser.useMutation({
    onSuccess: (data) => {
      if (data.isMatch) {
        Alert.alert('🎉 It\'s a Match!', 'You both liked each other!', [
          { text: 'View Matches', onPress: () => router.push('/dating/matches') },
          { text: 'Continue', onPress: () => handleSwipeComplete() },
        ]);
      } else {
        handleSwipeComplete();
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
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
    if (discovery && discovery.length > 0 && currentIndex < discovery.length) {
      setProfile(discovery[currentIndex]);
    }
  }, [discovery, currentIndex]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, gesture) => {
          position.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > SWIPE_THRESHOLD) {
            // Swipe right - Like
            handleLike();
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            // Swipe left - Pass
            handlePass();
          } else {
            // Return to center
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [currentIndex]
  );

  const handleLike = () => {
    if (!profile) return;
    
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      likeMutation.mutate({
        likedUserId: profile.user_id,
        isSuperLike: false,
      });
    });
  };

  const handlePass = () => {
    if (!profile) return;
    
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      passMutation.mutate({
        passedUserId: profile.user_id,
      });
    });
  };

  const handleSwipeComplete = () => {
    position.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);
  };

  const rotateCard = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Check if user needs to create profile
  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Heart size={64} color={colors.primary} />
          <Text style={styles.emptyTitle}>Create Your Dating Profile</Text>
          <Text style={styles.emptyText}>
            Set up your dating profile to start discovering people near you!
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/dating/profile-setup')}
          >
            <Text style={styles.primaryButtonText}>Create Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finding matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!discovery || discovery.length === 0 || currentIndex >= discovery.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
          <TouchableOpacity onPress={() => router.push('/dating/matches')}>
            <Users size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Heart size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No More Profiles</Text>
          <Text style={styles.emptyText}>
            You've seen everyone in your area. Check back later for new people!
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setCurrentIndex(0);
              refetch();
            }}
          >
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const primaryPhoto = profile.photos?.[0]?.photo_url || profile.profile_picture;

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

      <View style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: rotateCard },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: primaryPhoto }}
              style={styles.photo}
              contentFit="cover"
            />
            <View style={styles.photoOverlay}>
              <View style={styles.verificationBadges}>
                {profile.phone_verified && (
                  <View style={styles.badge}>
                    <CheckCircle2 size={16} color={colors.success} />
                  </View>
                )}
                {profile.email_verified && (
                  <View style={styles.badge}>
                    <CheckCircle2 size={16} color={colors.success} />
                  </View>
                )}
                {profile.id_verified && (
                  <View style={styles.badge}>
                    <Shield size={16} color={colors.primary} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.full_name}</Text>
              {profile.age && <Text style={styles.age}>{profile.age}</Text>}
            </View>
            
            {profile.location_city && (
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.text.secondary} />
                <Text style={styles.location}>
                  {profile.location_city}
                  {profile.distance_km && ` • ${Math.round(profile.distance_km)} km away`}
                </Text>
              </View>
            )}

            {profile.bio && (
              <Text style={styles.bio} numberOfLines={3}>
                {profile.bio}
              </Text>
            )}

            {profile.interests && profile.interests.length > 0 && (
              <View style={styles.interestsContainer}>
                {profile.interests.slice(0, 5).map((interest: string, idx: number) => (
                  <View key={idx} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Overlay indicators */}
        <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]}>
          <Heart size={80} color={colors.success} fill={colors.success} />
        </Animated.View>
        <Animated.View style={[styles.passOverlay, { opacity: passOpacity }]}>
          <X size={80} color={colors.error} />
        </Animated.View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={handlePass}
          disabled={likeMutation.isPending || passMutation.isPending}
        >
          <X size={28} color={colors.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.superLikeButton]}
          onPress={() => {
            if (profile) {
              likeMutation.mutate({
                likedUserId: profile.user_id,
                isSuperLike: true,
              });
            }
          }}
          disabled={likeMutation.isPending || passMutation.isPending}
        >
          <Star size={24} color={colors.primary} fill={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={handleLike}
          disabled={likeMutation.isPending || passMutation.isPending}
        >
          <Heart size={28} color={colors.success} fill={colors.success} />
        </TouchableOpacity>
      </View>
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
    },
    headerButton: {
      padding: 4,
    },
    cardContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    photoContainer: {
      width: '100%',
      height: '70%',
      position: 'relative',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: 16,
    },
    verificationBadges: {
      flexDirection: 'row',
      gap: 8,
    },
    badge: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 4,
    },
    infoContainer: {
      flex: 1,
      padding: 20,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    name: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    age: {
      fontSize: 24,
      color: colors.text.secondary,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 12,
    },
    location: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    bio: {
      fontSize: 16,
      color: colors.text.primary,
      lineHeight: 22,
      marginBottom: 12,
    },
    interestsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    interestTag: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    interestText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    likeOverlay: {
      position: 'absolute',
      top: '40%',
      right: 40,
      transform: [{ rotate: '15deg' }],
    },
    passOverlay: {
      position: 'absolute',
      top: '40%',
      left: 40,
      transform: [{ rotate: '-15deg' }],
    },
    actionsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 20,
      paddingVertical: 24,
      paddingBottom: 40,
    },
    actionButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    passButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.error,
    },
    superLikeButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    likeButton: {
      backgroundColor: colors.success,
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
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      gap: 16,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    secondaryButtonText: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  });

