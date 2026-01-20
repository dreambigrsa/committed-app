import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, ArrowRight, Sparkles, Users, Shield, MapPin, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { Button, Input } from '@/components/ui';
import { spacing, typography, borderRadius } from '@/constants/design-system';

const ONBOARDING_VERSION = '1.0.0';

export default function OnboardingScreen() {
  const router = useRouter();
  const { currentUser, hasCompletedOnboarding } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [step, setStep] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Check on mount if onboarding is already completed - if so, redirect immediately
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      // If hasCompletedOnboarding is already true, redirect immediately
      if (hasCompletedOnboarding === true) {
        console.log('Onboarding already completed, redirecting...');
        router.replace('/(tabs)/home');
        return;
      }

      // If status is null, check directly from database
      if (hasCompletedOnboarding === null && currentUser) {
        try {
          const { data: onboardingData } = await supabase
            .from('user_onboarding_data')
            .select('has_completed_onboarding')
            .eq('user_id', currentUser.id)
            .maybeSingle();
          
          if (onboardingData?.has_completed_onboarding === true) {
            console.log('Onboarding already completed (checked from DB), redirecting...');
            router.replace('/(tabs)/home');
            return;
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          // If error, continue showing onboarding screen
        }
      }
    };

    checkOnboardingStatus();
  }, [hasCompletedOnboarding, currentUser, router]);

  const steps = [
    {
      title: 'Welcome to Committed',
      icon: Sparkles,
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.welcomeText}>
            We're here to support your relationships with both AI assistance and human professionals.
          </Text>
        </View>
      ),
    },
    {
      title: 'How Committed AI Works',
      icon: Sparkles,
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.sectionTitle}>What Committed AI Can Do:</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <CheckCircle2 size={20} color={themeColors.primary} />
              <Text style={styles.featureText}>Provide general guidance and support</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle2 size={20} color={themeColors.primary} />
              <Text style={styles.featureText}>Answer questions about relationships</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle2 size={20} color={themeColors.primary} />
              <Text style={styles.featureText}>Help with communication strategies</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle2 size={20} color={themeColors.primary} />
              <Text style={styles.featureText}>Connect you with human professionals when needed</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>What Committed AI Cannot Do:</Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <X size={20} color={themeColors.danger} />
              <Text style={styles.featureText}>Provide medical or psychiatric diagnosis</Text>
            </View>
            <View style={styles.featureItem}>
              <X size={20} color={themeColors.danger} />
              <Text style={styles.featureText}>Replace licensed professional services</Text>
            </View>
            <View style={styles.featureItem}>
              <X size={20} color={themeColors.danger} />
              <Text style={styles.featureText}>Handle emergency situations</Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      title: 'AI vs Human Professionals',
      icon: Users,
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.explanationText}>
            <Text style={styles.boldText}>Committed AI</Text> provides 24/7 support and guidance. When you need deeper help, our AI can connect you with verified human professionals including:
          </Text>
          
          <View style={styles.professionalTypes}>
            <View style={styles.professionalCard}>
              <Text style={styles.professionalTitle}>Mental Health Professionals</Text>
              <Text style={styles.professionalDesc}>Counselors, therapists, psychologists</Text>
            </View>
            <View style={styles.professionalCard}>
              <Text style={styles.professionalTitle}>Life Coaches & Mentors</Text>
              <Text style={styles.professionalDesc}>Personal development and guidance</Text>
            </View>
            <View style={styles.professionalCard}>
              <Text style={styles.professionalTitle}>Legal Advisors</Text>
              <Text style={styles.professionalDesc}>General legal guidance and consultation</Text>
            </View>
          </View>

          <Text style={styles.explanationText}>
            <Text style={styles.boldText}>Human professionals</Text> are verified, credentialed experts who provide specialized support. The AI remains available as a moderator during professional sessions.
          </Text>
        </View>
      ),
    },
    {
      title: 'Your Location (Optional)',
      icon: MapPin,
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.explanationText}>
            Sharing your location helps us connect you with local professionals and provide better service. This is completely optional and can be changed later.
          </Text>
          
          <Input
            label="Location (Optional)"
            placeholder="City, Country (e.g., New York, USA)"
            value={location}
            onChangeText={setLocation}
            size="md"
            variant="default"
          />
          
          <Button
            title="Skip"
            onPress={() => setStep(step + 1)}
            variant="ghost"
            size="md"
            style={{ marginTop: spacing.sm, alignSelf: 'center' }}
          />
        </View>
      ),
    },
    {
      title: 'Consent & Agreement',
      icon: Shield,
      content: (
        <View style={styles.stepContent}>
          <Text style={styles.consentText}>
            I understand that Committed AI provides support but may connect me with human professionals when appropriate. I consent to this service.
          </Text>
          
          <TouchableOpacity
            style={styles.consentButton}
            onPress={() => setConsentGiven(!consentGiven)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
              {consentGiven && <CheckCircle2 size={20} color={themeColors.text.white} />}
            </View>
            <Text style={styles.consentButtonText}>
              I understand and consent
            </Text>
          </TouchableOpacity>
        </View>
      ),
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!consentGiven) {
      Alert.alert('Consent Required', 'Please provide your consent to continue.');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Please log in to continue.');
      return;
    }

    try {
      setSaving(true);

      // Save onboarding data
      const { error } = await supabase
        .from('user_onboarding_data')
        .upsert({
          user_id: currentUser.id,
          has_completed_onboarding: true,
          onboarding_version: ONBOARDING_VERSION,
          ai_explanation_viewed: true,
          consent_given: true,
          consent_given_at: new Date().toISOString(),
          location_provided: location.trim() || null,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      // Navigate to home
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error('Error saving onboarding data:', error);
      Alert.alert('Error', 'Failed to save onboarding data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentStep = steps[step];
  const CurrentIcon = currentStep.icon;
  const isLastStep = step === steps.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]} />
        </View>
        <Text style={styles.stepIndicator}>{step + 1} of {steps.length}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
          <View style={styles.iconContainer}>
            <CurrentIcon size={64} color={themeColors.primary} />
          </View>
          
          <Text style={styles.stepTitle}>{currentStep.title}</Text>
          
          {currentStep.content}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Button
            title="Back"
            onPress={() => setStep(step - 1)}
            variant="secondary"
            size="lg"
            style={{ flex: 1 }}
          />
        )}
        
        <Button
          title={isLastStep ? (saving ? 'Saving...' : 'Get Started') : 'Next'}
          onPress={handleNext}
          variant="primary"
          size="lg"
          loading={saving}
          disabled={saving || (isLastStep && !consentGiven)}
          icon={!isLastStep ? <ArrowRight size={20} color={themeColors.text.white} /> : undefined}
          iconPosition="right"
          style={{ flex: step > 0 ? 2 : 1, marginLeft: step > 0 ? spacing.sm : 0 }}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.sm + spacing.xs,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xs,
  },
  stepIndicator: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.fontSize.xxxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  stepContent: {
    width: '100%',
  },
  welcomeText: {
    fontSize: 18,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 24,
    marginBottom: 12,
  },
  featureList: {
    gap: 12,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 24,
  },
  explanationText: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  professionalTypes: {
    gap: 12,
    marginVertical: 24,
  },
  professionalCard: {
    backgroundColor: colors.background.primary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  professionalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  professionalDesc: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  locationInput: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text.primary,
    marginTop: 16,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  consentText: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  consentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background.primary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  consentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm + spacing.xs,
  },
});

