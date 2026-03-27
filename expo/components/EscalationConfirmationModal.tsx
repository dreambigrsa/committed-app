import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AlertCircle, CheckCircle2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfessionalProfile } from '@/types';

interface EscalationConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDecline: () => void;
  professional: ProfessionalProfile | null;
  reason: string;
  loading?: boolean;
}

export default function EscalationConfirmationModal({
  visible,
  onClose,
  onConfirm,
  onDecline,
  professional,
  reason,
  loading = false,
}: EscalationConfirmationModalProps) {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <AlertCircle size={24} color={themeColors.accent} />
            </View>
            <Text style={styles.title}>Session Escalation</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={loading}>
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Your session needs to be escalated to a different professional.
            </Text>

            {reason && (
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            )}

            {professional && (
              <View style={styles.professionalContainer}>
                <Text style={styles.professionalLabel}>New Professional:</Text>
                <View style={styles.professionalCard}>
                  <Text style={styles.professionalName}>{professional.fullName}</Text>
                  {professional.ratingAverage > 0 && (
                    <View style={styles.ratingContainer}>
                      <Text style={styles.ratingText}>
                        ⭐ {professional.ratingAverage.toFixed(1)} ({professional.ratingCount} reviews)
                      </Text>
                    </View>
                  )}
                  {professional.bio && (
                    <Text style={styles.professionalBio}>{professional.bio}</Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                • Your conversation history will be shared with the new professional
              </Text>
              <Text style={styles.infoText}>
                • You can continue your conversation seamlessly
              </Text>
              <Text style={styles.infoText}>
                • You can decline if you prefer to continue with the current professional
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
              disabled={loading}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={themeColors.text.white} />
              ) : (
                <>
                  <CheckCircle2 size={18} color={themeColors.text.white} />
                  <Text style={styles.confirmButtonText}>Accept Escalation</Text>
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      width: '90%',
      maxHeight: '80%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    iconContainer: {
      marginRight: 12,
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 20,
    },
    description: {
      fontSize: 16,
      color: colors.text.primary,
      lineHeight: 24,
      marginBottom: 20,
    },
    reasonContainer: {
      backgroundColor: colors.accent + '20',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    reasonLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
      marginBottom: 8,
    },
    reasonText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    professionalContainer: {
      marginBottom: 20,
    },
    professionalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 12,
    },
    professionalCard: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    professionalName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    ratingContainer: {
      marginBottom: 8,
    },
    ratingText: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    professionalBio: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    infoBox: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    declineButton: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    declineButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    confirmButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.secondary,
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

