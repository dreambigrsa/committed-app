import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Shield, CheckCircle2, Heart, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.65; // Reduced from 0.75 to 0.65 to prevent content cutoff
const SWIPE_THRESHOLD = 100;
const ROTATION_MULTIPLIER = 0.1;

interface DatingSwipeCardProps {
  profile: any; // Flexible type to handle both snake_case and camelCase
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSuperLike: () => void;
  onTap: () => void;
  index: number;
  isTop: boolean;
}

export default function DatingSwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
  onTap,
  index,
  isTop,
}: DatingSwipeCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(isTop ? 1 : 0.95)).current;
  const opacity = useRef(new Animated.Value(isTop ? 1 : 0.9)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const passOpacity = useRef(new Animated.Value(0)).current;

  const photos = profile.photos || [];
  const currentPhoto = photos[currentPhotoIndex]?.photo_url || photos[currentPhotoIndex]?.photoUrl || profile.profile_picture || profile.profilePicture;

  useEffect(() => {
    if (isTop) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 0.95,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isTop]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: () => isTop,
      onPanResponderGrant: () => {
        position.setOffset({
          x: (position.x as any)._value,
          y: (position.y as any)._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (!isTop) return;
        
        position.setValue({ x: gesture.dx, y: gesture.dy });
        
        // Rotation based on horizontal movement
        const rotation = gesture.dx * ROTATION_MULTIPLIER;
        rotate.setValue(rotation);
        
        // Like/Pass overlay opacity
        if (gesture.dx > 0) {
          likeOpacity.setValue(Math.min(gesture.dx / SWIPE_THRESHOLD, 1));
          passOpacity.setValue(0);
        } else if (gesture.dx < 0) {
          passOpacity.setValue(Math.min(Math.abs(gesture.dx) / SWIPE_THRESHOLD, 1));
          likeOpacity.setValue(0);
        } else {
          likeOpacity.setValue(0);
          passOpacity.setValue(0);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (!isTop) return;
        
        position.flattenOffset();
        
        if (Math.abs(gesture.dx) > SWIPE_THRESHOLD) {
          // Swipe detected
          if (gesture.dx > 0) {
            // Swipe right - Like
            handleSwipeRight();
          } else {
            // Swipe left - Pass
            handleSwipeLeft();
          }
        } else {
          // Return to center - Stop any ongoing animations first
          position.stopAnimation();
          rotate.stopAnimation();
          likeOpacity.stopAnimation();
          passOpacity.stopAnimation();
          
          // Reset to current values before animating
          const currentPos = { x: (position.x as any)._value, y: (position.y as any)._value };
          position.setValue(currentPos);
          
          // Animate back to center - separate native and JS animations
          Animated.parallel([
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: false,
              tension: 50,
              friction: 7,
            }),
            Animated.spring(rotate, {
              toValue: 0,
              useNativeDriver: true,
              tension: 50,
              friction: 7,
            }),
          ]).start();
          
          // Animate opacity separately
          Animated.parallel([
            Animated.timing(likeOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(passOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  const handleSwipeRight = () => {
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x: SCREEN_WIDTH + 100, y: 0 },
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotate, {
        toValue: 30,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onSwipeRight();
      resetCard();
    });
  };

  const handleSwipeLeft = () => {
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(rotate, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onSwipeLeft();
      resetCard();
    });
  };

  const resetCard = () => {
    position.setValue({ x: 0, y: 0 });
    rotate.setValue(0);
    likeOpacity.setValue(0);
    passOpacity.setValue(0);
  };

  const rotateInterpolate = rotate.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const nextPhoto = () => {
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const prevPhoto = () => {
    if (photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate: rotateInterpolate },
            { scale },
          ],
          opacity,
          zIndex: isTop ? 1000 : 1000 - index,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Photo Gallery */}
      <TouchableOpacity
        style={styles.photoContainer}
        activeOpacity={0.9}
        onPress={onTap}
      >
        <ExpoImage
          source={{ uri: currentPhoto }}
          style={styles.photo}
          contentFit="cover"
          transition={200}
        />
        
        {/* Photo Indicators */}
        {photos.length > 1 && (
          <View style={styles.photoIndicators}>
            {photos.map((_: any, idx: number) => (
              <View
                key={idx}
                style={[
                  styles.indicator,
                  idx === currentPhotoIndex && styles.indicatorActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradientOverlay}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        {/* Top Info Overlay */}
        <View style={styles.topOverlay}>
          <View style={styles.verificationBadges}>
            {(profile.phone_verified || profile.phoneVerified) && (
              <View style={styles.badge}>
                <CheckCircle2 size={14} color={colors.success} />
              </View>
            )}
            {(profile.email_verified || profile.emailVerified) && (
              <View style={styles.badge}>
                <CheckCircle2 size={14} color={colors.success} />
              </View>
            )}
            {(profile.id_verified || profile.idVerified) && (
              <View style={styles.badge}>
                <Shield size={14} color={colors.primary} />
              </View>
            )}
          </View>
        </View>

        {/* Bottom Info Overlay */}
        <View style={styles.bottomOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.full_name || profile.fullName}</Text>
            {profile.age && <Text style={styles.age}>{profile.age}</Text>}
          </View>
          
          {(profile.location_city || profile.locationCity) && (
            <View style={styles.locationRow}>
              <MapPin size={12} color={colors.text.white} />
              <Text style={styles.location}>
                {profile.location_city || profile.locationCity}
                {(profile.distance_km || profile.distanceKm) && ` • ${Math.round(profile.distance_km || profile.distanceKm || 0)} km`}
              </Text>
            </View>
          )}

          {profile.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}

          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestsRow}>
              {profile.interests.slice(0, 4).map((interest: any, idx: number) => (
                <View key={idx} style={styles.interestChip}>
                  <Text style={styles.interestText}>{typeof interest === 'string' ? interest : interest.name || interest}</Text>
                </View>
              ))}
              {profile.interests.length > 4 && (
                <View style={styles.interestChip}>
                  <Text style={styles.interestText}>+{profile.interests.length - 4}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Swipe Indicators - Premium Design */}
        <Animated.View style={[styles.likeOverlay, { opacity: likeOpacity }]}>
          <View style={styles.likeBadge}>
            <LinearGradient
              colors={[colors.success, colors.success + 'DD']}
              style={styles.badgeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Heart size={32} color="#fff" fill="#fff" />
              <Text style={styles.likeText}>LIKE</Text>
            </LinearGradient>
          </View>
        </Animated.View>
        <Animated.View style={[styles.passOverlay, { opacity: passOpacity }]}>
          <View style={styles.passBadge}>
            <LinearGradient
              colors={[colors.danger, colors.danger + 'DD']}
              style={styles.badgeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <X size={32} color="#fff" strokeWidth={4} />
              <Text style={styles.passText}>NOPE</Text>
            </LinearGradient>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.background.secondary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    photoContainer: {
      width: '100%',
      height: '100%',
      position: 'relative',
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoIndicators: {
      position: 'absolute',
      top: 16,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      zIndex: 10,
    },
    indicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    indicatorActive: {
      backgroundColor: '#fff',
      width: 24,
    },
    gradientOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
    },
    topOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingTop: 40,
    },
    bottomOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      paddingBottom: 24,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    verificationBadges: {
      flexDirection: 'row',
      gap: 8,
      alignSelf: 'flex-end',
    },
    badge: {
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: 12,
      padding: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 6,
    },
    name: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#fff',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    age: {
      fontSize: 28,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.9)',
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    location: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.9)',
      fontWeight: '500',
    },
    bio: {
      fontSize: 16,
      color: '#fff',
      lineHeight: 22,
      marginBottom: 12,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    interestsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    interestChip: {
      backgroundColor: 'rgba(255, 255, 255, 0.25)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    interestText: {
      fontSize: 12,
      color: '#fff',
      fontWeight: '600',
    },
    likeOverlay: {
      position: 'absolute',
      top: '20%',
      left: 20,
      transform: [{ rotate: '-12deg' }],
      zIndex: 10,
    },
    likeBadge: {
      backgroundColor: '#FFE500', // Bright yellow like Tinder
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: '#00E676', // Green border
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 10,
    },
    likeText: {
      fontSize: 48,
      fontWeight: '900',
      color: '#00E676', // Green text
      letterSpacing: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 4,
    },
    passOverlay: {
      position: 'absolute',
      top: '20%',
      left: 20,
      transform: [{ rotate: '-12deg' }],
      zIndex: 10,
    },
    passBadge: {
      backgroundColor: '#FF1744', // Bright pink like Tinder
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 8,
      borderWidth: 4,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 10,
    },
    passText: {
      fontSize: 36,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 2,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    badgeGradient: {
      paddingHorizontal: 32,
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
  });

