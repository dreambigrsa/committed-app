import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Calendar, MapPin, Clock, Check, X, ArrowRight, Edit2, Trash2, Send } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import { Image as ExpoImage } from 'expo-image';

export default function DateRequestsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { data: profile } = trpc.dating.getProfile.useQuery();
  const currentUserId = profile?.user_id;
  
  const { data: dateRequests, isLoading, refetch } = trpc.dating.getDateRequests.useQuery();
  const respondMutation = trpc.dating.respondDateRequest.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const cancelMutation = trpc.dating.cancelDateRequest.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('received');

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleRespond = (requestId: string, response: 'accepted' | 'declined') => {
    Alert.alert(
      response === 'accepted' ? 'Accept Date Request' : 'Decline Date Request',
      response === 'accepted'
        ? 'Are you sure you want to accept this date request?'
        : 'Are you sure you want to decline this date request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: response === 'accepted' ? 'Accept' : 'Decline',
          style: response === 'declined' ? 'destructive' : 'default',
          onPress: () => {
            respondMutation.mutate({
              dateRequestId: requestId,
              response,
            });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Date Requests', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading date requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dateRequests || dateRequests.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Date Requests', headerShown: true }} />
        <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
          <Calendar size={80} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No Date Requests</Text>
          <Text style={styles.emptyText}>
            When you or your matches create date requests, they'll appear here.
          </Text>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const handleCancel = (requestId: string) => {
    Alert.alert(
      'Cancel Date Request',
      'Are you sure you want to cancel this date request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate({ dateRequestId: requestId });
          },
        },
      ]
    );
  };

  // Filter requests by tab
  const filteredRequests = dateRequests?.filter((item: any) => {
    if (activeTab === 'sent') {
      return item.from_user_id === currentUserId;
    } else {
      return item.to_user_id === currentUserId;
    }
  }) || [];

  const renderDateRequest = ({ item, index }: { item: any; index: number }) => {
    const isReceived = item.to_user_id === currentUserId;
    const isSent = item.from_user_id === currentUserId;
    const otherUser = isReceived ? item.from_user : item.to_user;
    const photo = otherUser?.profile_picture;

    return (
      <Animated.View
        style={[
          styles.requestCard,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.requestHeader}>
          <View style={styles.requestUserInfo}>
            {photo && (
              <ExpoImage
                source={{ uri: photo }}
                style={styles.userAvatar}
                contentFit="cover"
              />
            )}
            <View style={styles.requestUserDetails}>
              <Text style={styles.requestUserName}>
                {isReceived ? 'From' : 'To'}: {otherUser?.full_name || 'Unknown'}
              </Text>
              <View style={styles.statusBadge}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        item.status === 'accepted'
                          ? colors.success
                          : item.status === 'declined'
                          ? colors.danger
                          : colors.accent,
                    },
                  ]}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.requestContent}>
          <Text style={styles.requestTitle}>{item.date_title}</Text>
          {item.date_description && (
            <Text style={styles.requestDescription}>{item.date_description}</Text>
          )}

          <View style={styles.requestDetails}>
            <View style={styles.detailRow}>
              <MapPin size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>{item.date_location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Calendar size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>{formatDateTime(item.date_time)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Clock size={16} color={colors.text.secondary} />
              <Text style={styles.detailText}>
                {item.date_duration_hours} {item.date_duration_hours === 1 ? 'hour' : 'hours'}
              </Text>
            </View>
          </View>

          {item.suggested_activities && item.suggested_activities.length > 0 && (
            <View style={styles.activitiesContainer}>
              {item.suggested_activities.map((activity: string, idx: number) => (
                <View key={idx} style={styles.activityTag}>
                  <Text style={styles.activityText}>{activity}</Text>
                </View>
              ))}
            </View>
          )}

          {item.dress_code && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Dress Code:</Text>
              <Text style={styles.metaValue}>
                {item.dress_code.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </Text>
            </View>
          )}

          {item.budget_range && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Budget:</Text>
              <Text style={styles.metaValue}>
                {item.budget_range.charAt(0).toUpperCase() + item.budget_range.slice(1)}
              </Text>
            </View>
          )}

          {item.expense_handling && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Expenses:</Text>
              <Text style={styles.metaValue}>
                {item.expense_handling === 'split' 
                  ? 'Split the Bill'
                  : item.expense_handling === 'initiator_pays'
                  ? 'Initiator Pays'
                  : 'Acceptor Pays'}
              </Text>
            </View>
          )}

          {item.number_of_people && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>People:</Text>
              <Text style={styles.metaValue}>
                {item.number_of_people} {item.number_of_people === 2 ? 'people' : 'people'}
                {item.number_of_people > 2 && item.gender_preference && (
                  <Text style={styles.metaValue}>
                    {' '}({item.gender_preference === 'everyone' ? 'Everyone' : item.gender_preference.charAt(0).toUpperCase() + item.gender_preference.slice(1)})
                  </Text>
                )}
              </Text>
            </View>
          )}

          {item.special_requests && (
            <View style={styles.specialRequests}>
              <Text style={styles.specialRequestsLabel}>Special Requests:</Text>
              <Text style={styles.specialRequestsText}>{item.special_requests}</Text>
            </View>
          )}

          {item.status === 'pending' && isReceived && (
            <View style={styles.responseActions}>
              <TouchableOpacity
                style={[styles.responseButton, styles.acceptButton]}
                onPress={() => handleRespond(item.id, 'accepted')}
                disabled={respondMutation.isPending}
              >
                <Check size={20} color="#fff" />
                <Text style={styles.responseButtonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.responseButton, styles.declineButton]}
                onPress={() => handleRespond(item.id, 'declined')}
                disabled={respondMutation.isPending}
              >
                <X size={20} color="#fff" />
                <Text style={styles.responseButtonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}

          {item.response_message && (
            <View style={styles.responseMessage}>
              <Text style={styles.responseMessageLabel}>Response:</Text>
              <Text style={styles.responseMessageText}>{item.response_message}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Date Requests',
          headerShown: true,
        }} 
      />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'received' && styles.tabActive]}
            onPress={() => setActiveTab('received')}
          >
            <Text style={[styles.tabText, activeTab === 'received' && styles.tabTextActive]}>
              Received ({dateRequests?.filter((r: any) => r.to_user_id === currentUserId).length || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
            onPress={() => setActiveTab('sent')}
          >
            <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
              Sent ({dateRequests?.filter((r: any) => r.from_user_id === currentUserId).length || 0})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredRequests}
          renderItem={renderDateRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Calendar size={64} color={colors.text.tertiary} />
              <Text style={styles.emptyListText}>
                {activeTab === 'sent' 
                  ? 'You haven\'t sent any date requests yet'
                  : 'No date requests received'}
              </Text>
            </View>
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
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
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      gap: 20,
    },
    emptyTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    listContent: {
      padding: 20,
    },
    requestCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    requestHeader: {
      marginBottom: 16,
    },
    requestUserInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    userAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    requestUserDetails: {
      flex: 1,
    },
    requestUserName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    statusBadge: {
      alignSelf: 'flex-start',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    requestContent: {
      gap: 12,
    },
    requestTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    requestDescription: {
      fontSize: 16,
      color: colors.text.secondary,
      lineHeight: 22,
    },
    requestDetails: {
      gap: 8,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border.light,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
      color: colors.text.primary,
    },
    activitiesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    activityTag: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    activityText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },
    metaRow: {
      flexDirection: 'row',
      gap: 8,
    },
    metaLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    metaValue: {
      fontSize: 14,
      color: colors.text.primary,
    },
    specialRequests: {
      backgroundColor: colors.background.primary,
      padding: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    specialRequestsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    specialRequestsText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    responseActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    responseButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },
    acceptButton: {
      backgroundColor: colors.success,
    },
    declineButton: {
      backgroundColor: colors.danger,
    },
    responseButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    responseMessage: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border.light,
    },
    responseMessageLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    responseMessageText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    tabTextActive: {
      color: '#fff',
    },
    sentActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    cancelActionButton: {
      borderColor: colors.danger,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    cancelActionText: {
      color: colors.danger,
    },
    emptyListContainer: {
      paddingVertical: 60,
      alignItems: 'center',
      gap: 16,
    },
    emptyListText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  });

