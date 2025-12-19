import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';

interface ReportContentModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'post' | 'reel' | 'comment' | 'message' | 'profile';
  contentId?: string;
  reportedUserId?: string;
  onReport: (
    contentType: 'post' | 'reel' | 'comment' | 'message' | 'profile',
    contentId: string | undefined,
    reportedUserId: string | undefined,
    reason: string,
    description?: string
  ) => Promise<any>;
  colors: any;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Nudity or sexual content',
  'Copyright violation',
  'False information',
  'Other',
];

export default function ReportContentModal({
  visible,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  onReport,
  colors,
}: ReportContentModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    try {
      await onReport(contentType, contentId, reportedUserId, selectedReason, description.trim() || undefined);
      Alert.alert('Success', 'Your report has been submitted. We will review it shortly.', [
        { text: 'OK', onPress: onClose },
      ]);
      setSelectedReason('');
      setDescription('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setDescription('');
      onClose();
    }
  };

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <AlertTriangle size={24} color={colors.danger} />
              <Text style={styles.modalTitle}>Report {contentType}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
              <X size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Why are you reporting this?</Text>
            <Text style={styles.subLabel}>Your report is anonymous</Text>

            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[
                  styles.reasonOption,
                  selectedReason === reason && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason)}
                disabled={isSubmitting}
              >
                <View style={styles.reasonRadio}>
                  {selectedReason === reason && (
                    <View style={styles.reasonRadioSelected} />
                  )}
                </View>
                <Text
                  style={[
                    styles.reasonText,
                    selectedReason === reason && styles.reasonTextSelected,
                  ]}
                >
                  {reason}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Additional details (optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Provide more context..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.text.primary,
    },
    modalBody: {
      padding: 20,
      maxHeight: 500,
    },
    label: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.primary,
      marginBottom: 4,
    },
    subLabel: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 16,
    },
    reasonOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    reasonOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    reasonRadio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border.medium,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reasonRadioSelected: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    reasonText: {
      fontSize: 15,
      color: colors.text.primary,
      flex: 1,
    },
    reasonTextSelected: {
      fontWeight: '600' as const,
      color: colors.primary,
    },
    descriptionInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: colors.text.primary,
      minHeight: 100,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginTop: 8,
    },
    modalFooter: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: colors.background.secondary,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.secondary,
    },
    submitButton: {
      backgroundColor: colors.danger,
    },
    submitButtonDisabled: {
      backgroundColor: colors.border.light,
      opacity: 0.5,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.white,
    },
  });

