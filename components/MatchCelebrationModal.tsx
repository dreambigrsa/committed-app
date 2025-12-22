import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MessageCircle, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchCelebrationModalProps {
  visible: boolean;
  matchedUserName: string;
  matchedUserPhoto?: string;
  currentUserPhoto?: string;
  onClose: () => void;
  onSendMessage: () => void;
}

export default function MatchCelebrationModal({
  visible,
  matchedUserName,
  matchedUserPhoto,
  currentUserPhoto,
  onClose,
  onSendMessage,
}: MatchCelebrationModalProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const heartRotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      heartScaleAnim.setValue(0);
      heartRotateAnim.setValue(0);

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(200),
          Animated.spring(heartScaleAnim, {
            toValue: 1,
            tension: 30,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.sequence([
              Animated.timing(heartRotateAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
              }),
              Animated.timing(heartRotateAnim, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: true,
              }),
            ])
          ),
        ]),
      ]).start();
    }
  }, [visible]);

  const heartRotation = heartRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#00E676', '#00C853', '#00E676']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Animated Hearts Background */}
          <Animated.View
            style={[
              styles.heartBackground,
              {
                opacity: fadeAnim,
                transform: [{ scale: heartScaleAnim }, { rotate: heartRotation }],
              },
            ]}
          >
            <Text style={styles.heartEmoji}>💚</Text>
          </Animated.View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>

          {/* Profile Pictures */}
          <Animated.View
            style={[
              styles.profilesContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.profileCircle}>
              {currentUserPhoto ? (
                <ExpoImage
                  source={{ uri: currentUserPhoto }}
                  style={styles.profileImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profileInitial}>You</Text>
                </View>
              )}
            </View>
            <View style={styles.profileCircle}>
              {matchedUserPhoto ? (
                <ExpoImage
                  source={{ uri: matchedUserPhoto }}
                  style={styles.profileImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profileInitial}>
                    {matchedUserName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Match Text */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Text style={styles.matchText}>IT'S A MATCH</Text>
            <Text style={styles.matchSubtext}>
              You matched with {matchedUserName}
            </Text>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            style={[
              styles.actionsContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }) }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.messageButton}
              onPress={onSendMessage}
            >
              <MessageCircle size={20} color="#fff" />
              <Text style={styles.messageButtonText}>Send a Message</Text>
            </TouchableOpacity>

            <View style={styles.quickReactions}>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionEmoji}>👋</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionEmoji}>😊</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionEmoji}>❤️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionButton}>
                <Text style={styles.reactionEmoji}>😉</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    gradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    heartBackground: {
      position: 'absolute',
      top: '10%',
      alignSelf: 'center',
    },
    heartEmoji: {
      fontSize: 120,
      opacity: 0.3,
    },
    closeButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    profilesContainer: {
      flexDirection: 'row',
      gap: 20,
      marginBottom: 30,
      marginTop: 40,
    },
    profileCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 6,
      borderColor: '#fff',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    profilePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInitial: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    textContainer: {
      alignItems: 'center',
      marginBottom: 40,
    },
    matchText: {
      fontSize: 48,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 8,
      marginBottom: 12,
    },
    matchSubtext: {
      fontSize: 20,
      fontWeight: '600',
      color: '#fff',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    actionsContainer: {
      width: '100%',
      maxWidth: 400,
      gap: 20,
    },
    messageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backgroundColor: '#fff',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    messageButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#00E676',
    },
    quickReactions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
    },
    reactionButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    reactionEmoji: {
      fontSize: 24,
    },
  });

