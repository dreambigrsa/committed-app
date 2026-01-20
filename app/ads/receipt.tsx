import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, ScrollView, Alert, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Download, X } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
    const issuedAt = new Date(receipt.issued_at).toLocaleString();
    const adTitle = advertisement?.title || '—';
    const placement = advertisement?.placement || '—';

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .title { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
            .subtitle { font-size: 12px; color: #6B7280; margin-bottom: 20px; }
            .card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 14px; }
            .section-title { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #111827; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; gap: 12px; }
            .label { font-size: 12px; color: #6B7280; }
            .value { font-size: 13px; font-weight: 600; color: #111827; text-align: right; flex: 1; }
            .note { font-size: 12px; color: #6B7280; line-height: 18px; }
          </style>
        </head>
        <body>
          <div class="title">Payment Receipt</div>
          <div class="subtitle">Receipt #${receipt.receipt_number}</div>

          <div class="card">
            <div class="section-title">Ad Details</div>
            <div class="row"><div class="label">Title</div><div class="value">${adTitle}</div></div>
            <div class="row"><div class="label">Placement</div><div class="value">${placement}</div></div>
            <div class="row"><div class="label">Billing Status</div><div class="value">${advertisement?.billing_status || 'paid'}</div></div>
          </div>

          <div class="card">
            <div class="section-title">Payment Summary</div>
            <div class="row"><div class="label">Amount</div><div class="value">${amount}</div></div>
            <div class="row"><div class="label">Issued</div><div class="value">${issuedAt}</div></div>
            <div class="row"><div class="label">Receipt ID</div><div class="value">${receipt.id}</div></div>
          </div>

          <div class="card">
            <div class="section-title">Notes</div>
            <div class="note">This receipt confirms payment for your advertisement. Keep it for your records.</div>
          </div>
        </body>
      </html>
    `;

    try {
      const file = await Print.printToFileAsync({ html });
      if (Platform.OS === 'web') {
        const opener = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
        if (opener?.open) {
          opener.open(file.uri, '_blank');
          return;
        }
        Alert.alert('Saved', 'Receipt PDF created.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to generate receipt PDF.');
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
          <Text style={styles.downloadButtonText}>Download PDF</Text>
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
