import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { X, Star, Send } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalReview } from '@/types';

interface SessionReviewModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  professionalId: string;
  userId: string;
  onReviewSubmitted?: () => void;
}

export default function SessionReviewModal({
  visible,
  onClose,
  sessionId,
  professionalId,
  userId,
  onReviewSubmitted,
}: SessionReviewModalProps) {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please provide a rating before submitting your review.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('professional_reviews').insert({
        session_id: sessionId,
        professional_id: professionalId,
        user_id: userId,
        rating,
        review_text: reviewText.trim() || null,
        is_anonymous: isAnonymous,
        moderation_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      Alert.alert('Thank You!', 'Your review has been submitted and is pending moderation.', [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            onClose();
            if (onReviewSubmitted) {
              onReviewSubmitted();
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setRating(0);
    setHoveredRating(0);
    setReviewText('');
    setIsAnonymous(false);
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate Your Session</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.ratingSection}>
              <Text style={styles.label}>How would you rate this session? *</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= (hoveredRating || rating);
                  return (
                    <TouchableOpacity
                      key={star}
                      style={styles.starButton}
                      onPress={() => setRating(star)}
                      onPressIn={() => setHoveredRating(star)}
                      onPressOut={() => setHoveredRating(0)}
                      disabled={submitting}
                    >
                      <Star
                        size={40}
                        color={isFilled ? themeColors.accent : themeColors.border.light}
                        fill={isFilled ? themeColors.accent : 'transparent'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
              {rating > 0 && (
                <Text style={styles.ratingText}>
                  {rating === 5
                    ? 'Excellent'
                    : rating === 4
                    ? 'Very Good'
                    : rating === 3
                    ? 'Good'
                    : rating === 2
                    ? 'Fair'
                    : 'Poor'}
                </Text>
              )}
            </View>

            <View style={styles.reviewSection}>
              <Text style={styles.label}>Share your experience (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Tell us about your experience with this professional..."
                placeholderTextColor={themeColors.text.tertiary}
                multiline
                numberOfLines={6}
                maxLength={1000}
                editable={!submitting}
              />
              <Text style={styles.charCount}>
                {reviewText.length}/1000 characters
              </Text>
            </View>

            <View style={styles.anonymousSection}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Submit anonymously</Text>
                <Switch
                  value={isAnonymous}
                  onValueChange={setIsAnonymous}
                  disabled={submitting}
                  trackColor={{
                    false: themeColors.border.light,
                    true: themeColors.primary,
                  }}
                  thumbColor={themeColors.text.white}
                />
              </View>
              <Text style={styles.switchHelpText}>
                Your name will not be shown to the professional, but admins can see your identity.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (rating === 0 || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={rating === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={themeColors.text.white} />
              ) : (
                <>
                  <Send size={18} color={themeColors.text.white} />
                  <Text style={styles.submitButtonText}>Submit Review</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    ratingSection: {
      marginBottom: 32,
      alignItems: 'center',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 16,
      textAlign: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    starButton: {
      padding: 4,
    },
    ratingText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.accent,
    },
    reviewSection: {
      marginBottom: 24,
    },
    textInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
      minHeight: 120,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    charCount: {
      fontSize: 12,
      color: colors.text.tertiary,
      textAlign: 'right',
      marginTop: 8,
    },
    anonymousSection: {
      marginBottom: 16,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      flex: 1,
    },
    switchHelpText: {
      fontSize: 12,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    cancelButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    submitButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

