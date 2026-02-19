import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
 Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IdCard, ArrowLeft, Upload, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - legacy path works at runtime
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';

import { supabase } from '@/lib/supabase';

interface VerificationDocument {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  reviewed_at?: string;
  submitted_at?: string;
}

export default function IdVerificationScreen() {
  const router = useRouter();
  const { currentUser, updateUserProfile } = useApp();
  const [idImageUrl, setIdImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentVerification, setCurrentVerification] = useState<VerificationDocument | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    loadVerificationStatus();
  }, []);

  const loadVerificationStatus = async () => {
    if (!currentUser?.id) return;
    
    try {
      setLoadingStatus(true);
      const { data, error } = await supabase
        .from('verification_documents')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('document_type', 'government_id')
        .order('submitted_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setCurrentVerification(data[0] as VerificationDocument);
        // If there's a current verification, don't show upload option unless rejected
        if (data[0].status !== 'rejected') {
          setIdImageUrl(data[0].document_url);
        }
      }
    } catch (error) {
      console.error('Failed to load verification status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const uploadIdDocument = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const fileName = `id_${currentUser?.id}_${Date.now()}.jpg`;
        let uint8Array: Uint8Array;
        
        // Handle web platform differently
        if (Platform.OS === 'web') {
          // For web, fetch the image and convert to blob
          const response = await fetch(result.assets[0].uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          uint8Array = new Uint8Array(arrayBuffer);
        } else {
          // For native platforms, use FileSystem
          const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Convert base64 to Uint8Array
          const binaryString = atob(base64);
          uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }
        }

        const { error } = await supabase.storage
          .from('media')
          .upload(fileName, uint8Array, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        setIdImageUrl(publicUrl);
      } catch (error: any) {
        console.error('Failed to upload ID:', error);
        Alert.alert('Error', error.message || 'Failed to upload ID document');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const submitForVerification = async () => {
    if (!idImageUrl) {
      Alert.alert('Error', 'Please upload your ID document first');
      return;
    }

    setIsSubmitting(true);
    try {
      // If there's a rejected verification, update it; otherwise insert new
      if (currentVerification && currentVerification.status === 'rejected') {
        const { error } = await supabase
          .from('verification_documents')
          .update({
            document_url: idImageUrl,
            status: 'pending',
            rejection_reason: null,
            reviewed_at: null,
            reviewed_by: null,
          })
          .eq('id', currentVerification.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('verification_documents')
          .insert({
            user_id: currentUser?.id,
            document_url: idImageUrl,
            document_type: 'government_id',
            status: 'pending',
          });

        if (error) throw error;
      }

      Alert.alert(
        'Success',
        'Your ID has been submitted for verification. You will be notified once it is approved.',
        [{ text: 'OK', onPress: () => loadVerificationStatus() }]
      );
    } catch (error: any) {
      console.error('Failed to submit verification:', error);
      Alert.alert('Error', error?.message || 'Failed to submit verification request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'ID Verification',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <IdCard size={48} color={colors.primary} />
          </View>

          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            Upload a government-issued ID to complete your identity verification
          </Text>

          {/* Current Verification Status */}
          {loadingStatus ? (
            <View style={styles.statusCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>Loading status...</Text>
            </View>
          ) : currentVerification ? (
            <View style={styles.statusCard}>
              {currentVerification.status === 'pending' && (
                <>
                  <Clock size={24} color={colors.accent} />
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Verification Pending</Text>
                    <Text style={styles.statusSubtext}>
                      Submitted: {new Date(currentVerification.submitted_at || Date.now()).toLocaleDateString()}
                    </Text>
                    <Text style={styles.statusDescription}>
                      Your ID is under review. We'll notify you once it's been processed.
                    </Text>
                  </View>
                </>
              )}
              {currentVerification.status === 'approved' && (
                <>
                  <CheckCircle2 size={24} color={colors.status.verified} />
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Verification Approved</Text>
                    <Text style={styles.statusSubtext}>
                      Approved: {currentVerification.reviewed_at ? new Date(currentVerification.reviewed_at).toLocaleDateString() : 'N/A'}
                    </Text>
                    <Text style={styles.statusDescription}>
                      Your identity has been verified successfully.
                    </Text>
                  </View>
                </>
              )}
              {currentVerification.status === 'rejected' && (
                <>
                  <XCircle size={24} color={colors.danger} />
                  <View style={styles.statusContent}>
                    <Text style={styles.statusTitle}>Verification Rejected</Text>
                    <Text style={styles.statusSubtext}>
                      Rejected: {currentVerification.reviewed_at ? new Date(currentVerification.reviewed_at).toLocaleDateString() : 'N/A'}
                    </Text>
                    {currentVerification.rejection_reason && (
                      <View style={styles.rejectionReasonBox}>
                        <Text style={styles.rejectionReasonLabel}>Reason:</Text>
                        <Text style={styles.rejectionReasonText}>{currentVerification.rejection_reason}</Text>
                      </View>
                    )}
                    <Text style={styles.statusDescription}>
                      Please review the reason above and resubmit with a new document.
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : null}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Accepted Documents:</Text>
            <Text style={styles.infoText}>• Driver&apos;s License</Text>
            <Text style={styles.infoText}>• Passport</Text>
            <Text style={styles.infoText}>• National ID Card</Text>
            <Text style={styles.infoText}>• State ID</Text>
          </View>

          {/* Show current document if approved or pending, or allow upload if rejected or no submission */}
          {(!currentVerification || currentVerification.status === 'rejected') && (
            <>
              {idImageUrl ? (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>New Document</Text>
                  <View style={styles.imagePreview}>
                    <Image
                      source={{ uri: idImageUrl }}
                      style={styles.previewImage}
                      contentFit="cover"
                    />
                    <View style={styles.checkBadge}>
                      <CheckCircle2 size={24} color={colors.secondary} />
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.changeButton}
                    onPress={uploadIdDocument}
                  >
                    <Text style={styles.changeButtonText}>Change Document</Text>
                  </TouchableOpacity>
                </View>
              ) : (
            <TouchableOpacity
              style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
              onPress={uploadIdDocument}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Upload size={32} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Upload ID Document</Text>
                  <Text style={styles.uploadButtonSubtext}>
                    Tap to select from your photos
                  </Text>
                </>
              )}
              </TouchableOpacity>
              )}

              {idImageUrl && (
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                  onPress={submitForVerification}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.text.white} />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {currentVerification?.status === 'rejected' ? 'Resubmit for Verification' : 'Submit for Verification'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Show submitted document if approved or pending */}
          {currentVerification && currentVerification.status !== 'rejected' && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Submitted Document</Text>
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: currentVerification.document_url }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
                {currentVerification.status === 'approved' && (
                  <View style={styles.checkBadge}>
                    <CheckCircle2 size={24} color={colors.status.verified} />
                  </View>
                )}
                {currentVerification.status === 'pending' && (
                  <View style={styles.checkBadge}>
                    <Clock size={24} color={colors.accent} />
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.securityNote}>
            <Text style={styles.securityText}>
              🔒 Your ID is encrypted and securely stored. We will never share your personal information.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  infoBox: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  uploadButton: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 48,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
    marginTop: 16,
  },
  uploadButtonSubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: 300,
    height: 200,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  changeButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  securityNote: {
    backgroundColor: colors.badge.verified,
    borderRadius: 12,
    padding: 16,
  },
  securityText: {
    fontSize: 14,
    color: colors.badge.verifiedText,
    lineHeight: 20,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  statusText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginLeft: 12,
  },
  rejectionReasonBox: {
    backgroundColor: colors.danger + '15',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  rejectionReasonLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.danger,
    marginBottom: 4,
  },
  rejectionReasonText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
});
