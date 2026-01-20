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
  Modal,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle, XCircle, Calendar, User, Eye, Shield } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { FalseRelationshipReport } from '@/types';

export default function AdminFalseRelationshipReportsScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [reports, setReports] = useState<FalseRelationshipReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReport, setSelectedReport] = useState<FalseRelationshipReport | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [resolution, setResolution] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed'>('all');

  useEffect(() => {
    loadReports();
  }, [filter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('false_relationship_reports')
        .select(`
          *,
          relationship:relationships(id, user_id, partner_name, partner_phone, partner_user_id, type, status),
          reporter:users!false_relationship_reports_reported_by_fkey(id, full_name, email, phone_number),
          resolver:users!false_relationship_reports_resolved_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Reports query error:', error);
        throw error;
      }

      if (data) {
        const formattedReports: FalseRelationshipReport[] = data.map((r: any) => ({
          id: r.id,
          relationshipId: r.relationship_id,
          reportedBy: r.reported_by,
          reason: r.reason,
          evidenceUrls: r.evidence_urls || [],
          status: r.status,
          resolution: r.resolution,
          resolvedBy: r.resolved_by,
          resolvedAt: r.resolved_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          // Additional data for display
          relationship: r.relationship,
          reporter: r.reporter,
          resolver: r.resolver,
        } as any));
        setReports(formattedReports);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId: string, action: 'resolved' | 'dismissed') => {
    if (!resolution.trim() && action === 'resolved') {
      Alert.alert('Error', 'Please provide a resolution note');
      return;
    }

    try {
      const { error } = await supabase
        .from('false_relationship_reports')
        .update({
          status: action,
          resolution: resolution.trim() || null,
          resolved_by: currentUser?.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      // If resolved, optionally end the relationship
      if (action === 'resolved' && selectedReport) {
        Alert.alert(
          'Relationship Action',
          'Would you like to end this relationship?',
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, End Relationship',
              style: 'destructive',
              onPress: async () => {
                try {
                  await supabase
                    .from('relationships')
                    .update({
                      status: 'ended',
                      end_date: new Date().toISOString(),
                    })
                    .eq('id', selectedReport.relationshipId);

                  // Notify both partners
                  const relationship = (selectedReport as any).relationship;
                  if (relationship) {
                    const partnerIds = [relationship.user_id, relationship.partner_user_id].filter(Boolean);
                    for (const partnerId of partnerIds) {
                      await supabase.from('notifications').insert({
                        user_id: partnerId,
                        type: 'false_relationship_resolved',
                        title: 'Relationship Removed',
                        message: 'Your relationship has been removed due to a false relationship report.',
                        data: { relationshipId: relationship.id },
                      });
                    }
                  }
                } catch (error) {
                  console.error('Error ending relationship:', error);
                }
              },
            },
          ]
        );
      }

      // Notify the reporter
      if (selectedReport) {
        await supabase.from('notifications').insert({
          user_id: selectedReport.reportedBy,
          type: 'false_relationship_resolved',
          title: `Report ${action === 'resolved' ? 'Resolved' : 'Dismissed'}`,
          message: `Your false relationship report has been ${action === 'resolved' ? 'resolved' : 'dismissed'}.`,
          data: { reportId },
        });
      }

      setShowModal(false);
      setResolution('');
      setSelectedReport(null);
      loadReports();
      Alert.alert('Success', `Report ${action === 'resolved' ? 'resolved' : 'dismissed'} successfully`);
    } catch (error: any) {
      console.error('Error resolving report:', error);
      Alert.alert('Error', error?.message || 'Failed to resolve report');
    }
  };

  const openReportModal = (report: FalseRelationshipReport) => {
    setSelectedReport(report);
    setShowModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return colors.warning;
      case 'reviewing':
        return colors.primary;
      case 'resolved':
        return colors.success;
      case 'dismissed':
        return colors.text.tertiary;
      default:
        return colors.text.secondary;
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'False Relationship Reports', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>You don't have admin permissions</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredReports = filter === 'all' ? reports : reports.filter(r => r.status === filter);
  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const reviewingCount = reports.filter(r => r.status === 'reviewing').length;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'False Relationship Reports', headerShown: true }} />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'reviewing' && styles.filterTabActive]}
          onPress={() => setFilter('reviewing')}
        >
          <Text style={[styles.filterText, filter === 'reviewing' && styles.filterTextActive]}>
            Reviewing {reviewingCount > 0 && `(${reviewingCount})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'resolved' && styles.filterTabActive]}
          onPress={() => setFilter('resolved')}
        >
          <Text style={[styles.filterText, filter === 'resolved' && styles.filterTextActive]}>Resolved</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'dismissed' && styles.filterTabActive]}
          onPress={() => setFilter('dismissed')}
        >
          <Text style={[styles.filterText, filter === 'dismissed' && styles.filterTextActive]}>Dismissed</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertTriangle size={48} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No reports found</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView}>
          {filteredReports.map((report) => {
            const relationship = (report as any).relationship;
            const reporter = (report as any).reporter;
            return (
              <TouchableOpacity
                key={report.id}
                style={styles.reportCard}
                onPress={() => openReportModal(report)}
              >
                <View style={styles.reportHeader}>
                  <View style={styles.reportHeaderLeft}>
                    <AlertTriangle size={20} color={getStatusColor(report.status)} />
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportTitle}>
                        Report by {reporter?.full_name || 'Unknown User'}
                      </Text>
                      <Text style={styles.reportDate}>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                      {report.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {relationship && (
                  <View style={styles.relationshipInfo}>
                    <Text style={styles.relationshipLabel}>Relationship:</Text>
                    <Text style={styles.relationshipText}>
                      {relationship.partner_name} ({relationship.type})
                    </Text>
                  </View>
                )}

                {report.reason && (
                  <View style={styles.reasonContainer}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText}>{report.reason}</Text>
                  </View>
                )}

                <View style={styles.reportFooter}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => openReportModal(report)}
                  >
                    <Eye size={16} color={colors.primary} />
                    <Text style={styles.viewButtonText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Report Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowModal(false);
          setResolution('');
          setSelectedReport(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {selectedReport && (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Report Details</Text>
                    <TouchableOpacity onPress={() => {
                      setShowModal(false);
                      setResolution('');
                      setSelectedReport(null);
                    }}>
                      <XCircle size={24} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalLabel}>Reporter:</Text>
                    <Text style={styles.modalValue}>
                      {(selectedReport as any).reporter?.full_name || 'Unknown'}
                    </Text>
                  </View>

                  {(selectedReport as any).relationship && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Relationship:</Text>
                      <Text style={styles.modalValue}>
                        Partner: {(selectedReport as any).relationship.partner_name}
                      </Text>
                      <Text style={styles.modalValue}>
                        Type: {(selectedReport as any).relationship.type}
                      </Text>
                      <Text style={styles.modalValue}>
                        Status: {(selectedReport as any).relationship.status}
                      </Text>
                    </View>
                  )}

                  {selectedReport.reason && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Reason:</Text>
                      <Text style={styles.modalText}>{selectedReport.reason}</Text>
                    </View>
                  )}

                  {selectedReport.evidenceUrls && selectedReport.evidenceUrls.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Evidence:</Text>
                      {selectedReport.evidenceUrls.map((url, index) => (
                        <Text key={index} style={styles.modalLink}>{url}</Text>
                      ))}
                    </View>
                  )}

                  {selectedReport.status !== 'resolved' && selectedReport.status !== 'dismissed' && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Resolution Note:</Text>
                      <TextInput
                        style={styles.resolutionInput}
                        placeholder="Enter resolution notes..."
                        placeholderTextColor={colors.text.tertiary}
                        multiline
                        numberOfLines={4}
                        value={resolution}
                        onChangeText={setResolution}
                      />
                    </View>
                  )}

                  {selectedReport.resolution && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalLabel}>Previous Resolution:</Text>
                      <Text style={styles.modalText}>{selectedReport.resolution}</Text>
                      {selectedReport.resolvedBy && (
                        <Text style={styles.modalSubtext}>
                          Resolved by: {(selectedReport as any).resolver?.full_name || 'Admin'}
                        </Text>
                      )}
                    </View>
                  )}

                  {selectedReport.status !== 'resolved' && selectedReport.status !== 'dismissed' && (
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.dismissButton]}
                        onPress={() => handleResolve(selectedReport.id, 'dismissed')}
                      >
                        <XCircle size={20} color={colors.danger} />
                        <Text style={styles.dismissButtonText}>Dismiss</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.resolveButton]}
                        onPress={() => handleResolve(selectedReport.id, 'resolved')}
                      >
                        <CheckCircle size={20} color={colors.success} />
                        <Text style={styles.resolveButtonText}>Resolve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  reportCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportInfo: {
    marginLeft: 12,
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  reportDate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  relationshipInfo: {
    marginBottom: 8,
  },
  relationshipLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  relationshipText: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
  },
  reasonContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  reportFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  modalValue: {
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 4,
  },
  modalText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  modalSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  modalLink: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
    marginBottom: 4,
  },
  resolutionInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  dismissButton: {
    backgroundColor: colors.danger + '20',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dismissButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.danger,
  },
  resolveButton: {
    backgroundColor: colors.success + '20',
    borderWidth: 1,
    borderColor: colors.success,
  },
  resolveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success,
  },
});

