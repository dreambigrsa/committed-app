import React, { useEffect, useState } from 'react';
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
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const styles = createStyles(colors);

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
        });
      }
      setLoading(false);
    };
    loadAd();
  }, [adIdParam]);

  const save = async () => {
    if (!currentUser) {
      Alert.alert('Login required', 'Please sign in to promote content.');
      return;
    }
    if (!form.title || !form.description || !form.imageUrl) {
      Alert.alert('Missing info', 'Please fill title, description, and image URL/video URL.');
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
        <Text style={styles.header}>{adIdParam ? 'Edit Promotion' : 'Boost Content'}</Text>
        {loading && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}

        <Section title="Creative">
          <Field label="Title" value={form.title} onChangeText={(text) => setForm((f) => ({ ...f, title: text }))} />
          <Field
            label="Description"
            multiline
            value={form.description}
            onChangeText={(text) => setForm((f) => ({ ...f, description: text }))}
          />
          <Field
            label="Image / Video URL"
            value={form.imageUrl}
            onChangeText={(text) => setForm((f) => ({ ...f, imageUrl: text }))}
            placeholder="https://..."
          />
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

        <TouchableOpacity style={styles.submit} onPress={save} disabled={loading}>
          <Text style={styles.submitText}>{adIdParam ? 'Update' : 'Submit for Review'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
    submit: {
      marginTop: 10,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    submitText: { color: colors.text.white, fontWeight: '700', fontSize: 16 },
  });

