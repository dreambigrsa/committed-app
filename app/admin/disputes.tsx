import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Shield, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Dispute } from '@/types';

export default function AdminDisputesScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedDisputes: Dispute[] = data.map((d: any) => ({
          id: d.id,
          relationshipId: d.relationship_id,
          initiatedBy: d.initiated_by,
          disputeType: d.dispute_type,
          description: d.description,
          status: d.status,
          resolution: d.resolution,
          autoResolveAt: d.auto_resolve_at,
          resolvedAt: d.resolved_at,
          resolvedBy: d.resolved_by,
          createdAt: d.created_at,
        }));
        setDisputes(formattedDisputes);
      }
    } catch (error: any) {
      console.error('Failed to load disputes:', error);
      // Extract proper error message
      const errorMessage = error?.message || error?.toString() || 'Failed to load disputes';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (disputeId: string, resolution: string) => {
    try {
      const dispute = disputes.find((item) => item.id === disputeId);
      if (!dispute) throw new Error('Dispute not found');

      if (dispute.disputeType === 'end_relationship' && resolution === 'confirmed_by_admin') {
        const endDate = new Date().toISOString();
        const { data: relationship, error: relationshipError } = await supabase
          .from('relationships')
          .select('id,user_id,partner_user_id')
          .eq('id', dispute.relationshipId)
          .maybeSingle();

        if (relationshipError) throw relationshipError;
        if (!relationship) throw new Error('Relationship not found');

        const relationshipIds = [relationship.id];
        if (relationship.user_id && relationship.partner_user_id) {
          const { data: reciprocalRows, error: reciprocalError } = await supabase
            .from('relationships')
            .select('id')
            .eq('user_id', relationship.partner_user_id)
            .eq('partner_user_id', relationship.user_id)
            .in('status', ['pending', 'verified']);

          if (reciprocalError) throw reciprocalError;
          reciprocalRows?.forEach((row: any) => {
            if (row.id && !relationshipIds.includes(row.id)) relationshipIds.push(row.id);
          });
        }

        const { data: endedRows, error: endError } = await supabase
          .from('relationships')
          .update({
            status: 'ended',
            end_date: endDate,
          })
          .in('id', relationshipIds)
          .select('id,status,end_date');

        if (endError) throw endError;
        if (!endedRows || endedRows.length === 0) {
          throw new Error('No relationship rows were ended. Relationship update permission may be missing.');
        }
      }

      const finalResolution = resolution === 'confirmed_by_admin'
        ? 'confirmed_by_admin'
        : resolution === 'rejected_by_admin'
          ? 'rejected_by_admin'
          : resolution;

      const { data, error } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: finalResolution,
          resolved_by: currentUser?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId)
        .eq('status', 'pending')
        .select('id,status,resolution')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Dispute was not updated. It may already be resolved.');

      Alert.alert('Success', dispute.disputeType === 'end_relationship' && resolution === 'confirmed_by_admin'
        ? 'Relationship ended and dispute resolved'
        : 'Dispute resolved');
      loadDisputes();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to resolve dispute');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Disputes', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Disputes', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Failed to load disputes</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {disputes.filter(d => d.status === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {disputes.filter(d => d.status === 'resolved').length}
              </Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {disputes.filter(d => d.status === 'auto_resolved').length}
              </Text>
              <Text style={styles.statLabel}>Auto-Resolved</Text>
            </View>
          </View>

          <View style={styles.disputesList}>
            {disputes.map((dispute) => (
              <View key={dispute.id} style={styles.disputeCard}>
                <View style={styles.disputeHeader}>
                  <Shield size={24} color={colors.primary} />
                  <View style={[
                    styles.statusBadge,
                    dispute.status === 'pending' ? styles.pendingBadge :
                    dispute.status === 'resolved' ? styles.resolvedBadge :
                    styles.autoResolvedBadge
                  ]}>
                    <Text style={styles.statusText}>{dispute.status.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.disputeContent}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Type:</Text>
                    <Text style={styles.metaValue}>{dispute.disputeType.replace('_', ' ')}</Text>
                  </View>
                  {dispute.description && (
                    <View style={styles.descriptionBox}>
                      <Text style={styles.descriptionText}>{dispute.description}</Text>
                    </View>
                  )}
                  <View style={styles.dateRow}>
                    <Clock size={14} color={colors.text.tertiary} />
                    <Text style={styles.dateText}>
                      Created: {new Date(dispute.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  {dispute.autoResolveAt && dispute.status === 'pending' && (
                    <View style={styles.dateRow}>
                      <Clock size={14} color={colors.accent} />
                      <Text style={styles.autoResolveText}>
                        Auto-resolve: {new Date(dispute.autoResolveAt).toLocaleString()}
                      </Text>
                    </View>
                  )}
                  {dispute.resolution && (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.resolutionLabel}>Resolution:</Text>
                      <Text style={styles.resolutionText}>{dispute.resolution}</Text>
                    </View>
                  )}
                </View>

                {dispute.status === 'pending' && (
                  <View style={styles.disputeActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleResolveDispute(
                        dispute.id,
                        dispute.disputeType === 'end_relationship' ? 'confirmed_by_admin' : 'Approved by admin'
                      )}
                    >
                      <CheckCircle size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>
                        {dispute.disputeType === 'end_relationship' ? 'End' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleResolveDispute(
                        dispute.id,
                        dispute.disputeType === 'end_relationship' ? 'rejected_by_admin' : 'Rejected by admin'
                      )}
                    >
                      <XCircle size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>
                        {dispute.disputeType === 'end_relationship' ? 'Keep Active' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {disputes.length === 0 && (
              <View style={styles.emptyState}>
                <Shield size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No disputes yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  disputesList: {
    padding: 16,
    gap: 16,
  },
  disputeCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pendingBadge: {
    backgroundColor: colors.accent,
  },
  resolvedBadge: {
    backgroundColor: colors.secondary,
  },
  autoResolvedBadge: {
    backgroundColor: colors.text.tertiary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  disputeContent: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontWeight: '600' as const,
  },
  metaValue: {
    fontSize: 14,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  descriptionBox: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  autoResolveText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600' as const,
  },
  resolutionBox: {
    backgroundColor: colors.secondary + '20',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.secondary,
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  disputeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: colors.secondary,
  },
  rejectButton: {
    backgroundColor: colors.danger,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
});
