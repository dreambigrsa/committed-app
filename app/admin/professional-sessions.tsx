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
} from 'react-native';
import { Stack } from 'expo-router';
import { Clock, Users, CheckCircle2, XCircle, AlertCircle, Filter } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalSession } from '@/types';

type SessionStatus = 'all' | 'pending_acceptance' | 'active' | 'ended' | 'declined';

export default function AdminProfessionalSessionsScreen() {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<ProfessionalSession[]>([]);
  const [filterStatus, setFilterStatus] = useState<SessionStatus>('all');

  useEffect(() => {
    loadSessions();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('admin-professional-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'professional_sessions',
        },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterStatus]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('professional_sessions')
        .select(`
          *,
          user:users!professional_sessions_user_id_fkey(id, full_name, profile_picture),
          professional:professional_profiles!professional_sessions_professional_id_fkey(id, full_name),
          role:professional_roles(name, category)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions((data || []).map(mapSession));
    } catch (error: any) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load professional sessions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const mapSession = (session: any): ProfessionalSession & { user?: any; professional?: any; role?: any } => {
    return {
      id: session.id,
      conversationId: session.conversation_id,
      userId: session.user_id,
      professionalId: session.professional_id,
      roleId: session.role_id,
      sessionType: session.session_type,
      status: session.status,
      aiSummary: session.ai_summary,
      userConsentGiven: session.user_consent_given || false,
      consentGivenAt: session.consent_given_at,
      professionalJoinedAt: session.professional_joined_at,
      professionalEndedAt: session.professional_ended_at,
      escalationLevel: session.escalation_level || 0,
      escalationReason: session.escalation_reason,
      aiObserverMode: session.ai_observer_mode || false,
      endedBy: session.ended_by,
      endedReason: session.ended_reason,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      user: session.user,
      professional: session.professional,
      role: session.role,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return themeColors.secondary;
      case 'pending_acceptance':
        return themeColors.accent;
      case 'ended':
        return themeColors.text.tertiary;
      case 'declined':
        return themeColors.danger;
      default:
        return themeColors.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return CheckCircle2;
      case 'pending_acceptance':
        return Clock;
      case 'ended':
        return CheckCircle2;
      case 'declined':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  const statusFilters: { label: string; value: SessionStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending_acceptance' },
    { label: 'Active', value: 'active' },
    { label: 'Ended', value: 'ended' },
    { label: 'Declined', value: 'declined' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Professional Sessions' }} />
      
      {/* Status Filters - Segmented Control */}
      <View style={styles.filtersContainer}>
        <View style={styles.segmentedControl}>
          {statusFilters.map((filter, index) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.segmentedButton,
                filterStatus === filter.value && styles.segmentedButtonActive,
                index === 0 && styles.segmentedButtonFirst,
                index === statusFilters.length - 1 && styles.segmentedButtonLast,
              ]}
              onPress={() => setFilterStatus(filter.value)}
            >
              <Text
                style={[
                  styles.segmentedButtonText,
                  filterStatus === filter.value && styles.segmentedButtonTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading sessions...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadSessions();
              }}
              colors={[themeColors.primary]}
            />
          }
        >
          {sessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={64} color={themeColors.text.tertiary} />
              <Text style={styles.emptyTitle}>No Sessions Found</Text>
              <Text style={styles.emptyText}>
                {filterStatus === 'all'
                  ? 'No professional sessions have been created yet.'
                  : `No sessions with status "${statusFilters.find((f) => f.value === filterStatus)?.label}".`}
              </Text>
            </View>
          ) : (
            <View style={styles.sessionsList}>
              {sessions.map((session: any) => {
                const StatusIcon = getStatusIcon(session.status);
                const statusColor = getStatusColor(session.status);
                const sessionWithExtras = session as ProfessionalSession & { user?: any; professional?: any; role?: any };
                
                return (
                  <View key={session.id} style={styles.sessionCard}>
                    {/* Header with Status */}
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionHeaderLeft}>
                        <View style={[styles.statusIconContainer, { backgroundColor: statusColor + '20' }]}>
                          <StatusIcon size={24} color={statusColor} />
                        </View>
                        <View style={styles.sessionInfo}>
                          <View style={styles.sessionStatusRow}>
                            <Text style={styles.sessionStatus}>
                              {session.status.replace('_', ' ').toUpperCase()}
                            </Text>
                            {sessionWithExtras.role && (
                              <View style={styles.roleBadge}>
                                <Text style={styles.roleBadgeText}>{sessionWithExtras.role.name}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.sessionTime}>
                            {new Date(session.createdAt).toLocaleDateString()} at {new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* User and Professional Info */}
                    <View style={styles.participantsContainer}>
                      {sessionWithExtras.user && (
                        <View style={styles.participantItem}>
                          <Text style={styles.participantLabel}>User:</Text>
                          <Text style={styles.participantName}>{sessionWithExtras.user.full_name || 'Unknown'}</Text>
                        </View>
                      )}
                      {sessionWithExtras.professional && (
                        <View style={styles.participantItem}>
                          <Text style={styles.participantLabel}>Professional:</Text>
                          <Text style={styles.participantName}>{sessionWithExtras.professional.full_name || 'Unknown'}</Text>
                        </View>
                      )}
                    </View>

                    {/* AI Summary */}
                    {session.aiSummary && (
                      <View style={styles.summaryContainer}>
                        <Text style={styles.summaryLabel}>AI Summary</Text>
                        <Text style={styles.summaryText}>{session.aiSummary}</Text>
                      </View>
                    )}

                    {/* Session Details Grid */}
                    <View style={styles.sessionDetails}>
                      <View style={styles.detailGrid}>
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Session Type</Text>
                          <Text style={styles.detailValue}>{session.sessionType.replace('_', ' ')}</Text>
                        </View>
                        {session.professionalJoinedAt && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Started</Text>
                            <Text style={styles.detailValue}>
                              {new Date(session.professionalJoinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        )}
                        {session.professionalEndedAt && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Ended</Text>
                            <Text style={styles.detailValue}>
                              {new Date(session.professionalEndedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        )}
                        {session.escalationLevel > 0 && (
                          <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Escalation</Text>
                            <Text style={styles.detailValue}>Level {session.escalationLevel}</Text>
                          </View>
                        )}
                      </View>
                      
                      {session.endedBy && (
                        <View style={styles.endedByContainer}>
                          <Text style={styles.endedByLabel}>Ended by: {session.endedBy}</Text>
                          {session.endedReason && (
                            <Text style={styles.endedByReason}>{session.endedReason}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
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
      padding: 16,
      backgroundColor: colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      padding: 4,
      gap: 0,
    },
    segmentedButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    segmentedButtonActive: {
      backgroundColor: colors.primary,
    },
    segmentedButtonFirst: {
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
    },
    segmentedButtonLast: {
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
    },
    segmentedButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    segmentedButtonTextActive: {
      color: colors.text.white,
      fontWeight: '700',
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
    sessionsList: {
      padding: 16,
      gap: 16,
    },
    sessionCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    sessionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    statusIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sessionInfo: {
      flex: 1,
    },
    sessionStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
      flexWrap: 'wrap',
    },
    sessionStatus: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      textTransform: 'capitalize',
    },
    roleBadge: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    roleBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    sessionTime: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    participantsContainer: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    participantItem: {
      flex: 1,
    },
    participantLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    participantName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    summaryContainer: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text.secondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    summaryText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 22,
      fontWeight: '400',
    },
    sessionDetails: {
      gap: 12,
    },
    detailGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    detailItem: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailValue: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
    },
    endedByContainer: {
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    endedByLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    endedByReason: {
      fontSize: 13,
      color: colors.text.secondary,
      fontStyle: 'italic',
    },
  });
