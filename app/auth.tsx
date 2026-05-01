import React, { useState, useEffect, useMemo } from 'react';
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
  Modal,
} from 'react-native';
import { Shield, Heart, ArrowLeft, Eye, EyeOff, ChevronDown, Search, X } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { normalizePhoneWithCountryCode } from '@committed/shared';
import LegalAcceptanceCheckbox from '@/components/LegalAcceptanceCheckbox';
import MessageModal from '@/components/MessageModal';
import { LegalDocument } from '@/types';
import { checkUserLegalAcceptances } from '@/lib/legal-enforcement';
import { COUNTRY_CALLING_CODES, DEFAULT_COUNTRY_CALLING_CODE } from '@/lib/country-calling-codes';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; verified?: string }>();
  const { signup, resetPassword } = useApp();
  const { updateUser, signIn: authSignIn, user, isAuthenticated, syncAuthState } = useAuth();
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
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY_CALLING_CODE);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
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

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return COUNTRY_CALLING_CODES;
    return COUNTRY_CALLING_CODES.filter((country) =>
      country.name.toLowerCase().includes(query) ||
      country.iso2.toLowerCase().includes(query) ||
      country.dialCode.includes(query.replace(/[^\d+]/g, ''))
    );
  }, [countrySearch]);

  const getSignupPhoneNumber = () => {
    return normalizePhoneWithCountryCode(selectedCountry.dialCode, formData.phoneNumber);
  };

  useEffect(() => {
    if (params?.mode === 'signin') setIsSignUp(false);
    else if (params?.mode === 'signup') setIsSignUp(true);
  }, [params?.mode]);

  // Ensure loading is cleared if user leaves the screen during sign-in (no stuck button)
  useEffect(() => {
    return () => {
      setIsLoading(false);
    };
  }, []);

  // If sign-in eventually succeeds after a timeout, dismiss the error modal automatically.
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setMessageModal((prev) => ({ ...prev, visible: false }));
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

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

  const persistSignupLegalAcceptances = async (userId: string) => {
    try {
      let userRecordExists = false;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (userRecord) {
          userRecordExists = true;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!userRecordExists) return;

      await saveLegalAcceptances(userId, true);
      const acceptanceStatus = await checkUserLegalAcceptances(userId);
      if (acceptanceStatus.hasAllRequired) {
        updateUser({ acceptedLegalDocs: true });
      }
    } catch (error: any) {
      console.warn('Failed to persist signup legal acceptances in background:', error?.message || error);
    }
  };

  const handleAuth = async () => {
    setIsLoading(true);
    setMessageModal((prev) => ({ ...prev, visible: false }));
    try {
      if (isSignUp) {
        const signupPhoneNumber = getSignupPhoneNumber();

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

        if (signupPhoneNumber.replace(/\D/g, '').length < 8) {
          setMessageModal({
            visible: true,
            variant: 'error',
            title: 'Invalid phone number',
            message: 'Please select your country code and enter a valid phone number.',
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

        const user = await signup(formData.fullName, formData.email, signupPhoneNumber, formData.password);

        // Move to the next screen immediately. Slow profile/legal persistence can finish
        // in the background; blocking here caused a blank transition on first signup.
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            void syncAuthState({ reason: 'signup_success_bootstrap', refreshToken: true }).catch(() => false);
          }

          // New accounts always enter the product flow through Verify Email.
          // If the backend already marks the email verified, that screen checks once and AppGate
          // moves forward to Legal -> AI -> Home without competing redirects.
          router.replace('/verify-email');
        } catch (redirectError) {
          console.error('Error during redirect after signup:', redirectError);
          router.replace('/verify-email');
        }

        if (user?.id) {
          void persistSignupLegalAcceptances(user.id);
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

        // AuthContext.signIn resolves as soon as session exists (full hydration runs in background).
        // AppGate redirects based on auth state; longer timeout when user just verified email (verified=1).
        const email = formData.email.trim();
        const normalizedEmail = email.toLowerCase();
        const isPostVerification = params?.verified === '1' || params?.verified === 'true';

        // On slow networks, Supabase sign-in can take longer than usual.
        // Instead of hard-failing immediately, we:
        // 1) show a non-error info message after a short delay
        // 2) use a longer hard timeout to avoid waiting forever
        // 3) on timeout, check if a session exists anyway (in that case, don't block the user)
        // Native networks are often slower than local web dev; give a bit more time and earlier feedback.
        const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
        const SIGN_IN_WARNING_MS = isPostVerification ? 12000 : isNativeMobile ? 6000 : 8000;
        const SIGN_IN_HARD_TIMEOUT_MS = isPostVerification ? 60000 : isNativeMobile ? 60000 : 45000;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const warningTimerId = setTimeout(() => {
          setMessageModal({
            visible: true,
            variant: 'info',
            title: 'Signing you in…',
            message: 'This may take a moment on slow connections. Please keep the app open.',
            buttonText: 'OK',
          });
        }, SIGN_IN_WARNING_MS);

        try {
          await Promise.race([
            authSignIn(email, formData.password),
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(
                  new Error(
                    isPostVerification
                      ? 'Sign-in timed out (slow connection).'
                      : 'Sign-in timed out (slow connection).'
                  )
                );
              }, SIGN_IN_HARD_TIMEOUT_MS);
            }),
          ]);
        } catch (error: any) {
          // If we hit the timeout but the session is already available,
          // treat it as success and let AppGate redirect.
          if (timeoutId != null) {
            // no-op; timeoutId is cleared below
          }
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const sessionEmail = session?.user?.email?.toLowerCase();
            if (session && sessionEmail && sessionEmail === normalizedEmail) {
              setMessageModal((prev) => ({ ...prev, visible: false }));
              return;
            }
          } catch {
            // ignore - we'll fall through to outer catch error messaging
          }

          // Extra recovery path: if SDK sign-in resolved late or listener missed,
          // force-sync auth state before surfacing an error.
          try {
            const recovered = await syncAuthState({
              reason: 'auth_screen_sign_in_recovery',
              refreshToken: false,
            });
            if (recovered) {
              setMessageModal((prev) => ({ ...prev, visible: false }));
              return;
            }
          } catch {
            // ignore and show normal error modal below
          }

          throw error;
        } finally {
          if (timeoutId != null) clearTimeout(timeoutId);
          clearTimeout(warningTimerId);
          // Guarantee button loading stops even if redirect is slow
          setIsLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      const rawMessage = typeof error?.message === 'string' ? error.message : '';
      const lower = rawMessage.toLowerCase();
      const isTimeout = lower.includes('timed out') || lower.includes('taking longer than usual');
      const isNetwork =
        lower.includes('network') ||
        lower.includes('failed to fetch') ||
        lower.includes('fetch') ||
        lower.includes('timeout');

      let title = 'Sign-in failed';
      let errorMessage = rawMessage || 'Unable to sign you in right now. Please try again.';
      
      if (error?.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
        title = 'Invalid credentials';
      } else if (error?.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email before signing in.';
        title = 'Email not verified';
      } else if (error?.code === 'PGRST116') {
        errorMessage = 'Database setup incomplete. Please check DATABASE-FIX-INSTRUCTIONS.md';
        title = 'Server misconfiguration';
      } else if (isTimeout) {
        title = 'Sign-in is taking longer than usual';
        errorMessage =
          'We couldn’t complete sign-in right now. Please check your connection and try again. If you already verified your email recently, please wait 10-30 seconds first.';
      } else if (isNetwork) {
        title = 'Connection issue';
        errorMessage =
          'We couldn’t reach the server. Please check your connection and try again in a moment.';
      }

      setMessageModal({
        visible: true,
        variant: 'error',
        title,
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
              testID="auth-email-input"
              style={styles.textInput}
              placeholder="Enter your email"
              placeholderTextColor={colors.text.tertiary}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {isSignUp && !showForgotPassword && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <View style={styles.phoneInputRow}>
                <TouchableOpacity
                  style={styles.countryCodeButton}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Select country code"
                >
                  <Text style={styles.countryCodeIso}>{selectedCountry.iso2}</Text>
                  <Text style={styles.countryCodeText}>{selectedCountry.dialCode}</Text>
                  <ChevronDown size={16} color={colors.text.secondary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneTextInput}
                  placeholder="Phone number"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.phoneNumber}
                  onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          {!showForgotPassword && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  testID="auth-password-input"
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

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.countryModalOverlay}>
          <View style={styles.countryModal}>
            <View style={styles.countryModalHeader}>
              <Text style={styles.countryModalTitle}>Select Country Code</Text>
              <TouchableOpacity
                style={styles.countryModalClose}
                onPress={() => setShowCountryPicker(false)}
                accessibilityLabel="Close country code picker"
              >
                <X size={22} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.countrySearchBox}>
              <Search size={18} color={colors.text.secondary} />
              <TextInput
                style={styles.countrySearchInput}
                placeholder="Search country or code"
                placeholderTextColor={colors.text.tertiary}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />
            </View>

            <ScrollView style={styles.countryList} keyboardShouldPersistTaps="handled">
              {filteredCountries.map((country) => (
                <TouchableOpacity
                  key={`${country.iso2}-${country.name}`}
                  style={[
                    styles.countryOption,
                    selectedCountry.iso2 === country.iso2 && styles.countryOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountry(country);
                    setCountrySearch('');
                    setShowCountryPicker(false);
                  }}
                >
                  <View style={styles.countryOptionTextCol}>
                    <Text style={styles.countryOptionName}>{country.name}</Text>
                    <Text style={styles.countryOptionIso}>{country.iso2}</Text>
                  </View>
                  <Text style={styles.countryOptionCode}>{country.dialCode}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  countryCodeButton: {
    minWidth: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: 10,
  },
  countryCodeIso: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  phoneTextInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  countryModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  countryModal: {
    maxHeight: '82%',
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 28,
  },
  countryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  countryModalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  countryModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  countrySearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  countrySearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  countryList: {
    maxHeight: 460,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  countryOptionSelected: {
    backgroundColor: colors.primary + '18',
  },
  countryOptionTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  countryOptionName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  countryOptionIso: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  countryOptionCode: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: colors.primary,
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
