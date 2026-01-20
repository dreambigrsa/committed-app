import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, ScrollView, Share, Alert, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Download, X } from 'lucide-react-native';

export default function AdReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receiptId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [receipt, setReceipt] = useState<any>(null);
  const [advertisement, setAdvertisement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReceipt = async () => {
      if (!params.receiptId) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('ad_payment_receipts')
        .select('*')
        .eq('id', params.receiptId)
        .single();
      if (!error && data) {
        setReceipt(data);
        const { data: adData } = await supabase
          .from('advertisements')
          .select('id, title, placement, total_budget, billing_status, created_at')
          .eq('id', data.advertisement_id)
          .single();
        setAdvertisement(adData || null);
      }
      setLoading(false);
    };
    loadReceipt();
  }, [params.receiptId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Receipt', headerShown: true }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!receipt) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Receipt', headerShown: true }} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Receipt not found</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <X size={16} color={colors.text.primary} />
            <Text style={styles.closeButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleShareReceipt = async () => {
    const amount = `${receipt.currency || 'USD'} ${Number(receipt.amount || 0).toFixed(2)}`;
    const receiptText = [
      `Ad Payment Receipt`,
      `Receipt #${receipt.receipt_number}`,
      `Amount: ${amount}`,
      `Issued: ${new Date(receipt.issued_at).toLocaleString()}`,
      `Ad: ${advertisement?.title || '—'}`,
      `Placement: ${advertisement?.placement || '—'}`,
    ].join('\n');

    try {
      await Share.share({
        message: receiptText,
      });
    } catch (error) {
      const maybeNavigator =
        typeof globalThis !== 'undefined' ? (globalThis as any).navigator : undefined;
      if (Platform.OS === 'web' && maybeNavigator?.clipboard?.writeText) {
        await maybeNavigator.clipboard.writeText(receiptText);
        Alert.alert('Copied', 'Receipt details copied to clipboard.');
        return;
      }
      Alert.alert('Error', 'Unable to share receipt.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Ad Receipt', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment Receipt</Text>
          <Text style={styles.subtitle}>Receipt #{receipt.receipt_number}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ad Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Title</Text>
            <Text style={styles.value}>{advertisement?.title || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Placement</Text>
            <Text style={styles.value}>{advertisement?.placement || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Billing Status</Text>
            <Text style={styles.value}>{advertisement?.billing_status || 'paid'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.value}>
              {receipt.currency || 'USD'} {Number(receipt.amount || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Issued</Text>
            <Text style={styles.value}>{new Date(receipt.issued_at).toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Receipt ID</Text>
            <Text style={styles.value}>{receipt.id}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.noteText}>
            This receipt confirms payment for your advertisement. Keep it for your records.
          </Text>
        </View>

        <TouchableOpacity style={styles.downloadButton} onPress={handleShareReceipt}>
          <Download size={18} color={colors.text.white} />
          <Text style={styles.downloadButtonText}>Download / Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.secondary },
    content: { padding: 20, paddingBottom: 32 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 12 },
    closeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border.light },
    closeButtonText: { fontWeight: '600', color: colors.text.primary },
    header: { marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '800', color: colors.text.primary },
    subtitle: { marginTop: 4, fontSize: 12, color: colors.text.secondary },
    card: { backgroundColor: colors.background.primary, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border.light },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary, marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, gap: 12 },
    label: { fontSize: 12, color: colors.text.secondary },
    value: { fontSize: 13, fontWeight: '600', color: colors.text.primary, flex: 1, textAlign: 'right' },
    noteText: { fontSize: 12, color: colors.text.secondary, lineHeight: 18 },
    downloadButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary },
    downloadButtonText: { color: colors.text.white, fontWeight: '700' },
    doneButton: { marginTop: 10, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border.light, backgroundColor: colors.background.primary },
    doneButtonText: { color: colors.text.primary, fontWeight: '700' },
  });
