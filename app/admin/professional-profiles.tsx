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
import { UserCheck, CheckCircle, XCircle, Clock, Eye, FileText } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalProfile, ProfessionalApplication } from '@/types';
import colors from '@/constants/colors';

export default function AdminProfessionalProfilesScreen() {
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  
  const [tab, setTab] = useState<'applications' | 'profiles'>('applications');
  const [applications, setApplications] = useState<(ProfessionalApplication & { user?: any; role?: any })[]>([]);
  const [profiles, setProfiles] = useState<(ProfessionalProfile & { user?: any; role?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (tab === 'applications') {
      loadApplications();
    } else {
      loadProfiles();
    }
  }, [tab]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_applications')
        .select(`
          *,
          user:users!professional_applications_user_id_fkey(*),
          role:professional_roles!professional_applications_role_id_fkey(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setApplications(data || []);
    } catch (error: any) {
      console.error('Error loading applications:', error);
      Alert.alert('Error', 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_profiles')
        .select(`
          *,
          user:users!professional_profiles_user_id_fkey(*),
          role:professional_roles!professional_profiles_role_id_fkey(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error('Error loading profiles:', error);
      Alert.alert('Error', 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveApplication = async (application: any) => {
    const app = application as any; // Database returns snake_case
    Alert.alert(
      'Approve Application',
      `Approve ${app.user?.full_name || app.user?.fullName || 'this professional'} for ${app.role?.name || 'this role'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              // Create professional profile from application
              const { data: profileData, error: profileError } = await supabase
                .from('professional_profiles')
                .insert([{
                  user_id: app.user_id || app.userId,
                  role_id: app.role_id || app.roleId,
                  full_name: app.user?.full_name || app.user?.fullName || 'Professional',
                  bio: app.application_data?.bio || app.applicationData?.bio || null,
                  credentials: app.application_data?.credentials || app.applicationData?.credentials || [],
                  credential_documents: app.application_data?.credential_documents || app.applicationData?.credentialDocuments || [],
                  location: app.application_data?.location || app.applicationData?.location || null,
                  approval_status: 'approved',
                  approved_by: currentUser?.id,
                  approved_at: new Date().toISOString(),
                }])
                .select()
                .single();

              if (profileError) throw profileError;

              // Update application status
              const { error: updateError } = await supabase
                .from('professional_applications')
                .update({
                  status: 'approved',
                  reviewed_by: currentUser?.id,
                  reviewed_at: new Date().toISOString(),
                  review_notes: reviewNotes || null,
                })
                .eq('id', application.id);

              if (updateError) throw updateError;

              Alert.alert('Success', 'Application approved and profile created');
              setShowDetailModal(false);
              loadApplications();
              if (tab === 'profiles') loadProfiles();
            } catch (error: any) {
              console.error('Error approving application:', error);
              Alert.alert('Error', error.message || 'Failed to approve application');
            }
          },
        },
      ]
    );
  };

  const handleRejectApplication = async (application: any) => {
    Alert.prompt(
      'Reject Application',
      'Please provide a reason for rejection:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async (reason: string | undefined) => {
            try {
              const { error } = await supabase
                .from('professional_applications')
                .update({
                  status: 'rejected',
                  reviewed_by: currentUser?.id,
                  reviewed_at: new Date().toISOString(),
                  rejection_reason: reason || 'Application rejected',
                  review_notes: reviewNotes || null,
                })
                .eq('id', application.id);

              if (error) throw error;

              Alert.alert('Success', 'Application rejected');
              setShowDetailModal(false);
              loadApplications();
            } catch (error: any) {
              console.error('Error rejecting application:', error);
              Alert.alert('Error', error.message || 'Failed to reject application');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleToggleProfileStatus = async (profile: any) => {
    const currentStatus = profile.approval_status || profile.approvalStatus || 'pending';
    const newStatus = currentStatus === 'approved' ? 'suspended' : 'approved';
    Alert.alert(
      newStatus === 'suspended' ? 'Suspend Professional' : 'Activate Professional',
      `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this professional?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('professional_profiles')
                .update({
                  approval_status: newStatus,
                  approved_by: currentUser?.id,
                  approved_at: newStatus === 'approved' ? new Date().toISOString() : (profile.approved_at || profile.approvedAt),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', profile.id);

              if (error) throw error;

              Alert.alert('Success', `Professional ${newStatus === 'suspended' ? 'suspended' : 'activated'}`);
              setShowDetailModal(false);
              loadProfiles();
            } catch (error: any) {
              console.error('Error updating profile:', error);
              Alert.alert('Error', error.message || 'Failed to update profile');
            }
          },
        },
      ]
    );
  };

  const handleDeleteProfile = async (profile: any) => {
    Alert.alert(
      'Delete Professional Profile',
      `Are you sure you want to permanently delete this professional profile? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('professional_profiles')
                .delete()
                .eq('id', profile.id);

              if (error) throw error;

              Alert.alert('Success', 'Professional profile deleted');
              setShowDetailModal(false);
              loadProfiles();
            } catch (error: any) {
              console.error('Error deleting profile:', error);
              Alert.alert('Error', error.message || 'Failed to delete profile');
            }
          },
        },
      ]
    );
  };

  const handleToggleServiceStatus = async (profile: any) => {
    const currentStatus = profile.is_active !== undefined ? profile.is_active : (profile.isActive !== undefined ? profile.isActive : true);
    const newStatus = !currentStatus;
    Alert.alert(
      newStatus ? 'Resume Service' : 'Pause Service',
      `Are you sure you want to ${newStatus ? 'resume' : 'pause'} this professional's service?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('professional_profiles')
                .update({
                  is_active: newStatus,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', profile.id);

              if (error) throw error;

              Alert.alert('Success', `Service ${newStatus ? 'resumed' : 'paused'}`);
              setShowDetailModal(false);
              loadProfiles();
            } catch (error: any) {
              console.error('Error updating service status:', error);
              Alert.alert('Error', error.message || 'Failed to update service status');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return colors.secondary; // success color
      case 'pending': return colors.accent; // warning color
      case 'rejected': return colors.danger;
      case 'suspended': return colors.danger;
      default: return themeColors.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return CheckCircle;
      case 'pending': return Clock;
      case 'rejected': return XCircle;
      case 'suspended': return XCircle;
      default: return Clock;
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Professional Profiles' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Professional Profiles' }} />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === 'applications' && styles.activeTab]}
          onPress={() => setTab('applications')}
        >
          <Text style={[styles.tabText, tab === 'applications' && styles.activeTabText]}>
            Applications ({applications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'profiles' && styles.activeTab]}
          onPress={() => setTab('profiles')}
        >
          <Text style={[styles.tabText, tab === 'profiles' && styles.activeTabText]}>
            Profiles ({profiles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {tab === 'applications' ? (
            <View style={styles.list}>
              {applications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <UserCheck size={64} color={themeColors.text.tertiary} />
                  <Text style={styles.emptyText}>No applications</Text>
                </View>
              ) : (
                applications.map((app: any) => {
                  const StatusIcon = getStatusIcon(app.status);
                  return (
                    <TouchableOpacity
                      key={app.id}
                      style={styles.card}
                      onPress={() => {
                        setSelectedItem(app);
                        setReviewNotes(app.reviewNotes || '');
                        setShowDetailModal(true);
                      }}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardInfo}>
                          {app.user?.profile_picture ? (
                            <Image
                              source={{ uri: app.user.profile_picture }}
                              style={styles.avatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                              <Text style={styles.avatarText}>
                                {app.user?.full_name?.[0] || '?'}
                              </Text>
                            </View>
                          )}
                          <View style={styles.cardDetails}>
                            <Text style={styles.cardName}>{app.user?.full_name || 'Unknown'}</Text>
                            <Text style={styles.cardEmail}>{app.user?.email}</Text>
                            <Text style={styles.cardRole}>{app.role?.name}</Text>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(app.status) + '20' }]}>
                          <StatusIcon size={16} color={getStatusColor(app.status)} />
                          <Text style={[styles.statusText, { color: getStatusColor(app.status) }]}>
                            {app.status.replace('_', ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardDate}>
                        Applied {new Date(app.created_at || app.createdAt || Date.now()).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : (
            <View style={styles.list}>
              {profiles.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <UserCheck size={64} color={themeColors.text.tertiary} />
                  <Text style={styles.emptyText}>No professional profiles</Text>
                </View>
              ) : (
                profiles.map((profile: any) => {
                  const status = profile.approval_status || profile.approvalStatus || 'pending';
                  const StatusIcon = getStatusIcon(status);
                  return (
                    <TouchableOpacity
                      key={profile.id}
                      style={styles.card}
                      onPress={() => {
                        setSelectedItem(profile);
                        setShowDetailModal(true);
                      }}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardInfo}>
                          {profile.user?.profile_picture ? (
                            <Image
                              source={{ uri: profile.user.profile_picture }}
                              style={styles.avatar}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                              <Text style={styles.avatarText}>
                                {(profile.full_name || profile.fullName || '?')[0]}
                              </Text>
                            </View>
                          )}
                          <View style={styles.cardDetails}>
                            <Text style={styles.cardName}>{profile.full_name || profile.fullName || 'Professional'}</Text>
                            <Text style={styles.cardEmail}>{profile.user?.email}</Text>
                            <Text style={styles.cardRole}>{profile.role?.name}</Text>
                            <View style={styles.ratingRow}>
                              <Text style={styles.ratingText}>
                                ⭐ {((profile.rating_average ?? profile.ratingAverage) || 0).toFixed(1)} ({(profile.rating_count ?? profile.ratingCount) || 0} ratings)
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
                          <StatusIcon size={16} color={getStatusColor(status)} />
                          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
                            {status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {tab === 'applications' ? 'Application Details' : 'Profile Details'}
            </Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedItem && (
              <>
                {/* User Information */}
                <View style={styles.detailSection}>
                  <Text style={styles.modalSectionTitle}>User Information</Text>
                  <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Name:</Text>
                      <Text style={styles.detailValue}>
                        {selectedItem.user?.full_name || selectedItem.user?.fullName || selectedItem.full_name || selectedItem.fullName || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{selectedItem.user?.email || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Applied for Role:</Text>
                      <Text style={styles.detailValue}>{selectedItem.role?.name || 'N/A'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Approval Status:</Text>
                      <View style={[styles.statusBadgeInline, { backgroundColor: getStatusColor(selectedItem.status || selectedItem.approval_status || selectedItem.approvalStatus || 'pending') + '20' }]}>
                        <Text style={[styles.statusTextInline, { color: getStatusColor(selectedItem.status || selectedItem.approval_status || selectedItem.approvalStatus || 'pending') }]}>
                          {(selectedItem.status || selectedItem.approval_status || selectedItem.approvalStatus || 'pending').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {tab === 'profiles' && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Service Status:</Text>
                        <View style={[styles.statusBadgeInline, { backgroundColor: ((selectedItem.is_active !== undefined ? selectedItem.is_active : selectedItem.isActive) ? themeColors.success : themeColors.danger) + '20' }]}>
                          <Text style={[styles.statusTextInline, { color: (selectedItem.is_active !== undefined ? selectedItem.is_active : selectedItem.isActive) ? themeColors.success : themeColors.danger }]}>
                            {(selectedItem.is_active !== undefined ? selectedItem.is_active : selectedItem.isActive) ? 'ACTIVE' : 'PAUSED'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Application Details */}
                {(selectedItem.applicationData || selectedItem.bio) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.modalSectionTitle}>Application Details</Text>
                    <View style={styles.detailCard}>
                      {selectedItem.applicationData?.bio || selectedItem.bio ? (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Bio:</Text>
                          <Text style={styles.detailValueMultiline}>
                            {selectedItem.applicationData?.bio || selectedItem.bio}
                          </Text>
                        </View>
                      ) : null}
                      {selectedItem.applicationData?.location || selectedItem.location ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Location:</Text>
                          <Text style={styles.detailValue}>
                            {selectedItem.applicationData?.location || selectedItem.location}
                          </Text>
                        </View>
                      ) : null}
                      {selectedItem.applicationData?.credentials && selectedItem.applicationData.credentials.length > 0 && (
                        <View style={styles.detailItem}>
                          <Text style={styles.detailLabel}>Credentials:</Text>
                          {selectedItem.applicationData.credentials.map((cred: string, idx: number) => (
                            <Text key={idx} style={styles.detailValue}>• {cred}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Review Notes Section - Only for pending applications */}
                {tab === 'applications' && (selectedItem.status === 'pending' || selectedItem.status === 'under_review') && (
                  <View style={styles.detailSection}>
                    <Text style={styles.modalSectionTitle}>Review Notes</Text>
                    <TextInput
                      style={styles.textArea}
                      value={reviewNotes}
                      onChangeText={setReviewNotes}
                      placeholder="Add review notes (optional)..."
                      multiline
                      numberOfLines={4}
                      placeholderTextColor={themeColors.text.tertiary}
                    />
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.rejectButton]}
                        onPress={() => handleRejectApplication(selectedItem)}
                      >
                        <XCircle size={20} color={colors.text.white} />
                        <Text style={styles.modalButtonText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.approveButton]}
                        onPress={() => handleApproveApplication(selectedItem)}
                      >
                        <CheckCircle size={20} color={colors.text.white} />
                        <Text style={styles.modalButtonText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Profile Information for approved profiles */}
                {tab === 'profiles' && (
                  <>
                    <View style={styles.detailSection}>
                      <Text style={styles.modalSectionTitle}>Profile Information</Text>
                      <View style={styles.detailCard}>
                        {selectedItem.ratingAverage !== undefined && (
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Rating:</Text>
                            <Text style={styles.detailValue}>
                              ⭐ {((selectedItem.rating_average ?? selectedItem.ratingAverage) || 0).toFixed(1)} ({(selectedItem.rating_count ?? selectedItem.ratingCount) || 0} ratings)
                            </Text>
                          </View>
                        )}
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Approved At:</Text>
                          <Text style={styles.detailValue}>
                            {selectedItem.approved_at || selectedItem.approvedAt 
                              ? new Date(selectedItem.approved_at || selectedItem.approvedAt).toLocaleString()
                              : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Profile Management Actions */}
                    <View style={styles.detailSection}>
                      <Text style={styles.modalSectionTitle}>Profile Management</Text>
                      <View style={styles.detailCard}>
                        <TouchableOpacity
                          style={[styles.managementButton, styles.toggleStatusButton]}
                          onPress={() => handleToggleProfileStatus(selectedItem)}
                        >
                          <Text style={styles.managementButtonText}>
                            {(selectedItem.approval_status || selectedItem.approvalStatus) === 'approved' ? 'Suspend Professional' : 'Activate Professional'}
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={[styles.managementButton, styles.toggleServiceButton]}
                          onPress={() => handleToggleServiceStatus(selectedItem)}
                        >
                          <Text style={styles.managementButtonText}>
                            {(selectedItem.is_active !== undefined ? selectedItem.is_active : selectedItem.isActive) ? 'Pause Service' : 'Resume Service'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.managementButton, styles.deleteButton]}
                          onPress={() => handleDeleteProfile(selectedItem)}
                        >
                          <XCircle size={20} color={colors.text.white} />
                          <Text style={[styles.managementButtonText, { color: colors.text.white }]}>
                            Delete Profile
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
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
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 16,
  },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
  },
  cardDetails: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  cardEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  cardRole: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 12,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  detailValueMultiline: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 4,
  },
  statusBadgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextInline: {
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: colors.danger,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.white,
  },
  managementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  toggleStatusButton: {
    backgroundColor: colors.accent,
  },
  toggleServiceButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  managementButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.white,
  },
});

