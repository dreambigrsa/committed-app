import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  Heart,
  CheckCircle2,
  Search,
  Bell,
  Users,
  Lock,
  Award,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';

export default function LandingScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (currentUser) {
      router.replace('/(tabs)/home');
    }
  }, [currentUser, router]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const features = [
    {
      icon: Shield,
      title: 'Verified Relationships',
      description: 'Register your relationship and get verified with your partner',
    },
    {
      icon: Search,
      title: 'Public Registry',
      description: 'Search anyone by name or phone to check their relationship status',
    },
    {
      icon: Bell,
      title: 'Cheating Alerts',
      description: 'Get notified if your partner attempts to register with someone else',
    },
    {
      icon: Lock,
      title: 'Privacy Control',
      description: 'Control who can see your relationship history and personal information',
    },
    {
      icon: Award,
      title: 'Digital Certificates',
      description: 'Get verified couple badges and downloadable certificates',
    },
    {
      icon: Users,
      title: 'Accountability',
      description: 'Build trust through transparency and public verification',
    },
  ];

  const stats = [
    { number: '10K+', label: 'Verified Couples' },
    { number: '98%', label: 'Trust Score' },
    { number: '24/7', label: 'Monitoring' },
  ];

  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        <LinearGradient
          colors={['#1A73E8', '#1557B0', '#0D47A1']}
          style={styles.heroSection}
        >
          <Animated.View
            style={[
              styles.heroContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Shield size={56} color={colors.text.white} strokeWidth={2} />
                <View style={styles.heartBadge}>
                  <Heart size={28} color={colors.danger} fill={colors.danger} />
                </View>
              </View>
            </View>

            <Text style={styles.heroTitle}>Committed</Text>
            <Text style={styles.heroSubtitle}>
              The world&apos;s first verified relationship registry
            </Text>

            <View style={styles.heroTagline}>
              <Sparkles size={20} color={colors.accent} />
              <Text style={styles.heroTaglineText}>
                Build trust. Reduce infidelity. Stay accountable.
              </Text>
            </View>

            <View style={styles.ctaButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <ArrowRight size={20} color={colors.text.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.secondaryButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statNumber}>{stat.number}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <Text style={styles.sectionDescription}>
              Simple steps to verify your relationship and build trust
            </Text>
          </View>

          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Create Your Profile</Text>
                <Text style={styles.stepDescription}>
                  Sign up with your name, phone number, and email. Verify your identity with government ID for extra trust.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Register Your Relationship</Text>
                <Text style={styles.stepDescription}>
                  Add your partner&apos;s information and choose your relationship type: Married, Engaged, Serious, or Dating.
                </Text>
              </View>
            </View>

            <View style={styles.stepConnector} />

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Get Verified</Text>
                <Text style={styles.stepDescription}>
                  Your partner confirms the relationship. Once verified, both of you are publicly registered and protected.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Features</Text>
            <Text style={styles.sectionDescription}>
              Everything you need for relationship transparency
            </Text>
          </View>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={styles.featureIconContainer}>
                  <feature.icon size={28} color={colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.warningSection]}>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={32} color={colors.accent} />
              <Text style={styles.warningTitle}>Integrity Shield Protection</Text>
            </View>
            <Text style={styles.warningDescription}>
              If someone tries to register a second relationship while already verified, both partners are immediately notified. This creates accountability and reduces the risk of infidelity.
            </Text>
            <View style={styles.warningFeatures}>
              <View style={styles.warningFeature}>
                <CheckCircle2 size={18} color={colors.secondary} />
                <Text style={styles.warningFeatureText}>Real-time alerts</Text>
              </View>
              <View style={styles.warningFeature}>
                <CheckCircle2 size={18} color={colors.secondary} />
                <Text style={styles.warningFeatureText}>Partner notifications</Text>
              </View>
              <View style={styles.warningFeature}>
                <CheckCircle2 size={18} color={colors.secondary} />
                <Text style={styles.warningFeatureText}>Public record</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Why Committed?</Text>
          </View>

          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <CheckCircle2 size={24} color={colors.secondary} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Transparency:</Text> No more secrets. Your relationship status is clear and verified.
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <CheckCircle2 size={24} color={colors.secondary} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Trust:</Text> Build confidence knowing your partner is publicly committed.
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <CheckCircle2 size={24} color={colors.secondary} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Protection:</Text> Get notified if someone tries to register with your partner.
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <CheckCircle2 size={24} color={colors.secondary} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Privacy:</Text> Control what information is visible and to whom.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.finalCta]}>
          <View style={styles.finalCtaCard}>
            <Text style={styles.finalCtaTitle}>Ready to build trust?</Text>
            <Text style={styles.finalCtaDescription}>
              Join thousands of couples who are committed to transparency and accountability
            </Text>
            <TouchableOpacity
              style={styles.finalCtaButton}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.finalCtaButtonText}>Start Your Journey</Text>
              <ArrowRight size={20} color={colors.text.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Committed. All rights reserved.
          </Text>
          <Text style={styles.footerSubtext}>
            Building trust through verified relationships
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: typeof import('@/constants/colors').default) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  heroContent: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heartBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#1A73E8',
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: colors.text.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  heroTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 32,
  },
  heroTaglineText: {
    fontSize: 14,
    color: colors.text.white,
    fontWeight: '600' as const,
  },
  ctaButtons: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.text.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 48,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500' as const,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  sectionHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  stepsContainer: {
    gap: 0,
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  stepConnector: {
    width: 2,
    height: 32,
    backgroundColor: colors.border.light,
    marginLeft: 23,
    marginVertical: 8,
  },
  featuresGrid: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  warningSection: {
    backgroundColor: colors.background.secondary,
    paddingVertical: 56,
  },
  warningCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 28,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  warningDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  warningFeatures: {
    gap: 12,
  },
  warningFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningFeatureText: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600' as const,
  },
  benefitsContainer: {
    gap: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  benefitBold: {
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  finalCta: {
    backgroundColor: colors.background.secondary,
  },
  finalCtaCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  finalCtaTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  finalCtaDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  finalCtaButton: {
    backgroundColor: colors.text.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finalCtaButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
