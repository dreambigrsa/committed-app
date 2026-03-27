import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { Advertisement } from '@/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - legacy path works at runtime
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { Upload, X } from 'lucide-react-native';
import * as PaymentAdminService from '@/lib/payment-admin-service';

export default function PromoteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const adIdParam = params.adId as string | undefined;
  const postIdParam = params.postId as string | undefined;
  const reelIdParam = params.reelId as string | undefined;
  const { currentUser, createAdvertisement, updateAdvertisement, createNotification } = useApp();

  const [loading, setLoading] = useState(false);
  const [isBoostingContent, setIsBoostingContent] = useState<boolean>(!!postIdParam || !!reelIdParam);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Partial<Advertisement>>({
    title: '',
    description: '',
    imageUrl: '',
    ctaType: 'whatsapp',
    ctaPhone: '',
    ctaMessage: '',
    ctaMessengerId: '',
    ctaUrl: '',
    placement: 'feed',
    dailyBudget: 5,
    totalBudget: 20,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    status: 'pending',
    targeting: {},
    billingProvider: 'manual',
  });
  const [targeting, setTargeting] = useState<{
    locations: string;
    gender: 'any' | 'male' | 'female';
    ageMin: string;
    ageMax: string;
    interests: string;
  }>({
    locations: '',
    gender: 'any',
    ageMin: '18',
    ageMax: '65',
    interests: '',
  });
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<any>(null);
  const [payment, setPayment] = useState<{
    methodId: string;
    reference: string;
    proofUrl: string;
  }>({
    methodId: '',
    reference: '',
    proofUrl: '',
  });
  const [paymentProofUri, setPaymentProofUri] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalSteps = 4;

  const uploadPaymentProof = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingProof(true);
      try {
        if (!currentUser) {
          throw new Error('User not authenticated');
        }
        setPaymentProofUri(result.assets[0].uri);
        const fileName = `payment_proof_${currentUser.id}_${Date.now()}.jpg`;

        let uint8Array: Uint8Array;
        if (Platform.OS === 'web') {
          const response = await fetch(result.assets[0].uri);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          uint8Array = new Uint8Array(arrayBuffer);
        } else {
          const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

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

        setPayment((p) => ({ ...p, proofUrl: publicUrl }));
        Alert.alert('Success', 'Payment proof uploaded!');
      } catch (error: any) {
        console.error('Failed to upload payment proof:', error);
        Alert.alert('Error', error.message || 'Failed to upload payment proof');
        setPaymentProofUri(null);
      } finally {
        setUploadingProof(false);
      }
    }
  };

  useEffect(() => {
    setIsBoostingContent(!!postIdParam || !!reelIdParam);
  }, [postIdParam, reelIdParam]);

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const methods = await PaymentAdminService.getPaymentMethods();
        setPaymentMethods(methods);
        if (methods.length > 0) {
          setSelectedMethod(methods[0]);
          setPayment((p) => ({ ...p, methodId: methods[0].id }));
        }
      } catch (e) {
        console.error('Failed to load payment methods:', e);
      }
    };
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    const loadAd = async () => {
      if (!adIdParam) return;
      setLoading(true);
      const { data, error } = await supabase.from('advertisements').select('*').eq('id', adIdParam).single();
      if (!error && data) {
        setForm({
          id: data.id,
          title: data.title,
          description: data.description,
          imageUrl: data.image_url,
          linkUrl: data.link_url,
          type: data.type,
          placement: data.placement,
          active: data.active,
          ctaType: data.cta_type,
          ctaPhone: data.cta_phone,
          ctaMessage: data.cta_message,
          ctaMessengerId: data.cta_messenger_id,
          ctaUrl: data.cta_url,
          sponsorName: data.sponsor_name,
          sponsorVerified: data.sponsor_verified,
          status: data.status,
          rejectionReason: data.rejection_reason,
          startDate: data.start_date,
          endDate: data.end_date,
          dailyBudget: data.daily_budget,
          totalBudget: data.total_budget,
          spend: data.spend,
          billingStatus: data.billing_status,
          billingProvider: data.billing_provider,
          billingTxnId: data.billing_txn_id,
          promotedPostId: data.promoted_post_id,
          promotedReelId: data.promoted_reel_id,
          targeting: data.targeting || {},
        });
        if (data.targeting) {
          setTargeting({
            locations: data.targeting.locations || '',
            gender: data.targeting.gender || 'any',
            ageMin: String(data.targeting.ageMin || '18'),
            ageMax: String(data.targeting.ageMax || '65'),
            interests: data.targeting.interests || '',
          });
          const selected = paymentMethods.find((m) => m.id === data.targeting.paymentMethod) || null;
          setSelectedMethod(selected);
          setPayment({
            methodId: data.targeting.paymentMethod || '',
            reference: data.billing_txn_id || '',
            proofUrl: data.targeting.paymentProofUrl || '',
          });
          setPaymentProofUri(data.targeting.paymentProofUrl || null);
        }
      }
      setLoading(false);
    };
    loadAd();
  }, [adIdParam, paymentMethods]);

  useEffect(() => {
    const loadContentDefaults = async () => {
      if (!currentUser) return;
      if (adIdParam) return; // editing existing ad
      if (!postIdParam && !reelIdParam) return; // standalone ad creation

      setLoading(true);
      try {
        if (postIdParam) {
          const { data: post, error } = await supabase
            .from('posts')
            .select('id, content, media_urls, created_at')
            .eq('id', postIdParam)
            .single();
          if (error) throw error;

          const mediaUrls: string[] = Array.isArray((post as any).media_urls) ? (post as any).media_urls : [];
          const firstMedia = mediaUrls[0] || '';
          const isVideo = firstMedia ? (firstMedia.includes('.mp4') || firstMedia.includes('.mov') || firstMedia.includes('video')) : false;
          const postContent = (post as any).content || '';
          
          // Auto-detect title: first line or first 50 chars
          const autoTitle = postContent.split('\n')[0].trim() || postContent.substring(0, 50).trim() || 'Boost post';
          // Auto-detect description: full content or truncated
          const autoDescription = postContent || '';

          setForm((f) => ({
            ...f,
            // Facebook-style: use the post itself as creative, auto-detect title and description
            title: f.title || autoTitle,
            description: f.description || autoDescription,
            imageUrl: f.imageUrl || firstMedia,
            type: f.type || (isVideo ? 'video' : 'card'),
            promotedPostId: postIdParam,
            promotedReelId: null,
            sponsorName: f.sponsorName || currentUser.fullName,
            sponsorVerified: f.sponsorVerified ?? false,
          }));
        } else if (reelIdParam) {
          const { data: reel, error } = await supabase
            .from('reels')
            .select('id, caption, video_url, thumbnail_url, created_at')
            .eq('id', reelIdParam)
            .single();
          if (error) throw error;

          const videoUrl = (reel as any).video_url as string | undefined;
          const thumbUrl = (reel as any).thumbnail_url as string | undefined;
          const reelCaption = (reel as any).caption || '';
          
          // Auto-detect title: first line or first 50 chars
          const autoTitle = reelCaption.split('\n')[0].trim() || reelCaption.substring(0, 50).trim() || 'Boost reel';
          // Auto-detect description: full caption or truncated
          const autoDescription = reelCaption || '';

          setForm((f) => ({
            ...f,
            title: f.title || autoTitle,
            description: f.description || autoDescription,
            // For video ads we use the video URL as creative; thumbnail (if any) is secondary
            imageUrl: f.imageUrl || videoUrl || thumbUrl || '',
            type: f.type || 'video',
            promotedReelId: reelIdParam,
            promotedPostId: null,
            sponsorName: f.sponsorName || currentUser.fullName,
            sponsorVerified: f.sponsorVerified ?? false,
          }));
        }
      } catch (e) {
        console.error('Failed to load boost content defaults:', e);
      } finally {
        setLoading(false);
      }
    };

    loadContentDefaults();
  }, [currentUser, adIdParam, postIdParam, reelIdParam]);

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!form.title || !form.description) {
        Alert.alert('Add creative', 'Please add a title and description.');
        return false;
      }
      if (!isBoostingContent && !form.imageUrl) {
        Alert.alert('Add media', 'Please add an image or video URL.');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!targeting.locations && !targeting.interests) {
        Alert.alert('Targeting needed', 'Add at least a location or interests.');
        return false;
      }
    }
    if (currentStep === 3) {
      if (!form.dailyBudget || !form.totalBudget) {
        Alert.alert('Budget required', 'Set a daily and total budget.');
        return false;
      }
      if (!form.startDate || !form.endDate) {
        Alert.alert('Schedule required', 'Set start and end dates.');
        return false;
      }
    }
    if (currentStep === 4) {
      if (!selectedMethod?.id) {
        Alert.alert('Payment method', 'Select a payment method.');
        return false;
      }
      if (!payment.proofUrl) {
        Alert.alert('Payment proof', 'Upload proof of payment.');
        return false;
      }
      if (!payment.reference) {
        Alert.alert('Payment reference', 'Provide a payment reference/transaction ID.');
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < totalSteps) setStep(step + 1);
    else save();
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const save = async () => {
    if (!currentUser) {
      Alert.alert('Login required', 'Please sign in to promote content.');
      return;
    }
    // For boost flows, we auto-fill from post/reel. For standalone ads we still require creative.
    if (!form.description || !form.imageUrl) {
      Alert.alert('Missing info', isBoostingContent ? 'Could not load post/reel creative. Please try again.' : 'Please fill description and image/video URL.');
      return;
    }
    setLoading(true);
    const payload: any = {
      ...form,
      placement: form.placement || 'feed',
      status: form.status || 'pending',
      promotedPostId: postIdParam || form.promotedPostId || null,
      promotedReelId: reelIdParam || form.promotedReelId || null,
      type: form.type || 'card',
      active: true,
      targeting: {
        ...(form.targeting || {}),
        locations: targeting.locations,
        gender: targeting.gender,
        ageMin: Number(targeting.ageMin) || 18,
        ageMax: Number(targeting.ageMax) || 65,
        interests: targeting.interests,
        paymentMethod: selectedMethod?.id || payment.methodId,
        paymentProofUrl: payment.proofUrl,
      },
      billingProvider: selectedMethod?.payment_type || 'manual',
      billingTxnId: payment.reference,
      billingStatus: form.billingStatus || 'pending',
    };
    try {
      let adId = adIdParam;
      if (adIdParam) {
        await updateAdvertisement(adIdParam, payload);
      } else {
        const created = await createAdvertisement(payload as any);
        adId = created?.id;
      }

      if (adId && selectedMethod?.id && payment.proofUrl) {
        const { data: submission, error } = await supabase
          .from('payment_submissions')
          .insert({
            user_id: currentUser.id,
            advertisement_id: adId,
            payment_method_id: selectedMethod.id,
            amount: Number(form.totalBudget || 0),
            currency: 'USD',
            payment_proof_url: payment.proofUrl,
            transaction_reference: payment.reference.trim() || null,
            payment_date: new Date().toISOString().split('T')[0],
            notes: null,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;

        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .in('role', ['admin', 'super_admin', 'moderator']);

        if (admins) {
          for (const admin of admins) {
            await createNotification(
              admin.id,
              'payment_submission',
              'Ad Payment Submitted',
              `${currentUser.fullName} submitted ad payment proof for review.`,
              { advertisementId: adId, submissionId: submission?.id }
            );
          }
        }
      }

      Alert.alert('Submitted', 'Your ad payment was submitted for review.');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save ad');
    } finally {
      setLoading(false);
    }
  };

  const setDate = (key: 'startDate' | 'endDate', date?: Date) => {
    if (date) setForm((f) => ({ ...f, [key]: date.toISOString() }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.header}>
          {adIdParam ? 'Edit Promotion' : isBoostingContent ? 'Boost' : 'Create Ad'}
        </Text>
        <Stepper step={step} total={totalSteps} colors={colors} />
        {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}

        {step === 1 && (
          <>
            <Section title="Creative" colors={colors}>
              <Field label="Title" value={form.title} onChangeText={(text) => setForm((f) => ({ ...f, title: text }))} colors={colors} />
              <Field
                label="Description"
                multiline
                value={form.description}
                onChangeText={(text) => setForm((f) => ({ ...f, description: text }))}
                colors={colors}
              />
              {!isBoostingContent && (
                <Field
                  label="Image / Video URL"
                  value={form.imageUrl}
                  onChangeText={(text) => setForm((f) => ({ ...f, imageUrl: text }))}
                  placeholder="https://..."
                  colors={colors}
                />
              )}
            </Section>

            <Section title="CTA" colors={colors}>
              <Segment
                options={[
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'messenger', label: 'Messenger' },
                  { value: 'website', label: 'Website' },
                ]}
                value={form.ctaType || 'whatsapp'}
                onChange={(v) => setForm((f) => ({ ...f, ctaType: v as any }))}
                colors={colors}
              />
              {form.ctaType === 'whatsapp' && (
                <>
                  <Field label="WhatsApp Number" value={form.ctaPhone} onChangeText={(text) => setForm((f) => ({ ...f, ctaPhone: text }))} colors={colors} />
                  <Field
                    label="Template Message"
                    multiline
                    value={form.ctaMessage}
                    onChangeText={(text) => setForm((f) => ({ ...f, ctaMessage: text }))}
                    colors={colors}
                  />
                </>
              )}
              {form.ctaType === 'messenger' && (
                <>
                  <Field
                    label="Messenger Page/User ID"
                    value={form.ctaMessengerId}
                    onChangeText={(text) => setForm((f) => ({ ...f, ctaMessengerId: text }))}
                    colors={colors}
                  />
                  <Field
                    label="Template Message"
                    multiline
                    value={form.ctaMessage}
                    onChangeText={(text) => setForm((f) => ({ ...f, ctaMessage: text }))}
                    colors={colors}
                  />
                </>
              )}
              {form.ctaType === 'website' && (
                <Field label="Website URL" value={form.ctaUrl} onChangeText={(text) => setForm((f) => ({ ...f, ctaUrl: text }))} colors={colors} />
              )}
            </Section>
          </>
        )}

        {step === 2 && (
          <>
            <Section title="Targeting" colors={colors}>
              <Field
                label="Locations (cities/countries)"
                value={targeting.locations}
                onChangeText={(text) => setTargeting((t) => ({ ...t, locations: text }))}
                placeholder="e.g. Harare; Lagos; Nairobi"
                colors={colors}
              />
              <Field
                label="Interests / Keywords"
                value={targeting.interests}
                onChangeText={(text) => setTargeting((t) => ({ ...t, interests: text }))}
                placeholder="cleaning services, beauty, sports..."
                colors={colors}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Age min"
                    value={targeting.ageMin}
                    onChangeText={(text) => setTargeting((t) => ({ ...t, ageMin: text }))}
                    keyboardType="number-pad"
                    colors={colors}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Age max"
                    value={targeting.ageMax}
                    onChangeText={(text) => setTargeting((t) => ({ ...t, ageMax: text }))}
                    keyboardType="number-pad"
                    colors={colors}
                  />
                </View>
              </View>
              <Segment
                options={[
                  { value: 'any', label: 'All genders' },
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                ]}
                value={targeting.gender}
                onChange={(v) => setTargeting((t) => ({ ...t, gender: v as any }))}
                colors={colors}
              />
            </Section>

            <Section title="Placement" colors={colors}>
              <Segment
                options={[
                  { value: 'feed', label: 'Feed' },
                  { value: 'reels', label: 'Reels' },
                  { value: 'messages', label: 'Messages' },
                  { value: 'all', label: 'All' },
                ]}
                value={form.placement || 'feed'}
                onChange={(v) => setForm((f) => ({ ...f, placement: v as any }))}
                colors={colors}
              />
            </Section>
          </>
        )}

        {step === 3 && (
          <Section title="Budget & Schedule" colors={colors}>
            <Field
              label="Daily Budget (USD)"
              keyboardType="decimal-pad"
              value={form.dailyBudget?.toString() || ''}
              onChangeText={(text) => setForm((f) => ({ ...f, dailyBudget: parseFloat(text) || 0 }))}
              colors={colors}
            />
            <Field
              label="Total Budget (USD)"
              keyboardType="decimal-pad"
              value={form.totalBudget?.toString() || ''}
              onChangeText={(text) => setForm((f) => ({ ...f, totalBudget: parseFloat(text) || 0 }))}
              colors={colors}
            />
            <DateRow
              label="Start Date"
              value={form.startDate}
              onPress={() => setShowStartPicker(true)}
              colors={colors}
            />
            <DateRow
              label="End Date"
              value={form.endDate}
              onPress={() => setShowEndPicker(true)}
              colors={colors}
            />
            {showStartPicker && (
              <DateTimePicker
                value={form.startDate ? new Date(form.startDate) : new Date()}
                mode="date"
                onChange={(e, d) => {
                  setShowStartPicker(false);
                  if (d) setDate('startDate', d);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={form.endDate ? new Date(form.endDate) : new Date()}
                mode="date"
                onChange={(e, d) => {
                  setShowEndPicker(false);
                  if (d) setDate('endDate', d);
                }}
              />
            )}
          </Section>
        )}

        {step === 4 && (
          <>
            <Section title="Payment" colors={colors}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text.primary }}>
                  Select Payment Method
                </Text>
                {paymentMethods.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.methodCard,
                      selectedMethod?.id === method.id && styles.methodCardSelected,
                    ]}
                    onPress={() => {
                      setSelectedMethod(method);
                      setPayment((p) => ({ ...p, methodId: method.id }));
                    }}
                  >
                    <View style={styles.methodHeader}>
                      <Text style={styles.methodIcon}>{method.icon_emoji || '💳'}</Text>
                      <View style={styles.methodInfo}>
                        <Text style={styles.methodName}>{method.name}</Text>
                        {method.description && (
                          <Text style={styles.methodDescription}>{method.description}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {selectedMethod && (
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
                </View>
              )}
              <Field
                label="Payment reference / transaction ID"
                value={payment.reference}
                onChangeText={(text) => setPayment((p) => ({ ...p, reference: text }))}
                placeholder="e.g. receipt #, transfer reference"
                colors={colors}
              />
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6 }}>Proof of payment</Text>
                {payment.proofUrl ? (
                  <View style={styles.proofContainer}>
                    <Image source={{ uri: paymentProofUri || payment.proofUrl }} style={styles.proofImage} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.removeProofButton}
                      onPress={() => {
                        setPayment((p) => ({ ...p, proofUrl: '' }));
                        setPaymentProofUri(null);
                      }}
                    >
                      <X size={16} color={colors.text.white} />
                    </TouchableOpacity>
                    <Text style={styles.proofUrlText} numberOfLines={1}>{payment.proofUrl}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={uploadPaymentProof}
                    disabled={uploadingProof}
                  >
                    {uploadingProof ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Upload size={20} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Upload receipt/screenshot</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: 6 }}>
                  Upload a screenshot or photo of your payment receipt for admin verification.
                </Text>
              </View>
            </Section>

            <Section title="Review" colors={colors}>
              <View style={styles.reviewContainer}>
                <Text style={styles.reviewLine}>Title: {form.title}</Text>
                <Text style={styles.reviewLine}>Description: {form.description}</Text>
                <Text style={styles.reviewLine}>Placement: {form.placement}</Text>
                <Text style={styles.reviewLine}>Budget: ${form.dailyBudget} / day, total ${form.totalBudget}</Text>
                <Text style={styles.reviewLine}>Schedule: {form.startDate ? new Date(form.startDate).toDateString() : '-'} → {form.endDate ? new Date(form.endDate).toDateString() : '-'}</Text>
                <Text style={styles.reviewLine}>CTA: {form.ctaType}</Text>
                <Text style={styles.reviewLine}>Targeting: {targeting.locations || 'anywhere'} | {targeting.interests || 'broad'} | {targeting.gender} | {targeting.ageMin}-{targeting.ageMax}</Text>
                <Text style={styles.reviewLine}>Payment: {selectedMethod?.name || 'Manual'} / ref {payment.reference || '-'}</Text>
              </View>
            </Section>
          </>
        )}

        <View style={styles.navRow}>
          {step > 1 && (
            <TouchableOpacity style={[styles.navButton, styles.navSecondary]} onPress={goBack} disabled={loading}>
              <Text style={styles.navSecondaryText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.navButton, styles.navPrimary]} onPress={goNext} disabled={loading}>
            <Text style={styles.navPrimaryText}>{step === totalSteps ? (adIdParam ? 'Update' : 'Submit for Review') : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ step, total, colors }: { step: number; total: number; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 8, paddingVertical: 12 }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 <= step;
        const current = i + 1 === step;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: active ? colors.primary : colors.border.light,
                width: '100%',
              }}
            />
            {current && (
              <View
                style={{
                  position: 'absolute',
                  top: -4,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: colors.primary,
                  borderWidth: 2,
                  borderColor: colors.background.primary,
                }}
              />
            )}
          </View>
        );
      })}
      <Text style={{ marginLeft: 8, fontWeight: '700', fontSize: 13, color: colors.text.secondary }}>
        {step}/{total}
      </Text>
    </View>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: 24, backgroundColor: colors.background.secondary, borderRadius: 16, padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: colors.text.primary }}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  colors,
}: {
  label: string;
  value?: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  colors: any;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text.primary }}>{label}</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 12,
          padding: 14,
          fontSize: 15,
          backgroundColor: colors.background.secondary,
          color: colors.text.primary,
          minHeight: multiline ? 100 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.text.tertiary}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function Segment({
  options,
  value,
  onChange,
  colors,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: any;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, backgroundColor: colors.background.secondary, borderRadius: 12, padding: 4 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: value === opt.value ? colors.primary : 'transparent',
            alignItems: 'center',
          }}
          onPress={() => onChange(opt.value)}
        >
          <Text style={{ color: value === opt.value ? colors.text.white : colors.text.primary, fontWeight: '700', fontSize: 14 }}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DateRow({ label, value, onPress, colors }: { label: string; value?: string | null; onPress: () => void; colors: any }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.text.primary }}>{label}</Text>
      <View style={{ borderWidth: 1, borderColor: colors.border.light, borderRadius: 12, padding: 14, backgroundColor: colors.background.primary }}>
        <Text style={{ fontSize: 15, color: colors.text.primary }}>{value ? new Date(value).toDateString() : 'Select date'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    form: { padding: 20 },
    header: { fontSize: 28, fontWeight: '800', marginBottom: 8, color: colors.text.primary, letterSpacing: -0.5 },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12, paddingBottom: 20 },
    navButton: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    navPrimary: { backgroundColor: colors.primary },
    navPrimaryText: { color: colors.text.white, fontWeight: '700', fontSize: 16 },
    navSecondary: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.light },
    navSecondaryText: { color: colors.text.primary, fontWeight: '700', fontSize: 16 },
    reviewContainer: { backgroundColor: colors.background.primary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border.light },
    reviewLine: { fontSize: 14, marginBottom: 10, color: colors.text.primary, lineHeight: 20 },
    methodCard: { backgroundColor: colors.background.secondary, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
    methodCardSelected: { borderColor: colors.primary },
    methodHeader: { flexDirection: 'row', alignItems: 'center' },
    methodIcon: { fontSize: 28, marginRight: 12 },
    methodInfo: { flex: 1 },
    methodName: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: 4 },
    methodDescription: { fontSize: 13, color: colors.text.secondary },
    instructionsCard: { backgroundColor: colors.background.secondary, padding: 16, borderRadius: 12, marginBottom: 12 },
    accountDetails: { marginBottom: 12 },
    accountDetailsTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 8 },
    accountDetailRow: { flexDirection: 'row', marginBottom: 6 },
    accountDetailLabel: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, width: 120 },
    accountDetailValue: { fontSize: 12, color: colors.text.primary, flex: 1 },
    instructions: { marginBottom: 8 },
    instructionsTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 6 },
    instructionsText: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
    uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.background.primary, borderWidth: 2, borderColor: colors.border.light, borderStyle: 'dashed' },
    uploadButtonText: { fontSize: 15, fontWeight: '600', color: colors.primary },
    proofContainer: { position: 'relative', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border.light },
    proofImage: { width: '100%', height: 200 },
    removeProofButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    proofUrlText: { fontSize: 12, color: colors.text.secondary, padding: 8, backgroundColor: colors.background.secondary },
  });

