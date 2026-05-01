import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bot, CheckCircle2, Shield, Sparkles, Users, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { COMMITTED_AI_ONBOARDING_VERSION } from '@committed/shared';
import { supabase } from '@/lib/supabase';

const AI_CONSENT_REMINDER_MS = 5 * 60 * 1000;

type ConsentSurface = 'sheet' | 'reminder';

export default function CommittedAIConsentEnforcer() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentUser, hasCompletedOnboarding, checkOnboardingStatus, legalAcceptanceStatus } = useApp();
  const { user: authUser, updateUser, syncAuthState, profileHydrated } = useAuth();
  const styles = createStyles(colors);
  const pathname = usePathname();

  const [surface, setSurface] = useState<ConsentSurface>('sheet');
  const [currentStep, setCurrentStep] = useState(0);
  const [consentGiven, setConsentGiven] = useState(false);
  const [saving, setSaving] = useState(false);
  const reminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPendingRef = useRef(false);

  const userId = authUser?.id ?? currentUser?.id ?? null;
  const emailVerified = authUser?.emailVerified === true;
  const legalAccepted =
    authUser?.acceptedLegalDocs === true ||
    legalAcceptanceStatus?.hasAllRequired === true;
  const completed =
    authUser?.completedOnboarding === true ||
    hasCompletedOnboarding === true;

  const isOnVerifyEmail =
    pathname === '/verify-email' || pathname === 'verify-email' || pathname?.endsWith('/verify-email');
  const isAuthOrPublicRoute =
    pathname === '/' ||
    pathname === '/auth' ||
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname === '/signup' ||
    pathname === '/auth-callback' ||
    pathname === '/reset-password' ||
    pathname?.startsWith('/legal/') ||
    isOnVerifyEmail;

  const consentRequired = Boolean(
      userId &&
      emailVerified &&
      profileHydrated &&
      legalAccepted &&
      !isAuthOrPublicRoute &&
      !completed
  );

  useEffect(() => {
    if (consentRequired && !prevPendingRef.current) {
      setSurface('sheet');
      setCurrentStep(0);
    }
    if (!consentRequired && reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    prevPendingRef.current = consentRequired;
  }, [consentRequired]);

  useEffect(() => {
    if (!userId || !emailVerified || !legalAccepted || completed) return;
    let cancelled = false;
    checkOnboardingStatus(userId)
      .then((isComplete) => {
        if (cancelled) return;
        if (isComplete) {
          updateUser({ completedOnboarding: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, emailVerified, legalAccepted, completed, checkOnboardingStatus, updateUser]);

  useEffect(() => {
    return () => {
      if (reminderTimerRef.current) clearTimeout(reminderTimerRef.current);
    };
  }, []);

  const dismissSheet = () => {
    setSurface('reminder');
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    reminderTimerRef.current = setTimeout(() => {
      reminderTimerRef.current = null;
      if (consentRequired) {
        setSurface('sheet');
      }
    }, AI_CONSENT_REMINDER_MS);
  };

  const openSheet = () => {
    if (reminderTimerRef.current) {
      clearTimeout(reminderTimerRef.current);
      reminderTimerRef.current = null;
    }
    setSurface('sheet');
  };

  const acceptConsent = async () => {
    if (!userId) return;
    if (!consentGiven) {
      alert('Please confirm your consent to continue.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_onboarding_data')
        .upsert({
          user_id: userId,
          has_completed_onboarding: true,
          onboarding_version: COMMITTED_AI_ONBOARDING_VERSION,
          ai_explanation_viewed: true,
          consent_given: true,
          consent_given_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      if (reminderTimerRef.current) {
        clearTimeout(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
      updateUser({ completedOnboarding: true });
      await syncAuthState({ reason: 'ai_consent_complete', refreshToken: false }).catch(() => false);
      await checkOnboardingStatus(userId).catch(() => false);
      updateUser({ completedOnboarding: true });
      setSurface('sheet');
    } catch (error: any) {
      console.error('Failed to save Committed AI consent:', error);
      alert(error?.message || 'Failed to save consent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      icon: <CheckCircle2 size={20} color={colors.primary} />,
      title: 'What Committed AI can do',
      text: 'Provide general guidance, relationship support, communication ideas, and help finding human professionals when needed.',
    },
    {
      icon: <X size={20} color={colors.danger} />,
      title: 'What Committed AI cannot do',
      text: 'It does not provide medical, psychiatric, emergency, or licensed professional services.',
    },
    {
      icon: <Users size={20} color={colors.primary} />,
      title: 'Human professionals',
      text: 'When deeper help is needed, Committed AI may suggest verified human professionals. You stay in control of whether to request help.',
    },
    {
      icon: <Shield size={20} color={colors.primary} />,
      title: 'Your consent',
      text: 'You can close this prompt and continue, but we will remind you until you accept. AI-dependent features may keep asking for consent.',
    },
  ];
  const safeCurrentStep = Math.min(Math.max(currentStep, 0), steps.length - 1);
  const currentStepData = steps[safeCurrentStep] ?? steps[0];
  const isLastStep = safeCurrentStep === steps.length - 1;

  const handlePrimaryAction = () => {
    if (!isLastStep) {
          setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
      return;
    }
    void acceptConsent();
  };

  const showSheet = consentRequired && surface === 'sheet';
  const showReminder = consentRequired && surface === 'reminder';

  return (
    <>
      {showReminder ? (
        <View
          style={[
            styles.bannerWrap,
            { paddingTop: Math.max(insets.top, 8) },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.banner}
            onPress={openSheet}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Review Committed AI consent"
          >
            <Bot size={20} color={colors.text.white} />
            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerTitle}>Committed AI consent</Text>
              <Text style={styles.bannerSubtitle}>Tap to review. We will keep reminding you until accepted.</Text>
            </View>
            <Text style={styles.bannerAction}>Review</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={showSheet}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
        onRequestClose={dismissSheet}
      >
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={dismissSheet}
                accessibilityLabel="Close Committed AI consent"
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.iconContainer}>
              <Sparkles size={34} color={colors.primary} />
            </View>
            <Text style={styles.title}>Committed AI Consent</Text>
            <Text style={styles.subtitle}>
              Review how Committed AI supports you before using AI-powered help.
            </Text>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
            <View style={styles.stepProgressRow}>
              {steps.map((step, index) => (
                <View
                  key={step.title}
                  style={[
                    styles.stepDot,
                    index <= safeCurrentStep && styles.stepDotActive,
                  ]}
                />
              ))}
            </View>

            <Text style={styles.stepCount}>Step {safeCurrentStep + 1} of {steps.length}</Text>
            <InfoRow
              icon={currentStepData.icon}
              title={currentStepData.title}
              text={currentStepData.text}
              styles={styles}
            />

            {isLastStep ? (
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => setConsentGiven((value) => !value)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, consentGiven && styles.checkboxChecked]}>
                  {consentGiven ? <CheckCircle2 size={20} color={colors.text.white} /> : null}
                </View>
                <Text style={styles.consentText}>
                  I understand and consent to Committed AI support.
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {safeCurrentStep > 0 ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentStep((step) => Math.max(step - 1, 0))}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.acceptButton, (isLastStep && (!consentGiven || saving)) && styles.acceptButtonDisabled]}
              onPress={handlePrimaryAction}
              disabled={isLastStep && (!consentGiven || saving)}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <Text style={styles.acceptButtonText}>{isLastStep ? 'Accept and Continue' : 'Continue'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function InfoRow({
  icon,
  title,
  text,
  styles,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoTextCol}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText}>{text}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    bannerWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 9998,
      elevation: 9998,
    },
    banner: {
      marginHorizontal: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.secondary || colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    bannerTextCol: {
      flex: 1,
    },
    bannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.white,
    },
    bannerSubtitle: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.88)',
      marginTop: 2,
    },
    bannerAction: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text.white,
      textDecorationLine: 'underline',
    },
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      padding: 24,
      paddingBottom: 18,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerRow: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    headerSpacer: {
      flex: 1,
    },
    closeButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.background.secondary,
    },
    closeButtonText: {
      color: colors.text.secondary,
      fontWeight: '700',
    },
    iconContainer: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text.primary,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 20,
      flexGrow: 1,
      justifyContent: 'center',
      gap: 12,
    },
    stepProgressRow: {
      flexDirection: 'row',
      gap: 8,
      alignSelf: 'center',
      marginBottom: 8,
    },
    stepDot: {
      width: 34,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border.light,
    },
    stepDotActive: {
      backgroundColor: colors.primary,
    },
    stepCount: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.text.tertiary,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0,
      marginBottom: 2,
    },
    infoCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.secondary,
    },
    infoIcon: {
      width: 30,
      alignItems: 'center',
      paddingTop: 2,
    },
    infoTextCol: {
      flex: 1,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text.primary,
      marginBottom: 4,
    },
    infoText: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.light,
      backgroundColor: colors.background.primary,
      marginTop: 8,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    consentText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text.primary,
      lineHeight: 21,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.primary,
    },
    backButton: {
      minHeight: 52,
      paddingHorizontal: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background.secondary,
    },
    backButtonText: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    acceptButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButtonDisabled: {
      opacity: 0.55,
    },
    acceptButtonText: {
      color: colors.text.white,
      fontSize: 16,
      fontWeight: '800',
    },
  });
}
