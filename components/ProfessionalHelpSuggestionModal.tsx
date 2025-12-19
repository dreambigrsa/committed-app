import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Heart, Shield, Sparkles, X, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

interface ProfessionalHelpSuggestionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  professionalType: string;
}

const { width } = Dimensions.get('window');

export default function ProfessionalHelpSuggestionModal({
  visible,
  onClose,
  onConfirm,
  professionalType,
}: ProfessionalHelpSuggestionModalProps) {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.9);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleConfirm = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onConfirm();
    });
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FA']}
            style={styles.gradientContainer}
          >
            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={themeColors.text.secondary} />
            </TouchableOpacity>

            {/* Icon Container with Animation */}
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <LinearGradient
                  colors={['#FF6B9D', '#FF8E9B', '#FFB3C1']}
                  style={styles.iconGradient}
                >
                  <Heart size={32} color="#FFFFFF" fill="#FFFFFF" />
                </LinearGradient>
                <View style={styles.sparkleContainer}>
                  <Sparkles size={16} color={themeColors.accent} style={styles.sparkle1} />
                  <Sparkles size={14} color={themeColors.secondary} style={styles.sparkle2} />
                </View>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>We're Here to Help</Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              Based on our conversation, I think speaking with a verified{' '}
              <Text style={styles.highlight}>{professionalType}</Text> might be helpful.
            </Text>

            {/* Benefits List */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <Shield size={18} color={themeColors.secondary} />
                <Text style={styles.benefitText}>Verified professionals</Text>
              </View>
              <View style={styles.benefitItem}>
                <Heart size={18} color={themeColors.danger} />
                <Text style={styles.benefitText}>Personalized support</Text>
              </View>
              <View style={styles.benefitItem}>
                <Sparkles size={18} color={themeColors.accent} />
                <Text style={styles.benefitText}>Available now</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Not Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[themeColors.primary, themeColors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>Yes, Connect Me</Text>
                  <ArrowRight size={18} color="#FFFFFF" style={styles.arrowIcon} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
      width: width * 0.9,
      maxWidth: 400,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
    gradientContainer: {
      padding: 24,
      borderRadius: 24,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContainer: {
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
    },
    iconGradient: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#FF6B9D',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    sparkleContainer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sparkle1: {
      position: 'absolute',
      top: -8,
      right: -8,
    },
    sparkle2: {
      position: 'absolute',
      bottom: -6,
      left: -6,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
      paddingHorizontal: 8,
    },
    highlight: {
      color: colors.primary,
      fontWeight: '600',
    },
    benefitsContainer: {
      marginBottom: 28,
      gap: 12,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    benefitText: {
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: '500',
      flex: 1,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    secondaryButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1.5,
      borderColor: colors.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    primaryButton: {
      flex: 1.5,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    primaryButtonGradient: {
      flexDirection: 'row',
      paddingVertical: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    arrowIcon: {
      marginLeft: 4,
    },
  });

