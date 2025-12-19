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
} from 'react-native';
import { Stack } from 'expo-router';
import { Star, User, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';

interface ProfessionalReview {
  id: string;
  rating: number;
  reviewText: string | null;
  isAnonymous: boolean;
  createdAt: string;
  user?: {
    fullName: string;
    profilePicture: string | null;
  };
  session?: {
    id: string;
    createdAt: string;
  };
}

export default function ProfessionalReviewsScreen() {
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<ProfessionalReview[]>([]);
  const [professionalProfile, setProfessionalProfile] = useState<any>(null);
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  useEffect(() => {
    loadProfessionalProfile();
  }, [currentUser]);

  useEffect(() => {
    if (professionalId) {
      loadReviews();
    }
  }, [professionalId]);

  const loadProfessionalProfile = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('professional_profiles')
        .select('id, rating_average, rating_count, review_count')
        .eq('user_id', currentUser.id)
        .eq('approval_status', 'approved')
        .single();

      if (error) throw error;

      if (data) {
        setProfessionalId(data.id);
        setProfessionalProfile(data);
      }
    } catch (error: any) {
      console.error('Error loading professional profile:', error);
    }
  };

  const loadReviews = async () => {
    if (!professionalId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_reviews')
        .select(`
          id,
          rating,
          review_text,
          is_anonymous,
          created_at,
          user:users!professional_reviews_user_id_fkey(id, full_name, profile_picture),
          session:professional_sessions!professional_reviews_session_id_fkey(id, created_at)
        `)
        .eq('professional_id', professionalId)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedReviews: ProfessionalReview[] = (data || []).map((review: any) => ({
        id: review.id,
        rating: review.rating,
        reviewText: review.review_text,
        isAnonymous: review.is_anonymous,
        createdAt: review.created_at,
        user: review.user ? {
          fullName: review.user.full_name,
          profilePicture: review.user.profile_picture,
        } : undefined,
        session: review.session ? {
          id: review.session.id,
          createdAt: review.session.created_at,
        } : undefined,
      }));

      setReviews(mappedReviews);
    } catch (error: any) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
    loadProfessionalProfile();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading && reviews.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'My Reviews' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading reviews...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'My Reviews' }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColors.primary]} />
        }
      >
        {/* Rating Summary */}
        {professionalProfile && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Average Rating</Text>
                <View style={styles.ratingDisplay}>
                  <Star size={24} color={themeColors.accent} fill={themeColors.accent} />
                  <Text style={styles.ratingValue}>
                    {professionalProfile.rating_average ? parseFloat(professionalProfile.rating_average).toFixed(1) : '0.0'}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Ratings</Text>
                <Text style={styles.summaryValue}>{professionalProfile.rating_count || 0}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Reviews</Text>
                <Text style={styles.summaryValue}>{professionalProfile.review_count || 0}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Star size={64} color={themeColors.text.tertiary} />
            <Text style={styles.emptyTitle}>No reviews yet</Text>
            <Text style={styles.emptyText}>
              Your approved reviews will appear here once users rate their sessions with you.
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.avatarContainer}>
                      {review.isAnonymous ? (
                        <User size={20} color={themeColors.text.secondary} />
                      ) : review.user?.profilePicture ? (
                        <View style={styles.avatarPlaceholder} />
                      ) : (
                        <User size={20} color={themeColors.text.secondary} />
                      )}
                    </View>
                    <View style={styles.reviewerDetails}>
                      <Text style={styles.reviewerName}>
                        {review.isAnonymous ? 'Anonymous' : (review.user?.fullName || 'User')}
                      </Text>
                      {review.session && (
                        <Text style={styles.reviewDate}>
                          <Calendar size={12} color={themeColors.text.tertiary} /> {formatDate(review.session.createdAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.ratingDisplay}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        color={themeColors.accent}
                        fill={star <= review.rating ? themeColors.accent : 'transparent'}
                      />
                    ))}
                  </View>
                </View>

                {review.reviewText && (
                  <Text style={styles.reviewText}>{review.reviewText}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
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
    summaryCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    summaryItem: {
      alignItems: 'center',
      gap: 8,
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '600',
    },
    ratingDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    summaryValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    reviewsList: {
      gap: 12,
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
    reviewerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    avatarContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
    },
    reviewerDetails: {
      flex: 1,
    },
    reviewerName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    reviewDate: {
      fontSize: 12,
      color: colors.text.tertiary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    reviewText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
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
  });

