import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { X, Calendar, XCircle, MapPin, Shield, Clock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfessionalSession } from '@/types';
import { cancelProfessionalSession, endProfessionalSession } from '@/lib/professional-sessions';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface SessionManagementModalProps {
  visible: boolean;
  onClose: () => void;
  session: ProfessionalSession | null;
  userId: string;
  onSessionCancelled?: () => void;
  onSessionEnded?: () => void;
}

const { width } = Dimensions.get('window');

export default function SessionManagementModal({
  visible,
  onClose,
  session,
  userId,
  onSessionCancelled,
  onSessionEnded,
}: SessionManagementModalProps) {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(false);
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);
  const [showAddressRequest, setShowAddressRequest] = useState(false);
  const [addressRequest, setAddressRequest] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      scaleAnim.setValue(0.9);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset state when modal closes
      setShowRescheduleInput(false);
      setShowAddressRequest(false);
      setRescheduleNote('');
      setAddressRequest('');
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!session) return null;

  const canCancel = session.status === 'pending_acceptance';
  const canEnd = session.status === 'active';
  const canRequestAddress = session.status === 'active' || session.status === 'pending_acceptance';

  const getStatusInfo = () => {
    switch (session.status) {
      case 'pending_acceptance':
        return {
          label: 'Pending Acceptance',
          icon: Clock,
          color: themeColors.accent,
          bgColor: themeColors.badge.pending,
          textColor: themeColors.badge.pendingText,
          description: 'Waiting for professional to accept your request',
        };
      case 'active':
        return {
          label: 'Active Session',
          icon: CheckCircle2,
          color: themeColors.secondary,
          bgColor: themeColors.badge.verified,
          textColor: themeColors.badge.verifiedText,
          description: 'Professional has joined the conversation',
        };
      case 'ended':
        return {
          label: 'Ended',
          icon: XCircle,
          color: themeColors.text.tertiary,
          bgColor: themeColors.background.secondary,
          textColor: themeColors.text.secondary,
          description: 'This session has ended',
        };
      default:
        return {
          label: session.status.replace('_', ' ').toUpperCase(),
          icon: Shield,
          color: themeColors.primary,
          bgColor: themeColors.background.secondary,
          textColor: themeColors.text.primary,
          description: 'Session status',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const handleCancel = async () => {
    Alert.alert(
      'Cancel Session',
      'Are you sure you want to cancel this session request? The professional will be notified.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await cancelProfessionalSession(session.id, userId);
              if (success) {
                Alert.alert('Session Cancelled', 'Your session request has been cancelled.');
                onSessionCancelled?.();
                handleClose();
              } else {
                Alert.alert('Error', 'Failed to cancel session. Please try again.');
              }
            } catch (error: any) {
              console.error('Error cancelling session:', error);
              Alert.alert('Error', 'Failed to cancel session. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEndSession = async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session? You\'ll be able to leave a review after ending.',
      [
        { text: 'Keep Session', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const success = await endProfessionalSession(session.id, 'user', 'Ended by user');
              if (success) {
                Alert.alert('Session Ended', 'This session has been ended. You can leave a review if you wish.');
                onSessionEnded?.();
                handleClose();
              } else {
                Alert.alert('Error', 'Failed to end session. Please try again.');
              }
            } catch (error: any) {
              console.error('Error ending session:', error);
              Alert.alert('Error', 'Failed to end session. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestReschedule = async () => {
    if (!rescheduleNote.trim()) {
      Alert.alert('Note Required', 'Please provide a reason for rescheduling so the professional can better assist you.');
      return;
    }

    Alert.alert(
      'Request Reschedule',
      'This will cancel the current session and send a message to the professional requesting a new time. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Reschedule',
          onPress: async () => {
            try {
              setLoading(true);
              
              const cancelled = await cancelProfessionalSession(session.id, userId);
              if (!cancelled) {
                Alert.alert('Error', 'Failed to cancel session. Please try again.');
                return;
              }

              const { data: conversation } = await supabase
                .from('conversations')
                .select('participants')
                .eq('id', session.conversationId)
                .single();

              if (conversation) {
                const professionalUserId = await supabase
                  .from('professional_profiles')
                  .select('user_id')
                  .eq('id', session.professionalId)
                  .single()
                  .then(({ data }) => data?.user_id);

                if (professionalUserId) {
                  await supabase.from('messages').insert({
                    conversation_id: session.conversationId,
                    sender_id: userId,
                    receiver_id: professionalUserId,
                    content: `I would like to reschedule our session. ${rescheduleNote}`,
                    message_type: 'text',
                  });
                }
              }

              Alert.alert(
                'Reschedule Requested',
                'Your session has been cancelled and the professional has been notified. You can request a new session when ready.',
                [{ text: 'OK', onPress: () => {
                  onSessionCancelled?.();
                  handleClose();
                }}]
              );
            } catch (error: any) {
              console.error('Error requesting reschedule:', error);
              Alert.alert('Error', 'Failed to request reschedule. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRequestAddress = async () => {
    try {
      setLoading(true);
      
      const { data: professionalProfile } = await supabase
        .from('professional_profiles')
        .select('user_id')
        .eq('id', session.professionalId)
        .single();

      if (professionalProfile) {
        const messageContent = addressRequest.trim() 
          ? `I need the address for our in-person session. ${addressRequest}`
          : 'I need the address for our in-person session.';
        
        await supabase.from('messages').insert({
          conversation_id: session.conversationId,
          sender_id: userId,
          receiver_id: professionalProfile.user_id,
          content: messageContent,
          message_type: 'text',
        });

        Alert.alert(
          'Address Requested',
          'Your request for the session address has been sent to the professional.',
          [{ text: 'OK', onPress: () => {
            setShowAddressRequest(false);
            setAddressRequest('');
            handleClose();
          }}]
        );
      }
    } catch (error: any) {
      console.error('Error requesting address:', error);
      Alert.alert('Error', 'Failed to send address request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[themeColors.background.primary, themeColors.background.secondary]}
            style={styles.gradientContainer}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={[styles.iconCircle, { backgroundColor: statusInfo.bgColor }]}>
                  <StatusIcon size={24} color={statusInfo.color} />
                </View>
                <View>
                  <Text style={styles.title}>Session Management</Text>
                  <Text style={styles.subtitle}>{statusInfo.description}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={loading}
              >
                <X size={20} color={themeColors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
              <StatusIcon size={16} color={statusInfo.color} />
              <Text style={[styles.statusBadgeText, { color: statusInfo.textColor }]}>
                {statusInfo.label}
              </Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Primary Actions */}
              <View style={styles.actionsContainer}>
                {canCancel && (
                  <TouchableOpacity
                    style={[styles.primaryActionButton, styles.cancelButton]}
                    onPress={handleCancel}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={themeColors.text.white} />
                    ) : (
                      <>
                        <XCircle size={20} color={themeColors.text.white} />
                        <Text style={styles.primaryActionText}>Cancel Session</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {canEnd && (
                  <TouchableOpacity
                    style={[styles.primaryActionButton, styles.endButton]}
                    onPress={handleEndSession}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={themeColors.text.white} />
                    ) : (
                      <>
                        <XCircle size={20} color={themeColors.text.white} />
                        <Text style={styles.primaryActionText}>End Session</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Secondary Actions */}
              <View style={styles.secondaryActionsContainer}>
                {canCancel && (
                  <TouchableOpacity
                    style={[styles.secondaryActionButton, showRescheduleInput && styles.secondaryActionButtonActive]}
                    onPress={() => {
                      setShowAddressRequest(false);
                      setAddressRequest('');
                      setShowRescheduleInput(!showRescheduleInput);
                    }}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Calendar size={20} color={themeColors.primary} />
                    <Text style={styles.secondaryActionText}>Request Reschedule</Text>
                  </TouchableOpacity>
                )}

                {canRequestAddress && (
                  <TouchableOpacity
                    style={[styles.secondaryActionButton, showAddressRequest && styles.secondaryActionButtonActive]}
                    onPress={() => {
                      setShowRescheduleInput(false);
                      setRescheduleNote('');
                      setShowAddressRequest(!showAddressRequest);
                    }}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <MapPin size={20} color={themeColors.primary} />
                    <Text style={styles.secondaryActionText}>Request Address</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Reschedule Input */}
              {showRescheduleInput && (
                <View style={styles.inputSection}>
                  <View style={styles.inputHeader}>
                    <Calendar size={16} color={themeColors.primary} />
                    <Text style={styles.inputSectionTitle}>Reschedule Request</Text>
                  </View>
                  <Text style={styles.inputLabel}>
                    Please provide a reason for rescheduling
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={rescheduleNote}
                    onChangeText={setRescheduleNote}
                    placeholder="e.g., I need to reschedule due to a conflict..."
                    placeholderTextColor={themeColors.text.tertiary}
                    multiline
                    numberOfLines={4}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleRequestReschedule}
                    disabled={loading || !rescheduleNote.trim()}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={themeColors.text.white} />
                    ) : (
                      <>
                        <Text style={styles.submitButtonText}>Send Reschedule Request</Text>
                        <Calendar size={16} color={themeColors.text.white} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Address Request Input */}
              {showAddressRequest && (
                <View style={styles.inputSection}>
                  <View style={styles.inputHeader}>
                    <MapPin size={16} color={themeColors.primary} />
                    <Text style={styles.inputSectionTitle}>Address Request</Text>
                  </View>
                  <Text style={styles.inputLabel}>
                    Add an optional message for the professional
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={addressRequest}
                    onChangeText={setAddressRequest}
                    placeholder="e.g., Please share the meeting location..."
                    placeholderTextColor={themeColors.text.tertiary}
                    multiline
                    numberOfLines={3}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleRequestAddress}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={themeColors.text.white} />
                    ) : (
                      <>
                        <Text style={styles.submitButtonText}>Request Address</Text>
                        <MapPin size={16} color={themeColors.text.white} />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    modalContainer: {
      width: width * 0.9,
      maxWidth: 500,
      borderRadius: 24,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 10,
      },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
      maxHeight: '85%',
    },
    gradientContainer: {
      borderRadius: 24,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      letterSpacing: -0.5,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 8,
      borderRadius: 20,
    },
    statusBadgeText: {
      fontSize: 14,
      fontWeight: '600',
    },
    content: {
      padding: 20,
      maxHeight: 400,
    },
    actionsContainer: {
      marginBottom: 16,
      gap: 12,
    },
    primaryActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cancelButton: {
      backgroundColor: colors.danger,
    },
    endButton: {
      backgroundColor: colors.danger,
    },
    primaryActionText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.white,
      letterSpacing: 0.3,
    },
    secondaryActionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    secondaryActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1.5,
      borderColor: colors.border.light,
    },
    secondaryActionButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    secondaryActionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    inputSection: {
      marginTop: 8,
      marginBottom: 8,
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    inputHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    inputSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    inputLabel: {
      fontSize: 13,
      color: colors.text.secondary,
      marginBottom: 12,
      fontWeight: '500',
    },
    textInput: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: colors.text.primary,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.text.white,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
  });
