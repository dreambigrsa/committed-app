import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { Advertisement } from '@/types';
import { ExternalLink, FileText, Play, PauseCircle, RefreshCw, TrendingUp, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

export default function MyAdsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { currentUser, updateAdvertisement, deleteAdvertisement, recordAdClick } = useApp();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [receiptsByAdId, setReceiptsByAdId] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const styles = createStyles(colors);

  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (!error && data && currentUser) {
        const adIds = data.map((ad: any) => ad.id);
        let impressionsMap = new Map<string, number>();
        let clicksMap = new Map<string, number>();
        let engagementsMap = new Map<string, { likes: number; comments: number; shares: number }>();

        if (adIds.length > 0) {
          const [impressionsRes, clicksRes, engagementsRes] = await Promise.all([
            supabase
              .from('advertisement_impressions')
              .select('advertisement_id')
              .in('advertisement_id', adIds),
            supabase
              .from('advertisement_clicks')
              .select('advertisement_id')
              .in('advertisement_id', adIds),
            supabase
              .from('ad_engagements')
              .select('advertisement_id, engagement_type')
              .in('advertisement_id', adIds),
          ]);

          impressionsRes.data?.forEach((imp: any) => {
            const count = impressionsMap.get(imp.advertisement_id) || 0;
            impressionsMap.set(imp.advertisement_id, count + 1);
          });

          clicksRes.data?.forEach((click: any) => {
            const count = clicksMap.get(click.advertisement_id) || 0;
            clicksMap.set(click.advertisement_id, count + 1);
          });

          engagementsRes.data?.forEach((eng: any) => {
            const entry = engagementsMap.get(eng.advertisement_id) || { likes: 0, comments: 0, shares: 0 };
            if (eng.engagement_type === 'like') entry.likes += 1;
            if (eng.engagement_type === 'comment') entry.comments += 1;
            if (eng.engagement_type === 'share') entry.shares += 1;
            engagementsMap.set(eng.advertisement_id, entry);
          });
        }

        setAds(
          data.map((ad: any) => ({
            id: ad.id,
            title: ad.title,
            description: ad.description,
            imageUrl: ad.image_url,
            linkUrl: ad.link_url,
            type: ad.type,
            placement: ad.placement,
            active: ad.active,
            impressions: impressionsMap.get(ad.id) || 0,
            clicks: clicksMap.get(ad.id) || 0,
            engagementSummary: engagementsMap.get(ad.id),
            createdBy: ad.created_by,
            createdAt: ad.created_at,
            updatedAt: ad.updated_at,
            ctaType: ad.cta_type,
            ctaPhone: ad.cta_phone,
            ctaMessage: ad.cta_message,
            ctaMessengerId: ad.cta_messenger_id,
            ctaUrl: ad.cta_url,
            sponsorName: ad.sponsor_name,
            sponsorVerified: ad.sponsor_verified,
            userId: ad.user_id,
            status: ad.status,
            rejectionReason: ad.rejection_reason,
            startDate: ad.start_date,
            endDate: ad.end_date,
            dailyBudget: ad.daily_budget,
            totalBudget: ad.total_budget,
            spend: ad.spend,
            billingStatus: ad.billing_status,
            billingProvider: ad.billing_provider,
            billingTxnId: ad.billing_txn_id,
            promotedPostId: ad.promoted_post_id,
            promotedReelId: ad.promoted_reel_id,
          })),
        );
      }
      if (!error && data && currentUser) {
        const adIds = data.map((ad: any) => ad.id);
        if (adIds.length > 0) {
          const { data: receipts } = await supabase
            .from('ad_payment_receipts')
            .select('*')
            .in('advertisement_id', adIds)
            .eq('user_id', currentUser.id);
          const receiptMap: Record<string, any> = {};
          (receipts || []).forEach((receipt: any) => {
            receiptMap[receipt.advertisement_id] = receipt;
          });
          setReceiptsByAdId(receiptMap);
        }
      }
      setLoading(false);
    };
    load();
  }, [currentUser]);

  const suggestion = (ad: Advertisement) => {
    if (ad.impressions > 0) {
      const ctr = ad.clicks / ad.impressions;
      if (ctr < 0.01) return 'Try stronger creative/CTA';
    }
    if (ad.impressions < 20) return 'Increase budget or broaden targeting';
    return 'Looking good';
  };

  const handlePauseResume = async (ad: Advertisement) => {
    const newStatus = ad.status === 'paused' ? 'pending' : 'paused';
    await updateAdvertisement(ad.id, { status: newStatus });
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, status: newStatus } : a)));
  };

  const handleOpenCta = async (ad: Advertisement) => {
    const url =
      ad.ctaType === 'whatsapp' && ad.ctaPhone
        ? `https://wa.me/${ad.ctaPhone}${ad.ctaMessage ? `?text=${encodeURIComponent(ad.ctaMessage)}` : ''}`
        : ad.ctaType === 'messenger' && ad.ctaMessengerId
        ? `https://m.me/${ad.ctaMessengerId}`
        : ad.ctaUrl || ad.linkUrl;
    if (url) {
      await recordAdClick(ad.id);
      await WebBrowser.openBrowserAsync(url);
    }
  };

  const handleDelete = async (ad: Advertisement) => {
    Alert.alert('Delete ad', 'Are you sure you want to delete this ad?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAdvertisement(ad.id);
          setAds((prev) => prev.filter((a) => a.id !== ad.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Ads</Text>
          <Text style={styles.headerSubtitle}>Monitor performance, tweak targeting, and boost again in one place.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.newButtonSecondary} onPress={() => router.push('/ads/invoices' as any)}>
            <FileText size={16} color={colors.text.primary} />
            <Text style={styles.newButtonSecondaryText}>Invoices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newButtonSecondary} onPress={() => router.push('/ads/promote')}>
            <Text style={styles.newButtonSecondaryText}>Create Ad</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newButton} onPress={() => router.push('/ads/promote')}>
            <Text style={styles.newButtonText}>Boost</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 32 }}>
          {ads.map((ad) => (
            <View key={ad.id} style={styles.card}>
              {/* Featured image */}
              {ad.imageUrl && (
                <Image
                  source={{ uri: ad.imageUrl }}
                  style={styles.featuredImage}
                  contentFit="cover"
                />
              )}
              <View style={{ padding: 16 }}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.title}>{ad.title}</Text>
                    <Text style={styles.subtitle}>
                      {(ad.placement || 'feed').toUpperCase()} • {(ad.type || 'card').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.chipRow}>
                    <View style={[styles.chip, ad.status === 'approved' ? styles.chipApproved : ad.status === 'rejected' ? styles.chipRejected : styles.chipPending]}>
                      <Text style={styles.chipText}>{(ad.status || 'pending').toUpperCase()}</Text>
                    </View>
                    <View style={[styles.chip, ad.billingStatus === 'paid' ? styles.chipPaid : styles.chipUnpaid]}>
                      <Text style={styles.chipText}>{(ad.billingStatus || 'unpaid').toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.desc} numberOfLines={2}>
                  {ad.description}
                </Text>

                <View style={styles.metricsRow}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{ad.impressions}</Text>
                    <Text style={styles.metricLabel}>Impressions</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{ad.clicks}</Text>
                    <Text style={styles.metricLabel}>Clicks</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>
                      {ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(2)}%` : '0%'}
                    </Text>
                    <Text style={styles.metricLabel}>CTR</Text>
                  </View>
                </View>

                <View style={styles.spendRow}>
                  <Text style={styles.metaEmphasis}>
                    Spend {ad.spend ? `\$${ad.spend.toFixed(2)}` : '$0.00'}
                  </Text>
                  <Text style={styles.meta}>Budget {ad.dailyBudget ? `\$${ad.dailyBudget}/day` : '-'}</Text>
                </View>

                <Text style={styles.suggestion}>{suggestion(ad)}</Text>
                {((ad as any).engagementSummary?.likes ||
                  (ad as any).engagementSummary?.comments ||
                  (ad as any).engagementSummary?.shares) ? (
                  <Text style={styles.engagementText}>
                    {(ad as any).engagementSummary?.likes || 0} likes •{' '}
                    {(ad as any).engagementSummary?.comments || 0} comments •{' '}
                    {(ad as any).engagementSummary?.shares || 0} shares
                  </Text>
                ) : null}
                {ad.rejectionReason ? (
                  <Text style={styles.rejection}>Rejected: {ad.rejectionReason}</Text>
                ) : null}

                <View style={styles.primaryActions}>
                  <TouchableOpacity style={[styles.primaryAction, styles.primaryActionBrand]} onPress={() => handleOpenCta(ad)}>
                    <ExternalLink size={16} color={colors.text.white} />
                    <Text style={styles.primaryActionText}>View CTA</Text>
                  </TouchableOpacity>
                  {receiptsByAdId[ad.id] ? (
                    <TouchableOpacity
                      style={[styles.primaryAction, styles.primaryActionSecondary]}
                      onPress={() =>
                        router.push({
                          pathname: '/ads/receipt',
                          params: { receiptId: receiptsByAdId[ad.id].id },
                        } as any)
                      }
                    >
                      <FileText size={16} color={colors.text.primary} />
                      <Text style={styles.primaryActionTextAlt}>Receipt</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.secondaryActions}>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => handlePauseResume(ad)}>
                    {ad.status === 'paused' ? (
                      <>
                        <Play size={16} color={colors.text.primary} />
                        <Text style={styles.secondaryActionText}>Resume</Text>
                      </>
                    ) : (
                      <>
                        <PauseCircle size={16} color={colors.text.primary} />
                        <Text style={styles.secondaryActionText}>Pause</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push({ pathname: '/ads/promote', params: { adId: ad.id } })}>
                    <RefreshCw size={16} color={colors.text.primary} />
                    <Text style={styles.secondaryActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => handleDelete(ad)}>
                    <Trash2 size={16} color={colors.danger} />
                    <Text style={[styles.secondaryActionText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          {ads.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No ads yet</Text>
              <Text style={styles.emptyDesc}>Tap “Boost” on your post/reel, or “Create Ad” to make a standalone ad.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.secondary },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 20, paddingBottom: 12, backgroundColor: colors.background.primary, borderBottomWidth: 1, borderBottomColor: colors.border.light },
    headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text.primary },
    headerSubtitle: { marginTop: 4, fontSize: 12, color: colors.text.secondary, maxWidth: 220 },
    headerActions: { flexDirection: 'row', gap: 8, marginLeft: 12 },
    newButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
    newButtonText: { color: colors.text.white, fontWeight: '700' },
    newButtonSecondary: { backgroundColor: colors.background.secondary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border.light, flexDirection: 'row', alignItems: 'center', gap: 6 },
    newButtonSecondaryText: { color: colors.text.primary, fontWeight: '700' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: 16, paddingTop: 12 },
    card: { backgroundColor: colors.background.primary, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border.light, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, overflow: 'hidden' },
    featuredImage: { width: '100%', height: 200, backgroundColor: colors.background.secondary },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    titleWrap: { flex: 1 },
    title: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    subtitle: { marginTop: 4, fontSize: 11, fontWeight: '600' as const, color: colors.text.tertiary, letterSpacing: 0.4 },
    chipRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    chipText: { fontSize: 10, fontWeight: '700', color: colors.text.white },
    chipApproved: { backgroundColor: colors.success || colors.primary },
    chipRejected: { backgroundColor: colors.danger },
    chipPending: { backgroundColor: colors.accent || colors.primary },
    chipPaid: { backgroundColor: colors.primary },
    chipUnpaid: { backgroundColor: colors.text.tertiary },
    desc: { marginTop: 4, color: colors.text.secondary },
    meta: { fontSize: 12, color: colors.text.secondary },
    metaEmphasis: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    suggestion: { marginTop: 6, fontSize: 12, color: colors.text.secondary },
    engagementText: { marginTop: 6, fontSize: 12, color: colors.text.tertiary },
    rejection: { marginTop: 4, fontSize: 12, color: colors.danger },
    metricsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 8 },
    metricCard: { flex: 1, backgroundColor: colors.background.secondary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    metricLabel: { fontSize: 11, color: colors.text.tertiary, marginTop: 4 },
    metricValue: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    spendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    primaryActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    primaryAction: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
    primaryActionBrand: { backgroundColor: colors.primary },
    primaryActionSecondary: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.light },
    primaryActionText: { color: colors.text.white, fontWeight: '700' },
    primaryActionTextAlt: { color: colors.text.primary, fontWeight: '700' },
    secondaryActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    secondaryAction: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.light },
    secondaryActionText: { color: colors.text.primary, fontWeight: '600' },
    empty: { padding: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    emptyDesc: { marginTop: 6, color: colors.text.secondary, textAlign: 'center' },
  });

