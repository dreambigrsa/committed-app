import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Briefcase, Upload, CheckCircle2, X, ArrowRight, ArrowLeft, Shield, MapPin, FileText, User, Edit2, ChevronRight } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalRole, ProfessionalApplication, ProfessionalProfile } from '@/types';
import { LinearGradient } from 'expo-linear-gradient';

type Step = 1 | 2 | 3 | 4;

export default function BecomeProfessionalScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<ProfessionalRole | null>(null);
  const [existingProfile, setExistingProfile] = useState<ProfessionalProfile | null>(null);
  const [, setExistingApplication] = useState<ProfessionalApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // User info from account (auto-populated)
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Professional profile fields
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [credentials, setCredentials] = useState<string[]>([]);
  const [credentialInput, setCredentialInput] = useState('');
  const [credentialDocuments, setCredentialDocuments] = useState<{ type: string; url: string; verified: boolean }[]>([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [currentStep]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Auto-populate user info from account
      if (currentUser) {
        setFullName(currentUser.fullName || '');
        setEmail(currentUser.email || '');
        setPhoneNumber(currentUser.phoneNumber || '');
      }
      
      // Load available roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('professional_roles')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      if (!currentUser) return;

      // Check if user already has a profile
      const { data: profileData } = await supabase
        .from('professional_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      if (profileData) {
        setExistingProfile(profileData);
        setSelectedRole(rolesData?.find((r: ProfessionalRole) => r.id === profileData.role_id) || null);
        setBio(profileData.bio || '');
        setLocation(profileData.location || '');
        setCredentials(profileData.credentials || []);
        setCredentialDocuments(profileData.credential_documents || []);
      }

      // Check if user has pending application
      const { data: applicationData } = await supabase
        .from('professional_applications')
        .select('*, role:professional_roles(*)')
        .eq('user_id', currentUser.id)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (applicationData) {
        setExistingApplication(applicationData);
        setSelectedRole(applicationData.role);
        setBio(applicationData.application_data?.bio || '');
        setLocation(applicationData.application_data?.location || '');
        setCredentials(applicationData.application_data?.credentials || []);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedRole) {
      Alert.alert('Please Select a Role', 'Choose a professional role to continue');
      return;
    }
    if (currentStep === 3 && !bio.trim()) {
      Alert.alert('Bio Required', 'Please provide a professional bio');
      return;
    }
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    }
  };

  const handleAddCredential = () => {
    if (credentialInput.trim()) {
      setCredentials([...credentials, credentialInput.trim()]);
      setCredentialInput('');
    }
  };

  const handleRemoveCredential = (index: number) => {
    setCredentials(credentials.filter((_: string, i: number) => i !== index));
  };

  const handleUploadDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser?.id}/${Date.now()}.${fileExt}`;
      const filePath = `professional-credentials/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('professional-credentials')
        .upload(filePath, {
          uri: file.uri,
          type: file.mimeType || 'application/pdf',
        } as any, {
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('professional-credentials')
        .getPublicUrl(filePath);

      setCredentialDocuments([
        ...credentialDocuments,
        { type: fileExt || 'pdf', url: publicUrl, verified: false },
      ]);

      Alert.alert('Success', 'Document uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    }
  };

  const handleSubmit = async () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select a professional role');
      return;
    }

    if (selectedRole.requiresCredentials && credentials.length === 0 && credentialDocuments.length === 0) {
      Alert.alert('Error', 'This role requires credentials. Please add at least one credential or upload a document.');
      return;
    }

    try {
      setSubmitting(true);

      const applicationData = {
        bio: bio.trim() || null,
        location: location.trim() || null,
        credentials,
        credentialDocuments,
      };

      if (existingProfile) {
        const { error } = await supabase
          .from('professional_profiles')
          .update({
            bio: applicationData.bio,
            location: applicationData.location,
            credentials: applicationData.credentials,
            credential_documents: applicationData.credentialDocuments,
            approval_status: 'pending',
          })
          .eq('id', existingProfile.id);

        if (error) throw error;
        Alert.alert('Success', 'Profile updated and submitted for review');
      } else {
        const { error } = await supabase
          .from('professional_applications')
          .insert([{
            user_id: currentUser?.id,
            role_id: selectedRole.id,
            application_data: applicationData,
            status: 'pending',
          }]);

        if (error) throw error;
        Alert.alert('Success', 'Application submitted successfully. You will be notified when it\'s reviewed.');
      }

      router.back();
    } catch (error: any) {
      console.error('Error submitting application:', error);
      Alert.alert('Error', error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Become a Professional', headerShown: true }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Please log in to continue</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Become a Professional', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: 'Role' },
      { number: 2, label: 'Your Info' },
      { number: 3, label: 'Profile' },
      { number: 4, label: 'Credentials' },
    ];

    return (
      <View style={styles.stepIndicator}>
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  currentStep >= step.number && styles.stepCircleActive,
                  currentStep === step.number && styles.stepCircleCurrent,
                ]}
              >
                {currentStep > step.number ? (
                  <CheckCircle2 size={20} color={themeColors.text.white} />
                ) : (
                  <Text style={[styles.stepNumber, currentStep >= step.number && styles.stepNumberActive]}>
                    {step.number}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, currentStep >= step.number && styles.stepLabelActive]}>
                {step.label}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  currentStep > step.number && styles.stepConnectorActive,
                ]}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.stepHeader}>
              <View style={styles.iconCircle}>
                <Briefcase size={32} color={themeColors.primary} />
              </View>
              <Text style={styles.stepTitle}>Choose Your Professional Role</Text>
              <Text style={styles.stepDescription}>
                Select the role that best matches your expertise and qualifications
              </Text>
            </View>

            <View style={styles.rolesContainer}>
              {roles.map((role: ProfessionalRole) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.roleCard,
                    selectedRole?.id === role.id && styles.roleCardSelected,
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <View style={styles.roleCardContent}>
                    <View style={styles.roleCardHeader}>
                      <View style={styles.roleIconContainer}>
                        <Briefcase size={24} color={selectedRole?.id === role.id ? themeColors.primary : themeColors.text.secondary} />
                      </View>
                      <View style={styles.roleCardText}>
                        <Text style={[styles.roleName, selectedRole?.id === role.id && styles.roleNameSelected]}>
                          {role.name}
                        </Text>
                        <Text style={styles.roleCategory}>{role.category}</Text>
                      </View>
                      {selectedRole?.id === role.id && (
                        <View style={styles.selectedBadge}>
                          <CheckCircle2 size={24} color={themeColors.primary} />
                        </View>
                      )}
                    </View>
                    {role.description && (
                      <Text style={styles.roleDescription}>{role.description}</Text>
                    )}
                    {role.requiresCredentials && (
                      <View style={styles.requirementBadge}>
                        <Shield size={14} color={themeColors.accent} />
                        <Text style={styles.requirementText}>Credentials Required</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.stepHeader}>
              <View style={styles.iconCircle}>
                <User size={32} color={themeColors.primary} />
              </View>
              <Text style={styles.stepTitle}>Verify Your Information</Text>
              <Text style={styles.stepDescription}>
                Review and update your account information if needed
              </Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoLabelHint}>This will appear on your professional profile</Text>
                </View>
                <View style={styles.infoInputContainer}>
                  <TextInput
                    style={styles.infoInput}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                  <TouchableOpacity style={styles.editButton}>
                    <Edit2 size={16} color={themeColors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={styles.infoLabelHint}>Verified and secure</Text>
                </View>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue} numberOfLines={1}>{email}</Text>
                  <View style={styles.verifiedBadge}>
                    <CheckCircle2 size={14} color={themeColors.secondary} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoDivider} />

              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoLabelHint}>Used for verification and notifications</Text>
                </View>
                <View style={styles.infoInputContainer}>
                  <TextInput
                    style={styles.infoInput}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="+1 (555) 123-4567"
                    placeholderTextColor={themeColors.text.tertiary}
                    keyboardType="phone-pad"
                  />
                  <View style={styles.verifiedBadge}>
                    <CheckCircle2 size={14} color={themeColors.secondary} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.stepHeader}>
              <View style={styles.iconCircle}>
                <FileText size={32} color={themeColors.primary} />
              </View>
              <Text style={styles.stepTitle}>Create Your Professional Profile</Text>
              <Text style={styles.stepDescription}>
                Tell us about your professional background and experience
              </Text>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Professional Bio *</Text>
                <Text style={styles.formHint}>Share your expertise, experience, and what makes you unique</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="e.g., Licensed therapist with 10+ years of experience helping couples navigate relationship challenges..."
                  multiline
                  numberOfLines={8}
                  placeholderTextColor={themeColors.text.tertiary}
                />
                <Text style={styles.characterCount}>{bio.length}/500</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Location (Optional)</Text>
                <Text style={styles.formHint}>City and country where you provide services</Text>
                <View style={styles.inputWithIcon}>
                  <MapPin size={20} color={themeColors.text.secondary} />
                  <TextInput
                    style={[styles.formInput, styles.inputWithIconText]}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g., New York, USA"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        );

      case 4:
        return (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.stepHeader}>
              <View style={styles.iconCircle}>
                <Shield size={32} color={themeColors.primary} />
              </View>
              <Text style={styles.stepTitle}>
                {selectedRole?.requiresCredentials ? 'Add Your Credentials' : 'Credentials (Optional)'}
              </Text>
              <Text style={styles.stepDescription}>
                {selectedRole?.requiresCredentials
                  ? 'This role requires professional credentials. Please add your certifications, licenses, or qualifications.'
                  : 'Add any professional credentials, certifications, or licenses you hold'}
              </Text>
            </View>

            <View style={styles.formCard}>
              {credentials.length > 0 && (
                <View style={styles.credentialsList}>
                  {credentials.map((cred: string, index: number) => (
                    <View key={index} style={styles.credentialTag}>
                      <Text style={styles.credentialTagText}>{cred}</Text>
                      <TouchableOpacity onPress={() => handleRemoveCredential(index)}>
                        <X size={18} color={themeColors.text.secondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.addCredentialRow}>
                <TextInput
                  style={styles.credentialInput}
                  value={credentialInput}
                  onChangeText={setCredentialInput}
                  placeholder="e.g., Licensed Marriage and Family Therapist"
                  placeholderTextColor={themeColors.text.tertiary}
                  onSubmitEditing={handleAddCredential}
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddCredential}>
                  <Text style={styles.addButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.uploadCard} onPress={handleUploadDocument}>
                <Upload size={24} color={themeColors.primary} />
                <View style={styles.uploadCardText}>
                  <Text style={styles.uploadCardTitle}>Upload Credential Document</Text>
                  <Text style={styles.uploadCardHint}>PDF, JPG, or PNG files accepted</Text>
                </View>
                <ChevronRight size={20} color={themeColors.text.tertiary} />
              </TouchableOpacity>

              {credentialDocuments.length > 0 && (
                <View style={styles.documentsList}>
                  {credentialDocuments.map((doc: { type: string; url: string; verified: boolean }, index: number) => (
                    <View key={index} style={styles.documentCard}>
                      <FileText size={20} color={themeColors.primary} />
                      <View style={styles.documentCardText}>
                        <Text style={styles.documentCardTitle}>{doc.type.toUpperCase()} Document</Text>
                        <Text style={styles.documentCardUrl} numberOfLines={1}>{doc.url}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {selectedRole?.disclaimerText && (
                <View style={styles.disclaimerBox}>
                  <Shield size={20} color={themeColors.accent} />
                  <View style={styles.disclaimerBoxText}>
                    <Text style={styles.disclaimerBoxTitle}>Important Notice</Text>
                    <Text style={styles.disclaimerBoxContent}>{selectedRole.disclaimerText}</Text>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Become a Professional', headerShown: true }} />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <LinearGradient
          colors={[themeColors.primary + '15', 'transparent']}
          style={styles.gradientHeader}
        >
          {renderStepIndicator()}
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderStepContent()}
        </ScrollView>

        <View style={styles.footer}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={20} color={themeColors.text.primary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.nextButton, submitting && styles.nextButtonDisabled]}
            onPress={currentStep === 4 ? handleSubmit : handleNext}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={themeColors.text.white} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {currentStep === 4 ? 'Submit Application' : 'Continue'}
                </Text>
                <ArrowRight size={20} color={themeColors.text.white} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  keyboardView: {
    flex: 1,
  },
  gradientHeader: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepCircleCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  stepNumberActive: {
    color: colors.text.white,
  },
  stepLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border.light,
    marginHorizontal: 8,
    marginBottom: 28,
  },
  stepConnectorActive: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  rolesContainer: {
    paddingBottom: 8,
  },
  roleCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  roleCardContent: {
    gap: 12,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardText: {
    flex: 1,
  },
  roleName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  roleNameSelected: {
    color: colors.primary,
  },
  roleCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
  },
  selectedBadge: {
    marginLeft: 'auto',
  },
  roleDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  requirementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  requirementText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  infoCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    paddingVertical: 18,
  },
  infoLabelContainer: {
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  infoLabelHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  infoValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    gap: 10,
  },
  infoInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
    padding: 0,
  },
  editButton: {
    padding: 4,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexShrink: 0,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: 4,
  },
  formCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  formHint: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  formInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 160,
    textAlignVertical: 'top',
    paddingTop: 14,
    lineHeight: 22,
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '500',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  inputWithIconText: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderWidth: 0,
  },
  credentialsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  credentialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  credentialTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  addCredentialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  credentialInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: colors.text.primary,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.text.white,
    fontWeight: '700',
    fontSize: 14,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    gap: 16,
    marginBottom: 16,
  },
  uploadCardText: {
    flex: 1,
  },
  uploadCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  uploadCardHint: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  documentsList: {
    gap: 12,
    marginBottom: 20,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  documentCardText: {
    flex: 1,
  },
  documentCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  documentCardUrl: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  disclaimerBox: {
    flexDirection: 'row',
    backgroundColor: colors.accent + '20',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  disclaimerBoxText: {
    flex: 1,
  },
  disclaimerBoxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  disclaimerBoxContent: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    minWidth: 100,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.white,
  },
});
