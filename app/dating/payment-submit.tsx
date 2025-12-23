import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Upload, CreditCard, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import * as PaymentAdminService from '@/lib/payment-admin-service';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - legacy path works at runtime, TypeScript definitions may not include it
import * as FileSystem from 'expo-file-system/legacy';
import { useApp } from '@/contexts/AppContext';

export default function PaymentSubmitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ planId: string }>();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [plan, setPlan] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [paymentProofUri, setPaymentProofUri] = useState<string | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', params.planId)
        .single();

      if (planError || !planData) {
        Alert.alert('Error', 'Plan not found');
        router.back();
        return;
      }

      setPlan(planData);

      // Load payment methods
      const methods = await PaymentAdminService.getPaymentMethods();
      setPaymentMethods(methods);
      
      // Auto-select first payment method
      if (methods.length > 0) {
        setSelectedMethod(methods[0]);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load payment information');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickPaymentProof = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPaymentProofUri(result.assets[0].uri);
        await uploadPaymentProof(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadPaymentProof = async (uri: string) => {
    try {
      setIsUploading(true);

      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Convert URI to Uint8Array for upload
      let uint8Array: Uint8Array;
      
      // Handle web platform differently
      if (Platform.OS === 'web') {
        // For web, fetch the image and convert to blob
        const response = await fetch(uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        uint8Array = new Uint8Array(arrayBuffer);
      } else {
        // For native platforms, use FileSystem
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
      }

      // Upload to Supabase Storage
      const fileName = `payment_proof_${currentUser.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, uint8Array, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      setPaymentProofUrl(publicUrl);
    } catch (error: any) {
      console.error('Error uploading payment proof:', error);
      Alert.alert('Error', error.message || 'Failed to upload payment proof');
      setPaymentProofUri(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (!paymentProofUrl) {
      Alert.alert('Error', 'Please upload payment proof');
      return;
    }

    if (!currentUser || !plan) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create payment submission (NOT a subscription - that comes after admin verification)
      const { data, error } = await supabase
        .from('payment_submissions')
        .insert({
          user_id: currentUser.id,
          subscription_plan_id: plan.id,
          payment_method_id: selectedMethod.id,
          amount: plan.price_monthly || plan.price_yearly || 0,
          currency: 'USD',
          payment_proof_url: paymentProofUrl,
          transaction_reference: transactionReference.trim() || null,
          payment_date: new Date().toISOString().split('T')[0],
          notes: notes.trim() || null,
          status: 'pending', // Will be approved/rejected by admin
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert(
        'Payment Submitted!',
        'Your payment proof has been submitted for verification. You will be notified once it is approved and your subscription is activated.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/dating/premium');
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      Alert.alert('Error', error.message || 'Failed to submit payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Submit Payment', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Submit Payment',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plan Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plan Details</Text>
          <View style={styles.planSummary}>
            <Text style={styles.planName}>{plan?.display_name}</Text>
            <Text style={styles.planPrice}>
              ${plan?.price_monthly?.toFixed(2) || plan?.price_yearly?.toFixed(2) || '0.00'}
              {plan?.price_monthly ? '/month' : plan?.price_yearly ? '/year' : ''}
            </Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod?.id === method.id && styles.methodCardSelected,
              ]}
              onPress={() => setSelectedMethod(method)}
            >
              <View style={styles.methodHeader}>
                <Text style={styles.methodIcon}>{method.icon_emoji || '💳'}</Text>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodName}>{method.name}</Text>
                  {method.description && (
                    <Text style={styles.methodDescription}>{method.description}</Text>
                  )}
                </View>
                {selectedMethod?.id === method.id && (
                  <CheckCircle size={24} color={colors.success} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment Details */}
        {selectedMethod && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Instructions</Text>
            <View style={styles.instructionsCard}>
              {selectedMethod.account_details && (
                <View style={styles.accountDetails}>
                  <Text style={styles.accountDetailsTitle}>Account Details:</Text>
                  {Object.entries(selectedMethod.account_details).map(([key, value]) => (
                    <View key={key} style={styles.accountDetailRow}>
                      <Text style={styles.accountDetailLabel}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}:
                      </Text>
                      <Text style={styles.accountDetailValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>
              )}
              {selectedMethod.instructions && (
                <View style={styles.instructions}>
                  <Text style={styles.instructionsTitle}>Instructions:</Text>
                  <Text style={styles.instructionsText}>{selectedMethod.instructions}</Text>
                </View>
              )}
              <View style={styles.referenceNote}>
                <AlertCircle size={16} color={colors.accent} />
                <Text style={styles.referenceNoteText}>
                  Use your User ID as reference: {currentUser?.id.substring(0, 8)}...
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Proof Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upload Payment Proof *</Text>
          <Text style={styles.sectionSubtitle}>
            Upload a screenshot or photo of your payment receipt/confirmation
          </Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handlePickPaymentProof}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : paymentProofUri ? (
              <View style={styles.proofPreview}>
                <ExpoImage
                  source={{ uri: paymentProofUri }}
                  style={styles.proofImage}
                  contentFit="contain"
                />
                <View style={styles.proofOverlay}>
                  <Upload size={24} color="#fff" />
                  <Text style={styles.proofOverlayText}>Change Photo</Text>
                </View>
              </View>
            ) : (
              <>
                <Upload size={24} color={colors.primary} />
                <Text style={styles.uploadButtonText}>Upload Payment Proof</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Transaction Reference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction Reference (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter transaction ID or reference number"
            placeholderTextColor={colors.text.tertiary}
            value={transactionReference}
            onChangeText={setTransactionReference}
          />
        </View>

        {/* Additional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Add any additional information about your payment"
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedMethod || !paymentProofUrl || isSubmitting) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitPayment}
            disabled={!selectedMethod || !paymentProofUrl || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CreditCard size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Payment for Verification</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Your payment will be reviewed by an administrator. You will be notified once your subscription is activated.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_IMAGE_HEIGHT = Math.min(SCREEN_WIDTH * 0.8, 350);

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 12,
    },
    planSummary: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
    },
    planName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    planPrice: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.primary,
    },
    methodCard: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    methodCardSelected: {
      borderColor: colors.primary,
    },
    methodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    methodIcon: {
      fontSize: 32,
      marginRight: 12,
    },
    methodInfo: {
      flex: 1,
    },
    methodName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    methodDescription: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    instructionsCard: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
    },
    accountDetails: {
      marginBottom: 16,
    },
    accountDetailsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 12,
    },
    accountDetailRow: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    accountDetailLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
      width: 120,
    },
    accountDetailValue: {
      fontSize: 14,
      color: colors.text.primary,
      flex: 1,
    },
    instructions: {
      marginBottom: 12,
    },
    instructionsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    instructionsText: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    referenceNote: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accent + '15',
      padding: 12,
      borderRadius: 8,
      marginTop: 8,
    },
    referenceNoteText: {
      fontSize: 13,
      color: colors.accent,
      marginLeft: 8,
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    uploadButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.light,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      height: MAX_IMAGE_HEIGHT,
      overflow: 'hidden',
    },
    proofPreview: {
      width: '100%',
      height: MAX_IMAGE_HEIGHT - 32,
      position: 'relative',
    },
    proofImage: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
    },
    proofOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    proofOverlayText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      marginTop: 8,
    },
    uploadButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginTop: 12,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 16,
    },
    submitButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
    },
    disclaimer: {
      fontSize: 12,
      color: colors.text.tertiary,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 18,
    },
  });

