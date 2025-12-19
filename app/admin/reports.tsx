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
import { AlertTriangle, CheckCircle, XCircle, Eye, Ban } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { ReportedContent } from '@/types';
import BanUserModal from '@/components/BanUserModal';

export default function AdminReportsScreen() {
  const { currentUser } = useApp();
  const [reports, setReports] = useState<ReportedContent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [banModalVisible, setBanModalVisible] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<ReportedContent | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('reported_content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedReports: ReportedContent[] = data.map((r: any) => ({
          id: r.id || '',
          reporterId: r.reporter_id || '',
          reportedUserId: r.reported_user_id || undefined,
          contentType: r.content_type || 'post',
          contentId: r.content_id || undefined,
          reason: r.reason || '',
          description: r.description || undefined,
          status: r.status || 'pending',
          reviewedBy: r.reviewed_by || undefined,
          reviewedAt: r.reviewed_at || undefined,
          actionTaken: r.action_taken || undefined,
          createdAt: r.created_at || new Date().toISOString(),
        }));
        setReports(formattedReports);
      }
    } catch (error: any) {
      console.error('Failed to load reports:', error);
      // Extract proper error message
      const errorMessage = error?.message || error?.toString() || 'Failed to load reports';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewReport = async (reportId: string, action: 'resolved' | 'dismissed', actionTaken?: string) => {
    try {
      const { error } = await supabase
        .from('reported_content')
        .update({
          status: action,
          reviewed_by: currentUser?.id,
          reviewed_at: new Date().toISOString(),
          action_taken: actionTaken || action,
        })
        .eq('id', reportId);

      if (error) {
        console.error('Update report error:', error);
        Alert.alert('Error', error.message || 'Failed to update report');
        return;
      }

      Alert.alert('Success', `Report ${action}`);
      loadReports();
    } catch (error: any) {
      console.error('Update report error:', error);
      Alert.alert('Error', error?.message || 'Failed to update report');
    }
  };

  const handleDeleteReportedContent = async (report: ReportedContent) => {
    if (!report.contentId) return;

    Alert.alert(
      'Delete Content',
      'Are you sure you want to delete this content?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const tableName = report.contentType === 'post' ? 'posts' : 
                               report.contentType === 'reel' ? 'reels' :
                               report.contentType === 'comment' ? 'comments' :
                               report.contentType === 'message' ? 'messages' : null;

              if (tableName) {
                const { error } = await supabase
                  .from(tableName)
                  .delete()
                  .eq('id', report.contentId);

                if (error) {
                  console.error('Delete content error:', error);
                  Alert.alert('Error', error.message || 'Failed to delete content');
                  return;
                }

                await handleReviewReport(report.id, 'resolved', 'Content deleted');
              }
            } catch (error: any) {
              console.error('Delete content error:', error);
              Alert.alert('Error', error?.message || 'Failed to delete content');
            }
          },
        },
      ]
    );
  };

  const handleBanUser = async (report: ReportedContent) => {
    if (!report.reportedUserId) {
      Alert.alert('Error', 'No user ID available for this report');
      return;
    }
    setSelectedReport(report);
    setBanModalVisible(true);
  };

  const handleBanFeatures = async (features: string[]) => {
    if (!selectedReport?.reportedUserId) return;

    try {
      // Insert restrictions for each selected feature
      const restrictions = features.map(feature => ({
        user_id: selectedReport.reportedUserId,
        restricted_feature: feature,
        reason: `Reported: ${selectedReport.reason}`,
        restricted_by: currentUser?.id,
        is_active: true,
      }));

      const { error: restrictionError } = await supabase
        .from('user_restrictions')
        .insert(restrictions);

      if (restrictionError) {
        console.error('Add restriction error:', restrictionError);
        Alert.alert('Error', restrictionError.message || 'Failed to add restrictions');
        return;
      }

      const featureNames = features.map(f => f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')).join(', ');
      await handleReviewReport(selectedReport.id, 'resolved', `User banned from: ${featureNames}`);
      Alert.alert('Success', `User has been banned from: ${featureNames}`);
      setBanModalVisible(false);
      setSelectedReport(null);
      loadReports();
    } catch (error: any) {
      console.error('Ban user error:', error);
      Alert.alert('Error', error?.message || 'Failed to ban user');
    }
  };

  const handleFullBan = async () => {
    if (!selectedReport?.reportedUserId) return;

    try {
      // Update database
      const { error: dbError } = await supabase
        .from('users')
        .update({ 
          banned_at: new Date().toISOString(),
          banned_by: currentUser?.id,
          ban_reason: `Reported: ${selectedReport.reason}`,
        })
        .eq('id', selectedReport.reportedUserId);

      if (dbError) {
        console.error('DB update error:', dbError);
        throw dbError;
      }

      // Add restriction for all
      const { error: restrictionError } = await supabase
        .from('user_restrictions')
        .insert({
          user_id: selectedReport.reportedUserId,
          restricted_feature: 'all',
          reason: `Reported: ${selectedReport.reason}`,
          restricted_by: currentUser?.id,
          is_active: true,
        });

      if (restrictionError) {
        console.error('Restriction error:', restrictionError);
        throw restrictionError;
      }

      await handleReviewReport(selectedReport.id, 'resolved', 'User fully banned');
      Alert.alert('Success', 'User has been fully banned');
      setBanModalVisible(false);
      setSelectedReport(null);
      loadReports();
    } catch (error: any) {
      console.error('Full ban error:', error);
      Alert.alert('Error', error?.message || 'Failed to ban user');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Reports', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Reported Content', headerShown: true }} />
      
      <BanUserModal
        visible={banModalVisible}
        onClose={() => {
          setBanModalVisible(false);
          setSelectedReport(null);
        }}
        onBanFeatures={handleBanFeatures}
        onFullBan={handleFullBan}
        reportedContentType={selectedReport?.contentType}
        reason={selectedReport?.reason}
        colors={colors}
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <AlertTriangle size={64} color={colors.danger} />
          <Text style={styles.errorText}>Failed to load reports</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reports.filter(r => r.status === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reports.filter(r => r.status === 'reviewing').length}
              </Text>
              <Text style={styles.statLabel}>Reviewing</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {reports.filter(r => r.status === 'resolved').length}
              </Text>
              <Text style={styles.statLabel}>Resolved</Text>
            </View>
          </View>

          <View style={styles.reportsList}>
            {reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <AlertTriangle size={24} color={colors.danger} />
                  <View style={[
                    styles.statusBadge,
                    report.status === 'pending' ? styles.pendingBadge :
                    report.status === 'reviewing' ? styles.reviewingBadge :
                    report.status === 'resolved' ? styles.resolvedBadge :
                    styles.dismissedBadge
                  ]}>
                    <Text style={styles.statusText}>{report.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.reportContent}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Type:</Text>
                    <Text style={styles.metaValue}>{report.contentType}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Reason:</Text>
                    <Text style={styles.metaValue}>{report.reason}</Text>
                  </View>
                  {report.description && (
                    <View style={styles.descriptionBox}>
                      <Text style={styles.descriptionText}>{report.description}</Text>
                    </View>
                  )}
                  <Text style={styles.dateText}>
                    Reported: {new Date(report.createdAt).toLocaleString()}
                  </Text>
                  {report.actionTaken && (
                    <Text style={styles.actionText}>Action: {report.actionTaken}</Text>
                  )}
                </View>

                {report.status === 'pending' && (
                  <View style={styles.reportActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteContentButton]}
                      onPress={() => handleDeleteReportedContent(report)}
                    >
                      <Text style={styles.actionButtonText}>Delete Content</Text>
                    </TouchableOpacity>
                    {report.reportedUserId && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.banButton]}
                        onPress={() => handleBanUser(report)}
                      >
                        <Ban size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Ban User</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.resolveButton]}
                      onPress={() => handleReviewReport(report.id, 'resolved', 'Warning sent')}
                    >
                      <CheckCircle size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Resolve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => handleReviewReport(report.id, 'dismissed')}
                    >
                      <XCircle size={16} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {reports.length === 0 && (
              <View style={styles.emptyState}>
                <AlertTriangle size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyText}>No reports yet</Text>
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
  reportsList: {
    padding: 16,
    gap: 16,
  },
  reportCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  reportHeader: {
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
  reviewingBadge: {
    backgroundColor: colors.primary,
  },
  resolvedBadge: {
    backgroundColor: colors.secondary,
  },
  dismissedBadge: {
    backgroundColor: colors.text.tertiary,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  reportContent: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
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
    marginTop: 8,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 8,
  },
  actionText: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 4,
    fontWeight: '600' as const,
  },
  reportActions: {
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
  deleteContentButton: {
    backgroundColor: '#8B0000',
  },
  banButton: {
    backgroundColor: colors.danger,
  },
  resolveButton: {
    backgroundColor: colors.secondary,
  },
  dismissButton: {
    backgroundColor: colors.text.tertiary,
  },
  actionButtonText: {
    fontSize: 12,
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
