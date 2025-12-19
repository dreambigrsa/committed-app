import React, { useState, useEffect } from 'react';
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
import { Heart, CheckCircle, XCircle, Calendar } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';
import colors from '@/constants/colors';
import { Relationship } from '@/types';

export default function AdminRelationshipsScreen() {
  const { currentUser } = useApp();
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const deleteRelationshipMutation = trpc.admin.deleteRelationship.useMutation();

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
      await supabase
        .from('relationships')
        .update({
          status: 'verified',
          verified_date: new Date().toISOString(),
        })
        .eq('id', relationshipId);

      Alert.alert('Success', 'Relationship verified');
      loadRelationships();
    } catch (error) {
      Alert.alert('Error', 'Failed to verify relationship');
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
              await supabase
                .from('relationships')
                .update({
                  status: 'ended',
                  end_date: new Date().toISOString(),
                })
                .eq('id', relationshipId);

              Alert.alert('Success', 'Relationship rejected');
              loadRelationships();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject relationship');
            }
          },
        },
      ]
    );
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    Alert.alert(
      'Delete Relationship',
      'Are you sure you want to permanently delete this relationship?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRelationshipMutation.mutateAsync({ relationshipId });
              Alert.alert('Success', 'Relationship deleted');
              loadRelationships();
            } catch (error: any) {
              console.error('Delete relationship error:', error);
              Alert.alert(
                'Error', 
                error?.message || 'Failed to delete relationship'
              );
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
                        style={[styles.actionButton, styles.verifyButton]}
                        onPress={() => handleVerifyRelationship(relationship.id)}
                      >
                        <CheckCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => handleRejectRelationship(relationship.id)}
                      >
                        <XCircle size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                  <TouchableOpacity
                    style={styles.deleteButtonFull}
                    onPress={() => handleDeleteRelationship(relationship.id)}
                    disabled={deleteRelationshipMutation.isPending}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
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

const styles = StyleSheet.create({
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
