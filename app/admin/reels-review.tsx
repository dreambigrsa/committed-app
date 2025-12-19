import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { CheckCircle, XCircle, RefreshCw, Video as VideoIcon, Trash2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

interface ReviewReel {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  caption: string;
  moderationStatus: string;
  moderationReason?: string;
  createdAt: string;
}

export default function AdminReelsReviewScreen() {
  const { currentUser, adminDeleteReel, adminRejectReel } = useApp();
  const [reels, setReels] = useState<ReviewReel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'resubmit'>('pending');
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

  useEffect(() => {
    loadReels();
  }, [filter]);

  const loadReels = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('reels')
        .select(`
          *,
          users!reels_user_id_fkey(full_name, profile_picture)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const formattedReels: ReviewReel[] = data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.users?.full_name || 'Unknown',
          userAvatar: r.users?.profile_picture,
          videoUrl: r.video_url,
          thumbnailUrl: r.thumbnail_url,
          caption: r.caption,
          moderationStatus: r.moderation_status,
          moderationReason: r.moderation_reason,
          createdAt: r.created_at,
        }));
        setReels(formattedReels);
      }
    } catch (error) {
      console.error('Failed to load reels:', error);
      Alert.alert('Error', 'Failed to load reels');
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (reelId: string, action: 'approved' | 'rejected' | 'resubmit', reason?: string) => {
    try {
      const updateData: any = {
        moderation_status: action,
        moderated_at: new Date().toISOString(),
        moderated_by: currentUser?.id,
      };

      if (reason) {
        updateData.moderation_reason = reason;
      }

      const { error } = await supabase
        .from('reels')
        .update(updateData)
        .eq('id', reelId);

      if (error) throw error;

      Alert.alert('Success', `Reel ${action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'marked for resubmission'}`);
      setRejectionReason(prev => {
        const next = { ...prev };
        delete next[reelId];
        return next;
      });
      loadReels();
    } catch (error) {
      console.error('Failed to moderate reel:', error);
      Alert.alert('Error', 'Failed to moderate reel');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Reels Review', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Review Reels', headerShown: true }} />
      
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'approved', 'rejected', 'resubmit'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reels.filter(r => r.moderationStatus === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reels.filter(r => r.moderationStatus === 'approved').length}
              </Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reels.filter(r => r.moderationStatus === 'rejected').length}
              </Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reels.filter(r => r.moderationStatus === 'resubmit').length}
              </Text>
              <Text style={styles.statLabel}>Resubmit</Text>
            </View>
          </View>

          <View style={styles.reelsList}>
            {reels.map((reel) => (
              <View key={reel.id} style={styles.reelCard}>
                <View style={styles.reelHeader}>
                  <View style={styles.userInfo}>
                    {reel.userAvatar ? (
                      <Image source={{ uri: reel.userAvatar }} style={styles.userAvatar} />
                    ) : (
                      <View style={styles.userAvatarPlaceholder}>
                        <Text style={styles.userAvatarText}>{reel.userName.charAt(0)}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.userName}>{reel.userName}</Text>
                      <Text style={styles.reelDate}>
                        {new Date(reel.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    reel.moderationStatus === 'pending' && styles.pendingBadge,
                    reel.moderationStatus === 'rejected' && styles.rejectedBadge,
                    reel.moderationStatus === 'resubmit' && styles.resubmitBadge,
                  ]}>
                    <Text style={styles.statusText}>{reel.moderationStatus.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.videoContainer}>
                  {reel.thumbnailUrl ? (
                    <Image source={{ uri: reel.thumbnailUrl }} style={styles.videoThumbnail} />
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <VideoIcon size={48} color={colors.text.tertiary} />
                    </View>
                  )}
                  <View style={styles.videoOverlay}>
                    <Video
                      source={{ uri: reel.videoUrl }}
                      style={styles.video}
                      useNativeControls
                      resizeMode={ResizeMode.CONTAIN}
                    />
                  </View>
                </View>

                {reel.caption && (
                  <Text style={styles.caption}>{reel.caption}</Text>
                )}

                {reel.moderationReason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Previous Reason:</Text>
                    <Text style={styles.reasonText}>{reel.moderationReason}</Text>
                  </View>
                )}

                {reel.moderationStatus === 'pending' && (
                  <View style={styles.reasonInputContainer}>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Rejection reason (optional)"
                      placeholderTextColor={colors.text.tertiary}
                      value={rejectionReason[reel.id] || ''}
                      onChangeText={(text) => setRejectionReason(prev => ({ ...prev, [reel.id]: text }))}
                      multiline
                    />
                  </View>
                )}

                <View style={styles.actions}>
                  {reel.moderationStatus === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleModerate(reel.id, 'approved')}
                      >
                        <CheckCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleModerate(reel.id, 'rejected', rejectionReason[reel.id])}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.resubmitButton]}
                        onPress={() => handleModerate(reel.id, 'resubmit', rejectionReason[reel.id])}
                      >
                        <RefreshCw size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Resubmit</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {reel.moderationStatus === 'resubmit' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleModerate(reel.id, 'approved')}
                      >
                        <CheckCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleModerate(reel.id, 'rejected', rejectionReason[reel.id])}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {reel.moderationStatus === 'approved' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={async () => {
                          const reason = rejectionReason[reel.id] || 'Rejected by admin';
                          const success = await adminRejectReel(reel.id, reason);
                          if (success) {
                            Alert.alert('Success', 'Reel rejected successfully');
                            setRejectionReason(prev => {
                              const next = { ...prev };
                              delete next[reel.id];
                              return next;
                            });
                            loadReels();
                          } else {
                            Alert.alert('Error', 'Failed to reject reel');
                          }
                        }}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.danger }]}
                        onPress={async () => {
                          Alert.alert(
                            'Delete Reel',
                            'Are you sure you want to delete this reel?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  const success = await adminDeleteReel(reel.id);
                                  if (success) {
                                    Alert.alert('Success', 'Reel deleted successfully');
                                    loadReels();
                                  } else {
                                    Alert.alert('Error', 'Failed to delete reel');
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <Trash2 size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}

            {reels.length === 0 && (
              <View style={styles.emptyState}>
                <VideoIcon size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No reels to review</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
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
  },
  errorText: {
    fontSize: 18,
    color: colors.text.primary,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.text.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statItem: {
    flex: 1,
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
  },
  reelsList: {
    padding: 16,
    gap: 16,
  },
  reelCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  reelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  reelDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pendingBadge: {
    backgroundColor: colors.accent,
  },
  rejectedBadge: {
    backgroundColor: colors.danger,
  },
  resubmitBadge: {
    backgroundColor: '#FFA500',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  videoContainer: {
    width: '100%',
    height: 300,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  caption: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: 12,
  },
  reasonBox: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  reasonInputContainer: {
    marginBottom: 12,
  },
  reasonInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: colors.secondary,
  },
  rejectButton: {
    backgroundColor: colors.danger,
  },
  resubmitButton: {
    backgroundColor: '#FFA500',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
});

