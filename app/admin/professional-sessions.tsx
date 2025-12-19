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

  const mapSession = (session: any): ProfessionalSession => {
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
      
      {/* Status Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {statusFilters.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            style={[
              styles.filterButton,
              filterStatus === filter.value && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(filter.value)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === filter.value && styles.filterButtonTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
              {sessions.map((session) => {
                const StatusIcon = getStatusIcon(session.status);
                const statusColor = getStatusColor(session.status);
                
                return (
                  <View key={session.id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={styles.sessionHeaderLeft}>
                        <View style={[styles.statusIconContainer, { backgroundColor: statusColor + '20' }]}>
                          <StatusIcon size={20} color={statusColor} />
                        </View>
                        <View style={styles.sessionInfo}>
                          <Text style={styles.sessionStatus}>{session.status.replace('_', ' ').toUpperCase()}</Text>
                          <Text style={styles.sessionTime}>
                            Created: {new Date(session.createdAt).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {session.aiSummary && (
                      <View style={styles.summaryContainer}>
                        <Text style={styles.summaryLabel}>AI Summary:</Text>
                        <Text style={styles.summaryText}>{session.aiSummary}</Text>
                      </View>
                    )}

                    <View style={styles.sessionDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Session Type:</Text>
                        <Text style={styles.detailValue}>{session.sessionType.replace('_', ' ')}</Text>
                      </View>
                      {session.professionalJoinedAt && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Professional Joined:</Text>
                          <Text style={styles.detailValue}>
                            {new Date(session.professionalJoinedAt).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {session.professionalEndedAt && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Ended:</Text>
                          <Text style={styles.detailValue}>
                            {new Date(session.professionalEndedAt).toLocaleString()}
                          </Text>
                        </View>
                      )}
                      {session.endedBy && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Ended By:</Text>
                          <Text style={styles.detailValue}>{session.endedBy}</Text>
                        </View>
                      )}
                      {session.escalationLevel > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Escalation Level:</Text>
                          <Text style={styles.detailValue}>{session.escalationLevel}</Text>
                        </View>
                      )}
                      {session.aiObserverMode && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>AI Observer Mode:</Text>
                          <Text style={styles.detailValue}>Active</Text>
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
    sessionsList: {
      padding: 16,
      gap: 16,
    },
    sessionCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    sessionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    statusIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sessionInfo: {
      flex: 1,
    },
    sessionStatus: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
      textTransform: 'capitalize',
    },
    sessionTime: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    summaryContainer: {
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    summaryText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    sessionDetails: {
      gap: 8,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    detailValue: {
      fontSize: 14,
      color: colors.text.primary,
    },
  });
