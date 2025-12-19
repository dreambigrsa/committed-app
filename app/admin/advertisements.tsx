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
import { Plus, Edit2, Trash2, BarChart3, ExternalLink, X } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { Advertisement } from '@/types';

export default function AdminAdvertisementsScreen() {
  const { currentUser, createAdvertisement, updateAdvertisement, deleteAdvertisement } = useApp();
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    linkUrl: '',
    type: 'card' as Advertisement['type'],
    placement: 'feed' as Advertisement['placement'],
    active: true,
  });

  useEffect(() => {
    loadAdvertisements();
  }, []);

  const loadAdvertisements = async () => {
    try {
      setLoading(true);
      
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
        const { data: clicksData, error: clicksError } = await supabase
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
        const formattedAds: Advertisement[] = adsData.map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          description: ad.description,
          imageUrl: ad.image_url,
          linkUrl: ad.link_url,
          type: ad.type,
          placement: ad.placement,
          active: ad.active,
          impressions: impressionsMap.get(ad.id) || 0, // Use real count from tracking table
          clicks: clicksMap.get(ad.id) || 0, // Use real count from tracking table
          createdBy: ad.created_by,
          createdAt: ad.created_at,
          updatedAt: ad.updated_at,
        }));

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

    await saveAd();
  };

  const saveAd = async () => {
    if (editingAd) {
      await updateAdvertisement(editingAd.id, formData);
    } else {
      await createAdvertisement({
        ...formData,
        createdBy: currentUser.id,
        active: formData.active,
      });
    }

    setShowCreateModal(false);
    setEditingAd(null);
    resetForm();
    loadAdvertisements(); // Reload to get updated list
  };

  const handleEditAd = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl || '',
      type: ad.type,
      placement: ad.placement,
      active: ad.active,
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
        <Text style={styles.headerTitle}>Manage Ads</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => {
            resetForm();
            setEditingAd(null);
            setShowCreateModal(true);
          }}
        >
          <Plus size={20} color={colors.text.white} />
          <Text style={styles.createButtonText}>New Ad</Text>
        </TouchableOpacity>
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
                <Text style={styles.adTitle}>{ad.title}</Text>
                <Text style={styles.adDescription} numberOfLines={2}>
                  {ad.description}
                </Text>

                <View style={styles.adMeta}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Type:</Text>
                    <Text style={styles.metaValue}>{ad.type}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Placement:</Text>
                    <Text style={styles.metaValue}>{ad.placement}</Text>
                  </View>
                </View>

                <View style={styles.adStats}>
                  <View style={styles.statItem}>
                    <BarChart3 size={16} color={colors.primary} />
                    <Text style={styles.statItemText}>{ad.impressions} views</Text>
                  </View>
                  <View style={styles.statItem}>
                    <ExternalLink size={16} color={colors.secondary} />
                    <Text style={styles.statItemText}>{ad.clicks} clicks</Text>
                  </View>
                  <Text style={styles.ctrText}>CTR: {getCTR(ad)}</Text>
                </View>

                <View style={styles.adActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleToggleActive(ad)}
                  >
                    <Text style={styles.actionButtonText}>
                      {ad.active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEditAd(ad)}
                  >
                    <Edit2 size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteAd(ad)}
                  >
                    <Trash2 size={18} color={colors.danger} />
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
    alignItems: 'center',
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
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
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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
    borderRadius: 12,
    overflow: 'hidden',
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
    padding: 16,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  adDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
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
  adActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
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
