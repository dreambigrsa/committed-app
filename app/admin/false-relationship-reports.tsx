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
import { AlertTriangle, CheckCircle, XCircle, Eye, Shield, Clock, HeartOff, Trash2 } from 'lucide-react-native';
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount and filter change
  }, [filter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('false_relationship_reports')
        .select(`
          *,
          relationship:relationships(id, user_id, partner_name, partner_phone, partner_user_id, type, status, start_date, verified_date, privacy_level),
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

  const notifyReporter = async (
    report: FalseRelationshipReport,
    title: string,
    message: string,
    extraData?: Record<string, any>
  ) => {
    await supabase.from('notifications').insert({
      user_id: report.reportedBy,
      type: 'false_relationship_resolved',
      title,
      message,
      data: { reportId: report.id, relationshipId: report.relationshipId, ...extraData },
    });
  };

  const closeReportModal = () => {
    setShowModal(false);
    setResolution('');
    setSelectedReport(null);
  };

  const markUnderReview = async (report: FalseRelationshipReport) => {
    try {
      setActionLoading('reviewing');
      const { data, error } = await supabase
        .from('false_relationship_reports')
        .update({
          status: 'reviewing',
          resolution: resolution.trim() || 'Admin is reviewing this report. Relationship remains visible until a final decision is made.',
          resolved_by: currentUser?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', report.id)
        .select('id,status')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Report was not marked under review. Admin update permission may be missing.');

      await notifyReporter(
        report,
        'Report Under Review',
        'Your false relationship report is under admin review. The relationship remains visible until a final decision is made.'
      );

      closeReportModal();
      await loadReports();
      Alert.alert('Under review', 'The report is now under review. The relationship has not been changed.');
    } catch (error: any) {
      console.error('Error marking report under review:', error);
      Alert.alert('Error', error?.message || 'Failed to mark report under review');
    } finally {
      setActionLoading(null);
    }
  };

  const dismissReportAndKeepRelationship = async (report: FalseRelationshipReport) => {
    try {
      setActionLoading('dismiss');
      const note = resolution.trim() || 'Admin reviewed the report and kept the relationship active.';
      const { data, error } = await supabase
        .from('false_relationship_reports')
        .update({
          status: 'dismissed',
          resolution: note,
          resolved_by: currentUser?.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('relationship_id', report.relationshipId)
        .in('status', ['pending', 'reviewing'])
        .select('id,status');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Report was not dismissed. Admin update permission may be missing.');
      }

      await notifyReporter(
        report,
        'Report Dismissed',
        'An admin reviewed your report and kept the relationship active.',
        { affectedReports: data.length }
      );

      closeReportModal();
      await loadReports();
      Alert.alert('Relationship kept', 'The report was dismissed. The relationship stays visible in profile and search.');
    } catch (error: any) {
      console.error('Error dismissing report:', error);
      Alert.alert('Error', error?.message || 'Failed to dismiss report');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmFakeAndEndRelationship = async (report: FalseRelationshipReport) => {
    const relationship = (report as any).relationship;
    if (!relationship) {
      Alert.alert('Error', 'Relationship details are missing. Refresh and try again.');
      return;
    }

    Alert.alert(
      'Confirm Fake Relationship',
      'This is the only action that removes the relationship from profiles and search. It will end this relationship for both sides and resolve all open reports for it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Relationship',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading('end');
              const now = new Date().toISOString();
              const note = resolution.trim() || 'Admin confirmed this relationship is false and ended it.';

              const reciprocalIds = [relationship.id];
              if (relationship.user_id && relationship.partner_user_id) {
                const { data: reciprocalRows, error: reciprocalError } = await supabase
                  .from('relationships')
                  .select('id')
                  .eq('user_id', relationship.partner_user_id)
                  .eq('partner_user_id', relationship.user_id)
                  .in('status', ['pending', 'verified']);

                if (reciprocalError) throw reciprocalError;
                reciprocalRows?.forEach((row: any) => {
                  if (row.id && !reciprocalIds.includes(row.id)) reciprocalIds.push(row.id);
                });
              }

              const { data: endedRows, error: endError } = await supabase
                .from('relationships')
                .update({
                  status: 'ended',
                  end_date: now,
                })
                .in('id', reciprocalIds)
                .select('id,status,end_date');

              if (endError) throw endError;
              if (!endedRows || endedRows.length === 0) {
                throw new Error('Relationship was not ended. Admin relationship update permission may be missing.');
              }

              const { data: resolvedReports, error: reportError } = await supabase
                .from('false_relationship_reports')
                .update({
                  status: 'resolved',
                  resolution: note,
                  resolved_by: currentUser?.id,
                  resolved_at: now,
                  updated_at: now,
                })
                .eq('relationship_id', report.relationshipId)
                .in('status', ['pending', 'reviewing'])
                .select('id,status');

              if (reportError) throw reportError;
              if (!resolvedReports || resolvedReports.length === 0) {
                throw new Error('Relationship was ended, but the report was not resolved. Please refresh and check report permissions.');
              }

              const partnerIds = [relationship.user_id, relationship.partner_user_id].filter(Boolean);
              for (const partnerId of partnerIds) {
                await supabase.from('notifications').insert({
                  user_id: partnerId,
                  type: 'false_relationship_resolved',
                  title: 'Relationship Removed',
                  message: 'An admin reviewed a false relationship report and removed this relationship.',
                  data: { relationshipId: relationship.id, affectedRelationshipIds: endedRows.map((row: any) => row.id) },
                });
              }

              await notifyReporter(
                report,
                'Report Resolved',
                'An admin confirmed your report and removed the false relationship.',
                { endedRelationships: endedRows.length, affectedReports: resolvedReports.length }
              );

              closeReportModal();
              await loadReports();
              Alert.alert('Relationship ended', 'The false relationship was ended for both sides and removed from active profile/search results.');
            } catch (error: any) {
              console.error('Error ending false relationship:', error);
              Alert.alert('Error', error?.message || 'Failed to end relationship');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const deleteReportCase = async (report: FalseRelationshipReport) => {
    Alert.alert(
      'Delete Report Case',
      'This only deletes the report record. It does not change the relationship.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Report',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading('delete');
              const { data, error } = await supabase
                .from('false_relationship_reports')
                .delete()
                .eq('id', report.id)
                .select('id')
                .maybeSingle();

              if (error) throw error;
              if (!data) throw new Error('Report was not deleted. Admin delete permission may be missing.');

              closeReportModal();
              await loadReports();
              Alert.alert('Report deleted', 'The report case was deleted. The relationship was not changed.');
            } catch (error: any) {
              console.error('Error deleting report:', error);
              Alert.alert('Error', error?.message || 'Failed to delete report');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
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

                  <View style={styles.flowCard}>
                    <View style={styles.flowIcon}>
                      <Shield size={18} color={colors.primary} />
                    </View>
                    <View style={styles.flowCopy}>
                      <Text style={styles.flowTitle}>Review rule</Text>
                      <Text style={styles.flowText}>
                        A report never hides or removes a relationship by itself. Only confirming it as fake ends it.
                      </Text>
                    </View>
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
                      <Text style={styles.modalLabel}>Admin Note:</Text>
                      <TextInput
                        style={styles.resolutionInput}
                        placeholder="Add review notes for this decision..."
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
                    <View style={styles.decisionList}>
                      <TouchableOpacity
                        style={[styles.decisionButton, styles.reviewButton, actionLoading === 'reviewing' && styles.disabledButton]}
                        onPress={() => markUnderReview(selectedReport)}
                        disabled={!!actionLoading}
                      >
                        <Clock size={20} color={colors.primary} />
                        <View style={styles.decisionCopy}>
                          <Text style={[styles.decisionTitle, { color: colors.primary }]}>Mark under review</Text>
                          <Text style={styles.decisionText}>Keeps the relationship visible while admins investigate.</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.decisionButton, styles.keepButton, actionLoading === 'dismiss' && styles.disabledButton]}
                        onPress={() => dismissReportAndKeepRelationship(selectedReport)}
                        disabled={!!actionLoading}
                      >
                        <CheckCircle size={20} color={colors.success} />
                        <View style={styles.decisionCopy}>
                          <Text style={[styles.decisionTitle, { color: colors.success }]}>Dismiss report, keep relationship</Text>
                          <Text style={styles.decisionText}>Use when the report is wrong or unproven. Profile and search stay unchanged.</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.decisionButton, styles.endRelationshipButton, actionLoading === 'end' && styles.disabledButton]}
                        onPress={() => confirmFakeAndEndRelationship(selectedReport)}
                        disabled={!!actionLoading}
                      >
                        <HeartOff size={20} color={colors.danger} />
                        <View style={styles.decisionCopy}>
                          <Text style={[styles.decisionTitle, { color: colors.danger }]}>Confirm fake and end relationship</Text>
                          <Text style={styles.decisionText}>Only this removes the relationship from active profiles and search.</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.decisionButton, styles.deleteCaseButton, actionLoading === 'delete' && styles.disabledButton]}
                        onPress={() => deleteReportCase(selectedReport)}
                        disabled={!!actionLoading}
                      >
                        <Trash2 size={20} color={colors.text.secondary} />
                        <View style={styles.decisionCopy}>
                          <Text style={[styles.decisionTitle, { color: colors.text.primary }]}>Delete report case</Text>
                          <Text style={styles.decisionText}>Deletes only this report record. The relationship is not changed.</Text>
                        </View>
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
  flowCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '30',
    marginBottom: 20,
  },
  flowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  flowCopy: {
    flex: 1,
  },
  flowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
  },
  flowText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
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
  decisionList: {
    gap: 10,
    marginTop: 8,
    paddingBottom: 8,
  },
  decisionButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  reviewButton: {
    backgroundColor: colors.primary + '12',
    borderColor: colors.primary + '35',
  },
  keepButton: {
    backgroundColor: colors.success + '12',
    borderColor: colors.success + '35',
  },
  endRelationshipButton: {
    backgroundColor: colors.danger + '12',
    borderColor: colors.danger + '35',
  },
  deleteCaseButton: {
    backgroundColor: colors.background.secondary,
    borderColor: colors.border,
  },
  decisionCopy: {
    flex: 1,
  },
  decisionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  decisionText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  disabledButton: {
    opacity: 0.55,
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
