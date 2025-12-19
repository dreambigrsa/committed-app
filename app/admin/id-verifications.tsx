import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Shield, CheckCircle, XCircle, Eye, ArrowLeft } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

interface IdVerificationRequest {
  id: string;
  user_id: string;
  document_type: string;
  document_url: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  submitted_at?: string; // verification_documents uses submitted_at
  created_at?: string; // Fallback for compatibility
  user?: {
    full_name: string;
    email: string;
  };
}

export default function IdVerificationsScreen() {
  const { currentUser } = useApp();
  const [requests, setRequests] = useState<IdVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<IdVerificationRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      
      // Get all ID verification requests from verification_documents table
      const { data: requestsData, error: requestsError } = await supabase
        .from('verification_documents')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (requestsData) {
        // Get unique user IDs
        const userIds = [...new Set(requestsData.map((r: any) => r.user_id).filter(Boolean))];
        
        // Fetch user data for all users
        let usersMap: Record<string, { full_name: string; email: string }> = {};
        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', userIds);

          if (!usersError && usersData) {
            usersMap = usersData.reduce((acc: any, user: any) => {
              acc[user.id] = {
                full_name: user.full_name || 'Unknown User',
                email: user.email || 'No email',
              };
              return acc;
            }, {});
          }
        }

        // Combine requests with user data
        const formatted = requestsData.map((r: any) => ({
          ...r,
          user: usersMap[r.user_id] || {
            full_name: 'Unknown User',
            email: 'No email',
          },
        }));
        
        setRequests(formatted as IdVerificationRequest[]);
      }
    } catch (error: any) {
      console.error('Failed to load requests:', error);
      
      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
        errorMessage = JSON.stringify(error);
      }
      
      // Check if table doesn't exist
      if (error?.code === 'PGRST205' || errorMessage.includes('Could not find the table')) {
        Alert.alert(
          'Table Not Found',
          'The verification_documents table does not exist.\n\nPlease run the database migration:\n\n1. Go to Supabase SQL Editor\n2. Run supabase-schema.sql or complete-database-setup.sql if you haven\'t already.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', `Failed to load ID verification requests:\n\n${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    Alert.alert(
      'Approve Verification',
      'Are you sure you want to approve this ID verification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setReviewing(true);
            try {
               // Update verification request
               const { error: updateError, data: updateData } = await supabase
                 .from('verification_documents')
                 .update({
                   status: 'approved',
                   reviewed_by: currentUser?.id,
                   reviewed_at: new Date().toISOString(),
                 })
                 .eq('id', requestId)
                 .select();

              if (updateError) {
                console.error('Update error:', updateError);
                throw new Error(updateError.message || 'Failed to update verification document');
              }

              // Get the request to find user_id
              const request = requests.find((r) => r.id === requestId);
              if (request) {
                // Update user's verification status
                const { error: userError } = await supabase
                  .from('users')
                  .update({ id_verified: true })
                  .eq('id', request.user_id);

                if (userError) {
                  console.error('User update error:', userError);
                  throw new Error(userError.message || 'Failed to update user verification status');
                }
              }

              Alert.alert('Success', 'ID verification approved');
              setShowModal(false);
              setSelectedRequest(null);
              loadRequests();
            } catch (error: any) {
              console.error('Failed to approve:', error);
              const errorMessage = error?.message || error?.toString() || 'Failed to approve verification';
              Alert.alert('Error', errorMessage);
            } finally {
              setReviewing(false);
            }
          },
        },
      ]
    );
  };

  const rejectRequest = async (requestId: string, reason: string) => {
    if (!reason || !reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    setReviewing(true);
    try {
      // Update verification request
      const { error: updateError } = await supabase
        .from('verification_documents')
        .update({
          status: 'rejected',
          reviewed_by: currentUser?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason.trim(),
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(updateError.message || 'Failed to update verification document');
      }

      Alert.alert('Success', 'ID verification rejected');
      setShowModal(false);
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      loadRequests();
    } catch (error: any) {
      console.error('Failed to reject:', error);
      const errorMessage = error?.message || error?.toString() || 'Failed to reject verification';
      Alert.alert('Error', errorMessage);
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = (requestId: string) => {
    setShowRejectModal(true);
  };

  const handleConfirmReject = () => {
    if (selectedRequest) {
      rejectRequest(selectedRequest.id, rejectionReason);
    }
  };

  const openRequest = (request: IdVerificationRequest) => {
    setSelectedRequest(request);
    setShowModal(true);
    setRejectionReason('');
    setShowRejectModal(false);
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'ID Verifications', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only Admins can review ID verifications</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const approvedRequests = requests.filter((r) => r.status === 'approved');
  const rejectedRequests = requests.filter((r) => r.status === 'rejected');

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'ID Verifications', 
          headerShown: true,
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.text.white,
        }} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{pendingRequests.length}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, styles.statCardSuccess]}>
              <Text style={styles.statNumber}>{approvedRequests.length}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={[styles.statCard, styles.statCardDanger]}>
              <Text style={styles.statNumber}>{rejectedRequests.length}</Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </View>
          </View>

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Review ({pendingRequests.length})</Text>
              {pendingRequests.map((request) => (
                <TouchableOpacity
                  key={request.id}
                  style={styles.requestCard}
                  onPress={() => openRequest(request)}
                >
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestUserName}>
                        {request.user?.full_name || 'Unknown User'}
                      </Text>
                      <Text style={styles.requestEmail}>{request.user?.email || 'No email'}</Text>
                      <Text style={styles.requestDate}>
                        Submitted: {new Date(request.submitted_at || request.created_at || Date.now()).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                  </View>
                  <View style={styles.requestFooter}>
                    <Text style={styles.requestType}>
                      Document: {request.document_type.replace('_', ' ')}
                    </Text>
                    <Eye size={20} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Approved Requests */}
          {approvedRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Approved ({approvedRequests.length})</Text>
              {approvedRequests.map((request) => (
                <View key={request.id} style={[styles.requestCard, styles.approvedCard]}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestUserName}>
                        {request.user?.full_name || 'Unknown User'}
                      </Text>
                      <Text style={styles.requestDate}>
                        Approved: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : 'N/A'}
                      </Text>
                    </View>
                    <CheckCircle size={24} color={colors.status.verified} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Rejected Requests */}
          {rejectedRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Rejected ({rejectedRequests.length})</Text>
              {rejectedRequests.map((request) => (
                <View key={request.id} style={[styles.requestCard, styles.rejectedCard]}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestUserName}>
                        {request.user?.full_name || 'Unknown User'}
                      </Text>
                      <Text style={styles.requestDate}>
                        Rejected: {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : 'N/A'}
                      </Text>
                      {request.rejection_reason && (
                        <Text style={styles.rejectionReason}>
                          Reason: {request.rejection_reason}
                        </Text>
                      )}
                    </View>
                    <XCircle size={24} color={colors.danger} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {requests.length === 0 && (
            <View style={styles.emptyContainer}>
              <Shield size={64} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No ID verification requests</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowModal(false);
          setSelectedRequest(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                setSelectedRequest(null);
              }}
            >
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>ID Verification Review</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedRequest && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>User Information</Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Name:</Text> {selectedRequest.user?.full_name || 'Unknown'}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Email:</Text> {selectedRequest.user?.email || 'No email'}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Document Type:</Text>{' '}
                  {selectedRequest.document_type.replace('_', ' ')}
                </Text>
                <Text style={styles.modalText}>
                  <Text style={styles.modalLabel}>Submitted:</Text>{' '}
                  {new Date(selectedRequest.submitted_at || selectedRequest.created_at || Date.now()).toLocaleString()}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>ID Document</Text>
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: selectedRequest.document_url }}
                    style={styles.idImage}
                    contentFit="contain"
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleReject(selectedRequest.id)}
                  disabled={reviewing || selectedRequest.status !== 'pending'}
                >
                  <XCircle size={20} color={colors.text.white} />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => approveRequest(selectedRequest.id)}
                  disabled={reviewing || selectedRequest.status !== 'pending'}
                >
                  {reviewing ? (
                    <ActivityIndicator size="small" color={colors.text.white} />
                  ) : (
                    <>
                      <CheckCircle size={20} color={colors.text.white} />
                      <Text style={styles.actionButtonText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!reviewing) {
            setShowRejectModal(false);
            setRejectionReason('');
          }
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (!reviewing) {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }
              }}
              disabled={reviewing}
            >
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reject Verification</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Rejection Reason</Text>
              <Text style={styles.modalText}>
                Please provide a reason for rejecting this ID verification. This will be shown to the user.
              </Text>
              <TextInput
                style={styles.reasonInput}
                placeholder="Enter rejection reason..."
                placeholderTextColor={colors.text.tertiary}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                editable={!reviewing}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                disabled={reviewing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.rejectButton,
                  (!rejectionReason.trim() || reviewing) && styles.actionButtonDisabled,
                ]}
                onPress={handleConfirmReject}
                disabled={!rejectionReason.trim() || reviewing}
              >
                {reviewing ? (
                  <ActivityIndicator size="small" color={colors.text.white} />
                ) : (
                  <>
                    <XCircle size={20} color={colors.text.white} />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statCardSuccess: {
    backgroundColor: colors.status.verified + '20',
  },
  statCardDanger: {
    backgroundColor: colors.danger + '20',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  approvedCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.status.verified,
  },
  rejectedCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestUserName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  requestEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  pendingBadge: {
    backgroundColor: colors.accent + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.accent,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  requestType: {
    fontSize: 14,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  rejectionReason: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 8,
    lineHeight: 24,
  },
  modalLabel: {
    fontWeight: '600' as const,
  },
  imageContainer: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  idImage: {
    width: '100%',
    height: '100%',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  rejectButton: {
    backgroundColor: colors.danger,
  },
  approveButton: {
    backgroundColor: colors.status.verified,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  reasonInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: colors.text.tertiary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
});

