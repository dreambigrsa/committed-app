import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TextInput,
  Alert,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { X, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/contexts/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchCelebrationModalProps {
  visible: boolean;
  matchedUserId: string;
  matchedUserName: string;
  matchedUserPhoto?: string;
  currentUserPhoto?: string;
  onClose: () => void;
  onMessageSent?: () => void;
}

export default function MatchCelebrationModal({
  visible,
  matchedUserId,
  matchedUserName,
  matchedUserPhoto,
  currentUserPhoto,
  onClose,
  onMessageSent,
}: MatchCelebrationModalProps) {
  const { colors } = useTheme();
  const { currentUser, createOrGetConversation, sendMessage } = useApp();
  const styles = createStyles(colors);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const heartRotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations and message text
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      heartScaleAnim.setValue(0);
      heartRotateAnim.setValue(0);
      setMessageText('');

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

  const handleSendMessage = async (message?: string) => {
    if (!currentUser || isSending) return;
    
    const finalMessage = message || messageText.trim();
    if (!finalMessage && !message) return; // Only allow empty if it's a quick reaction

    setIsSending(true);
    try {
      // Create or get conversation
      const conversation = await createOrGetConversation(matchedUserId);
      if (!conversation) {
        Alert.alert('Error', 'Could not create conversation');
        setIsSending(false);
        return;
      }

      // Send message
      await sendMessage(
        conversation.id,
        matchedUserId,
        finalMessage,
        undefined, // mediaUrl
        undefined, // documentUrl
        undefined, // documentName
        'text', // messageType
        undefined, // stickerId
        undefined, // statusId
        undefined // statusPreviewUrl
      );

      // Clear input and close modal
      setMessageText('');
      setIsSending(false);
      onMessageSent?.();
      onClose();
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
      setIsSending(false);
    }
  };

  const handleQuickReaction = (emoji: string) => {
    handleSendMessage(emoji);
  };

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

          {/* Sparkle Icons */}
          <View style={styles.sparkleContainer}>
            <Sparkles size={20} color="#fff" fill="#fff" />
            <Sparkles size={20} color="#fff" fill="#fff" />
          </View>

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
            <View style={styles.matchTextContainer}>
              <Text style={styles.matchTextSmall}>IT'S A</Text>
              <Text style={styles.matchText}>Match</Text>
            </View>
            <Text style={styles.matchSubtext}>
              You matched with {matchedUserName}
            </Text>
          </Animated.View>

          {/* Message Input Section */}
          <Animated.View
            style={[
              styles.inputContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: scaleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }) }],
              },
            ]}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.messageInput}
                placeholder="Say something nice"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={messageText}
                onChangeText={setMessageText}
                multiline={false}
                editable={!isSending}
                autoFocus={false}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
                onPress={() => handleSendMessage()}
                disabled={!messageText.trim() || isSending}
              >
                <Text style={styles.sendButtonText}>SEND</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Reactions */}
            <View style={styles.quickReactions}>
              <TouchableOpacity 
                style={styles.reactionButton}
                onPress={() => handleQuickReaction('👋')}
                disabled={isSending}
              >
                <Text style={styles.reactionEmoji}>👋</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reactionButton}
                onPress={() => handleQuickReaction('😉')}
                disabled={isSending}
              >
                <Text style={styles.reactionEmoji}>😉</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reactionButton}
                onPress={() => handleQuickReaction('❤️')}
                disabled={isSending}
              >
                <Text style={styles.reactionEmoji}>❤️</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.reactionButton}
                onPress={() => handleQuickReaction('😍')}
                disabled={isSending}
              >
                <Text style={styles.reactionEmoji}>😍</Text>
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
    sparkleContainer: {
      position: 'absolute',
      top: 50,
      right: 70,
      flexDirection: 'row',
      gap: 8,
      zIndex: 10,
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
    matchTextContainer: {
      alignItems: 'center',
      marginBottom: 8,
    },
    matchTextSmall: {
      fontSize: 28,
      fontWeight: '700',
      color: '#fff',
      letterSpacing: 2,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    matchText: {
      fontSize: 56,
      fontWeight: '900',
      color: '#fff',
      letterSpacing: 2,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 4 },
      textShadowRadius: 8,
    },
    matchSubtext: {
      fontSize: 20,
      fontWeight: '600',
      color: '#fff',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    inputContainer: {
      width: '100%',
      maxWidth: 400,
      gap: 20,
      paddingHorizontal: 20,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 30,
      paddingHorizontal: 16,
      paddingVertical: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    messageInput: {
      flex: 1,
      fontSize: 16,
      color: '#000',
      paddingVertical: 12,
      paddingHorizontal: 8,
      minHeight: 44,
    },
    sendButton: {
      paddingVertical: 8,
      paddingHorizontal: 20,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#007AFF',
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

