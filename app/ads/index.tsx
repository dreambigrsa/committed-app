import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { Advertisement } from '@/types';
import { ExternalLink, Play, PauseCircle, RefreshCw, TrendingUp, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

export default function MyAdsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { currentUser, updateAdvertisement, deleteAdvertisement, recordAdClick } = useApp();
  const [ads, setAds] = useState<Advertisement[]>([]);
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
      if (!error && data) {
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
            impressions: ad.impressions,
            clicks: ad.clicks,
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
              <View style={styles.rowBetween}>
                <Text style={styles.title}>{ad.title}</Text>
                <View style={styles.chipRow}>
                  <View style={[styles.chip, styles.statusChip]}>
                    <Text style={styles.chipText}>{(ad.status || 'pending').toUpperCase()}</Text>
                  </View>
                  <View style={[styles.chip, styles.billingChip]}>
                    <Text style={styles.chipText}>{(ad.billingStatus || 'unpaid').toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              <View style={{ padding: 16 }}>
                <Text style={styles.desc} numberOfLines={2}>
                  {ad.description}
                </Text>

                <View style={styles.metricsCard}>
                <View style={styles.metricItem}>
                  <TrendingUp size={18} color={colors.primary} />
                  <View>
                    <Text style={styles.metricLabel}>Reach</Text>
                    <Text style={styles.metricValue}>{ad.impressions} impressions</Text>
                  </View>
                </View>
                <View style={styles.metricItem}>
                  <ExternalLink size={18} color={colors.primary} />
                  <View>
                    <Text style={styles.metricLabel}>Engagement</Text>
                    <Text style={styles.metricValue}>{ad.clicks} clicks</Text>
                  </View>
                </View>
              </View>

              <View style={styles.rowBetween}>
                <Text style={styles.metaEmphasis}>Spend {ad.spend ? `\$${ad.spend.toFixed(2)}` : '$0.00'}</Text>
                <Text style={styles.meta}>Budget {ad.dailyBudget ? `\$${ad.dailyBudget}/day` : '-'}</Text>
              </View>

                <Text style={styles.suggestion}>{suggestion(ad)}</Text>
                {ad.rejectionReason ? (
                  <Text style={styles.rejection}>Rejected: {ad.rejectionReason}</Text>
                ) : null}

                <View style={styles.actions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenCta(ad)}>
                  <ExternalLink size={16} color={colors.primary} />
                  <Text style={styles.actionText}>View CTA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handlePauseResume(ad)}>
                  {ad.status === 'paused' ? (
                    <>
                      <Play size={16} color={colors.primary} />
                      <Text style={styles.actionText}>Resume</Text>
                    </>
                  ) : (
                    <>
                      <PauseCircle size={16} color={colors.primary} />
                      <Text style={styles.actionText}>Pause</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => router.push({ pathname: '/ads/promote', params: { adId: ad.id } })}>
                  <RefreshCw size={16} color={colors.primary} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(ad)}>
                  <Trash2 size={16} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
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
    newButtonSecondary: { backgroundColor: colors.background.secondary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border.light },
    newButtonSecondaryText: { color: colors.text.primary, fontWeight: '700' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: 16, paddingTop: 12 },
    card: { backgroundColor: colors.background.primary, borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border.light, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
    featuredImage: { width: '100%', height: 200, backgroundColor: colors.background.secondary },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text.primary, flex: 1, marginRight: 8 },
    chipRow: { flexDirection: 'row', gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    statusChip: { backgroundColor: colors.primary + '20' },
    billingChip: { backgroundColor: colors.background.secondary, borderWidth: 1, borderColor: colors.border.light },
    chipText: { fontSize: 10, fontWeight: '700', color: colors.text.primary },
    desc: { marginTop: 4, color: colors.text.secondary },
    meta: { fontSize: 12, color: colors.text.secondary },
    metaEmphasis: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
    suggestion: { marginTop: 6, fontSize: 12, color: colors.text.secondary },
    rejection: { marginTop: 4, fontSize: 12, color: colors.danger },
    metricsCard: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: colors.background.secondary },
    metricItem: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    metricLabel: { fontSize: 11, color: colors.text.tertiary },
    metricValue: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
    actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionButton: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.background.primary, borderRadius: 8, borderWidth: 1, borderColor: colors.border.light },
    actionText: { color: colors.text.primary, fontWeight: '600' },
    empty: { padding: 24, alignItems: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
    emptyDesc: { marginTop: 6, color: colors.text.secondary, textAlign: 'center' },
  });

