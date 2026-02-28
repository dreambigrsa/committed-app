import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Shield, Heart, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import LegalAcceptanceCheckbox from '@/components/LegalAcceptanceCheckbox';
import MessageModal from '@/components/MessageModal';
import { LegalDocument } from '@/types';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signup, login, resetPassword } = useApp();
  const { updateUser } = useAuth();
  const { colors } = useTheme();
  const [isSignUp, setIsSignUp] = useState<boolean>(params?.mode === 'signin' ? false : true);
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
  const [messageModal, setMessageModal] = useState<{
    visible: boolean;
    variant: 'success' | 'error' | 'info';
    title: string;
    message: string;
    buttonText?: string;
    onCloseExtra?: () => void;
  }>({ visible: false, variant: 'success', title: '', message: '' });

  const closeMessageModal = () => {
    setMessageModal((prev) => {
      prev.onCloseExtra?.();
      return { ...prev, visible: false };
    });
  };

  useEffect(() => {
    if (params?.mode === 'signin') setIsSignUp(false);
    else if (params?.mode === 'signup') setIsSignUp(true);
  }, [params?.mode]);

  // No redirects - AppGate handles routing based on auth state

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
        setMessageModal({
          visible: true,
          variant: 'error',
          title: 'Email required',
          message: 'Please enter your email address so we can send you a reset link.',
          buttonText: 'OK',
        });
        setIsLoading(false);
        return;
      }

      await resetPassword(formData.email);
      setMessageModal({
        visible: true,
        variant: 'success',
        title: 'Check your email',
        message: `We've sent a password reset link to ${formData.email}. Check your inbox and spam folder, then click the link to set a new password.`,
        buttonText: 'OK',
        onCloseExtra: () => setShowForgotPassword(false),
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Couldn\'t send reset link',
        message: error.message || 'Failed to send reset link. Please try again.',
        buttonText: 'OK',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async () => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (!formData.fullName || !formData.email || !formData.phoneNumber || !formData.password) {
          setMessageModal({
            visible: true,
            variant: 'error',
            title: 'Missing information',
            message: 'Please fill in all fields to create your account.',
            buttonText: 'OK',
          });
          setIsLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setMessageModal({
            visible: true,
            variant: 'error',
            title: 'Password too short',
            message: 'Password must be at least 6 characters.',
            buttonText: 'OK',
          });
          setIsLoading(false);
          return;
        }

        // Check if all required legal documents are accepted
        const requiredDocs = legalDocuments.filter((doc) => doc.isRequired);
        const allRequiredAccepted = requiredDocs.every(
          (doc) => legalAcceptances[doc.id] === true
        );

        if (requiredDocs.length > 0 && !allRequiredAccepted) {
          setMessageModal({
            visible: true,
            variant: 'error',
            title: 'Legal documents',
            message: 'Please accept all required legal documents to continue.',
            buttonText: 'OK',
          });
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
                  updateUser({ acceptedLegalDocs: true });
                } else {
                  console.warn('Legal acceptances may not be fully saved, but continuing...');
                }
              } catch (error: any) {
                const errorMessage = error?.message || JSON.stringify(error);
                console.warn('Failed to save legal acceptances (user can accept later):', errorMessage);
                
                // If it's an RLS error, show a helpful modal
                if (error?.code === '42501') {
                  setMessageModal({
                    visible: true,
                    variant: 'info',
                    title: 'Database configuration required',
                    message:
                      'Your account was created, but a database setting needs to be updated. Please run the SQL in migrations/FIX-RLS-WITH-FUNCTION.sql in your Supabase SQL Editor. This is a one-time setup.',
                    buttonText: 'OK',
                  });
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
          setMessageModal({
            visible: true,
            variant: 'error',
            title: 'Email and password required',
            message: 'Please enter your email and password to sign in.',
            buttonText: 'OK',
          });
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
          } catch {
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

      setMessageModal({
        visible: true,
        variant: 'error',
        title: 'Something went wrong',
        message: errorMessage,
        buttonText: 'OK',
      });
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
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your full name"
                placeholderTextColor={colors.text.tertiary}
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your email"
              placeholderTextColor={colors.text.tertiary}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {!showForgotPassword && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={colors.text.tertiary}
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                keyboardType="phone-pad"
              />
            </View>
          )}

          {!showForgotPassword && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.text.secondary} />
                  ) : (
                    <Eye size={20} color={colors.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.authButton, isLoading && styles.buttonDisabled]}
            onPress={showForgotPassword ? handleResetPassword : handleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text.white} />
            ) : (
              <Text style={styles.authButtonText}>
                {showForgotPassword ? 'Send Reset Link' : (isSignUp ? 'Create Account' : 'Sign In')}
              </Text>
            )}
          </TouchableOpacity>

          {!isSignUp && !showForgotPassword && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => setShowForgotPassword(true)}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {showForgotPassword && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => {
                setShowForgotPassword(false);
                setIsSignUp(false);
              }}
            >
              <Text style={styles.forgotPasswordText}>Back to Sign In</Text>
            </TouchableOpacity>
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

      <MessageModal
        visible={messageModal.visible}
        onClose={closeMessageModal}
        variant={messageModal.variant}
        title={messageModal.title}
        message={messageModal.message}
        buttonText={messageModal.buttonText}
      />
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
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heartLogo: {
    position: 'absolute',
    bottom: -4,
    right: -4,
  },
  title: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
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
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 20,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  resetTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  resetSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  legalSection: {
    marginTop: 32,
    paddingTop: 24,
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
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  legalSectionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  legalDocumentsList: {
    gap: 12,
  },
  legalLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  legalLoadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
});
