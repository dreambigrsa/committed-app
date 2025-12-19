import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Briefcase, Upload, Save, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalRole, ProfessionalApplication, ProfessionalProfile } from '@/types';
import colors from '@/constants/colors';

export default function BecomeProfessionalScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<ProfessionalRole | null>(null);
  const [existingProfile, setExistingProfile] = useState<ProfessionalProfile | null>(null);
  const [existingApplication, setExistingApplication] = useState<ProfessionalApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [credentials, setCredentials] = useState<string[]>([]);
  const [credentialInput, setCredentialInput] = useState('');
  const [credentialDocuments, setCredentialDocuments] = useState<Array<{ type: string; url: string; verified: boolean }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
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

      const { data: uploadData, error: uploadError } = await supabase.storage
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
        // Update existing profile
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
        // Create new application
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

  const getStatusDisplay = () => {
    if (existingProfile) {
      switch (existingProfile.approvalStatus) {
        case 'approved':
          return { text: 'Approved', icon: CheckCircle, color: colors.secondary };
        case 'pending':
          return { text: 'Pending Review', icon: Clock, color: colors.accent };
        case 'rejected':
          return { text: 'Rejected', icon: XCircle, color: colors.danger };
        case 'suspended':
          return { text: 'Suspended', icon: XCircle, color: colors.danger };
        default:
          return null;
      }
    }
    if (existingApplication) {
      switch (existingApplication.status) {
        case 'pending':
          return { text: 'Application Pending', icon: Clock, color: colors.accent };
        case 'approved':
          return { text: 'Application Approved', icon: CheckCircle, color: colors.secondary };
        case 'rejected':
          return { text: 'Application Rejected', icon: XCircle, color: colors.danger };
        default:
          return null;
      }
    }
    return null;
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Become a Professional' }} />
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>Please log in to continue</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Become a Professional' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay?.icon;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Become a Professional' }} />
      
      <ScrollView style={styles.content}>
        {statusDisplay && StatusIcon && (
          <View style={[styles.statusBanner, { backgroundColor: statusDisplay.color + '20' }]}>
            <StatusIcon size={20} color={statusDisplay.color} />
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>
              {statusDisplay.text}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Professional Role</Text>
          <Text style={styles.sectionDescription}>
            Choose the role that best matches your expertise
          </Text>
          
          <View style={styles.rolesList}>
            {roles.map((role: ProfessionalRole) => (
              <TouchableOpacity
                key={role.id}
                style={[
                  styles.roleOption,
                  selectedRole?.id === role.id && styles.roleOptionSelected,
                ]}
                onPress={() => setSelectedRole(role)}
              >
                <View style={styles.roleOptionContent}>
                  <Briefcase size={24} color={selectedRole?.id === role.id ? themeColors.primary : themeColors.text.secondary} />
                  <View style={styles.roleOptionText}>
                    <Text style={[
                      styles.roleOptionName,
                      selectedRole?.id === role.id && styles.roleOptionNameSelected,
                    ]}>
                      {role.name}
                    </Text>
                    <Text style={styles.roleOptionCategory}>{role.category}</Text>
                    {role.description && (
                      <Text style={styles.roleOptionDescription}>{role.description}</Text>
                    )}
                    {role.requiresCredentials && (
                      <Text style={styles.roleRequirement}>✓ Credentials required</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {selectedRole && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about your professional background and experience"
                  multiline
                  numberOfLines={6}
                  placeholderTextColor={themeColors.text.tertiary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Location (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  placeholderTextColor={themeColors.text.tertiary}
                />
              </View>
            </View>

            {selectedRole.requiresCredentials && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Credentials</Text>
                <Text style={styles.sectionDescription}>
                  Add your professional credentials, certifications, or licenses
                </Text>

                <View style={styles.credentialsList}>
                  {credentials.map((cred: string, index: number) => (
                    <View key={index} style={styles.credentialItem}>
                      <Text style={styles.credentialText}>{cred}</Text>
                      <TouchableOpacity onPress={() => handleRemoveCredential(index)}>
                        <XCircle size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.addCredentialContainer}>
                  <TextInput
                    style={styles.credentialInput}
                    value={credentialInput}
                    onChangeText={setCredentialInput}
                    placeholder="Add credential (e.g., Licensed Therapist, MBA)"
                    placeholderTextColor={themeColors.text.tertiary}
                    onSubmitEditing={handleAddCredential}
                  />
                  <TouchableOpacity
                    style={styles.addCredentialButton}
                    onPress={handleAddCredential}
                  >
                    <Text style={styles.addCredentialButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUploadDocument}
                >
                  <Upload size={20} color={themeColors.primary} />
                  <Text style={styles.uploadButtonText}>Upload Credential Document</Text>
                </TouchableOpacity>

                {credentialDocuments.length > 0 && (
                  <View style={styles.documentsList}>
                    {credentialDocuments.map((doc: { type: string; url: string; verified: boolean }, index: number) => (
                      <View key={index} style={styles.documentItem}>
                        <Text style={styles.documentText}>{doc.type.toUpperCase()} Document</Text>
                        <Text style={styles.documentUrl} numberOfLines={1}>{doc.url}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {selectedRole.disclaimerText && (
              <View style={styles.disclaimerContainer}>
                <Text style={styles.disclaimerTitle}>Important Notice</Text>
                <Text style={styles.disclaimerText}>{selectedRole.disclaimerText}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.text.white} />
              ) : (
                <>
                  <Save size={20} color={colors.text.white} />
                  <Text style={styles.submitButtonText}>
                    {existingProfile ? 'Update Application' : 'Submit Application'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
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
  section: {
    padding: 16,
    backgroundColor: colors.background.primary,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  rolesList: {
    gap: 12,
  },
  roleOption: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  roleOptionContent: {
    flexDirection: 'row',
    gap: 12,
  },
  roleOptionText: {
    flex: 1,
  },
  roleOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  roleOptionNameSelected: {
    color: colors.primary,
  },
  roleOptionCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  roleOptionDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  roleRequirement: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  credentialsList: {
    marginBottom: 12,
    gap: 8,
  },
  credentialItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  credentialText: {
    fontSize: 14,
    color: colors.text.primary,
    flex: 1,
  },
  addCredentialContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  credentialInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
  },
  addCredentialButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addCredentialButtonText: {
    color: colors.text.white,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  documentsList: {
    marginTop: 12,
    gap: 8,
  },
  documentItem: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  documentUrl: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  disclaimerContainer: {
    backgroundColor: colors.warning + '20',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.white,
  },
});

