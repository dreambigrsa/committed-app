import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Check, X, Eye, Clock, DollarSign, CreditCard, Shield } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as PaymentAdminService from '@/lib/payment-admin-service';
import { Image as ExpoImage } from 'expo-image';

export default function AdminPaymentVerificationsScreen() {
  const { currentUser } = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [submissionType, setSubmissionType] = useState<'subscriptions' | 'ads'>(
    params.type === 'ads' ? 'ads' : 'subscriptions'
  );
  useEffect(() => {
    if (params.type === 'ads') {
      setSubmissionType('ads');
    } else if (params.type === 'subscriptions') {
      setSubmissionType('subscriptions');
    }
  }, [params.type]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter, submissionType]);

  const loadSubmissions = async () => {
    try {
      setIsLoading(true);
      const getAdsSubmissions =
        PaymentAdminService.getAdPaymentSubmissions ?? PaymentAdminService.getPaymentSubmissions;
      const data =
        submissionType === 'ads'
          ? await getAdsSubmissions(statusFilter)
          : await PaymentAdminService.getPaymentSubmissions(statusFilter);
      setSubmissions(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payment submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (submissionId: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      Alert.prompt(
        'Reject Payment',
        'Please provide a reason for rejection:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async (reason?: string) => {
              try {
                const verifyAdsPayment =
                  PaymentAdminService.verifyAdPayment ?? PaymentAdminService.verifyPayment;
                if (submissionType === 'ads') {
                  await verifyAdsPayment(
                    submissionId,
                    'rejected',
                    reason || 'Payment verification failed'
                  );
                } else {
                  await PaymentAdminService.verifyPayment(
                    submissionId,
                    'rejected',
                    reason || 'Payment verification failed'
                  );
                }
                Alert.alert('Success', 'Payment rejected');
                loadSubmissions();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to reject payment');
              }
            },
          },
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        'Approve Payment',
        'Are you sure you want to approve this payment? The subscription will be activated automatically.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Approve',
            onPress: async () => {
              try {
                const verifyAdsPayment =
                  PaymentAdminService.verifyAdPayment ?? PaymentAdminService.verifyPayment;
                if (submissionType === 'ads') {
                  await verifyAdsPayment(submissionId, 'approved');
                  Alert.alert('Success', 'Payment approved and ad activated');
                } else {
                  await PaymentAdminService.verifyPayment(submissionId, 'approved');
                  Alert.alert('Success', 'Payment approved and subscription activated');
                }
                loadSubmissions();
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to approve payment');
              }
            },
          },
        ]
      );
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Payment Verifications', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderSubmission = ({ item, index }: { item: any; index: number }) => {
    const user = item.user;
    const plan = item.subscription_plan;
    const method = item.payment_method;
    const advertisement = item.advertisement;

    return (
      <View style={styles.submissionCard}>
        <View style={styles.submissionHeader}>
          <View style={styles.userInfo}>
            {user?.profile_picture && (
              <ExpoImage
                source={{ uri: user.profile_picture }}
                style={styles.userAvatar}
                contentFit="cover"
              />
            )}
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.full_name || 'Unknown User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
          <View style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === 'approved'
                  ? colors.success + '20'
                  : item.status === 'rejected'
                  ? colors.danger + '20'
                  : colors.accent + '20',
            },
          ]}>
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    item.status === 'approved'
                      ? colors.success
                      : item.status === 'rejected'
                      ? colors.danger
                      : colors.accent,
                },
              ]}
            >
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Amount</Text>
            <Text style={styles.amountValue}>
              {item.currency || 'USD'} {item.amount}
            </Text>
          </View>
          <View style={styles.amountMeta}>
            <Text style={styles.amountMetaText}>
              {submissionType === 'ads' ? 'Ad Payment' : 'Subscription'}
            </Text>
          </View>
        </View>

        <View style={styles.submissionContent}>
          {submissionType === 'ads' ? (
            <View style={styles.detailRow}>
              <DollarSign size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>Ad:</Text>
              <Text style={styles.detailValue}>{advertisement?.title || 'N/A'}</Text>
              <Text style={styles.detailValue}>
                ${advertisement?.total_budget || item.amount || '0'}
              </Text>
            </View>
          ) : (
            <View style={styles.detailRow}>
              <DollarSign size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>Plan:</Text>
              <Text style={styles.detailValue}>{plan?.name || 'N/A'}</Text>
              <Text style={styles.detailValue}>
                ${plan?.price_monthly ? `${plan.price_monthly}/mo` : plan?.price_yearly ? `${plan.price_yearly}/yr` : '0'}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <CreditCard size={16} color={colors.text.secondary} />
            <Text style={styles.detailLabel}>Method:</Text>
            <Text style={styles.detailValue}>
              {method?.icon_emoji} {method?.name || 'N/A'}
            </Text>
          </View>

          {item.transaction_reference && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference:</Text>
              <Text style={[styles.detailValue, styles.monoText]}>
                {item.transaction_reference}
              </Text>
            </View>
          )}

          {item.payment_date && (
            <View style={styles.detailRow}>
              <Clock size={16} color={colors.text.secondary} />
              <Text style={styles.detailLabel}>Date:</Text>
              <Text style={styles.detailValue}>
                {new Date(item.payment_date).toLocaleDateString()}
              </Text>
            </View>
          )}

          {item.payment_proof_url && (
            <TouchableOpacity
              style={styles.proofButton}
              onPress={() => {
                // Open payment proof image
                router.push({
                  pathname: '/admin/payment-proof-viewer',
                  params: { imageUrl: item.payment_proof_url },
                } as any);
              }}
            >
              <Eye size={16} color={colors.primary} />
              <Text style={styles.proofButtonText}>View Payment Proof</Text>
            </TouchableOpacity>
          )}

          {item.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          )}

          {item.rejection_reason && (
            <View style={styles.rejectionContainer}>
              <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
              <Text style={styles.rejectionText}>{item.rejection_reason}</Text>
            </View>
          )}

          {item.verified_by && (
            <Text style={styles.verifiedBy}>
              Verified by admin on {new Date(item.verified_at).toLocaleString()}
            </Text>
          )}
        </View>

        {item.status === 'pending' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleVerify(item.id, 'approved')}
            >
              <Check size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleVerify(item.id, 'rejected')}
            >
              <X size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Payment Verifications', headerShown: true }} />
      
      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterTitle}>Payment Verifications</Text>
        <Text style={styles.filterSubtitle}>
          Review pending payments and keep billing up to date.
        </Text>
        <View style={styles.typeToggle}>
          {(['subscriptions', 'ads'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeChip,
                submissionType === type && styles.typeChipActive,
              ]}
              onPress={() => setSubmissionType(type)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  submissionType === type && styles.typeChipTextActive,
                ]}
              >
                {type === 'subscriptions' ? 'Subscriptions' : 'Ads'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.statusToggle}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                statusFilter === status && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === status && styles.filterTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={submissions}
          renderItem={renderSubmission}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <DollarSign size={64} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>
              {statusFilter === 'pending'
                ? `No pending ${submissionType === 'ads' ? 'ad' : 'subscription'} payments to verify`
                : `No ${statusFilter} ${submissionType === 'ads' ? 'ad' : 'subscription'} payments`}
              </Text>
            </View>
          }
        />
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
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    errorText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    filterContainer: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 14,
      gap: 8,
      backgroundColor: colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    filterTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    filterSubtitle: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    statusToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    typeToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    typeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    typeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
    },
    typeChipTextActive: {
      color: '#fff',
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    filterTextActive: {
      color: '#fff',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      padding: 20,
    },
    submissionCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    submissionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    userAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    userEmail: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    amountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      marginBottom: 12,
    },
    amountLabel: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    amountValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    amountMeta: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primary + '15',
    },
    amountMetaText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    submissionContent: {
      gap: 10,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    detailLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    detailValue: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '500',
    },
    monoText: {
      fontFamily: 'monospace',
    },
    proofButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      backgroundColor: colors.primary,
      borderRadius: 12,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    proofButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    notesContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
    },
    notesLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    notesText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    rejectionContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.danger + '15',
      borderRadius: 8,
    },
    rejectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.danger,
      marginBottom: 4,
    },
    rejectionText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    verifiedBy: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    actionsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
      paddingTop: 16,
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
      borderRadius: 12,
    },
    approveButton: {
      backgroundColor: colors.success,
    },
    rejectButton: {
      backgroundColor: colors.danger,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    emptyContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 16,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  });

