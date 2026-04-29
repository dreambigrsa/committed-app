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
import { Heart, CheckCircle, XCircle, Calendar, AlertTriangle } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Relationship } from '@/types';

export default function AdminRelationshipsScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [relationshipActionId, setRelationshipActionId] = useState<string | null>(null);

  useEffect(() => {
    loadRelationships();
  }, []);

  const loadRelationships = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('relationships')
        .select(`
          *,
          users!relationships_user_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Relationships query error:', error);
        throw error;
      }

      if (data) {
        const formattedRelationships: Relationship[] = data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          partnerName: r.partner_name || 'Unknown',
          partnerPhone: r.partner_phone || '',
          partnerUserId: r.partner_user_id || undefined,
          type: r.type,
          status: r.status,
          startDate: r.start_date || new Date().toISOString(),
          verifiedDate: r.verified_date || undefined,
          endDate: r.end_date || undefined,
          privacyLevel: r.privacy_level || 'public',
          partnerFacePhoto: r.partner_face_photo,
          partnerDateOfBirthMonth: r.partner_date_of_birth_month,
          partnerDateOfBirthYear: r.partner_date_of_birth_year,
          partnerCity: r.partner_city,
        }));
        setRelationships(formattedRelationships);
      }
    } catch (error: any) {
      console.error('Failed to load relationships:', error);
      Alert.alert('Error', error?.message || 'Failed to load relationships');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRelationship = async (relationshipId: string) => {
    try {
      setRelationshipActionId(relationshipId);
      const verifiedDate = new Date().toISOString();
      const { data, error } = await supabase
        .from('relationships')
        .update({
          status: 'verified',
          verified_date: verifiedDate,
        })
        .eq('id', relationshipId)
        .select('id,status,verified_date')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Relationship was not updated. Admin relationship update permission is missing in Supabase RLS.');
      }

      setRelationships(prev => prev.map(relationship => (
        relationship.id === relationshipId
          ? { ...relationship, status: 'verified', verifiedDate: data.verified_date || verifiedDate }
          : relationship
      )));
      Alert.alert('Success', 'Relationship verified');
      void loadRelationships();
    } catch (error: any) {
      console.error('Verify relationship error:', error);
      Alert.alert('Error', error?.message || 'Failed to verify relationship');
    } finally {
      setRelationshipActionId(null);
    }
  };

  const handleRejectRelationship = async (relationshipId: string) => {
    Alert.alert(
      'Reject Relationship',
      'Are you sure you want to reject this relationship?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setRelationshipActionId(relationshipId);
              const endDate = new Date().toISOString();
              const { data, error } = await supabase
                .from('relationships')
                .update({
                  status: 'ended',
                  end_date: endDate,
                })
                .eq('id', relationshipId)
                .select('id,status,end_date')
                .maybeSingle();

              if (error) throw error;
              if (!data) {
                throw new Error('Relationship was not updated. Admin relationship update permission is missing in Supabase RLS.');
              }

              setRelationships(prev => prev.map(relationship => (
                relationship.id === relationshipId
                  ? { ...relationship, status: 'ended', endDate: data.end_date || endDate }
                  : relationship
              )));
              Alert.alert('Success', 'Relationship rejected');
              void loadRelationships();
            } catch (error: any) {
              console.error('Reject relationship error:', error);
              Alert.alert('Error', error?.message || 'Failed to reject relationship');
            } finally {
              setRelationshipActionId(null);
            }
          },
        },
      ]
    );
  };

  const handleEndRelationship = async (relationshipId: string) => {
    Alert.alert(
      'Request Relationship End',
      'This does not end the relationship immediately. It notifies both partners, lets either partner confirm or reject, and auto-ends only if no one rejects within 7 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          style: 'destructive',
          onPress: async () => {
            try {
              setRelationshipActionId(relationshipId);
              // Fetch relationship to get partner IDs
              const { data: relationship, error: relError } = await supabase
                .from('relationships')
                .select('user_id, partner_user_id')
                .eq('id', relationshipId)
                .single();

              if (relError || !relationship) {
                throw new Error('Relationship not found');
              }

              const { data: existingDispute, error: existingDisputeError } = await supabase
                .from('disputes')
                .select('id,auto_resolve_at')
                .eq('relationship_id', relationshipId)
                .eq('dispute_type', 'end_relationship')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (existingDisputeError) throw existingDisputeError;
              if (existingDispute) {
                Alert.alert(
                  'Already Pending',
                  `An end request already exists for this relationship. It will auto-resolve on ${new Date(existingDispute.auto_resolve_at).toLocaleString()}.`
                );
                return;
              }

              // Create dispute for ending relationship
              const autoResolveDate = new Date();
              autoResolveDate.setDate(autoResolveDate.getDate() + 7);

              const { data: dispute, error: disputeError } = await supabase
                .from('disputes')
                .insert({
                  relationship_id: relationshipId,
                  initiated_by: currentUser!.id,
                  dispute_type: 'end_relationship',
                  description: 'Admin requested relationship end review',
                  status: 'pending',
                  auto_resolve_at: autoResolveDate.toISOString(),
                })
                .select('id,relationship_id,status,auto_resolve_at')
                .single();

              if (disputeError) throw disputeError;

              // Notify both partners
              const partnerIds = [relationship.user_id, relationship.partner_user_id].filter(Boolean);
              let notificationErrors = 0;

              for (const partnerId of partnerIds) {
                try {
                  await supabase.from('notifications').insert({
                    user_id: partnerId,
                    type: 'relationship_end_request',
                    title: 'Relationship End Review',
                    message: 'An administrator opened a relationship end review. Confirm to end it, or reject to keep it active. If no one rejects within 7 days, it will auto-end.',
                    data: { relationshipId, disputeId: dispute.id, adminInitiated: true },
                  });
                } catch (notifError) {
                  console.error('Failed to notify partner:', notifError);
                  notificationErrors++;
                }
              }

              if (notificationErrors > 0) {
                Alert.alert(
                  'Request Created',
                  'End review created, but some notifications may have failed. Partners can still see the request in Notifications.',
                  [{ text: 'OK', onPress: () => loadRelationships() }]
                );
              } else {
                Alert.alert(
                  'Success',
                  'End review created. Both partners can confirm or reject it in Notifications.',
                  [{ text: 'OK', onPress: () => loadRelationships() }]
                );
              }
            } catch (error: any) {
              console.error('End relationship error:', error);
              Alert.alert('Error', error?.message || 'Failed to end relationship');
            } finally {
              setRelationshipActionId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    Alert.alert(
      'Delete Relationship',
      'Are you sure you want to permanently delete this relationship? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setRelationshipActionId(relationshipId);
              const { data, error } = await supabase
                .from('relationships')
                .delete()
                .eq('id', relationshipId)
                .select('id')
                .maybeSingle();

              if (error) throw error;
              if (!data) {
                throw new Error('Relationship was not deleted. Admin relationship delete permission is missing in Supabase RLS.');
              }

              setRelationships(prev => prev.filter(relationship => relationship.id !== relationshipId));
              Alert.alert('Success', 'Relationship deleted');
              void loadRelationships();
            } catch (error: any) {
              console.error('Delete relationship error:', error);
              Alert.alert(
                'Error', 
                error?.message || 'Failed to delete relationship'
              );
            } finally {
              setRelationshipActionId(null);
            }
          },
        },
      ]
    );
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Relationships', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Relationships', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{relationships.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {relationships.filter(r => r.status === 'verified').length}
              </Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {relationships.filter(r => r.status === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          <View style={styles.relationshipsList}>
            {relationships.map((relationship) => (
              <View key={relationship.id} style={styles.relationshipCard}>
                {(() => {
                  const isWorking = relationshipActionId === relationship.id;
                  return (
                    <>
                <View style={styles.cardHeader}>
                  <Heart size={24} color={colors.primary} fill={colors.primary} />
                  <View style={[
                    styles.statusBadge,
                    relationship.status === 'verified' ? styles.verifiedBadge : styles.pendingBadge
                  ]}>
                    <Text style={styles.statusText}>
                      {relationship.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.partnerName}>{relationship.partnerName}</Text>
                  <Text style={styles.partnerPhone}>{relationship.partnerPhone}</Text>
                  
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Type:</Text>
                      <Text style={styles.metaValue}>{relationship.type}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Privacy:</Text>
                      <Text style={styles.metaValue}>{relationship.privacyLevel}</Text>
                    </View>
                  </View>

                  <View style={styles.dateRow}>
                    <Calendar size={14} color={colors.text.tertiary} />
                    <Text style={styles.dateText}>
                      Started: {new Date(relationship.startDate).toLocaleDateString()}
                    </Text>
                  </View>

                  {relationship.verifiedDate && (
                    <View style={styles.dateRow}>
                      <CheckCircle size={14} color={colors.secondary} />
                      <Text style={styles.dateText}>
                        Verified: {new Date(relationship.verifiedDate).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardActions}>
                  {relationship.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.verifyButton, isWorking && styles.disabledButton]}
                        onPress={() => handleVerifyRelationship(relationship.id)}
                        disabled={isWorking}
                      >
                        {isWorking ? (
                          <ActivityIndicator size="small" color={colors.text.white} />
                        ) : (
                          <CheckCircle size={16} color={colors.text.white} />
                        )}
                        <Text style={styles.actionButtonText}>Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton, isWorking && styles.disabledButton]}
                        onPress={() => handleRejectRelationship(relationship.id)}
                        disabled={isWorking}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                  <View style={styles.adminActions}>
                    {relationship.status === 'verified' && (
                      <TouchableOpacity
                        style={[styles.adminButton, styles.endButton, isWorking && styles.disabledButton]}
                        onPress={() => handleEndRelationship(relationship.id)}
                        disabled={isWorking}
                      >
                        <AlertTriangle size={16} color={colors.text.white} />
                        <Text style={styles.adminButtonText}>Request End Review</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.adminButton, styles.deleteButton, isWorking && styles.disabledButton]}
                      onPress={() => handleDeleteRelationship(relationship.id)}
                      disabled={isWorking}
                    >
                      <XCircle size={16} color={colors.text.white} />
                      <Text style={styles.adminButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
                    </>
                  );
                })()}
              </View>
            ))}

            {relationships.length === 0 && (
              <View style={styles.emptyState}>
                <Heart size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No relationships yet</Text>
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
  },
  errorText: {
    fontSize: 18,
    color: colors.text.primary,
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
  relationshipsList: {
    padding: 16,
    gap: 16,
  },
  relationshipCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
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
  verifiedBadge: {
    backgroundColor: colors.secondary,
  },
  pendingBadge: {
    backgroundColor: colors.accent,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  cardContent: {
    marginBottom: 16,
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  partnerPhone: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    gap: 4,
  },
  metaLabel: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    textTransform: 'capitalize',
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
  cardActions: {
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
  verifyButton: {
    backgroundColor: colors.secondary,
  },
  rejectButton: {
    backgroundColor: colors.danger,
  },
  deleteButton: {
    backgroundColor: '#8B0000',
  },
  deleteButtonFull: {
    width: '100%',
    backgroundColor: '#8B0000',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  adminActions: {
    marginTop: 8,
    gap: 8,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
  },
  endButton: {
    backgroundColor: colors.danger,
  },
  adminButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  disabledButton: {
    opacity: 0.65,
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
