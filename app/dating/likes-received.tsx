import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Heart, Sparkles, Crown, ArrowLeft, Lock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as DatingService from '@/lib/dating-service';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import PremiumModal from '@/components/PremiumModal';

export default function LikesReceivedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [likes, setLikes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const loadLikes = async () => {
    try {
      setIsLoading(true);
      setShowPremiumModal(false); // Reset modal state
      
      // Check premium status
      const premiumStatus = await DatingService.checkPremiumSubscription();
      setIsPremium(premiumStatus);
      
      const data = await DatingService.getLikesReceived();
      setLikes(data || []);
    } catch (error: any) {
      // Check if error is about premium subscription
      const isPremiumError = error?.message?.includes('Premium subscription required') || 
                             error?.message?.includes('premium subscription') ||
                             error?.message?.toLowerCase().includes('premium');
      
      if (isPremiumError) {
        // Don't log premium errors to console, just show the modal immediately
        setShowPremiumModal(true);
        setLikes([]);
      } else {
        // Only log non-premium errors
        console.error('Error loading likes:', error);
        setLikes([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadLikes();
    }, [])
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Likes', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading likes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!likes || likes.length === 0) {
    // If premium modal should show, don't show empty state
    if (showPremiumModal) {
      return (
        <SafeAreaView style={styles.container}>
          <Stack.Screen options={{ title: 'Likes', headerShown: true }} />
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Crown size={80} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>Premium Feature</Text>
            <Text style={styles.emptyText}>
              Upgrade to Premium to see who liked you!
            </Text>
          </View>
          <PremiumModal
            visible={showPremiumModal}
            onClose={() => setShowPremiumModal(false)}
            featureName="See Who Liked You"
            featureDescription="View all profiles that have liked you with Premium"
          />
        </SafeAreaView>
      );
    }
    
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Likes', headerShown: true }} />
        <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
          <View style={styles.emptyIconContainer}>
            <Heart size={80} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>No Likes Yet</Text>
          <Text style={styles.emptyText}>
            Keep swiping! When someone likes you, they'll appear here.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Start Swiping</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const blurredCount = likes.filter(l => l.isBlurred).length;

  const renderLike = ({ item, index }: { item: any; index: number }) => {
    const liker = item.liker;
    const photo = item.primaryPhoto || liker?.profile_picture;
    const isBlurred = item.isBlurred || !isPremium;
    const displayName = isBlurred ? 'Someone' : (liker?.full_name || 'Unknown');

    return (
      <Animated.View
        style={[
          styles.likeCard,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.likeContent}
          onPress={() => {
            if (isBlurred) {
              // Show premium modal instead of navigating
              setShowPremiumModal(true);
            } else if (isPremium && liker?.id) {
              // Navigate to their profile (only if premium)
              router.push({
                pathname: '/dating/user-profile',
                params: { userId: liker.id },
              } as any);
            }
          }}
          activeOpacity={isBlurred ? 0.7 : 0.9}
          disabled={false}
        >
          <View style={styles.likePhotoContainer}>
            <ExpoImage
              source={{ uri: photo }}
              style={styles.likePhoto}
              contentFit="cover"
            />
            {isBlurred && (
              <BlurView
                intensity={80}
                style={StyleSheet.absoluteFill}
                tint="dark"
              />
            )}
            <View style={styles.likeBadge}>
              <Heart size={16} color={colors.danger} fill={colors.danger} />
            </View>
            {isBlurred && (
              <View style={styles.premiumLockBadge}>
                <Lock size={20} color={colors.accent} fill={colors.accent} />
              </View>
            )}
          </View>
          
          <View style={styles.likeInfo}>
            <View style={styles.likeHeader}>
              <Text style={[styles.likeName, isBlurred && styles.blurredText]}>
                {displayName}
              </Text>
              {item.is_super_like && !isBlurred && (
                <View style={styles.superLikeBadge}>
                  <Sparkles size={16} color={colors.primary} fill={colors.primary} />
                </View>
              )}
            </View>
            <Text style={[styles.likeDate, isBlurred && styles.blurredText]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            {liker?.phone_verified && !isBlurred && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ Verified</Text>
              </View>
            )}
            {isBlurred && (
              <View style={styles.premiumPromptBadge}>
                <Crown size={12} color={colors.accent} fill={colors.accent} />
                <Text style={styles.premiumPromptText}>Tap to unlock</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.likeBackButton, isBlurred && styles.likeBackButtonDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              if (isBlurred) {
                setShowPremiumModal(true);
              } else {
                // Like them back
                router.push('/(tabs)/dating' as any);
              }
            }}
            disabled={isBlurred}
          >
            <Heart size={24} color={isBlurred ? colors.text.tertiary : colors.success} fill={isBlurred ? 'transparent' : colors.success} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Likes',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background.primary,
          },
          headerTintColor: colors.text.primary,
        }} 
      />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.headerSection}>
          <View style={styles.premiumBanner}>
            <Crown size={20} color={colors.accent} fill={colors.accent} />
            <Text style={styles.premiumText}>Premium Feature</Text>
          </View>
          <Text style={styles.headerTitle}>People Who Liked You</Text>
          <Text style={styles.headerSubtitle}>
            {isPremium 
              ? `${likes.length} ${likes.length === 1 ? 'like' : 'likes'}`
              : blurredCount > 0 
                ? `${blurredCount} ${blurredCount === 1 ? 'like' : 'likes'} - Upgrade to see who`
                : '0 likes'
            }
          </Text>
        </View>
        
        <FlatList
          data={likes}
          renderItem={renderLike}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      <PremiumModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        featureName="See Who Liked You"
        featureDescription="View all profiles that have liked you with Premium"
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
    headerSection: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    premiumBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: colors.accent + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginBottom: 12,
    },
    premiumText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.accent,
      letterSpacing: 0.5,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '500',
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
    emptyIconContainer: {
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
    listContent: {
      padding: 20,
      paddingTop: 16,
    },
    likeCard: {
      marginBottom: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    likeContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    likePhotoContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      overflow: 'hidden',
      marginRight: 16,
      position: 'relative',
      borderWidth: 3,
      borderColor: colors.danger + '30',
    },
    likePhoto: {
      width: '100%',
      height: '100%',
    },
    likeBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    likeInfo: {
      flex: 1,
    },
    likeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    likeName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    superLikeBadge: {
      opacity: 0.7,
    },
    likeDate: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 8,
    },
    verifiedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.badge.verified,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    verifiedText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.badge.verifiedText,
    },
    likeBackButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.success + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    likeBackButtonDisabled: {
      backgroundColor: colors.border.light,
      opacity: 0.5,
    },
    blurredText: {
      opacity: 0.6,
    },
    premiumLockBadge: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginTop: -20,
      marginLeft: -20,
      width: 40,
      height: 40,
      backgroundColor: colors.background.primary + 'DD',
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 10,
    },
    premiumPromptBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      backgroundColor: colors.accent + '20',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.accent + '40',
    },
    premiumPromptText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      letterSpacing: 0.5,
    },
  });

