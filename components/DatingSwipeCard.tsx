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
const SWIPE_THRESHOLD = 50; // Lower threshold for easier swiping
const VELOCITY_THRESHOLD = 0.5; // Velocity threshold for quick swipes (pixels per ms)
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
  // Position must use JS driver (ValueXY doesn't support native driver)
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // These can use native driver
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(isTop ? 1 : 0.95)).current;
  const opacity = useRef(new Animated.Value(isTop ? 1 : 0.9)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const passOpacity = useRef(new Animated.Value(0)).current;
  const positionAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const rotateAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const isAnimatingRef = useRef(false);

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

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      stopAllAnimations();
      position.setValue({ x: 0, y: 0 });
      rotate.setValue(0);
      scale.setValue(1);
      opacity.setValue(1);
      likeOpacity.setValue(0);
      passOpacity.setValue(0);
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      // Don't capture on start - let taps pass through
      onStartShouldSetPanResponder: () => false,
      // Only capture when there's significant movement (swipe)
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (!isTop || isAnimatingRef.current) return false;
        // Only capture if there's significant horizontal movement (swipe)
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        if (isAnimatingRef.current) return;
        // Stop any ongoing animations before starting new gesture
        stopAllAnimations();
        position.setOffset({
          x: (position.x as any)._value || 0,
          y: (position.y as any)._value || 0,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (!isTop || isAnimatingRef.current) return;
        
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
        if (!isTop || isAnimatingRef.current) return;
        
        // Flatten offset first to get current position
        position.flattenOffset();
        
        // If it was just a small tap (no significant movement), don't handle it here
        // Let the TouchableOpacity handle the tap
        const absDx = Math.abs(gesture.dx);
        const absDy = Math.abs(gesture.dy);
        if (absDx < 10 && absDy < 10) {
          // Very small movement - likely a tap, reset and let TouchableOpacity handle it
          resetToCenter();
          return;
        }
        
        // Calculate velocity (pixels per millisecond)
        const velocityX = gesture.vx || (gesture.dx / (gesture.dt || 1));
        const absVelocity = Math.abs(velocityX);
        
        // Check if swipe meets threshold (distance OR velocity)
        const meetsDistanceThreshold = absDx > SWIPE_THRESHOLD;
        const meetsVelocityThreshold = absVelocity > VELOCITY_THRESHOLD && absDx > 20; // At least 20px movement with velocity
        
        if (meetsDistanceThreshold || meetsVelocityThreshold) {
          // Swipe detected - trigger action immediately
          if (gesture.dx > 0) {
            // Swipe right - Like
            handleSwipeRight();
          } else {
            // Swipe left - Pass
            handleSwipeLeft();
          }
        } else {
          // Return to center - no action needed
          resetToCenter();
        }
      },
    })
  ).current;

  const stopAllAnimations = () => {
    try {
      // Stop position animations (JS-driven)
      if (positionAnimRef.current) {
        positionAnimRef.current.stop();
        positionAnimRef.current = null;
      }
      position.stopAnimation(() => {
        // Callback to ensure it's stopped
      });
      
      // Stop rotate animations (native-driven)
      if (rotateAnimRef.current) {
        rotateAnimRef.current.stop();
        rotateAnimRef.current = null;
      }
      rotate.stopAnimation(() => {
        // Callback to ensure it's stopped
      });
      
      // Stop opacity animations (native-driven)
      likeOpacity.stopAnimation(() => {
        // Callback to ensure it's stopped
      });
      passOpacity.stopAnimation(() => {
        // Callback to ensure it's stopped
      });
      
      // Also stop scale and opacity if they're animating
      scale.stopAnimation();
      opacity.stopAnimation();
    } catch (error) {
      console.warn('Error stopping animations:', error);
      // Continue anyway
    }
  };

  const resetToCenter = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    
    stopAllAnimations();
    
    // Get current values before resetting
    const currentX = (position.x as any)._value || 0;
    const currentY = (position.y as any)._value || 0;
    const currentRotate = (rotate as any)._value || 0;
    
    // Use spring animation for smoother feel
    requestAnimationFrame(() => {
      try {
        // Animate position with spring for smooth return (JS-driven)
        positionAnimRef.current = Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          tension: 50,
          friction: 7,
          useNativeDriver: false,
        });
        
        // Animate rotate with spring (native-driven)
        rotateAnimRef.current = Animated.spring(rotate, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        });
        
        // Animate opacity (native-driven)
        const opacityAnim = Animated.parallel([
          Animated.timing(likeOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(passOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]);
        
        // Start position animation (JS driver)
        positionAnimRef.current.start((finished) => {
          if (finished) {
            positionAnimRef.current = null;
            isAnimatingRef.current = false;
          }
        });
        
        // Start rotate and opacity animations (native driver)
        rotateAnimRef.current.start((finished) => {
          if (finished) {
            rotateAnimRef.current = null;
          }
        });
        opacityAnim.start();
      } catch (error) {
        console.warn('Error creating reset animations:', error);
        isAnimatingRef.current = false;
      }
    });
  };

  const handleSwipeRight = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    
    stopAllAnimations();
    
    // Call the callback to trigger the like action immediately
    onSwipeRight();
    
    try {
      // Use fast timing animation for quick, smooth swipe (much faster than spring)
      positionAnimRef.current = Animated.timing(position, {
        toValue: { x: SCREEN_WIDTH + 100, y: 0 },
        duration: 200, // Fast 200ms animation
        useNativeDriver: false,
      });
      
      // Animate rotate (native-driven) - fast
      rotateAnimRef.current = Animated.timing(rotate, {
        toValue: 30,
        duration: 200,
        useNativeDriver: true,
      });
      
      // Animate opacity fade out for smooth exit
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Start position animation
      positionAnimRef.current.start((finished) => {
        if (finished) {
          positionAnimRef.current = null;
          resetCard();
          isAnimatingRef.current = false;
        }
      });
      
      // Start rotate animation
      rotateAnimRef.current.start((finished) => {
        if (finished) {
          rotateAnimRef.current = null;
        }
      });
    } catch (error) {
      console.warn('Error creating swipe animations:', error);
      isAnimatingRef.current = false;
    }
  };

  const handleSwipeLeft = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    
    stopAllAnimations();
    
    // Call the callback to trigger the pass action immediately
    onSwipeLeft();
    
    try {
      // Use fast timing animation for quick, smooth swipe (much faster than spring)
      positionAnimRef.current = Animated.timing(position, {
        toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
        duration: 200, // Fast 200ms animation
        useNativeDriver: false,
      });
      
      // Animate rotate (native-driven) - fast
      rotateAnimRef.current = Animated.timing(rotate, {
        toValue: -30,
        duration: 200,
        useNativeDriver: true,
      });
      
      // Animate opacity fade out for smooth exit
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // Start position animation
      positionAnimRef.current.start((finished) => {
        if (finished) {
          positionAnimRef.current = null;
          resetCard();
          isAnimatingRef.current = false;
        }
      });
      
      // Start rotate animation
      rotateAnimRef.current.start((finished) => {
        if (finished) {
          rotateAnimRef.current = null;
        }
      });
    } catch (error) {
      console.warn('Error creating swipe animations:', error);
      isAnimatingRef.current = false;
    }
  };

  const resetCard = () => {
    // Stop all animations before resetting to prevent conflicts
    stopAllAnimations();
    
    // Use setTimeout to ensure animations are fully stopped before resetting
    setTimeout(() => {
      try {
        position.setValue({ x: 0, y: 0 });
        // Only reset native-driven values if they're not in use
        if (!isAnimatingRef.current) {
          rotate.setValue(0);
          likeOpacity.setValue(0);
          passOpacity.setValue(0);
        }
        isAnimatingRef.current = false;
      } catch (error) {
        console.warn('Error resetting card:', error);
        isAnimatingRef.current = false;
      }
    }, 150); // Longer delay to ensure everything is stopped
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

