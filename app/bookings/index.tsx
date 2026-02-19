import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Phone,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  RefreshCw,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { getUserBookings, rescheduleBooking, cancelBooking } from '@/lib/professional-bookings';
import { ProfessionalSession } from '@/types';
import { colors } from '@/constants/colors';

export default function BookingsScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [bookings, setBookings] = useState<ProfessionalSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  useEffect(() => {
    if (currentUser) {
      loadBookings();
    }
  }, [currentUser, filter]);

  const loadBookings = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const allBookings = await getUserBookings(currentUser.id);
      
      const now = new Date();
      let filtered = allBookings;

      if (filter === 'upcoming') {
        filtered = allBookings.filter(
          (b) => b.scheduledDate && new Date(b.scheduledDate) >= now && b.status !== 'cancelled' && b.status !== 'completed'
        );
      } else if (filter === 'past') {
        filtered = allBookings.filter(
          (b) => !b.scheduledDate || new Date(b.scheduledDate) < now || b.status === 'completed'
        );
      }

      setBookings(filtered);
    } catch (error: any) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return themeColors.status.verified || themeColors.secondary;
      case 'scheduled':
        return themeColors.primary;
      case 'cancelled':
        return themeColors.danger;
      default:
        return themeColors.text.tertiary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return <CheckCircle2 size={16} color={getStatusColor(status)} />;
      case 'cancelled':
        return <XCircle size={16} color={getStatusColor(status)} />;
      default:
        return <AlertCircle size={16} color={getStatusColor(status)} />;
    }
  };

  const getLocationIcon = (locationType?: string) => {
    switch (locationType) {
      case 'in_person':
        return <MapPin size={18} color={themeColors.text.secondary} />;
      case 'video':
        return <Video size={18} color={themeColors.text.secondary} />;
      case 'phone':
        return <Phone size={18} color={themeColors.text.secondary} />;
      default:
        return <Video size={18} color={themeColors.text.secondary} />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleReschedule = (booking: ProfessionalSession) => {
    router.push({
      pathname: '/bookings/reschedule',
      params: { sessionId: booking.id },
    } as any);
  };

  const handleCancel = async (booking: ProfessionalSession) => {
    // In a real app, you'd show a confirmation dialog
    const result = await cancelBooking({
      sessionId: booking.id,
      reason: 'Cancelled by user',
      requestedBy: 'user',
    });

    if (result.success) {
      loadBookings();
    }
  };

  const handleMessage = async (booking: ProfessionalSession) => {
    if (!booking.conversationId) {
      Alert.alert('Error', 'No conversation found for this booking. Please contact support.');
      return;
    }

    // Navigate to conversation for booking-related messaging
    router.push(`/messages/${booking.conversationId}`);
  };

  const renderBookingItem = ({ item }: { item: ProfessionalSession }) => {
    const isUpcoming = item.scheduledDate && new Date(item.scheduledDate) >= new Date();
    const canReschedule = isUpcoming && item.status !== 'cancelled' && item.status !== 'completed';
    const canCancel = isUpcoming && item.status !== 'cancelled' && item.status !== 'completed';

    return (
      <View style={styles.bookingCard}>
        <View style={styles.bookingHeader}>
          <View style={styles.professionalInfo}>
            <View style={styles.professionalAvatar}>
              <User size={20} color={themeColors.text.secondary} />
            </View>
            <View style={styles.professionalDetails}>
              <Text style={styles.professionalName}>
                {item.professional?.fullName || 'Professional'}
              </Text>
              <Text style={styles.professionalRole}>
                {item.role?.name || 'Professional'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            {getStatusIcon(item.status)}
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Calendar size={18} color={themeColors.text.secondary} />
            <Text style={styles.detailText}>{formatDate(item.scheduledDate)}</Text>
          </View>

          {item.scheduledDurationMinutes && (
            <View style={styles.detailRow}>
              <Clock size={18} color={themeColors.text.secondary} />
              <Text style={styles.detailText}>{item.scheduledDurationMinutes} minutes</Text>
            </View>
          )}

          {item.locationType && (
            <View style={styles.detailRow}>
              {getLocationIcon(item.locationType)}
              <Text style={styles.detailText}>
                {item.locationType === 'in_person' ? 'In-Person' : item.locationType === 'video' ? 'Video Call' : 'Phone Call'}
                {item.locationAddress && ` • ${item.locationAddress}`}
              </Text>
            </View>
          )}

          {item.bookingFeeAmount && (
            <View style={styles.detailRow}>
              <Text style={styles.feeText}>
                {item.bookingFeeCurrency} {item.bookingFeeAmount.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {item.locationNotes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesText}>{item.locationNotes}</Text>
          </View>
        )}

        <View style={styles.bookingActions}>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => handleMessage(item)}
          >
            <MessageSquare size={18} color={themeColors.primary} />
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>

          {canReschedule && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleReschedule(item)}
            >
              <RefreshCw size={18} color={themeColors.accent} />
              <Text style={[styles.actionButtonText, { color: themeColors.accent }]}>Reschedule</Text>
            </TouchableOpacity>
          )}

          {canCancel && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCancel(item)}
            >
              <XCircle size={18} color={themeColors.danger} />
              <Text style={[styles.actionButtonText, { color: themeColors.danger }]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && bookings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'My Bookings' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'My Bookings',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/bookings/create' as any)}
              style={{ marginRight: 16 }}
            >
              <Text style={{ color: themeColors.primary, fontSize: 16, fontWeight: '600' }}>
                + Book
              </Text>
            </TouchableOpacity>
          ),
        }} 
      />

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(['upcoming', 'past', 'all'] as const).map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[styles.filterTab, filter === filterType && styles.filterTabActive]}
            onPress={() => setFilter(filterType)}
          >
            <Text style={[
              styles.filterTabText,
              filter === filterType && styles.filterTabTextActive,
            ]}>
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Calendar size={64} color={themeColors.text.tertiary} />
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptyText}>
            {filter === 'upcoming'
              ? "You don't have any upcoming bookings"
              : filter === 'past'
              ? "You don't have any past bookings"
              : "You don't have any bookings yet"}
          </Text>
          {filter !== 'past' && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/bookings/create' as any)}
            >
              <Text style={styles.createButtonText}>Create Your First Booking</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.text.white,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  professionalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  professionalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  professionalDetails: {
    flex: 1,
  },
  professionalName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  professionalRole: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDetails: {
    gap: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    fontSize: 14,
    color: colors.text.primary,
    flex: 1,
  },
  feeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  notesContainer: {
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

