import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Heart, ArrowLeft, FileText, Eye, EyeOff } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import LegalAcceptanceCheckbox from '@/components/LegalAcceptanceCheckbox';
import { LegalDocument } from '@/types';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { Button, Input } from '@/components/ui';
import { spacing, typography, borderRadius, layout } from '@/constants/design-system';

export default function AuthScreen() {
  const router = useRouter();
  const { currentUser, signup, login, resetPassword } = useApp();
  const { colors } = useTheme();
  const [isSignUp, setIsSignUp] = useState<boolean>(true);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
  });
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([]);
  const [legalAcceptances, setLegalAcceptances] = useState<Record<string, boolean>>({});
  const [loadingLegalDocs, setLoadingLegalDocs] = useState(false);

  useEffect(() => {
    if (currentUser) {
      // Small delay to ensure user data and onboarding status are loaded
      // before redirecting - index.tsx will handle the redirect based on onboarding status
      const timer = setTimeout(() => {
        router.replace('/');
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentUser, router]);

  useEffect(() => {
    if (isSignUp && !showForgotPassword) {
      loadLegalDocuments();
    }
  }, [isSignUp, showForgotPassword]);

  const loadLegalDocuments = async () => {
    try {
      setLoadingLegalDocs(true);
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_active', true)
        .contains('display_location', ['signup']);

      if (error) throw error;

      if (data) {
        const docs = data.map((doc) => ({
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          content: doc.content,
          version: doc.version,
          isActive: doc.is_active,
          isRequired: doc.is_required,
          displayLocation: doc.display_location || [],
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          createdBy: doc.created_by,
          lastUpdatedBy: doc.last_updated_by,
        }));
        setLegalDocuments(docs);
        // Initialize acceptances as false
        const initialAcceptances: Record<string, boolean> = {};
        docs.forEach((doc) => {
          initialAcceptances[doc.id] = false;
        });
        setLegalAcceptances(initialAcceptances);
      }
    } catch (error) {
      console.error('Failed to load legal documents:', error);
    } finally {
      setLoadingLegalDocs(false);
    }
  };

  const handleToggleAcceptance = (documentId: string, accepted: boolean) => {
    setLegalAcceptances((prev) => ({
      ...prev,
      [documentId]: accepted,
    }));
  };

  const handleViewDocument = (document: LegalDocument) => {
    router.push(`/legal/${document.slug}` as any);
  };

  const saveLegalAcceptances = async (userId: string, isSignupContext: boolean = false) => {
    try {
      // During signup, session might not be immediately available, so we're more lenient
      // For non-signup contexts, verify session is active (fixes 401 errors)
      if (!isSignupContext) {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn('Session error when saving legal acceptances:', sessionError);
          throw new Error(`Authentication error: ${sessionError.message}`);
        }
        
        if (!session || !session.user) {
          console.warn('No active session when trying to save legal acceptances');
          throw new Error('No active session. Please log in again.');
        }
        
        if (session.user.id !== userId) {
          console.warn(`Session user ID (${session.user.id}) doesn't match provided userId (${userId})`);
          throw new Error('Session mismatch. Please log in again.');
        }
      } else {
        // During signup, wait for session to be established
        // Don't try to refresh if there's no session yet - just wait
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to get session (don't refresh if it doesn't exist)
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          // Only refresh if we have a session
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError && refreshError.message !== 'Auth session missing!') {
            console.warn('Session refresh error during signup:', refreshError);
          } else {
            console.log('Session available for legal acceptances');
          }
          
          if (session.user.id !== userId) {
            console.warn(`Session user ID (${session.user.id}) doesn't match provided userId (${userId}) during signup`);
          }
        } else {
          // No session yet - that's OK, the RLS policy will handle it via the helper function
          console.log('No session yet during signup - RLS policy will use helper function');
        }
      }

      const acceptancesToSave = Object.entries(legalAcceptances)
        .filter(([_, accepted]) => accepted)
        .map(([documentId, _]) => {
          const doc = legalDocuments.find((d) => d.id === documentId);
          return {
            user_id: userId,
            document_id: documentId,
            document_version: doc?.version || '1.0.0',
            context: 'signup' as const,
          };
        });

      // Verify user exists before trying to save acceptances
      const { data: userCheck, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      
      if (userCheckError && userCheckError.code !== 'PGRST116') {
        throw new Error(`Cannot verify user exists: ${userCheckError.message}`);
      }
      
      if (!userCheck) {
        throw new Error(`User record does not exist for user ${userId}. Cannot save legal acceptances.`);
      }

      if (acceptancesToSave.length === 0) {
        console.log('No legal acceptances to save');
        return true; // Return true if nothing to save
      }

      // During signup, try using the database function first (bypasses RLS)
      // If that fails, fall back to direct insert
      let error: any = null;
      let data: any[] | null = null;

      if (isSignupContext) {
        try {
          // Use the database function which bypasses RLS
          const functionResults = await Promise.all(
            acceptancesToSave.map(acceptance =>
              supabase.rpc('insert_user_legal_acceptance', {
                p_user_id: acceptance.user_id,
                p_document_id: acceptance.document_id,
                p_document_version: acceptance.document_version,
                p_context: acceptance.context || 'signup'
              })
            )
          );

          // Check if all succeeded
          const allSucceeded = functionResults.every(result => !result.error);
          if (allSucceeded) {
            console.log(`Successfully saved ${acceptancesToSave.length} legal acceptances via function`);
            return true;
          } else {
            // If function call failed, log and fall through to direct insert
            console.warn('Function call failed, trying direct insert...');
            const firstError = functionResults.find(r => r.error)?.error;
            if (firstError) console.warn('Function error:', firstError);
          }
        } catch (functionError) {
          console.warn('Error calling insert function, trying direct insert...', functionError);
          // Fall through to direct insert
        }
      }

      // Direct insert (for non-signup or if function failed)
      const insertResult = await supabase
        .from('user_legal_acceptances')
        .insert(acceptancesToSave)
        .select();
      
      error = insertResult.error;
      data = insertResult.data;

      if (error) {
        const errorDetails = {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        };
        console.error('Error saving legal acceptances:', JSON.stringify(errorDetails, null, 2));
        
        // If it's an RLS error, provide helpful message
        if (error.code === '42501') {
          console.error('RLS Policy Error: The database RLS policies for user_legal_acceptances are missing or incorrect.');
          console.error('⚠️ URGENT: Run migrations/FIX-RLS-WITH-FUNCTION.sql in Supabase SQL Editor');
          console.error('This version creates a database function that bypasses RLS during signup.');
          console.error('This is a database configuration issue that must be fixed in Supabase dashboard.');
        }
        
        throw error;
      }
      
      console.log(`Successfully saved ${data?.length || 0} legal acceptances for user ${userId}`);
      return true;
    } catch (error: any) {
      console.error('Failed to save legal acceptances:', error);
      throw error; // Re-throw so caller can handle it
    }
  };

  const handleResetPassword = async () => {
    setIsLoading(true);
    try {
      if (!formData.email) {
        alert('Please enter your email address');
        setIsLoading(false);
        return;
      }

      await resetPassword(formData.email);
      alert('Password reset link sent! Please check your email.');
      setShowForgotPassword(false);
    } catch (error: any) {
      console.error('Reset password error:', error);
      alert(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async () => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.password) {
          alert('Please fill in all fields');
          setIsLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          alert('Password must be at least 6 characters');
          setIsLoading(false);
          return;
        }

        // Check if all required legal documents are accepted
        const requiredDocs = legalDocuments.filter((doc) => doc.isRequired);
        const allRequiredAccepted = requiredDocs.every(
          (doc) => legalAcceptances[doc.id] === true
        );

        if (requiredDocs.length > 0 && !allRequiredAccepted) {
          alert('Please accept all required legal documents to continue');
          setIsLoading(false);
          return;
        }

        const user = await signup(formData.fullName, formData.email, formData.phoneNumber, formData.password);
        
        // Save legal acceptances after successful signup
        // Wait a moment for user record to be created by trigger
        if (user?.id) {
          try {
            // Quick check for user record (should exist by now from trigger)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            let userRecordExists = false;
            let quickChecks = 0;
            const maxQuickChecks = 3; // Only 3 quick checks (1.5 seconds max)
            
            while (!userRecordExists && quickChecks < maxQuickChecks) {
              const { data: userRecord } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
              
              if (userRecord) {
                userRecordExists = true;
                console.log('User record found, saving legal acceptances...');
                break;
              }
              
              quickChecks++;
              if (quickChecks < maxQuickChecks) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
            
            if (userRecordExists) {
              // User record exists - save legal acceptances
              // Pass isSignupContext=true since we're in signup flow
              try {
                await saveLegalAcceptances(user.id, true);
                
                // Quick verify
                await new Promise(resolve => setTimeout(resolve, 300));
                const acceptanceStatus = await checkUserLegalAcceptances(user.id);
                
                if (acceptanceStatus.hasAllRequired) {
                  console.log('Legal acceptances successfully saved');
                } else {
                  console.warn('Legal acceptances may not be fully saved, but continuing...');
                }
              } catch (error: any) {
                const errorMessage = error?.message || JSON.stringify(error);
                console.warn('Failed to save legal acceptances (user can accept later):', errorMessage);
                
                // If it's an RLS error, show a helpful alert
                if (error?.code === '42501') {
                  alert(
                    '⚠️ Database Configuration Required\n\n' +
                    'Your account was created, but we need to fix a database setting.\n\n' +
                    'Please run this SQL in Supabase SQL Editor:\n' +
                    'File: migrations/FIX-RLS-WITH-FUNCTION.sql\n\n' +
                    'This creates a function that bypasses RLS during signup.\n' +
                    'This is a one-time setup that must be done in Supabase dashboard.'
                  );
                }
                // Don't block signup
              }
            } else {
              console.log('User record not ready yet. Legal acceptances will be saved when user logs in.');
              // Don't block signup - user can accept documents later
            }
          } catch (error: any) {
            console.warn('Error checking user record for legal acceptances:', error?.message);
            // Don't block signup
          }
        }
        
        // Always redirect, even if there were errors above
        // Check if email confirmation is required and redirect immediately
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const emailConfirmed = !!session?.user?.email_confirmed_at;
          
          // Redirect immediately - verify-email screen will render instantly
          // Don't clear loading until after redirect completes
          if (!emailConfirmed) {
              // Redirect to email verification screen
              router.replace('/verify-email');
              // Keep loading visible during transition, then clear it
              setTimeout(() => setIsLoading(false), 300);
            } else {
              // Email already confirmed, redirect to index which will check onboarding
              router.replace('/');
              // Clear loading after redirect starts
              setTimeout(() => setIsLoading(false), 300);
            }
        } catch (redirectError) {
          console.error('Error during redirect after signup:', redirectError);
          // Fallback: always go to verify-email if we can't check status
          router.replace('/verify-email');
          setTimeout(() => setIsLoading(false), 300);
        }
      } else {
        if (!formData.email || !formData.password) {
          alert('Please enter email and password');
          setIsLoading(false);
          return;
        }

        await login(formData.email, formData.password);
        
        // Wait for user data to load, then redirect directly to appropriate page
        // Don't go through landing page to avoid flash
        setTimeout(async () => {
          try {
            // Check onboarding status directly
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
              const { data: onboardingData } = await supabase
                .from('user_onboarding_data')
                .select('has_completed_onboarding')
                .eq('user_id', session.user.id)
                .single();
              
              if (onboardingData?.has_completed_onboarding === false) {
                router.replace('/onboarding');
              } else {
                router.replace('/(tabs)/home');
              }
            } else {
              // Fallback to index if we can't get user
              router.replace('/');
            }
          } catch (error) {
            // If error, fallback to index
            router.replace('/');
          }
        }, 300);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      let errorMessage = error.message || 'An error occurred. Please try again.';
      
      if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email before signing in.';
      } else if (error.code === 'PGRST116') {
        errorMessage = 'Database setup incomplete. Please check DATABASE-FIX-INSTRUCTIONS.md';
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Shield size={48} color={colors.primary} strokeWidth={2} />
            <Heart size={32} color={colors.danger} fill={colors.danger} style={styles.heartLogo} />
          </View>

          <Text style={styles.title}>Committed</Text>
          <Text style={styles.subtitle}>
            Verify your relationship.{'\n'}Build trust. Stay accountable.
          </Text>
        </View>

        <View style={styles.formContainer}>
          {!showForgotPassword ? (
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, isSignUp && styles.activeTab]}
                onPress={() => setIsSignUp(true)}
              >
                <Text style={[styles.tabText, isSignUp && styles.activeTabText]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, !isSignUp && styles.activeTab]}
                onPress={() => setIsSignUp(false)}
              >
                <Text style={[styles.tabText, !isSignUp && styles.activeTabText]}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.header}>
              <Text style={styles.resetTitle}>Reset Password</Text>
              <Text style={styles.resetSubtitle}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </Text>
            </View>
          )}

          {isSignUp && !showForgotPassword && (
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              autoCapitalize="words"
              size="md"
              variant="default"
            />
          )}

          <Input
            label="Email"
            placeholder="Enter your email"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
            size="md"
            variant="default"
          />

          {!showForgotPassword && (
            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
              keyboardType="phone-pad"
              size="md"
              variant="default"
            />
          )}

          {!showForgotPassword && (
            <Input
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChangeText={(text) => setFormData({ ...formData, password: text })}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              size="md"
              variant="default"
              rightIcon={
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={colors.text.secondary} />
                  )}
                </TouchableOpacity>
              }
            />
          )}

          <Button
            title={showForgotPassword ? 'Send Reset Link' : (isSignUp ? 'Create Account' : 'Sign In')}
            onPress={showForgotPassword ? handleResetPassword : handleAuth}
            variant="primary"
            size="lg"
            loading={isLoading}
            disabled={isLoading}
            fullWidth
            style={{ marginTop: spacing.md }}
          />

          {!isSignUp && !showForgotPassword && (
            <Button
              title="Forgot Password?"
              onPress={() => setShowForgotPassword(true)}
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.sm }}
            />
          )}

          {showForgotPassword && (
            <Button
              title="Back to Sign In"
              onPress={() => {
                setShowForgotPassword(false);
                setIsSignUp(false);
              }}
              variant="ghost"
              size="md"
              style={{ marginTop: spacing.sm }}
            />
          )}

          {isSignUp && !showForgotPassword && legalDocuments.length > 0 && (
            <View style={styles.legalSection}>
              <View style={styles.legalSectionHeader}>
                <View style={styles.legalSectionIconContainer}>
                  <Shield size={20} color={colors.primary} />
                </View>
                <View style={styles.legalSectionHeaderText}>
                  <Text style={styles.legalSectionTitle}>Legal Documents</Text>
                  <Text style={styles.legalSectionSubtitle}>
                    Please review and accept the required documents to create your account
                  </Text>
                </View>
              </View>
              {loadingLegalDocs ? (
                <View style={styles.legalLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.legalLoadingText}>Loading documents...</Text>
                </View>
              ) : (
                <View style={styles.legalDocumentsList}>
                  {legalDocuments.map((doc) => (
                    <LegalAcceptanceCheckbox
                      key={doc.id}
                      document={doc}
                      isAccepted={legalAcceptances[doc.id] || false}
                      onToggle={handleToggleAcceptance}
                      onViewDocument={handleViewDocument}
                      required={doc.isRequired}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {isSignUp && legalDocuments.length === 0 && !loadingLegalDocs && (
            <Text style={styles.disclaimer}>
              By signing up, you agree to verify your relationship status and maintain transparency with your partner.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: typeof import('@/constants/colors').default) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heartLogo: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  title: {
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed * typography.fontSize.md,
  },
  formContainer: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: colors.background.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: 14,
    paddingRight: 8,
  },
  passwordToggle: {
    padding: 4,
    marginLeft: 8,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  authButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  disclaimer: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.xs,
    marginTop: spacing.lg,
  },
  resetTitle: {
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  resetSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
    marginBottom: spacing.lg,
  },
  legalSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 2,
    borderTopColor: colors.border.light,
  },
  legalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  legalSectionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalSectionHeaderText: {
    flex: 1,
  },
  legalSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  legalSectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.normal * typography.fontSize.sm,
  },
  legalDocumentsList: {
    gap: spacing.sm + spacing.xs,
  },
  legalLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.lg,
  },
  legalLoadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
});
