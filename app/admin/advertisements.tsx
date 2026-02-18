import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Plus, Edit2, Trash2, X, CheckCircle2, PauseCircle, Play, XCircle, DollarSign } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { Advertisement } from '@/types';

export default function AdminAdvertisementsScreen() {
  const { currentUser, createAdvertisement, updateAdvertisement, deleteAdvertisement } = useApp();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [settingsForm, setSettingsForm] = useState<{
    defaultCpm: string;
    defaultCpc: string;
    defaultCpe: string;
    defaultMaxMultiplier: string;
    competitorStep: string;
  }>({
    defaultCpm: '0.50',
    defaultCpc: '0.05',
    defaultCpe: '0.10',
    defaultMaxMultiplier: '2.0',
    competitorStep: '0.10',
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: '',
    type: 'card' as Advertisement['type'],
    placement: 'feed' as Advertisement['placement'],
    active: true,
    ctaType: 'whatsapp' as Advertisement['ctaType'],
    ctaPhone: '',
    ctaMessage: '',
    ctaMessengerId: '',
    ctaUrl: '',
    sponsorName: '',
    sponsorVerified: false,
    status: 'pending' as Advertisement['status'],
    rejectionReason: '',
    dailyBudget: '',
    totalBudget: '',
    billingStatus: 'unpaid' as Advertisement['billingStatus'],
    startDate: '',
    endDate: '',
    bidCpm: '0.50',
    bidCpc: '0.05',
    bidCpe: '0.10',
    bidMaxMultiplier: '2.0',
    bidNiche: '',
  });

  useEffect(() => {
    loadSystemSettings();
  }, []);

  useEffect(() => {
    // Once settings are loaded (or if they change), reload ads to apply spend calc
    loadAdvertisements();
  }, [systemSettings]);

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ad_system_settings')
        .select('id, settings')
        .eq('id', 'default')
        .maybeSingle();
      if (error) throw error;
      const settings = (data as any)?.settings || {};
      setSystemSettings(settings);
      const bidding = settings?.bidding || {};
      setSettingsForm({
        defaultCpm: (bidding.defaultCpm ?? 0.5).toString(),
        defaultCpc: (bidding.defaultCpc ?? 0.05).toString(),
        defaultCpe: (bidding.defaultCpe ?? 0.10).toString(),
        defaultMaxMultiplier: (bidding.defaultMaxMultiplier ?? 2.0).toString(),
        competitorStep: (bidding.competitorStep ?? 0.1).toString(),
      });
    } catch (e) {
      console.error('Failed to load ad system settings:', e);
    }
  };

  const saveSystemSettings = async () => {
    try {
      const payload = {
        bidding: {
          defaultCpm: parseFloat(settingsForm.defaultCpm) || 0.5,
          defaultCpc: parseFloat(settingsForm.defaultCpc) || 0.05,
          defaultCpe: parseFloat(settingsForm.defaultCpe) || 0.10,
          defaultMaxMultiplier: parseFloat(settingsForm.defaultMaxMultiplier) || 2.0,
          competitorStep: parseFloat(settingsForm.competitorStep) || 0.1,
          groupBy: 'placement+niche',
        },
      };
      const { error } = await supabase
        .from('ad_system_settings')
        .upsert({ id: 'default', settings: payload }, { onConflict: 'id' });
      if (error) throw error;
      setSystemSettings(payload);
      setShowSettingsModal(false);
      Alert.alert('Saved', 'Ad system settings updated.');
      loadAdvertisements(); // recalc spend using new settings
    } catch (e: any) {
      console.error('Failed to save ad system settings:', e);
      Alert.alert('Error', e?.message || 'Failed to save settings');
    }
  };

  const loadAdvertisements = async () => {
    try {
      setLoading(true);
      
      const biddingDefaults = systemSettings?.bidding || {};
      const DEFAULT_CPM = Number(biddingDefaults.defaultCpm ?? 0.5);
      const DEFAULT_CPC = Number(biddingDefaults.defaultCpc ?? 0.05);
      const DEFAULT_CPE = Number(biddingDefaults.defaultCpe ?? 0.10);
      const DEFAULT_MAX_MULTIPLIER = Number(biddingDefaults.defaultMaxMultiplier ?? 2.0);
      const COMPETITOR_STEP = Number(biddingDefaults.competitorStep ?? 0.1);

      // Load all advertisements (not just active ones for admin view)
      const { data: adsData, error: adsError } = await supabase
        .from('advertisements')
        .select('*')
        .order('created_at', { ascending: false });

      if (adsError) throw adsError;

      if (adsData && adsData.length > 0) {
        // Get all ad IDs
        const adIds = adsData.map((ad: any) => ad.id);

        // Get impression counts from tracking table
        const { data: impressionsData, error: impressionsError } = await supabase
          .from('advertisement_impressions')
          .select('advertisement_id')
          .in('advertisement_id', adIds);

        // Get click counts from tracking table
        const { data: clicksData, error: _clicksError } = await supabase
          .from('advertisement_clicks')
          .select('advertisement_id')
          .in('advertisement_id', adIds);

        // Calculate counts for each ad
        const impressionsMap = new Map<string, number>();
        const clicksMap = new Map<string, number>();

        impressionsData?.forEach((imp: any) => {
          const count = impressionsMap.get(imp.advertisement_id) || 0;
          impressionsMap.set(imp.advertisement_id, count + 1);
        });

        clicksData?.forEach((click: any) => {
          const count = clicksMap.get(click.advertisement_id) || 0;
          clicksMap.set(click.advertisement_id, count + 1);
        });

        // Format advertisements with real-time analytics
        const formattedAds: Advertisement[] = [];

        // Build a simple competition map by niche+placement for bidding
        const activeApproved = adsData.filter(
          (ad: any) => ad.active && ad.status === 'approved' && ad.billing_status === 'paid'
        );
        const groupCounts = new Map<string, number>();
        activeApproved.forEach((ad: any) => {
          const placement = ad.placement || 'feed';
          const niche = (ad.targeting && ad.targeting.bidding && ad.targeting.bidding.niche) ? String(ad.targeting.bidding.niche) : 'general';
          const key = `${placement}:${niche}`;
          groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
        });

        for (const ad of adsData) {
          const impressions = impressionsMap.get(ad.id) || 0;
          const clicks = clicksMap.get(ad.id) || 0;
          
          // Get engagements (likes, comments, shares)
          const { data: engagementsData } = await supabase
            .from('ad_engagements')
            .select('engagement_type')
            .eq('advertisement_id', ad.id);
          const engagements = engagementsData || [];
          const likes = engagements.filter((e: any) => e.engagement_type === 'like').length;
          const comments = engagements.filter((e: any) => e.engagement_type === 'comment').length;
          const shares = engagements.filter((e: any) => e.engagement_type === 'share').length;
          const totalEngagements = likes + comments + shares;
          
          const placement = ad.placement || 'feed';
          const niche = (ad.targeting && ad.targeting.bidding && ad.targeting.bidding.niche) ? String(ad.targeting.bidding.niche) : 'general';
          const key = `${placement}:${niche}`;
          const competitors = (groupCounts.get(key) || 1) - 1; // exclude self loosely

          const baseCpm = ad.targeting?.bidding?.cpm ? Number(ad.targeting.bidding.cpm) : DEFAULT_CPM;
          const baseCpc = ad.targeting?.bidding?.cpc ? Number(ad.targeting.bidding.cpc) : DEFAULT_CPC;
          const baseCpe = ad.targeting?.bidding?.cpe ? Number(ad.targeting.bidding.cpe) : DEFAULT_CPE;
          const maxMult = ad.targeting?.bidding?.maxMultiplier ? Number(ad.targeting.bidding.maxMultiplier) : DEFAULT_MAX_MULTIPLIER;

          const multiplier = Math.min(1 + competitors * COMPETITOR_STEP, maxMult);
          const effectiveCPM = baseCpm * multiplier;
          const effectiveCPC = baseCpc * multiplier;
          const effectiveCPE = baseCpe * multiplier;

          // Calculate spend: impressions (CPM) + clicks (CPC) + engagements (CPE)
          let spend = impressions * (effectiveCPM / 1000) + clicks * effectiveCPC + totalEngagements * effectiveCPE;
          if (ad.total_budget) {
            spend = Math.min(spend, Number(ad.total_budget));
          }

          // Persist computed spend so My Ads shows it too
          await supabase
            .from('advertisements')
            .update({ spend })
            .eq('id', ad.id);

          const adObj: Advertisement = {
            id: ad.id,
            title: ad.title,
            description: ad.description,
            imageUrl: ad.image_url,
            linkUrl: ad.link_url,
            type: ad.type,
            placement: ad.placement,
            active: ad.active,
            impressions,
            clicks,
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
            spend,
            billingStatus: ad.billing_status,
            billingProvider: ad.billing_provider,
            billingTxnId: ad.billing_txn_id,
            promotedPostId: ad.promoted_post_id,
            promotedReelId: ad.promoted_reel_id,
            targeting: ad.targeting,
          };
          
          // Add UI-only properties
          (adObj as any).effectiveCpm = effectiveCPM;
          (adObj as any).effectiveCpc = effectiveCPC;
          (adObj as any).effectiveCpe = effectiveCPE;
          (adObj as any).engagements = totalEngagements;
          (adObj as any).likes = likes;
          (adObj as any).comments = comments;
          (adObj as any).shares = shares;
          (adObj as any).bidMultiplier = multiplier;
          
          formattedAds.push(adObj);
        }

        setAdvertisements(formattedAds);
      } else {
        setAdvertisements([]);
      }
    } catch (error) {
      console.error('Failed to load advertisements:', error);
      Alert.alert('Error', 'Failed to load advertisements');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Advertisements', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>You don&apos;t have permission to manage advertisements</Text>
        </View>
      </SafeAreaView>
    );
  }

  const validateURL = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSaveAd = async () => {
    if (!formData.title || !formData.description || !formData.imageUrl) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate Image/Video URL
    if (!validateURL(formData.imageUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP or HTTPS URL for the image/video');
      return;
    }

    // Validate Link URL if provided
    if (formData.linkUrl && formData.linkUrl.trim() !== '' && !validateURL(formData.linkUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid HTTP or HTTPS URL for the link');
      return;
    }

    // Warn if video type but URL doesn't look like a video
    if (formData.type === 'video') {
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m3u8'];
      const isVideoUrl = videoExtensions.some(ext => 
        formData.imageUrl.toLowerCase().includes(ext)
      );
      if (!isVideoUrl && !formData.imageUrl.includes('video')) {
        Alert.alert(
          'Video URL Warning', 
          'The URL doesn\'t appear to be a video file. For video ads, please use a video URL (e.g., .mp4, .mov).',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue Anyway', onPress: async () => {
              await saveAd();
            }},
          ]
        );
        return;
      }
    }

    // CTA validation
    if (formData.ctaType === 'whatsapp') {
      if (!formData.ctaPhone) {
        Alert.alert('Error', 'Please provide a WhatsApp phone number.');
        return;
      }
    } else if (formData.ctaType === 'messenger') {
      if (!formData.ctaMessengerId) {
        Alert.alert('Error', 'Please provide a Messenger page/user ID.');
        return;
      }
    } else if (formData.ctaType === 'website') {
      if (!formData.ctaUrl && !formData.linkUrl) {
        Alert.alert('Error', 'Please provide a website URL.');
        return;
      }
      const targetUrl = formData.ctaUrl || formData.linkUrl;
      if (targetUrl && !validateURL(targetUrl)) {
        Alert.alert('Invalid URL', 'Please enter a valid website URL for the CTA.');
        return;
      }
    }

    await saveAd();
  };

  const handleApprove = async (ad: Advertisement) => {
    await updateAdvertisement(ad.id, { status: 'approved', rejectionReason: '', active: true, billingStatus: 'paid', billingProvider: ad.billingProvider || 'manual' });
    setAdvertisements((prev) =>
      prev.map((a) =>
        a.id === ad.id
          ? { ...a, status: 'approved', rejectionReason: '', active: true, billingStatus: 'paid', billingProvider: a.billingProvider || 'manual' }
          : a
      )
    );
  };

  const handleReject = async (ad: Advertisement) => {
    Alert.alert('Reject ad', 'Add a rejection reason', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          await updateAdvertisement(ad.id, { status: 'rejected', active: false, rejectionReason: 'Rejected by admin', billingStatus: 'unpaid' });
          setAdvertisements((prev) =>
            prev.map((a) =>
              a.id === ad.id ? { ...a, status: 'rejected', active: false, rejectionReason: 'Rejected by admin', billingStatus: 'unpaid' } : a
            )
          );
        },
      },
    ]);
  };

  const handleMarkPaid = async (ad: Advertisement) => {
    Alert.alert(
      'Mark as paid',
      'Confirm payment received (manual/transfer).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            await updateAdvertisement(ad.id, { billingStatus: 'paid', billingProvider: ad.billingProvider || 'manual', active: true });
            setAdvertisements((prev) => prev.map((a) => (a.id === ad.id ? { ...a, billingStatus: 'paid', billingProvider: ad.billingProvider || 'manual', active: true } : a)));
          },
        },
      ],
    );
  };

  const saveAd = async () => {
    const bidCpmNum = parseFloat(formData.bidCpm) || 0.5;
    const bidCpcNum = parseFloat(formData.bidCpc) || 0.05;
    const bidCpeNum = parseFloat(formData.bidCpe) || 0.10;
    const bidMaxNum = parseFloat(formData.bidMaxMultiplier) || 2.0;

    const targeting: any = {
      ...(editingAd?.targeting || {}),
      bidding: {
        cpm: bidCpmNum,
        cpc: bidCpcNum,
        cpe: bidCpeNum,
        maxMultiplier: bidMaxNum,
        niche: (formData.bidNiche || '').trim() || null,
      },
    };

    if (editingAd) {
      await updateAdvertisement(editingAd.id, {
        ...formData,
        dailyBudget: formData.dailyBudget ? parseFloat(formData.dailyBudget) : undefined,
        totalBudget: formData.totalBudget ? parseFloat(formData.totalBudget) : undefined,
        targeting,
      });
    } else {
      await createAdvertisement({
        ...formData,
        createdBy: currentUser.id,
        active: formData.active,
        dailyBudget: formData.dailyBudget ? parseFloat(formData.dailyBudget) : undefined,
        totalBudget: formData.totalBudget ? parseFloat(formData.totalBudget) : undefined,
        targeting,
      });
    }

    setShowCreateModal(false);
    setEditingAd(null);
    resetForm();
    loadAdvertisements(); // Reload to get updated list
  };

  const handleEditAd = (ad: Advertisement) => {
    setEditingAd(ad);
    const bid = (ad as any).targeting?.bidding || {};
    setFormData({
      title: ad.title,
      description: ad.description,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl || '',
      type: ad.type,
      placement: ad.placement,
      active: ad.active,
      ctaType: ad.ctaType || 'whatsapp',
      ctaPhone: ad.ctaPhone || '',
      ctaMessage: ad.ctaMessage || '',
      ctaMessengerId: ad.ctaMessengerId || '',
      ctaUrl: ad.ctaUrl || '',
      sponsorName: ad.sponsorName || '',
      sponsorVerified: !!ad.sponsorVerified,
      status: ad.status || 'pending',
      rejectionReason: ad.rejectionReason || '',
      dailyBudget: ad.dailyBudget?.toString() || '',
      totalBudget: ad.totalBudget?.toString() || '',
      billingStatus: ad.billingStatus || 'unpaid',
      startDate: ad.startDate || '',
      endDate: ad.endDate || '',
      bidCpm: (bid.cpm ?? 0.5).toString(),
      bidCpc: (bid.cpc ?? 0.05).toString(),
      bidCpe: (bid.cpe ?? 0.10).toString(),
      bidMaxMultiplier: (bid.maxMultiplier ?? 2.0).toString(),
      bidNiche: (bid.niche ?? '').toString(),
    });
    setShowCreateModal(true);
  };

  const handleDeleteAd = (ad: Advertisement) => {
    Alert.alert(
      'Delete Advertisement',
      'Are you sure you want to delete this advertisement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAdvertisement(ad.id);
            loadAdvertisements(); // Reload to update list
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      linkUrl: '',
      type: 'card',
      placement: 'feed',
      active: true,
      ctaType: 'whatsapp',
      ctaPhone: '',
      ctaMessage: '',
      ctaMessengerId: '',
      ctaUrl: '',
      sponsorName: '',
      sponsorVerified: false,
      status: 'pending',
      rejectionReason: '',
      dailyBudget: '',
      totalBudget: '',
      billingStatus: 'unpaid',
      startDate: '',
      endDate: '',
      bidCpm: '0.50',
      bidCpc: '0.05',
      bidCpe: '0.10',
      bidMaxMultiplier: '2.0',
      bidNiche: '',
    });
  };

  const handleToggleActive = async (ad: Advertisement) => {
    await updateAdvertisement(ad.id, { active: !ad.active });
    loadAdvertisements(); // Reload to update status
  };

  const getCTR = (ad: Advertisement) => {
    if (ad.impressions === 0) return '0%';
    return ((ad.clicks / ad.impressions) * 100).toFixed(2) + '%';
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Advertisements', headerShown: true }} />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Manage Ads</Text>
          <Text style={styles.headerSubtitle}>Review, approve, and optimize ad performance.</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, styles.headerButton]}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.secondaryButtonText}>Ad Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, styles.headerButton]}
            onPress={() => {
              resetForm();
              setEditingAd(null);
              setShowCreateModal(true);
            }}
          >
            <Plus size={18} color={colors.text.white} />
            <Text style={styles.primaryButtonText}>New Ad</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading advertisements...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{advertisements.length}</Text>
            <Text style={styles.statLabel}>Total Ads</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {advertisements.filter(ad => ad.active).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {advertisements.reduce((sum, ad) => sum + ad.impressions, 0)}
            </Text>
            <Text style={styles.statLabel}>Impressions</Text>
          </View>
        </View>

        <View style={styles.adsList}>
          {advertisements.map((ad) => (
            <View key={ad.id} style={styles.adCard}>
              <View style={styles.adImageContainer}>
                <Image source={{ uri: ad.imageUrl }} style={styles.adImage} contentFit="cover" />
                <View style={[styles.statusBadge, ad.active ? styles.activeBadge : styles.inactiveBadge]}>
                  <Text style={styles.statusText}>{ad.active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>

              <View style={styles.adContent}>
                <View style={styles.adHeaderRow}>
                  <View style={styles.adTitleWrap}>
                    <Text style={styles.adTitle}>{ad.title}</Text>
                    <Text style={styles.adSubtitle}>
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

                <Text style={styles.adDescription} numberOfLines={2}>
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
                    <Text style={styles.metricValue}>{getCTR(ad)}</Text>
                    <Text style={styles.metricLabel}>CTR</Text>
                  </View>
                </View>

                <View style={styles.spendRow}>
                  <Text style={styles.spendText}>
                    Spend ${Number(ad.spend || 0).toFixed(2)}
                    {ad.totalBudget ? ` / ${Number(ad.totalBudget).toFixed(2)}` : ''}
                  </Text>
                  <Text style={styles.spendSubtext}>Bid x{(ad as any).bidMultiplier?.toFixed(2) || '1.00'}</Text>
                </View>

                {(ad as any).engagements > 0 && (
                  <View style={styles.engagementRow}>
                    <Text style={styles.engagementText}>
                      {(ad as any).likes || 0} likes • {(ad as any).comments || 0} comments • {(ad as any).shares || 0} shares
                    </Text>
                  </View>
                )}
                {ad.rejectionReason ? (
                  <Text style={styles.rejectionText}>Rejected: {ad.rejectionReason}</Text>
                ) : null}

                <View style={styles.primaryActions}>
                  {ad.status === 'approved' ? (
                    <>
                      <View style={[styles.primaryAction, styles.primaryActionSuccess, styles.disabledButton]}>
                        <CheckCircle2 size={18} color={colors.text.white} />
                        <Text style={styles.primaryActionText}>Approved</Text>
                      </View>
                      <TouchableOpacity style={[styles.primaryAction, styles.primaryActionDanger]} onPress={() => handleReject(ad)}>
                        <XCircle size={18} color={colors.text.white} />
                        <Text style={styles.primaryActionText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  ) : ad.status === 'rejected' ? (
                    <>
                      <TouchableOpacity style={[styles.primaryAction, styles.primaryActionSuccess]} onPress={() => handleApprove(ad)}>
                        <CheckCircle2 size={18} color={colors.text.white} />
                        <Text style={styles.primaryActionText}>Approve</Text>
                      </TouchableOpacity>
                      <View style={[styles.primaryAction, styles.primaryActionDanger, styles.disabledButton]}>
                        <XCircle size={18} color={colors.text.white} />
                        <Text style={styles.primaryActionText}>Rejected</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity style={[styles.primaryAction, styles.primaryActionSuccess]} onPress={() => handleApprove(ad)}>
                        <CheckCircle2 size={18} color={colors.text.white} />
                        <Text style={styles.primaryActionText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.primaryAction, styles.primaryActionDanger]} onPress={() => handleReject(ad)}>
                        <XCircle size={18} color={colors.text.white} />
                        <Text style={styles.primaryActionText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={styles.secondaryActions}>
                  <TouchableOpacity style={[styles.primaryAction, styles.primaryActionBrand]} onPress={() => handleMarkPaid(ad)}>
                    <DollarSign size={18} color={colors.text.white} />
                    <Text style={styles.primaryActionText}>Mark Paid (manual)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() => updateAdvertisement(ad.id, { billingStatus: 'unpaid', active: false })}
                  >
                    <PauseCircle size={16} color={colors.text.primary} />
                    <Text style={styles.secondaryActionText}>Mark Unpaid</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.utilityActions}>
                  <TouchableOpacity
                    style={styles.iconAction}
                    onPress={() => handleToggleActive(ad)}
                  >
                    {ad.active ? (
                      <PauseCircle size={16} color={colors.text.primary} />
                    ) : (
                      <Play size={16} color={colors.text.primary} />
                    )}
                    <Text style={styles.iconActionText}>{ad.active ? 'Deactivate' : 'Activate'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconAction} onPress={() => handleEditAd(ad)}>
                    <Edit2 size={16} color={colors.text.primary} />
                    <Text style={styles.iconActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconAction} onPress={() => handleDeleteAd(ad)}>
                    <Trash2 size={16} color={colors.danger} />
                    <Text style={[styles.iconActionText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          {advertisements.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No advertisements yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Create your first ad to start monetizing
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      )}

      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateModal(false);
          setEditingAd(null);
          resetForm();
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAd ? 'Edit Advertisement' : 'New Advertisement'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  setEditingAd(null);
                  resetForm();
                }}
              >
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter ad title"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter ad description"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {formData.type === 'video' ? 'Video URL *' : 'Image URL *'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={formData.type === 'video' ? 'https://example.com/video.mp4' : 'https://example.com/image.jpg'}
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.imageUrl}
                  onChangeText={(text) => setFormData({ ...formData, imageUrl: text })}
                  autoCapitalize="none"
                />
                {formData.type === 'video' && (
                  <Text style={styles.helperText}>
                    💡 For video ads, use a video URL (.mp4, .mov, etc.). In reels, video ads will show as overlays with skip functionality.
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Link URL (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://example.com"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.linkUrl}
                  onChangeText={(text) => setFormData({ ...formData, linkUrl: text })}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.segmentedControl}>
                  {(['banner', 'card', 'video'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.segmentedButton,
                        formData.type === type && styles.segmentedButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type })}
                    >
                      <Text
                        style={[
                          styles.segmentedButtonText,
                          formData.type === type && styles.segmentedButtonTextActive,
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Placement</Text>
                <View style={styles.segmentedControl}>
                  {(['feed', 'reels', 'messages', 'all'] as const).map((placement) => (
                    <TouchableOpacity
                      key={placement}
                      style={[
                        styles.segmentedButton,
                        formData.placement === placement && styles.segmentedButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, placement })}
                    >
                      <Text
                        style={[
                          styles.segmentedButtonText,
                          formData.placement === placement && styles.segmentedButtonTextActive,
                        ]}
                      >
                        {placement.charAt(0).toUpperCase() + placement.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* CTA Settings */}
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Call To Action</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CTA Type</Text>
                <View style={styles.segmentedControl}>
                  {(['whatsapp', 'messenger', 'website'] as const).map((cta) => (
                    <TouchableOpacity
                      key={cta}
                      style={[
                        styles.segmentedButton,
                        formData.ctaType === cta && styles.segmentedButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, ctaType: cta })}
                    >
                      <Text
                        style={[
                          styles.segmentedButtonText,
                          formData.ctaType === cta && styles.segmentedButtonTextActive,
                        ]}
                      >
                        {cta === 'whatsapp'
                          ? 'WhatsApp'
                          : cta === 'messenger'
                          ? 'Messenger'
                          : 'Website'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {formData.ctaType === 'whatsapp' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>WhatsApp Number *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="+1234567890"
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.ctaPhone}
                      onChangeText={(text) => setFormData({ ...formData, ctaPhone: text })}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Template Message (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Hi, I'm interested..."
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.ctaMessage}
                      onChangeText={(text) => setFormData({ ...formData, ctaMessage: text })}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </>
              )}

              {formData.ctaType === 'messenger' && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Messenger Page/User ID *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="page_id or username"
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.ctaMessengerId}
                      onChangeText={(text) => setFormData({ ...formData, ctaMessengerId: text })}
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Template Message (Optional)</Text>
                    <TextInput
                      style={[styles.textInput, styles.textArea]}
                      placeholder="Hi, I'm interested..."
                      placeholderTextColor={colors.text.tertiary}
                      value={formData.ctaMessage}
                      onChangeText={(text) => setFormData({ ...formData, ctaMessage: text })}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </>
              )}

              {formData.ctaType === 'website' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Website URL *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://example.com"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.ctaUrl || formData.linkUrl}
                    onChangeText={(text) => setFormData({ ...formData, ctaUrl: text })}
                    autoCapitalize="none"
                  />
                </View>
              )}

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Sponsor</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sponsor Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Brand or company name"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.sponsorName}
                  onChangeText={(text) => setFormData({ ...formData, sponsorName: text })}
                />
              </View>
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setFormData({ ...formData, sponsorVerified: !formData.sponsorVerified })}
                >
                  <View style={[styles.checkbox, formData.sponsorVerified && styles.checkboxChecked]}>
                    {formData.sponsorVerified && <View style={styles.checkboxInner} />}
                  </View>
                  <Text style={styles.checkboxLabel}>Verified Sponsor</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setFormData({ ...formData, active: !formData.active })}
                >
                  <View style={[styles.checkbox, formData.active && styles.checkboxChecked]}>
                    {formData.active && <View style={styles.checkboxInner} />}
                  </View>
                  <Text style={styles.checkboxLabel}>Active</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Review & Billing</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.segmentedControl}>
                  {(['pending', 'approved', 'rejected', 'paused'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.segmentedButton,
                        formData.status === s && styles.segmentedButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, status: s })}
                    >
                      <Text
                        style={[
                          styles.segmentedButtonText,
                          formData.status === s && styles.segmentedButtonTextActive,
                        ]}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {formData.status === 'rejected' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Rejection Reason</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Explain why this ad was rejected"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.rejectionReason}
                    onChangeText={(text) => setFormData({ ...formData, rejectionReason: text })}
                    multiline
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Billing Status</Text>
                <View style={styles.segmentedControl}>
                  {(['unpaid', 'paid', 'failed', 'refunded'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.segmentedButton,
                        formData.billingStatus === s && styles.segmentedButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, billingStatus: s })}
                    >
                      <Text
                        style={[
                          styles.segmentedButtonText,
                          formData.billingStatus === s && styles.segmentedButtonTextActive,
                        ]}
                      >
                        {s.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Daily Budget (USD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 5"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.dailyBudget}
                  onChangeText={(text) => setFormData({ ...formData, dailyBudget: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Budget (USD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 50"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.totalBudget}
                  onChangeText={(text) => setFormData({ ...formData, totalBudget: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Bidding (CPM/CPC + Competition)</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Base CPM (USD per 1,000 views)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.50"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.bidCpm}
                  onChangeText={(text) => setFormData({ ...formData, bidCpm: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Base CPC (USD per click)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0.05"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.bidCpc}
                  onChangeText={(text) => setFormData({ ...formData, bidCpc: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Competition Multiplier</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="2.0"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.bidMaxMultiplier}
                  onChangeText={(text) => setFormData({ ...formData, bidMaxMultiplier: text })}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helperText}>
                  Bidding increases by +10% per competing paid ad in the same placement+niche, capped by this value.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Niche / Audience Key (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., relationships, dating, ruwah, women_25_35"
                  placeholderTextColor={colors.text.tertiary}
                  value={formData.bidNiche}
                  onChangeText={(text) => setFormData({ ...formData, bidNiche: text })}
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>
                  Ads with the same niche compete with each other (bid goes up). Empty = general.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setEditingAd(null);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveAd}
              >
                <Text style={styles.saveButtonText}>
                  {editingAd ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showSettingsModal}
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ad System Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Defaults (used if ad has no override)</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default CPM (USD per 1,000 views)</Text>
                <TextInput
                  style={styles.textInput}
                  value={settingsForm.defaultCpm}
                  onChangeText={(text) => setSettingsForm((p) => ({ ...p, defaultCpm: text }))}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default CPC (USD per click)</Text>
                <TextInput
                  style={styles.textInput}
                  value={settingsForm.defaultCpc}
                  onChangeText={(text) => setSettingsForm((p) => ({ ...p, defaultCpc: text }))}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputLabel}>Default CPE (USD per engagement)</Text>
                <TextInput
                  style={styles.textInput}
                  value={settingsForm.defaultCpe}
                  onChangeText={(text) => setSettingsForm((p) => ({ ...p, defaultCpe: text }))}
                  keyboardType="decimal-pad"
                  placeholder="0.10"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Max Multiplier</Text>
                <TextInput
                  style={styles.textInput}
                  value={settingsForm.defaultMaxMultiplier}
                  onChangeText={(text) => setSettingsForm((p) => ({ ...p, defaultMaxMultiplier: text }))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.sectionDivider}>
                <Text style={styles.sectionDividerText}>Competition / Bidding</Text>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Competitor Step (e.g. 0.10 = +10%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={settingsForm.competitorStep}
                  onChangeText={(text) => setSettingsForm((p) => ({ ...p, competitorStep: text }))}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helperText}>
                  Applied per competing paid+approved ad in the same placement+niche group.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowSettingsModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveSystemSettings}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: colors.text.secondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  secondaryButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  adsList: {
    padding: 16,
    gap: 16,
  },
  adCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  adImageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
  },
  adImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeBadge: {
    backgroundColor: colors.secondary,
  },
  inactiveBadge: {
    backgroundColor: colors.text.tertiary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  adContent: {
    padding: 18,
  },
  adHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  adTitleWrap: {
    flex: 1,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  adSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.text.tertiary,
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  chipApproved: {
    backgroundColor: colors.success || colors.primary,
  },
  chipRejected: {
    backgroundColor: colors.danger,
  },
  chipPending: {
    backgroundColor: colors.accent || colors.primary,
  },
  chipPaid: {
    backgroundColor: colors.primary,
  },
  chipUnpaid: {
    backgroundColor: colors.text.tertiary,
  },
  adDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 11,
    color: colors.text.tertiary,
  },
  spendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  spendText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  spendSubtext: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  engagementRow: {
    marginBottom: 10,
  },
  engagementText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  adMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  adStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statItemText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  ctrText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
    marginLeft: 'auto',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryActionSuccess: {
    backgroundColor: colors.success || colors.primary,
  },
  primaryActionDanger: {
    backgroundColor: colors.danger,
  },
  primaryActionBrand: {
    backgroundColor: colors.primary,
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  utilityActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  iconAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
  },
  iconActionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
    fontStyle: 'italic' as const,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentedButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentedButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  segmentedButtonTextActive: {
    color: colors.text.white,
  },
  sectionDivider: {
    marginVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 8,
  },
  sectionDividerText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: colors.text.white,
  },
  checkboxLabel: {
    fontSize: 16,
    color: colors.text.primary,
  },
  rejectionText: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.danger + '10',
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});
