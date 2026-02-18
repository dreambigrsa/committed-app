import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Shield, Heart } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LoadingScreenProps {
  visible?: boolean;
}

/**
 * Single full-screen splash: one container with theme background, logo animation only.
 * No navigation logic; receives theme from ThemeProvider.
 */
export default function LoadingScreen({ visible = true }: LoadingScreenProps) {
  const { colors } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;
  const logoFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.timing(logoFadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const heartAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 1.2,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heartScaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );

    pulseAnimation.start();
    rotateAnimation.start();
    heartAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotateAnimation.stop();
      heartAnimation.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoWrapper, { opacity: logoFadeAnim }]}>
      <View style={styles.logoContainer}>
        <Animated.View
          style={[
            styles.shieldContainer,
            {
              transform: [
                { scale: pulseAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        >
          <Shield size={80} color={colors.text.white} strokeWidth={2} />
        </Animated.View>
        <Animated.View
          style={[
            styles.heartBadge,
            {
              transform: [{ scale: heartScaleAnim }],
            },
          ]}
        >
          <Heart size={32} color={colors.danger} fill={colors.danger} />
        </Animated.View>
      </View>
    </Animated.View>
    </View>
  );
}

const createStyles = (colors: typeof import('@/constants/colors').default) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    shieldContainer: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    heartBadge: {
      position: 'absolute',
      bottom: -12,
      right: -12,
      backgroundColor: colors.background.primary,
      borderRadius: 24,
      padding: 10,
      borderWidth: 3,
      borderColor: colors.primary,
    },
  });

