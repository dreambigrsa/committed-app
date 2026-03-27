import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, Users, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalRole } from '@/types';
import { summarizeConversationForProfessional, suggestProfessionalRole } from '@/lib/ai-service';
import { findMatchingProfessionals, ProfessionalMatch } from '@/lib/professional-matching';
import { createProfessionalSession } from '@/lib/professional-sessions';

interface RequestLiveHelpModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  userId: string;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
  onSessionCreated?: () => void;
}

export default function RequestLiveHelpModal({
  visible,
  onClose,
  conversationId,
  userId,
  conversationHistory,
  onSessionCreated,
}: RequestLiveHelpModalProps) {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<ProfessionalRole | null>(null);
  const [matches, setMatches] = useState<ProfessionalMatch[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRoles();
      generateSummary();
    } else {
      // Reset state when modal closes
      setSelectedRole(null);
      setMatches([]);
      setConsentGiven(false);
      setAiSummary('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- generateSummary on visible
  }, [visible]);

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('professional_roles')
        .select('*')
        .eq('is_active', true)
        .eq('eligible_for_live_chat', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[RequestLiveHelpModal] Error loading professional roles:', error);
        throw error;
      }
      
      console.log('[RequestLiveHelpModal] Loaded roles:', data?.length || 0);
      setRoles(data || []);
    } catch (error: any) {
      console.error('[RequestLiveHelpModal] Error loading professional roles:', error);
      // Don't show alert - just log the error so modal can still be used
      setRoles([]);
    }
  };

  const generateSummary = async () => {
    setSummarizing(true);
    try {
      // Check if we have enough conversation history for a meaningful summary
      const userMessages = conversationHistory.filter((m) => m.role === 'user');
      const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|bye|goodbye)[\s!.,]*$/i;
      const meaningfulMessages = userMessages.filter(msg => {
        const content = msg.content.trim();
        return content.length > 10 && !greetingPatterns.test(content);
      });
      
      // Require at least 5 meaningful messages before generating summary
      if (meaningfulMessages.length < 5) {
        setAiSummary('Please continue the conversation so we can better understand how to help you. More context is needed to provide a meaningful summary for a professional.');
        setSummarizing(false);
        return;
      }
      
      const latestUserMessage =
        conversationHistory
          .filter((m) => m.role === 'user')
          .slice(-1)[0]?.content || '';

      const summary = await summarizeConversationForProfessional(
        conversationHistory,
        latestUserMessage
      );
      setAiSummary(summary);

      // Suggest a role based on the summary
      const suggestedRoleId = await suggestProfessionalRole(
        summary,
        conversationHistory
      );

      if (suggestedRoleId) {
        const suggestedRole = roles.find((r) => r.id === suggestedRoleId);
        if (suggestedRole) {
          setSelectedRole(suggestedRole);
          loadMatchesForRole(suggestedRole.id);
        }
      }
    } catch (error: any) {
      console.error('Error generating summary:', error);
    } finally {
      setSummarizing(false);
    }
  };

  const loadMatchesForRole = async (roleId: string) => {
    setLoading(true);
    try {
      // Get user location if available
      let location: string | undefined;
      try {
        const { data: onboardingData } = await supabase
          .from('user_onboarding_data')
          .select('location_provided')
          .eq('user_id', userId)
          .maybeSingle();
        location = onboardingData?.location_provided || undefined;
      } catch (locationError) {
        console.warn('Could not load user location:', locationError);
        // Continue without location
      }

      // First try to find online professionals
      let professionalMatches: any[] = [];
      try {
        professionalMatches = await findMatchingProfessionals(
          {
            roleId,
            location,
            requiresOnlineOnly: true,
            minRating: 0,
          },
          5
        );
      } catch (onlineError: any) {
        console.warn('Error finding online professionals:', onlineError?.message || onlineError);
        // Continue to try offline professionals
      }

      // If no online professionals found, also include offline ones (they might still accept)
      if (professionalMatches.length === 0) {
        try {
          professionalMatches = await findMatchingProfessionals(
            {
              roleId,
              location,
              requiresOnlineOnly: false,
              minRating: 0,
            },
            5
          );
      } catch (offlineError: any) {
        console.error('Error finding offline professionals:', offlineError?.message || offlineError);
        // Set empty array, will show "no professionals" message
        professionalMatches = [];
      }
      }

      setMatches(professionalMatches);
    } catch (error: any) {
      console.error('[RequestLiveHelpModal] Error loading matches:', error);
      setMatches([]);
      // Don't show alert, just show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: ProfessionalRole) => {
    setSelectedRole(role);
    loadMatchesForRole(role.id);
  };

  const handleRequestHelp = async () => {
    if (!selectedRole || matches.length === 0 || !consentGiven) {
      Alert.alert('Error', 'Please select a professional role and provide consent');
      return;
    }

    setRequesting(true);
    try {
      // Get the best match (first one)
      const bestMatch = matches[0];

      // Create session
      const result = await createProfessionalSession({
        conversationId,
        userId,
        professionalId: bestMatch.profile.id,
        roleId: selectedRole.id,
        aiSummary,
        userConsentGiven: consentGiven,
      });

      if (result.session) {
        Alert.alert(
          'Request Sent',
          `Your request has been sent to ${bestMatch.profile.fullName}. They will join the conversation shortly if available.`,
          [
            {
              text: 'OK',
              onPress: () => {
                onSessionCreated?.();
                onClose();
              },
            },
          ]
        );
      } else {
        // Show specific error message
        const errorMessage = result.error || 'Unknown error occurred';
        console.error('[RequestLiveHelpModal] Failed to create session:', errorMessage);
        Alert.alert(
          'Error',
          result.error 
            ? `Failed to send request: ${errorMessage}. Please try again.`
            : 'Failed to send request. Please try again.'
        );
      }
    } catch (error: any) {
      console.error('[RequestLiveHelpModal] Error requesting help:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      Alert.alert('Error', `Failed to send request: ${errorMessage}. Please try again.`);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Request Live Professional Help</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* AI Summary */}
            {summarizing ? (
              <View style={styles.summaryContainer}>
                <ActivityIndicator size="small" color={themeColors.primary} />
                <Text style={styles.summaryLabel}>Summarizing your conversation...</Text>
              </View>
            ) : aiSummary ? (
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryLabel}>Summary for Professional:</Text>
                    <Text style={styles.summaryText}>{String(aiSummary || '')}</Text>
              </View>
            ) : null}

            {/* Role Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Professional Type</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.rolesList}
                nestedScrollEnabled={true}
              >
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.roleCard,
                      selectedRole?.id === role.id && styles.roleCardSelected,
                    ]}
                    onPress={() => handleRoleSelect(role)}
                  >
                    <Text
                      style={[
                        styles.roleName,
                        selectedRole?.id === role.id && styles.roleNameSelected,
                      ]}
                    >
                      {String(role.name || '')}
                    </Text>
                    <Text style={styles.roleCategory}>{String(role.category || '')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Available Professionals */}
            {selectedRole && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available Professionals</Text>
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={themeColors.primary} />
                    <Text style={styles.loadingText}>Finding available professionals...</Text>
                  </View>
                ) : matches.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Users size={32} color={themeColors.text.tertiary} />
                    <Text style={styles.emptyText}>
                      No professionals available at the moment. Please try again later.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.matchesList}>
                    {matches.slice(0, 3).map((match, index) => (
                      <View key={String(match.profile.id || index)} style={styles.matchCard}>
                        <View style={styles.matchHeader}>
                          <View style={styles.matchInfo}>
                            <Text style={styles.matchName}>{String(match.profile.fullName || '')}</Text>
                            <Text style={styles.matchRole}>{String(match.role?.name || '')}</Text>
                          </View>
                          <View style={styles.matchBadge}>
                            <Text style={styles.matchBadgeText}>
                              {index === 0 ? 'Best Match' : `Match ${String(index + 1)}`}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.matchReasons}>
                          {(match.matchReasons || []).slice(0, 3).map((reason, i) => (
                            <View key={String(i)} style={styles.reasonTag}>
                              <CheckCircle2 size={12} color={themeColors.success} />
                              <Text style={styles.reasonText}>{String(reason || '')}</Text>
                            </View>
                          ))}
                        </View>
                        {(match.profile.ratingAverage && typeof match.profile.ratingAverage === 'number' && match.profile.ratingAverage > 0) && (
                          <Text style={styles.matchRating}>
                            ⭐ {String(Number(match.profile.ratingAverage).toFixed(1))} ({String(match.profile.reviewCount || 0)} reviews)
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Consent */}
            <View style={styles.section}>
              <View style={styles.consentContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setConsentGiven(!consentGiven)}
                >
                  {consentGiven && (
                    <CheckCircle2 size={20} color={themeColors.primary} />
                  )}
                </TouchableOpacity>
                <Text style={styles.consentText}>
                  I understand that a professional will join this conversation and may access the
                  conversation history. I consent to this service.
                </Text>
              </View>
              {selectedRole?.disclaimerText && (
                <View style={styles.disclaimerContainer}>
                  <AlertCircle size={16} color={themeColors.accent} />
                  <Text style={styles.disclaimerText}>{String(selectedRole.disclaimerText || '')}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.requestButton,
                (!selectedRole || matches.length === 0 || !consentGiven || requesting) &&
                  styles.requestButtonDisabled,
              ]}
              onPress={handleRequestHelp}
              disabled={!selectedRole || matches.length === 0 || !consentGiven || requesting}
            >
              {requesting ? (
                <ActivityIndicator color={themeColors.text.white} />
              ) : (
                <Text style={styles.requestButtonText}>Send Request</Text>
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
    modal: {
      backgroundColor: colors.background.primary,
      borderRadius: 20,
      maxHeight: '85%',
      width: '90%',
      maxWidth: 500,
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
      padding: 20,
      maxHeight: 450,
    },
    summaryContainer: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      gap: 8,
    },
    summaryLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    summaryText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 12,
    },
    rolesList: {
      marginHorizontal: -20,
      paddingHorizontal: 20,
    },
    roleCard: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      marginRight: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      minWidth: 120,
    },
    roleCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    roleName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    roleNameSelected: {
      color: colors.primary,
    },
    roleCategory: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 20,
      gap: 12,
    },
    loadingText: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    emptyContainer: {
      alignItems: 'center',
      padding: 32,
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    matchesList: {
      gap: 12,
    },
    matchCard: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    matchHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    matchInfo: {
      flex: 1,
    },
    matchName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    matchRole: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    matchBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    matchBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.white,
    },
    matchReasons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 8,
    },
    reasonTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.background.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    reasonText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    matchRating: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 4,
    },
    consentContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border.medium,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    consentText: {
      flex: 1,
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    disclaimerContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.accent + '20',
      padding: 12,
      borderRadius: 8,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      color: colors.text.secondary,
      lineHeight: 18,
    },
    footer: {
      padding: 20,
      paddingTop: 0,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    requestButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    requestButtonDisabled: {
      opacity: 0.5,
    },
    requestButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

