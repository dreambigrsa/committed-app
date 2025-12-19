import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Mail, CheckCircle, ArrowLeft, RefreshCw, Sparkles, Shield, Heart } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const [isChecking, setIsChecking] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    checkEmailVerification();
    
    // Animate entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Check every 3 seconds if email is verified
    const interval = setInterval(() => {
      checkEmailVerification();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const checkEmailVerification = async (showMessage: boolean = false) => {
    try {
      setIsChecking(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      if (currentSession?.user) {
        setEmail(currentSession.user.email || '');
        const emailConfirmed = !!currentSession.user.email_confirmed_at;
        setIsVerified(emailConfirmed);
        
        if (emailConfirmed) {
          // Email is verified, reload user data and redirect
          if (showMessage) {
            alert('✅ Email verified! Redirecting to home...');
          }
          
          // Reload user data to get updated verification status
          if (currentUser) {
            // Give a moment for the user to see the success message
            setTimeout(() => {
              router.replace('/(tabs)/home');
            }, showMessage ? 1500 : 500);
          } else {
            // If no currentUser yet, wait a bit for it to load
            setTimeout(() => {
              router.replace('/(tabs)/home');
            }, 2000);
          }
        } else {
          // Email not verified yet
          if (showMessage) {
            alert('Email not verified yet.\n\nPlease check your inbox and click the verification link in the email. If you just clicked it, wait a few seconds and try again.');
          }
        }
      } else {
        // No session - user needs to log in
        if (showMessage) {
          alert('Session expired. Please log in again.');
          router.replace('/auth');
        }
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
      if (showMessage) {
        alert('Error checking verification status. Please try again.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!email) {
      alert('Email address not found. Please try signing up again.');
      return;
    }
    
    setIsResending(true);
    try {
      // Use resend method to send confirmation email
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: 'committed-app://auth-callback',
        },
      });

      if (error) {
        console.error('Resend email error:', error);
        
        // Handle specific error cases
        if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
          alert('Too many requests. Please wait a few minutes before trying again.');
        } else if (error.message?.includes('already confirmed')) {
          // Email already confirmed, check again
          await checkEmailVerification();
          alert('Your email is already verified!');
        } else {
          throw error;
        }
        return;
      }

      // Success - show confirmation
      alert('✅ Verification email sent!\n\nPlease check your inbox (and spam folder) for the verification link. Click the link to verify your email.');
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      
      // More detailed error messages
      let errorMessage = 'Failed to resend verification email.';
      
      if (error.message) {
        if (error.message.includes('rate limit')) {
          errorMessage = 'Too many requests. Please wait a few minutes before trying again.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'User not found. Please try signing up again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      alert(errorMessage + '\n\nIf this problem persists, please contact support.');
    } finally {
      setIsResending(false);
    }
  };

  const openEmailApp = () => {
    Linking.openURL('mailto:');
  };

  const styles = createStyles(themeColors);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isChecking ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={themeColors.primary} />
              <Text style={styles.checkingText}>Checking verification status...</Text>
            </View>
          ) : isVerified ? (
            <Animated.View
              style={[
                styles.centerContent,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <View style={styles.successIconContainer}>
                <CheckCircle size={80} color={themeColors.status.verified} strokeWidth={2} />
              </View>
              <Text style={styles.successTitle}>Email Verified!</Text>
              <Text style={styles.successMessage}>
                Your email has been successfully verified.{'\n'}You can now access all features.
              </Text>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => router.replace('/(tabs)/home')}
              >
                <Text style={styles.continueButtonText}>Continue to App</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={['#1A73E8', '#1557B0', '#0D47A1']}
                style={styles.heroSection}
              >
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <ArrowLeft size={24} color={themeColors.text.white} />
                </TouchableOpacity>

                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Shield size={56} color={themeColors.text.white} strokeWidth={2} />
                    <View style={styles.heartBadge}>
                      <Heart size={28} color={themeColors.danger} fill={themeColors.danger} />
                    </View>
                  </View>
                </View>

                <View style={styles.iconContainer}>
                  <Mail size={64} color={themeColors.text.white} strokeWidth={1.5} />
                </View>

                <Text style={styles.heroTitle}>Verify Your Email</Text>
                <Text style={styles.heroSubtitle}>
                  We've sent a verification link to{'\n'}
                  <Text style={styles.emailText}>{email}</Text>
                </Text>

                <View style={styles.heroTagline}>
                  <Sparkles size={20} color={themeColors.accent} />
                  <Text style={styles.heroTaglineText}>
                    Check your inbox and click the link
                  </Text>
                </View>
              </LinearGradient>

              <View style={styles.section}>
                <View style={styles.instructionsCard}>
                  <Text style={styles.instructionsTitle}>What to do next:</Text>
                  <View style={styles.instructionsList}>
                    <View style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>1</Text>
                      </View>
                      <View style={styles.instructionContent}>
                        <Text style={styles.instructionTitle}>Open Your Email</Text>
                        <Text style={styles.instructionText}>
                          Check your inbox for an email from Committed
                        </Text>
                      </View>
                    </View>

                    <View style={styles.instructionConnector} />

                    <View style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>2</Text>
                      </View>
                      <View style={styles.instructionContent}>
                        <Text style={styles.instructionTitle}>Click the Link</Text>
                        <Text style={styles.instructionText}>
                          Tap the verification link in the email
                        </Text>
                      </View>
                    </View>

                    <View style={styles.instructionConnector} />

                    <View style={styles.instructionItem}>
                      <View style={styles.instructionNumber}>
                        <Text style={styles.instructionNumberText}>3</Text>
                      </View>
                      <View style={styles.instructionContent}>
                        <Text style={styles.instructionTitle}>Return to App</Text>
                        <Text style={styles.instructionText}>
                          Come back here - you'll be verified automatically
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={openEmailApp}
                  >
                    <Mail size={20} color={themeColors.text.white} />
                    <Text style={styles.primaryButtonText}>Open Email App</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={resendVerificationEmail}
                    disabled={isResending}
                  >
                    {isResending ? (
                      <ActivityIndicator size="small" color={themeColors.primary} />
                    ) : (
                      <>
                        <RefreshCw size={20} color={themeColors.primary} />
                        <Text style={styles.secondaryButtonText}>Resend Email</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.checkButton, isChecking && styles.checkButtonDisabled]}
                  onPress={() => checkEmailVerification(true)}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <ActivityIndicator size="small" color={themeColors.primary} />
                  ) : (
                    <Text style={styles.checkButtonText}>
                      I've verified my email
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
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
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 600,
    paddingHorizontal: 24,
  },
  checkingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 48,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: colors.text.white,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  emailText: {
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  heroTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  heroTaglineText: {
    fontSize: 14,
    color: colors.text.white,
    fontWeight: '600' as const,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  instructionsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 24,
  },
  instructionsList: {
    gap: 0,
  },
  instructionItem: {
    flexDirection: 'row',
    gap: 16,
  },
  instructionNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNumberText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  instructionContent: {
    flex: 1,
    paddingTop: 4,
  },
  instructionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  instructionConnector: {
    width: 2,
    height: 24,
    backgroundColor: colors.border.light,
    marginLeft: 19,
    marginVertical: 8,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  checkButton: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  checkButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  successIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.status.verified + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    borderWidth: 4,
    borderColor: colors.status.verified + '40',
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 17,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});
