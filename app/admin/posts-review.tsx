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
import { CheckCircle, XCircle, RefreshCw, Eye, Trash2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

interface ReviewPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  mediaUrls: string[];
  mediaType: string;
  moderationStatus: string;
  moderationReason?: string;
  createdAt: string;
}

export default function AdminPostsReviewScreen() {
  const { currentUser, adminDeletePost, adminRejectPost } = useApp();
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'resubmit'>('pending');
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPosts();
  }, [filter]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('posts')
        .select(`
          *,
          users!posts_user_id_fkey(full_name, profile_picture)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const formattedPosts: ReviewPost[] = data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          userName: p.users?.full_name || 'Unknown',
          userAvatar: p.users?.profile_picture,
          content: p.content,
          mediaUrls: p.media_urls || [],
          mediaType: p.media_type,
          moderationStatus: p.moderation_status,
          moderationReason: p.moderation_reason,
          createdAt: p.created_at,
        }));
        setPosts(formattedPosts);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (postId: string, action: 'approved' | 'rejected' | 'resubmit', reason?: string) => {
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
        .from('posts')
        .update(updateData)
        .eq('id', postId);

      if (error) throw error;

      Alert.alert('Success', `Post ${action === 'approved' ? 'approved' : action === 'rejected' ? 'rejected' : 'marked for resubmission'}`);
      setRejectionReason(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      loadPosts();
    } catch (error) {
      console.error('Failed to moderate post:', error);
      Alert.alert('Error', 'Failed to moderate post');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Posts Review', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Review Posts', headerShown: true }} />
      
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
                {posts.filter(p => p.moderationStatus === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {posts.filter(p => p.moderationStatus === 'approved').length}
              </Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {posts.filter(p => p.moderationStatus === 'rejected').length}
              </Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {posts.filter(p => p.moderationStatus === 'resubmit').length}
              </Text>
              <Text style={styles.statLabel}>Resubmit</Text>
            </View>
          </View>

          <View style={styles.postsList}>
            {posts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.userInfo}>
                    {post.userAvatar ? (
                      <Image source={{ uri: post.userAvatar }} style={styles.userAvatar} />
                    ) : (
                      <View style={styles.userAvatarPlaceholder}>
                        <Text style={styles.userAvatarText}>{post.userName.charAt(0)}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.userName}>{post.userName}</Text>
                      <Text style={styles.postDate}>
                        {new Date(post.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    post.moderationStatus === 'pending' && styles.pendingBadge,
                    post.moderationStatus === 'approved' && styles.approvedBadge,
                    post.moderationStatus === 'rejected' && styles.rejectedBadge,
                    post.moderationStatus === 'resubmit' && styles.resubmitBadge,
                  ]}>
                    <Text style={styles.statusText}>{post.moderationStatus.toUpperCase()}</Text>
                  </View>
                </View>

                {post.content && (
                  <Text style={styles.postContent}>{post.content}</Text>
                )}

                {post.mediaUrls.length > 0 && (
                  <View style={styles.mediaContainer}>
                    {post.mediaUrls.slice(0, 3).map((url, index) => (
                      <Image key={index} source={{ uri: url }} style={styles.mediaImage} />
                    ))}
                  </View>
                )}

                {post.moderationReason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Previous Reason:</Text>
                    <Text style={styles.reasonText}>{post.moderationReason}</Text>
                  </View>
                )}

                {(post.moderationStatus === 'pending' || post.moderationStatus === 'approved') && (
                  <View style={styles.reasonInputContainer}>
                    <TextInput
                      style={styles.reasonInput}
                      placeholder="Rejection reason (optional)"
                      placeholderTextColor={colors.text.tertiary}
                      value={rejectionReason[post.id] || ''}
                      onChangeText={(text) => setRejectionReason(prev => ({ ...prev, [post.id]: text }))}
                      multiline
                    />
                  </View>
                )}

                <View style={styles.actions}>
                  {post.moderationStatus === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleModerate(post.id, 'approved')}
                      >
                        <CheckCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleModerate(post.id, 'rejected', rejectionReason[post.id])}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.resubmitButton]}
                        onPress={() => handleModerate(post.id, 'resubmit', rejectionReason[post.id])}
                      >
                        <RefreshCw size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Resubmit</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {post.moderationStatus === 'approved' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={async () => {
                          const reason = rejectionReason[post.id] || 'Rejected by admin';
                          const success = await adminRejectPost(post.id, reason);
                          if (success) {
                            Alert.alert('Success', 'Post rejected successfully');
                            setRejectionReason(prev => {
                              const next = { ...prev };
                              delete next[post.id];
                              return next;
                            });
                            loadPosts();
                          } else {
                            Alert.alert('Error', 'Failed to reject post');
                          }
                        }}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={async () => {
                          Alert.alert(
                            'Delete Post',
                            'Are you sure you want to delete this approved post? This action cannot be undone.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  const success = await adminDeletePost(post.id);
                                  if (success) {
                                    Alert.alert('Success', 'Post deleted successfully');
                                    loadPosts();
                                  } else {
                                    Alert.alert('Error', 'Failed to delete post');
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
                  {post.moderationStatus === 'resubmit' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => handleModerate(post.id, 'approved')}
                      >
                        <CheckCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleModerate(post.id, 'rejected', rejectionReason[post.id])}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}

            {posts.length === 0 && (
              <View style={styles.emptyState}>
                <Eye size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No posts to review</Text>
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
  postsList: {
    padding: 16,
    gap: 16,
  },
  postCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  postHeader: {
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
  postDate: {
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
  approvedBadge: {
    backgroundColor: colors.secondary,
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
  postContent: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
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
  deleteButton: {
    backgroundColor: '#8B0000',
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

