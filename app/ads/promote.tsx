import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { Advertisement } from '@/types';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function PromoteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const adIdParam = params.adId as string | undefined;
  const postIdParam = params.postId as string | undefined;
  const reelIdParam = params.reelId as string | undefined;
  const { currentUser, createAdvertisement, updateAdvertisement } = useApp();

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
  const [payment, setPayment] = useState<{
    method: 'manual' | 'bank' | 'mobile_money';
    reference: string;
    proofUrl: string;
  }>({
    method: 'manual',
    reference: '',
    proofUrl: '',
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const totalSteps = 4;

  useEffect(() => {
    setIsBoostingContent(!!postIdParam || !!reelIdParam);
  }, [postIdParam, reelIdParam]);

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
          setPayment({
            method: (data.targeting.paymentMethod as any) || 'manual',
            reference: data.billing_txn_id || '',
            proofUrl: data.targeting.paymentProofUrl || '',
          });
        }
      }
      setLoading(false);
    };
    loadAd();
  }, [adIdParam]);

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
        paymentMethod: payment.method,
        paymentProofUrl: payment.proofUrl,
      },
      billingProvider: payment.method,
      billingTxnId: payment.reference,
      billingStatus: form.billingStatus || 'pending',
    };
    try {
      if (adIdParam) {
        await updateAdvertisement(adIdParam, payload);
      } else {
        await createAdvertisement(payload as any);
      }
      Alert.alert('Submitted', 'Your ad was submitted for review.');
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
        <Stepper step={step} total={totalSteps} />
        {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}

        {step === 1 && (
          <>
            <Section title="Creative">
              <Field label="Title" value={form.title} onChangeText={(text) => setForm((f) => ({ ...f, title: text }))} />
              <Field
                label="Description"
                multiline
                value={form.description}
                onChangeText={(text) => setForm((f) => ({ ...f, description: text }))}
              />
              {!isBoostingContent && (
                <Field
                  label="Image / Video URL"
                  value={form.imageUrl}
                  onChangeText={(text) => setForm((f) => ({ ...f, imageUrl: text }))}
                  placeholder="https://..."
                />
              )}
            </Section>

            <Section title="CTA">
              <Segment
                options={[
                  { value: 'whatsapp', label: 'WhatsApp' },
                  { value: 'messenger', label: 'Messenger' },
                  { value: 'website', label: 'Website' },
                ]}
                value={form.ctaType || 'whatsapp'}
                onChange={(v) => setForm((f) => ({ ...f, ctaType: v as any }))}
              />
              {form.ctaType === 'whatsapp' && (
                <>
                  <Field label="WhatsApp Number" value={form.ctaPhone} onChangeText={(text) => setForm((f) => ({ ...f, ctaPhone: text }))} />
                  <Field
                    label="Template Message"
                    multiline
                    value={form.ctaMessage}
                    onChangeText={(text) => setForm((f) => ({ ...f, ctaMessage: text }))}
                  />
                </>
              )}
              {form.ctaType === 'messenger' && (
                <>
                  <Field
                    label="Messenger Page/User ID"
                    value={form.ctaMessengerId}
                    onChangeText={(text) => setForm((f) => ({ ...f, ctaMessengerId: text }))}
                  />
                  <Field
                    label="Template Message"
                    multiline
                    value={form.ctaMessage}
                    onChangeText={(text) => setForm((f) => ({ ...f, ctaMessage: text }))}
                  />
                </>
              )}
              {form.ctaType === 'website' && (
                <Field label="Website URL" value={form.ctaUrl} onChangeText={(text) => setForm((f) => ({ ...f, ctaUrl: text }))} />
              )}
            </Section>
          </>
        )}

        {step === 2 && (
          <>
            <Section title="Targeting">
              <Field
                label="Locations (cities/countries)"
                value={targeting.locations}
                onChangeText={(text) => setTargeting((t) => ({ ...t, locations: text }))}
                placeholder="e.g. Harare; Lagos; Nairobi"
              />
              <Field
                label="Interests / Keywords"
                value={targeting.interests}
                onChangeText={(text) => setTargeting((t) => ({ ...t, interests: text }))}
                placeholder="cleaning services, beauty, sports..."
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Age min"
                    value={targeting.ageMin}
                    onChangeText={(text) => setTargeting((t) => ({ ...t, ageMin: text }))}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label="Age max"
                    value={targeting.ageMax}
                    onChangeText={(text) => setTargeting((t) => ({ ...t, ageMax: text }))}
                    keyboardType="number-pad"
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
              />
            </Section>

            <Section title="Placement">
              <Segment
                options={[
                  { value: 'feed', label: 'Feed' },
                  { value: 'reels', label: 'Reels' },
                  { value: 'messages', label: 'Messages' },
                  { value: 'all', label: 'All' },
                ]}
                value={form.placement || 'feed'}
                onChange={(v) => setForm((f) => ({ ...f, placement: v as any }))}
              />
            </Section>
          </>
        )}

        {step === 3 && (
          <Section title="Budget & Schedule">
            <Field
              label="Daily Budget (USD)"
              keyboardType="decimal-pad"
              value={form.dailyBudget?.toString() || ''}
              onChangeText={(text) => setForm((f) => ({ ...f, dailyBudget: parseFloat(text) || 0 }))}
            />
            <Field
              label="Total Budget (USD)"
              keyboardType="decimal-pad"
              value={form.totalBudget?.toString() || ''}
              onChangeText={(text) => setForm((f) => ({ ...f, totalBudget: parseFloat(text) || 0 }))}
            />
            <DateRow
              label="Start Date"
              value={form.startDate}
              onPress={() => setShowStartPicker(true)}
            />
            <DateRow
              label="End Date"
              value={form.endDate}
              onPress={() => setShowEndPicker(true)}
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
            <Section title="Payment">
              <Segment
                options={[
                  { value: 'manual', label: 'Manual (in-app/admin)' },
                  { value: 'bank', label: 'Bank' },
                  { value: 'mobile_money', label: 'Mobile Money' },
                ]}
                value={payment.method}
                onChange={(v) => setPayment((p) => ({ ...p, method: v as any }))}
              />
              <Field
                label="Payment reference / transaction ID"
                value={payment.reference}
                onChangeText={(text) => setPayment((p) => ({ ...p, reference: text }))}
                placeholder="e.g. receipt #, transfer reference"
              />
              <Field
                label="Proof of payment (link to screenshot/receipt)"
                value={payment.proofUrl}
                onChangeText={(text) => setPayment((p) => ({ ...p, proofUrl: text }))}
                placeholder="https://... (upload then paste link)"
              />
              <Text style={{ fontSize: 12, color: colors.text.secondary, marginTop: -4 }}>
                Tip: upload a receipt image to your storage and paste the URL so admins can verify.
              </Text>
            </Section>

            <Section title="Review">
              <Text style={styles.reviewLine}>Title: {form.title}</Text>
              <Text style={styles.reviewLine}>Description: {form.description}</Text>
              <Text style={styles.reviewLine}>Placement: {form.placement}</Text>
              <Text style={styles.reviewLine}>Budget: ${form.dailyBudget} / day, total ${form.totalBudget}</Text>
              <Text style={styles.reviewLine}>Schedule: {form.startDate ? new Date(form.startDate).toDateString() : '-'} → {form.endDate ? new Date(form.endDate).toDateString() : '-'}</Text>
              <Text style={styles.reviewLine}>CTA: {form.ctaType}</Text>
              <Text style={styles.reviewLine}>Targeting: {targeting.locations || 'anywhere'} | {targeting.interests || 'broad'} | {targeting.gender} | {targeting.ageMin}-{targeting.ageMax}</Text>
              <Text style={styles.reviewLine}>Payment: {payment.method} / ref {payment.reference || '-'}</Text>
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

function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 <= step;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 4,
              backgroundColor: active ? '#2563eb' : '#e5e7eb',
            }}
          />
        );
      })}
      <Text style={{ marginLeft: 8, fontWeight: '700' }}>{step}/{total}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>{title}</Text>
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
}: {
  label: string;
  value?: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 10,
          padding: 12,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        placeholder={placeholder}
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
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: value === opt.value ? '#2563eb' : '#f3f4f6',
            alignItems: 'center',
          }}
          onPress={() => onChange(opt.value)}
        >
          <Text style={{ color: value === opt.value ? '#fff' : '#111827', fontWeight: '700' }}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DateRow({ label, value, onPress }: { label: string; value?: string | null; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12 }}>
        <Text>{value ? new Date(value).toDateString() : 'Select date'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.primary },
    form: { padding: 16 },
    header: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: colors.text.primary },
    navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 10 },
    navButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    navPrimary: { backgroundColor: colors.primary },
    navPrimaryText: { color: colors.text.white, fontWeight: '700', fontSize: 16 },
    navSecondary: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.light },
    navSecondaryText: { color: colors.text.primary, fontWeight: '700', fontSize: 16 },
    reviewLine: { fontSize: 13, marginBottom: 6, color: colors.text.primary },
  });

