import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Crown, X, Sparkles, Heart, Star, RotateCcw, Zap, Shield, MessageCircle } from 'lucide-react-native';
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
  const isMessagingLimit = featureName?.toLowerCase().includes('messaging');
  const isLikesFeature = featureName?.toLowerCase().includes('liked');

  const handleGoPremium = () => {
    onClose();
    router.push('/dating/premium' as any);
  };

  const handleKeepDating = () => {
    onClose();
    router.push('/(tabs)/dating' as any);
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
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <LinearGradient
            colors={['#FF4D7D', '#8B5CF6', '#1A73E8']}
            style={styles.heroSection}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.softOrbTop} />
            <View style={styles.softOrbBottom} />
            <View style={styles.heroContent}>
              <View style={styles.crownContainer}>
                <Crown size={42} color="#FFFFFF" fill="#FFFFFF" />
              </View>
              <Text style={styles.heroTitle}>
                {isMessagingLimit ? 'Keep the spark going' : 'Unlock more romance'}
              </Text>
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
            <View style={styles.unlockSection}>
              <Text style={styles.sectionTitle}>What you can do next</Text>
              <View style={styles.unlockGrid}>
                {isMessagingLimit ? (
                  <>
                    <View style={styles.unlockCard}>
                      <View style={[styles.unlockIcon, styles.unlockIconHeart]}>
                        <Heart size={20} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                      <Text style={styles.unlockTitle}>Match first</Text>
                      <Text style={styles.unlockText}>If they like you back, the conversation can keep flowing.</Text>
                    </View>
                    <View style={styles.unlockCard}>
                      <View style={[styles.unlockIcon, styles.unlockIconGold]}>
                        <Crown size={20} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                      <Text style={styles.unlockTitle}>Go Premium</Text>
                      <Text style={styles.unlockText}>Send without the starter limit and use stronger dating tools.</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.unlockCard}>
                      <View style={[styles.unlockIcon, styles.unlockIconHeart]}>
                        <Sparkles size={20} color="#FFFFFF" />
                      </View>
                      <Text style={styles.unlockTitle}>Stand out</Text>
                      <Text style={styles.unlockText}>Boost, rewind, and send stronger signals when it matters.</Text>
                    </View>
                    <View style={styles.unlockCard}>
                      <View style={[styles.unlockIcon, styles.unlockIconGold]}>
                        <Crown size={20} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                      <Text style={styles.unlockTitle}>Unlock it</Text>
                      <Text style={styles.unlockText}>Premium opens this feature and the full dating toolkit.</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>Premium dating perks</Text>
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
                  <Text style={styles.premiumButtonText}>
                    {isMessagingLimit ? 'Unlock Unlimited Messaging' : 'Go Premium'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchButton}
                onPress={handleKeepDating}
                activeOpacity={0.8}
              >
                {isLikesFeature ? (
                  <Heart size={18} color="#FF4D7D" />
                ) : (
                  <MessageCircle size={18} color="#FF4D7D" />
                )}
                <Text style={styles.matchButtonText}>
                  {isMessagingLimit ? 'Find more matches' : 'Keep discovering'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Not now</Text>
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
      backgroundColor: 'rgba(8, 10, 24, 0.72)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 18,
    },
    modalContainer: {
      width: '100%',
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
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroSection: {
      paddingTop: 42,
      paddingBottom: 30,
      paddingHorizontal: 24,
      alignItems: 'center',
      overflow: 'hidden',
    },
    softOrbTop: {
      position: 'absolute',
      top: -36,
      left: -20,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    softOrbBottom: {
      position: 'absolute',
      right: -30,
      bottom: -46,
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    heroContent: {
      alignItems: 'center',
    },
    crownContainer: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.34)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    heroTitle: {
      fontSize: 27,
      fontWeight: '800',
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
    unlockSection: {
      padding: 20,
      paddingBottom: 8,
    },
    unlockGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    unlockCard: {
      flex: 1,
      minHeight: 132,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.secondary,
    },
    unlockIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    unlockIconHeart: {
      backgroundColor: '#FF4D7D',
    },
    unlockIconGold: {
      backgroundColor: '#F59E0B',
    },
    unlockTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text.primary,
      marginBottom: 5,
    },
    unlockText: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.text.secondary,
    },
    featuresSection: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text.primary,
      marginBottom: 12,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    featureIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: '#FF4D7D20',
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
      padding: 20,
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
    matchButton: {
      minHeight: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#FF4D7D55',
      backgroundColor: '#FF4D7D12',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    matchButtonText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FF4D7D',
    },
    cancelButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
  });

