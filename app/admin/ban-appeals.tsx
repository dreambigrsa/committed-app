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
  TextInput,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { AlertCircle, CheckCircle, XCircle, Clock, MessageSquare, User, Shield } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { BanAppeal } from '@/types';

type AppealStatus = 'all' | 'pending' | 'approved' | 'rejected' | 'under_review';

export default function AdminBanAppealsScreen() {
  const { currentUser } = useApp();
  const [appeals, setAppeals] = useState<BanAppeal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<AppealStatus>('all');
  const [selectedAppeal, setSelectedAppeal] = useState<BanAppeal | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAppeals();
  }, [filter]);

  const loadAppeals = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('ban_appeals')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const formattedAppeals: BanAppeal[] = data.map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          restrictionId: a.restriction_id || undefined,
          appealType: a.appeal_type,
          restrictedFeature: a.restricted_feature || undefined,
          reason: a.reason,
          status: a.status,
          reviewedBy: a.reviewed_by || undefined,
          reviewedAt: a.reviewed_at || undefined,
          adminResponse: a.admin_response || undefined,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        }));
        setAppeals(formattedAppeals);
      }
    } catch (error: any) {
      console.error('Failed to load appeals:', error);
      Alert.alert('Error', error?.message || 'Failed to load ban appeals');
    } finally {
      setLoading(false);
    }
  };

  const handleAppealAction = async (appealId: string, action: 'approve' | 'reject', response?: string) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('ban_appeals')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_by: currentUser?.id,
          reviewed_at: new Date().toISOString(),
          admin_response: response || undefined,
        })
        .eq('id', appealId);

      if (error) throw error;

      // If approved, remove the restriction
      if (action === 'approve') {
        const appeal = appeals.find(a => a.id === appealId);
        if (appeal?.restrictionId) {
          // Deactivate the restriction
          await supabase
            .from('user_restrictions')
            .update({ is_active: false })
            .eq('id', appeal.restrictionId);
        } else if (appeal?.appealType === 'full_ban') {
          // Remove full ban
          await supabase
            .from('users')
            .update({
              banned_at: null,
              banned_by: null,
              ban_reason: null,
            })
            .eq('id', appeal.userId);
          
          // Also remove any "all" restrictions
          await supabase
            .from('user_restrictions')
            .update({ is_active: false })
            .eq('user_id', appeal.userId)
            .eq('restricted_feature', 'all');
        } else if (appeal?.restrictedFeature) {
          // Remove feature-specific restriction
          await supabase
            .from('user_restrictions')
            .update({ is_active: false })
            .eq('user_id', appeal.userId)
            .eq('restricted_feature', appeal.restrictedFeature)
            .eq('is_active', true);
        }
      }

      Alert.alert('Success', `Appeal ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowResponseModal(false);
      setAdminResponse('');
      setSelectedAppeal(null);
      setActionType(null);
      loadAppeals();
    } catch (error: any) {
      console.error('Failed to process appeal:', error);
      Alert.alert('Error', error?.message || 'Failed to process appeal');
    } finally {
      setProcessing(false);
    }
  };

  const openResponseModal = (appeal: BanAppeal, action: 'approve' | 'reject') => {
    setSelectedAppeal(appeal);
    setActionType(action);
    setAdminResponse(appeal.adminResponse || '');
    setShowResponseModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={20} color={colors.secondary} />;
      case 'rejected':
        return <XCircle size={20} color={colors.danger} />;
      case 'under_review':
        return <Clock size={20} color={colors.accent} />;
      default:
        return <AlertCircle size={20} color={colors.accent} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.secondary;
      case 'rejected':
        return colors.danger;
      case 'under_review':
        return colors.accent;
      default:
        return colors.accent;
    }
  };

  const getFeatureDisplayName = (feature?: string) => {
    if (!feature || feature === 'all') return 'All Features';
    return feature === 'posts' ? 'Posts' :
           feature === 'comments' ? 'Comments' :
           feature === 'messages' ? 'Messages' :
           feature === 'reels' ? 'Reels' :
           feature === 'reel_comments' ? 'Reel Comments' : feature;
  };

  const filteredAppeals = filter === 'all' 
    ? appeals 
    : appeals.filter(a => a.status === filter);

  const stats = {
    pending: appeals.filter(a => a.status === 'pending').length,
    approved: appeals.filter(a => a.status === 'approved').length,
    rejected: appeals.filter(a => a.status === 'rejected').length,
    under_review: appeals.filter(a => a.status === 'under_review').length,
    total: appeals.length,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Ban Appeals', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Ban Appeals', headerShown: true }} />
      
      <View style={styles.filterContainer}>
        {(['all', 'pending', 'approved', 'rejected', 'under_review'] as AppealStatus[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.accent }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.secondary }]}>{stats.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.danger }]}>{stats.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {filteredAppeals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Shield size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No appeals found</Text>
          </View>
        ) : (
          <View style={styles.appealsList}>
            {filteredAppeals.map((appeal) => (
              <View key={appeal.id} style={styles.appealCard}>
                <View style={styles.appealHeader}>
                  <View style={styles.appealHeaderLeft}>
                    {getStatusIcon(appeal.status)}
                    <View style={styles.appealInfo}>
                      <Text style={styles.appealType}>
                        {appeal.appealType === 'full_ban' ? 'Full Ban Appeal' : 'Feature Restriction Appeal'}
                      </Text>
                      <Text style={styles.appealFeature}>
                        {appeal.appealType === 'full_ban' 
                          ? 'All Features' 
                          : getFeatureDisplayName(appeal.restrictedFeature)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appeal.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(appeal.status) }]}>
                      {appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1).replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.appealBody}>
                  <View style={styles.userInfoRow}>
                    <User size={16} color={colors.text.secondary} />
                    <Text style={styles.userInfoText}>User ID: {appeal.userId.substring(0, 8)}...</Text>
                  </View>

                  <View style={styles.reasonSection}>
                    <Text style={styles.sectionTitle}>Appeal Reason:</Text>
                    <Text style={styles.reasonText}>{appeal.reason}</Text>
                  </View>

                  {appeal.adminResponse && (
                    <View style={styles.responseSection}>
                      <Text style={styles.sectionTitle}>Admin Response:</Text>
                      <Text style={styles.responseText}>{appeal.adminResponse}</Text>
                      {appeal.reviewedAt && (
                        <Text style={styles.reviewedText}>
                          Reviewed on {new Date(appeal.reviewedAt).toLocaleDateString()}
                        </Text>
                      )}
                    </View>
                  )}

                  <Text style={styles.dateText}>
                    Submitted: {new Date(appeal.createdAt).toLocaleString()}
                  </Text>
                </View>

                {appeal.status === 'pending' && (
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => openResponseModal(appeal, 'approve')}
                    >
                      <CheckCircle size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => openResponseModal(appeal, 'reject')}
                    >
                      <XCircle size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !processing && setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === 'approve' ? 'Approve Appeal' : 'Reject Appeal'}
            </Text>
            <Text style={styles.modalDescription}>
              {actionType === 'approve' 
                ? 'The user\'s restriction will be removed if you approve this appeal.'
                : 'Please provide a reason for rejecting this appeal.'}
            </Text>

            <TextInput
              style={styles.responseInput}
              placeholder="Enter admin response (optional)"
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              value={adminResponse}
              onChangeText={setAdminResponse}
              editable={!processing}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  if (!processing) {
                    setShowResponseModal(false);
                    setAdminResponse('');
                    setSelectedAppeal(null);
                    setActionType(null);
                  }
                }}
                disabled={processing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  actionType === 'approve' ? styles.confirmApproveButton : styles.confirmRejectButton,
                  processing && styles.modalButtonDisabled,
                ]}
                onPress={() => selectedAppeal && actionType && handleAppealAction(selectedAppeal.id, actionType, adminResponse.trim() || undefined)}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color={colors.text.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {actionType === 'approve' ? 'Approve' : 'Reject'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.text.white,
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
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.tertiary,
    marginTop: 16,
  },
  appealsList: {
    padding: 16,
    gap: 16,
  },
  appealCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  appealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appealHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appealInfo: {
    flex: 1,
  },
  appealType: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  appealFeature: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  appealBody: {
    gap: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userInfoText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  reasonSection: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  responseSection: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.primary,
    marginBottom: 8,
  },
  reviewedText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  dateText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  responseInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  confirmApproveButton: {
    backgroundColor: colors.secondary,
  },
  confirmRejectButton: {
    backgroundColor: colors.danger,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
});

