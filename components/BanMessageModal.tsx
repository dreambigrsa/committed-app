import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { AlertCircle, XCircle, Send, Shield } from 'lucide-react-native';
import colors from '@/constants/colors';
import { supabase } from '@/lib/supabase';

interface BanMessageModalProps {
  visible: boolean;
  onClose: () => void;
  banReason: string;
  restrictionType: 'full_ban' | 'feature_restriction';
  restrictedFeature?: string;
  restrictionId?: string;
  userId: string;
}

export default function BanMessageModal({
  visible,
  onClose,
  banReason,
  restrictionType,
  restrictedFeature,
  restrictionId,
  userId,
}: BanMessageModalProps) {
  const [appealText, setAppealText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAppealed, setHasAppealed] = useState(false);

  const handleSubmitAppeal = async () => {
    if (!appealText.trim()) {
      Alert.alert('Error', 'Please provide a reason for your appeal');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('ban_appeals')
        .insert({
          user_id: userId,
          restriction_id: restrictionId || null,
          appeal_type: restrictionType,
          restricted_feature: restrictedFeature || null,
          reason: appealText.trim(),
          status: 'pending',
        });

      if (error) throw error;

      setHasAppealed(true);
      Alert.alert(
        'Appeal Submitted',
        'Your appeal has been submitted successfully. Our team will review it and get back to you soon.',
        [{ text: 'OK', onPress: onClose }]
      );
      setAppealText('');
    } catch (error: any) {
      console.error('Failed to submit appeal:', error);
      Alert.alert('Error', 'Failed to submit appeal. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setAppealText('');
      setHasAppealed(false);
      onClose();
    }
  };

  const featureDisplayName = restrictedFeature === 'posts' ? 'Creating Posts' :
                             restrictedFeature === 'comments' ? 'Commenting' :
                             restrictedFeature === 'messages' ? 'Sending Messages' :
                             restrictedFeature === 'reels' ? 'Creating Reels' :
                             restrictedFeature === 'reel_comments' ? 'Commenting on Reels' :
                             'This Feature';

  const banTitle = restrictionType === 'full_ban' 
    ? 'Account Suspended' 
    : `Access Restricted: ${featureDisplayName}`;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <View style={styles.titleContainer}>
              <AlertCircle size={24} color={colors.danger} />
              <Text style={styles.modalTitle}>{banTitle}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={isSubmitting}>
              <XCircle size={24} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.messageContainer}>
              <Text style={styles.messageText}>
                {banReason}
              </Text>
            </View>

            {!hasAppealed ? (
              <>
                <View style={styles.divider} />
                
                <View style={styles.appealSection}>
                  <View style={styles.appealHeader}>
                    <Shield size={20} color={colors.primary} />
                    <Text style={styles.appealTitle}>Submit an Appeal</Text>
                  </View>
                  <Text style={styles.appealDescription}>
                    If you believe this restriction was applied in error, you can submit an appeal. 
                    Our moderation team will review your case and respond within 24-48 hours.
                  </Text>

                  <TextInput
                    style={styles.appealInput}
                    placeholder="Please explain why you believe this restriction should be removed..."
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={6}
                    value={appealText}
                    onChangeText={setAppealText}
                    editable={!isSubmitting}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[styles.submitButton, (!appealText.trim() || isSubmitting) && styles.submitButtonDisabled]}
                    onPress={handleSubmitAppeal}
                    disabled={!appealText.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Text style={styles.submitButtonText}>Submitting...</Text>
                    ) : (
                      <>
                        <Send size={16} color={colors.text.white} />
                        <Text style={styles.submitButtonText}>Submit Appeal</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>
                  Your appeal has been submitted. We'll review it and notify you of the decision.
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeModalButton}
            onPress={handleClose}
            disabled={isSubmitting}
          >
            <Text style={styles.closeModalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalView: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    width: '100%',
    flex: 1,
  },
  messageContainer: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: 20,
    width: '100%',
  },
  appealSection: {
    width: '100%',
  },
  appealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  appealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  appealDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  appealInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 120,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: colors.text.tertiary,
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.white,
  },
  successContainer: {
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  successText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.primary,
  },
  closeModalButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: colors.background.secondary,
    width: '100%',
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

