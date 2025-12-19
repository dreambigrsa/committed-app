import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { Star, Filter, CheckCircle2, XCircle, Flag, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalReview, ReviewModerationStatus } from '@/types';

type ReviewFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'flagged';

export default function AdminProfessionalReviewsScreen() {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<ProfessionalReview[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [selectedReview, setSelectedReview] = useState<ProfessionalReview | null>(null);
  const [showModerationModal, setShowModerationModal] = useState(false);
  const [moderationReason, setModerationReason] = useState('');

  useEffect(() => {
    loadReviews();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('admin-professional-reviews')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'professional_reviews',
        },
        () => {
          loadReviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('professional_reviews')
        .select(`
          *,
          user:users!professional_reviews_user_id_fkey(id, full_name, profile_picture),
          professional:professional_profiles!professional_reviews_professional_id_fkey(id, full_name),
          session:professional_sessions(id, ai_summary)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('moderation_status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReviews((data || []).map(mapReview));
    } catch (error: any) {
      console.error('Error loading reviews:', error);
      Alert.alert('Error', 'Failed to load professional reviews');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const mapReview = (review: any): ProfessionalReview => {
    return {
      id: review.id,
      sessionId: review.session_id,
      professionalId: review.professional_id,
      userId: review.user_id,
      rating: review.rating,
      reviewText: review.review_text || undefined,
      isAnonymous: review.is_anonymous || false,
      moderationStatus: review.moderation_status,
      moderatedBy: review.moderated_by || undefined,
      moderatedAt: review.moderated_at || undefined,
      moderationReason: review.moderation_reason || undefined,
      reportedCount: review.reported_count || 0,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    };
  };

  const handleModerate = async (review: ProfessionalReview, status: ReviewModerationStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to moderate reviews');
        return;
      }

      const updateData: any = {
        moderation_status: status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (moderationReason.trim()) {
        updateData.moderation_reason = moderationReason.trim();
      }

      const { error } = await supabase
        .from('professional_reviews')
        .update(updateData)
        .eq('id', review.id);

      if (error) throw error;

      Alert.alert('Success', `Review ${status} successfully`);
      setShowModerationModal(false);
      setSelectedReview(null);
      setModerationReason('');
      loadReviews();
    } catch (error: any) {
      console.error('Error moderating review:', error);
      Alert.alert('Error', 'Failed to moderate review');
    }
  };

  const openModerationModal = (review: ProfessionalReview, status: ReviewModerationStatus) => {
    setSelectedReview(review);
    setShowModerationModal(true);
    // Pre-fill reason if rejecting/flagging
    if (status === 'rejected' || status === 'flagged') {
      setModerationReason('');
    } else {
      setModerationReason('');
    }
  };

  const getStatusIcon = (status: ReviewModerationStatus) => {
    switch (status) {
      case 'approved':
        return CheckCircle2;
      case 'rejected':
        return XCircle;
      case 'flagged':
        return Flag;
      default:
        return AlertCircle;
    }
  };

  const getStatusColor = (status: ReviewModerationStatus) => {
    switch (status) {
      case 'approved':
        return themeColors.secondary;
      case 'rejected':
        return themeColors.danger;
      case 'flagged':
        return themeColors.accent;
      default:
        return themeColors.text.tertiary;
    }
  };

  const filters: { label: string; value: ReviewFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Flagged', value: 'flagged' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Professional Reviews' }} />
      
      {/* Filters - Segmented Control */}
      <View style={styles.filtersContainer}>
        <View style={styles.segmentedControl}>
          {filters.map((filterOption, index) => (
            <TouchableOpacity
              key={filterOption.value}
              style={[
                styles.segmentedButton,
                filter === filterOption.value && styles.segmentedButtonActive,
                index === 0 && styles.segmentedButtonFirst,
                index === filters.length - 1 && styles.segmentedButtonLast,
              ]}
              onPress={() => setFilter(filterOption.value)}
            >
              <Text
                style={[
                  styles.segmentedButtonText,
                  filter === filterOption.value && styles.segmentedButtonTextActive,
                ]}
              >
                {filterOption.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading reviews...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadReviews();
              }}
              colors={[themeColors.primary]}
            />
          }
        >
          {reviews.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Star size={64} color={themeColors.text.tertiary} />
              <Text style={styles.emptyTitle}>No Reviews Found</Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'No professional reviews have been submitted yet.'
                  : `No reviews with status "${filters.find((f) => f.value === filter)?.label}".`}
              </Text>
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {reviews.map((review) => {
                const StatusIcon = getStatusIcon(review.moderationStatus);
                const statusColor = getStatusColor(review.moderationStatus);
                
                return (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewHeaderLeft}>
                        <View style={styles.ratingContainer}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={16}
                              color={star <= review.rating ? themeColors.accent : themeColors.border.light}
                              fill={star <= review.rating ? themeColors.accent : 'transparent'}
                            />
                          ))}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                          <StatusIcon size={14} color={statusColor} />
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {review.moderationStatus.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.reviewDate}>
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Text>
                    </View>

                    {review.reviewText && (
                      <Text style={styles.reviewText}>{review.reviewText}</Text>
                    )}

                    <View style={styles.reviewDetails}>
                      <Text style={styles.detailLabel}>
                        User: {review.isAnonymous ? 'Anonymous' : 'User ID'}
                      </Text>
                      <Text style={styles.detailLabel}>
                        Session: {review.sessionId.substring(0, 8)}...
                      </Text>
                    </View>

                    {review.moderationReason && (
                      <View style={styles.moderationReasonContainer}>
                        <Text style={styles.moderationReasonLabel}>Moderation Reason:</Text>
                        <Text style={styles.moderationReasonText}>{review.moderationReason}</Text>
                      </View>
                    )}

                    {review.moderationStatus === 'pending' && (
                      <View style={styles.moderationActions}>
                        <TouchableOpacity
                          style={[styles.moderationButton, styles.approveButton]}
                          onPress={() => openModerationModal(review, 'approved')}
                        >
                          <CheckCircle2 size={18} color={themeColors.secondary} />
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.moderationButton, styles.rejectButton]}
                          onPress={() => openModerationModal(review, 'rejected')}
                        >
                          <XCircle size={18} color={themeColors.danger} />
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.moderationButton, styles.flagButton]}
                          onPress={() => openModerationModal(review, 'flagged')}
                        >
                          <Flag size={18} color={themeColors.accent} />
                          <Text style={styles.flagButtonText}>Flag</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Moderation Modal */}
      {showModerationModal && selectedReview && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {selectedReview.moderationStatus === 'pending' ? 'Moderate Review' : 'Change Status'}
            </Text>
            
            <View style={styles.modalContent}>
              <Text style={styles.modalLabel}>Reason (optional):</Text>
              <TextInput
                style={styles.modalInput}
                value={moderationReason}
                onChangeText={setModerationReason}
                placeholder="Enter moderation reason..."
                placeholderTextColor={themeColors.text.tertiary}
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowModerationModal(false);
                  setSelectedReview(null);
                  setModerationReason('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              {selectedReview.moderationStatus === 'pending' && (
                <>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalApproveButton]}
                    onPress={() => handleModerate(selectedReview, 'approved')}
                  >
                    <Text style={styles.modalActionButtonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalRejectButton]}
                    onPress={() => handleModerate(selectedReview, 'rejected')}
                  >
                    <Text style={styles.modalActionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    filtersContainer: {
      backgroundColor: colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    filtersContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    filterButtonTextActive: {
      color: colors.text.white,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      minHeight: 400,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginTop: 24,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    reviewsList: {
      padding: 16,
      gap: 16,
    },
    reviewCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    reviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    reviewHeaderLeft: {
      flex: 1,
      gap: 8,
    },
    ratingContainer: {
      flexDirection: 'row',
      gap: 4,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    reviewDate: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    reviewText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
      marginBottom: 12,
    },
    reviewDetails: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 12,
    },
    detailLabel: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    moderationReasonContainer: {
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    moderationReasonLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    moderationReasonText: {
      fontSize: 14,
      color: colors.text.primary,
    },
    moderationActions: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    moderationButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 10,
      borderRadius: 8,
    },
    approveButton: {
      backgroundColor: colors.secondary + '20',
    },
    rejectButton: {
      backgroundColor: colors.danger + '20',
    },
    flagButton: {
      backgroundColor: colors.accent + '20',
    },
    approveButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondary,
    },
    rejectButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.danger,
    },
    flagButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      width: '90%',
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 20,
    },
    modalContent: {
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    modalInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text.primary,
      minHeight: 100,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    modalCancelButton: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    modalCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    modalActionButton: {
      flex: 1,
      padding: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalApproveButton: {
      backgroundColor: colors.secondary,
    },
    modalRejectButton: {
      backgroundColor: colors.danger,
    },
    modalActionButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

