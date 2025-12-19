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
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, XCircle, Clock, User, MessageSquare, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { getPendingSessionRequests, acceptProfessionalSession, declineProfessionalSession, ProfessionalSession } from '@/lib/professional-sessions';
import { supabase } from '@/lib/supabase';
import { ProfessionalProfile } from '@/types';

export default function ProfessionalSessionRequestsScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionRequests, setSessionRequests] = useState<ProfessionalSession[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [professionalProfileId, setProfessionalProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadProfessionalProfile();
  }, [currentUser]);

  useEffect(() => {
    if (professionalProfileId) {
      loadSessionRequests();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel('professional-session-requests')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'professional_sessions',
            filter: `professional_id=eq.${professionalProfileId}`,
          },
          () => {
            loadSessionRequests();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [professionalProfileId]);

  const loadProfessionalProfile = async () => {
    if (!currentUser) return;
    try {
      const { data } = await supabase
        .from('professional_profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .eq('approval_status', 'approved')
        .maybeSingle();
      setProfessionalProfileId(data?.id || null);
    } catch (error) {
      console.error('Error loading professional profile:', error);
    }
  };

  const loadSessionRequests = async () => {
    if (!professionalProfileId) {
      if (currentUser) {
        Alert.alert('Not a Professional', 'You need to be an approved professional to view session requests.');
        router.back();
      }
      return;
    }

    try {
      setLoading(true);
      const requests = await getPendingSessionRequests(professionalProfileId);
      setSessionRequests(requests);
    } catch (error: any) {
      console.error('Error loading session requests:', error);
      Alert.alert('Error', 'Failed to load session requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (sessionId: string) => {
    if (!currentUser) return;

    if (!professionalProfileId) return;

    try {
      setProcessingId(sessionId);

      const success = await acceptProfessionalSession(sessionId, professionalProfileId);
      
      if (success) {
        Alert.alert('Session Accepted', 'You can now chat with the user in the conversation.');
        // Navigate to conversation
        const session = sessionRequests.find((s) => s.id === sessionId);
        if (session?.conversationId) {
          router.push(`/messages/${session.conversationId}` as any);
        } else {
          loadSessionRequests();
        }
      } else {
        Alert.alert('Error', 'Failed to accept session. Please try again.');
      }
    } catch (error: any) {
      console.error('Error accepting session:', error);
      Alert.alert('Error', 'Failed to accept session');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (sessionId: string) => {
    if (!currentUser) return;

    Alert.alert(
      'Decline Session',
      'Are you sure you want to decline this session request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            if (!professionalProfileId) return;

            try {
              setProcessingId(sessionId);
              const success = await declineProfessionalSession(sessionId, professionalProfileId);
              
              if (success) {
                loadSessionRequests();
              } else {
                Alert.alert('Error', 'Failed to decline session');
              }
            } catch (error: any) {
              console.error('Error declining session:', error);
              Alert.alert('Error', 'Failed to decline session');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Session Requests' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading session requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Session Requests' }} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSessionRequests();
            }}
            colors={[themeColors.primary]}
          />
        }
      >
        {sessionRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageSquare size={64} color={themeColors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Pending Requests</Text>
            <Text style={styles.emptyText}>
              You don't have any pending session requests at the moment.
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {sessionRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={styles.requestHeaderLeft}>
                    <View style={styles.userIcon}>
                      <User size={24} color={themeColors.primary} />
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestUserName}>New Session Request</Text>
                      <Text style={styles.requestTime}>
                        {new Date(request.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.requestStatusBadge}>
                    <Clock size={14} color={themeColors.accent} />
                    <Text style={styles.requestStatusText}>Pending</Text>
                  </View>
                </View>

                {request.aiSummary && (
                  <View style={styles.summaryContainer}>
                    <Shield size={16} color={themeColors.text.secondary} />
                    <Text style={styles.summaryText}>{request.aiSummary}</Text>
                  </View>
                )}

                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleDecline(request.id)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <ActivityIndicator size="small" color={themeColors.text.white} />
                    ) : (
                      <>
                        <XCircle size={18} color={themeColors.text.white} />
                        <Text style={styles.actionButtonText}>Decline</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAccept(request.id)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <ActivityIndicator size="small" color={themeColors.text.white} />
                    ) : (
                      <>
                        <CheckCircle2 size={18} color={themeColors.text.white} />
                        <Text style={styles.actionButtonText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      minHeight: 400,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginTop: 24,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    requestsList: {
      padding: 16,
      gap: 16,
    },
    requestCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    requestHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    requestHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    userIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    requestInfo: {
      flex: 1,
    },
    requestUserName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    requestTime: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    requestStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accent + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    requestStatusText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
    },
    summaryContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    summaryText: {
      flex: 1,
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    requestActions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 8,
    },
    declineButton: {
      backgroundColor: colors.danger,
    },
    acceptButton: {
      backgroundColor: colors.secondary,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

