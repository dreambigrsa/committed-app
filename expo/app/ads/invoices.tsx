import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { FileText } from 'lucide-react-native';

export default function AdInvoicesScreen() {
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);

  useEffect(() => {
    const loadReceipts = async () => {
      if (!currentUser) return;
      setLoading(true);
      const { data } = await supabase
        .from('ad_payment_receipts')
        .select(`
          id,
          receipt_number,
          amount,
          currency,
          issued_at,
          advertisement:advertisements!ad_payment_receipts_advertisement_id_fkey(id, title, placement)
        `)
        .eq('user_id', currentUser.id)
        .order('issued_at', { ascending: false });
      setReceipts(data || []);
      setLoading(false);
    };
    loadReceipts();
  }, [currentUser]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Ad Invoices', headerShown: true }} />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Invoices</Text>
            <Text style={styles.headerSubtitle}>All receipts for your ad payments.</Text>
          </View>

          {receipts.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No invoices yet</Text>
              <Text style={styles.emptySubtitle}>Receipts appear here once an ad payment is approved.</Text>
            </View>
          )}

          {receipts.map((receipt) => (
            <TouchableOpacity
              key={receipt.id}
              style={styles.card}
              onPress={() =>
                router.push({ pathname: '/ads/receipt', params: { receiptId: receipt.id } } as any)
              }
            >
              <View style={styles.cardLeft}>
                <View style={styles.iconWrap}>
                  <FileText size={18} color={colors.primary} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {receipt.advertisement?.title || 'Ad Receipt'}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    Receipt #{receipt.receipt_number} • {new Date(receipt.issued_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <View style={styles.amountWrap}>
                <Text style={styles.amountText}>
                  {receipt.currency || 'USD'} {Number(receipt.amount || 0).toFixed(2)}
                </Text>
                <Text style={styles.placementText}>{receipt.advertisement?.placement || '—'}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.secondary },
    content: { padding: 20, paddingBottom: 32 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { marginBottom: 18 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text.primary },
    headerSubtitle: { marginTop: 6, fontSize: 12, color: colors.text.secondary },
    empty: { padding: 24, alignItems: 'center', backgroundColor: colors.background.primary, borderRadius: 16, borderWidth: 1, borderColor: colors.border.light },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    emptySubtitle: { marginTop: 6, fontSize: 12, color: colors.text.secondary, textAlign: 'center' },
    card: { backgroundColor: colors.background.primary, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border.light, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
    iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '12', alignItems: 'center', justifyContent: 'center' },
    cardText: { flex: 1 },
    cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
    cardSubtitle: { marginTop: 4, fontSize: 11, color: colors.text.secondary },
    amountWrap: { alignItems: 'flex-end' },
    amountText: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    placementText: { marginTop: 4, fontSize: 11, color: colors.text.tertiary },
  });
