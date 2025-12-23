import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Crown, X, Sparkles, Heart, Star, RotateCcw, Zap, Shield } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useRouter } from 'expo-router';

interface PremiumModalProps {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
  featureDescription?: string;
}

const premiumFeatures = [
  { icon: Heart, title: 'See Who Liked You', description: 'View all profiles that liked you' },
  { icon: Star, title: 'Unlimited Super Likes', description: 'Stand out with unlimited super likes' },
  { icon: RotateCcw, title: 'Unlimited Rewinds', description: 'Go back and swipe again' },
  { icon: Zap, title: 'Boost Your Profile', description: 'Get 10x more profile views' },
  { icon: Sparkles, title: 'Priority Likes', description: 'Your likes appear first' },
  { icon: Shield, title: 'Advanced Filters', description: 'Filter by education, job, and more' },
];

export default function PremiumModal({
  visible,
  onClose,
  featureName,
  featureDescription,
}: PremiumModalProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = createStyles(colors);

  const handleGoPremium = () => {
    onClose();
    router.push('/dating/premium');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Hero Section with Gradient */}
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD']}
            style={styles.heroSection}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroContent}>
              <View style={styles.crownContainer}>
                <Crown size={56} color="#FFFFFF" fill="#FFFFFF" />
              </View>
              <Text style={styles.heroTitle}>Premium Feature</Text>
              {featureName && (
                <Text style={styles.featureName}>{featureName}</Text>
              )}
              {featureDescription && (
                <Text style={styles.heroSubtitle}>{featureDescription}</Text>
              )}
              {!featureDescription && (
                <Text style={styles.heroSubtitle}>
                  Upgrade to Premium to unlock this exclusive feature
                </Text>
              )}
            </View>
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Premium Features List */}
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>All Premium Features</Text>
              {premiumFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureIconContainer}>
                      <Icon size={20} color={colors.primary} />
                    </View>
                    <View style={styles.featureTextContainer}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* CTA Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.premiumButton}
                onPress={handleGoPremium}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primary + 'DD']}
                  style={styles.premiumButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Crown size={20} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.premiumButtonText}>Go Premium</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '90%',
      maxWidth: 400,
      maxHeight: '85%',
      backgroundColor: colors.background.primary,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    closeButton: {
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroSection: {
      paddingTop: 40,
      paddingBottom: 32,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    heroContent: {
      alignItems: 'center',
    },
    crownContainer: {
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 8,
      textAlign: 'center',
    },
    featureName: {
      fontSize: 20,
      fontWeight: '600',
      color: '#FFFFFF',
      marginBottom: 8,
      textAlign: 'center',
      opacity: 0.95,
    },
    heroSubtitle: {
      fontSize: 16,
      color: '#FFFFFF',
      textAlign: 'center',
      opacity: 0.9,
      lineHeight: 22,
    },
    content: {
      flex: 1,
    },
    featuresSection: {
      padding: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 16,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    featureIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    featureTextContainer: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 13,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    buttonContainer: {
      padding: 24,
      paddingTop: 0,
    },
    premiumButton: {
      marginBottom: 12,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    premiumButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 8,
    },
    premiumButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cancelButton: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
  });

