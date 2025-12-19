import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Shield, Heart, CheckCircle2, Clock, Plus, AlertCircle, Award, Calendar, Settings } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function HomeScreen() {
  const router = useRouter();
  const { currentUser, isLoading, getCurrentUserRelationship, getPendingRequests } = useApp();
  const { colors } = useTheme();
  const relationship = getCurrentUserRelationship();
  const pendingRequests = getPendingRequests();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>Please log in to continue</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getRelationshipTypeLabel = (type: string) => {
    const labels = {
      married: 'Married',
      engaged: 'Engaged',
      serious: 'Serious Relationship',
      dating: 'Dating',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getVerificationCount = () => {
    return Object.values(currentUser.verifications).filter(Boolean).length;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{currentUser.fullName.split(' ')[0]} 👋</Text>
          </View>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => router.push('/settings')}
          >
            {currentUser.profilePicture ? (
              <Image
                source={{ uri: currentUser.profilePicture }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {currentUser.fullName.charAt(0)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {pendingRequests.length > 0 && (
          <Animated.View
            style={[
              styles.notificationBanner,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.notificationBannerInner}
              onPress={() => router.push('/(tabs)/notifications')}
            >
              <AlertCircle size={20} color={colors.accent} />
              <Text style={styles.notificationText}>
                You have {pendingRequests.length} pending relationship{' '}
                {pendingRequests.length === 1 ? 'request' : 'requests'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Shield size={20} color={colors.primary} />
              <Text style={styles.cardTitle}>Relationship Status</Text>
            </View>
          </View>

          {relationship ? (
            <>
              <View style={styles.relationshipStatus}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      relationship.status === 'verified' && styles.statusBadgeVerified,
                      relationship.status === 'pending' && styles.statusBadgePending,
                    ]}
                  >
                    {relationship.status === 'verified' ? (
                      <CheckCircle2 size={14} color={colors.status.verified} />
                    ) : (
                      <Clock size={14} color={colors.status.pending} />
                    )}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        relationship.status === 'verified' &&
                          styles.statusBadgeTextVerified,
                        relationship.status === 'pending' &&
                          styles.statusBadgeTextPending,
                      ]}
                    >
                      {relationship.status === 'verified'
                        ? 'Verified'
                        : 'Pending Confirmation'}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.relationshipDetails}>
                  <Heart
                    size={48}
                    color={colors.danger}
                    fill={colors.danger}
                    style={styles.heartIcon}
                  />
                  <Text style={styles.partnerName}>{relationship.partnerName}</Text>
                  <Text style={styles.relationshipType}>
                    {getRelationshipTypeLabel(relationship.type)}
                  </Text>
                  <Text style={styles.relationshipDate}>
                    Since {new Date(relationship.startDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                {relationship.status === 'pending' && (
                  <View style={styles.pendingNote}>
                    <Text style={styles.pendingNoteText}>
                      Waiting for {relationship.partnerName} to confirm this relationship
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.noRelationship}>
              <Heart size={48} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.noRelationshipTitle}>No Active Relationship</Text>
              <Text style={styles.noRelationshipText}>
                Register your relationship to verify your status and build trust
              </Text>
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => router.push('/relationship/register')}
              >
                <Plus size={20} color={colors.text.white} />
                <Text style={styles.registerButtonText}>Register Relationship</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <Animated.View 
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <CheckCircle2 size={20} color={colors.secondary} />
              <Text style={styles.cardTitle}>Verification Status</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/verification' as any)}
            >
              <Text style={styles.cardLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.verificationProgress}>
            {getVerificationCount()} of 3 verified
          </Text>

          <View style={styles.verificationList}>
            <View style={styles.verificationItem}>
              <View style={styles.verificationLeft}>
                <View
                  style={[
                    styles.verificationIcon,
                    currentUser.verifications.phone &&
                      styles.verificationIconVerified,
                  ]}
                >
                  {currentUser.verifications.phone && (
                    <CheckCircle2 size={16} color={colors.secondary} />
                  )}
                </View>
                <Text style={styles.verificationLabel}>Phone Number</Text>
              </View>
              {currentUser.verifications.phone && (
                <Text style={styles.verifiedText}>Verified</Text>
              )}
            </View>

            <View style={styles.verificationItem}>
              <View style={styles.verificationLeft}>
                <View
                  style={[
                    styles.verificationIcon,
                    currentUser.verifications.email &&
                      styles.verificationIconVerified,
                  ]}
                >
                  {currentUser.verifications.email && (
                    <CheckCircle2 size={16} color={colors.secondary} />
                  )}
                </View>
                <Text style={styles.verificationLabel}>Email Address</Text>
              </View>
              {currentUser.verifications.email && (
                <Text style={styles.verifiedText}>Verified</Text>
              )}
            </View>

            <View style={styles.verificationItem}>
              <View style={styles.verificationLeft}>
                <View
                  style={[
                    styles.verificationIcon,
                    currentUser.verifications.id && styles.verificationIconVerified,
                  ]}
                >
                  {currentUser.verifications.id && (
                    <CheckCircle2 size={16} color={colors.secondary} />
                  )}
                </View>
                <Text style={styles.verificationLabel}>Government ID</Text>
              </View>
              {currentUser.verifications.id && (
                <Text style={styles.verifiedText}>Verified</Text>
              )}
            </View>
          </View>
        </Animated.View>

        {relationship && relationship.status === 'verified' && (
          <>
            <Animated.View 
              style={[
                styles.actionsCard,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <Text style={styles.actionsTitle}>Relationship Tools</Text>
              <View style={styles.actionsGrid}>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => router.push(`/certificates/${relationship.id}` as any)}
                >  
                  <View style={styles.actionIconContainer}>
                    <Award size={24} color={colors.primary} />
                  </View>
                  <Text style={styles.actionLabel}>Certificate</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => router.push(`/anniversary/${relationship.id}` as any)}
                >
                  <View style={styles.actionIconContainer}>
                    <Calendar size={24} color={colors.accent} />
                  </View>
                  <Text style={styles.actionLabel}>Anniversary</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            <Animated.View 
              style={[
                styles.infoCard,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              <Shield size={20} color={colors.primary} />
              <Text style={styles.infoText}>
                Your relationship is verified and publicly visible. Others can now
                search and see your committed status.
              </Text>
            </Animated.View>
          </>
        )}

        {(currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator') && (
          <Animated.View
            style={[
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <TouchableOpacity
              style={styles.adminCard}
              onPress={() => router.push('/admin' as any)}
            >
              <View style={styles.adminCardContent}>
                <View style={styles.adminIconContainer}>
                  <Settings size={28} color={colors.primary} />
                </View>
                <View style={styles.adminTextContainer}>
                  <Text style={styles.adminCardTitle}>Admin Dashboard</Text>
                  <Text style={styles.adminCardSubtitle}>
                    {currentUser.role === 'super_admin' ? 'Super Admin' : 
                     currentUser.role === 'admin' ? 'Admin' : 'Moderator'} Control Panel
                  </Text>
                </View>
                <Shield size={24} color={colors.text.white} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
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
    fontWeight: '500' as const,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  name: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginTop: 4,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 52,
    height: 52,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  notificationBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  notificationBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.badge.pending,
    padding: 16,
    borderRadius: 16,
    gap: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  notificationText: {
    flex: 1,
    fontSize: 14,
    color: colors.badge.pendingText,
    fontWeight: '600' as const,
  },
  card: {
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  cardSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  cardLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  verificationProgress: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 20,
  },
  relationshipStatus: {
    gap: 0,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600' as const,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeVerified: {
    backgroundColor: colors.badge.verified,
  },
  statusBadgePending: {
    backgroundColor: colors.badge.pending,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  statusBadgeTextVerified: {
    color: colors.badge.verifiedText,
  },
  statusBadgeTextPending: {
    color: colors.badge.pendingText,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginBottom: 24,
  },
  relationshipDetails: {
    alignItems: 'center',
  },
  heartIcon: {
    marginBottom: 16,
  },
  partnerName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  relationshipType: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  relationshipDate: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  pendingNote: {
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
  },
  pendingNoteText: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  noRelationship: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noRelationshipTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  noRelationshipText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  verificationList: {
    gap: 16,
  },
  verificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationIconVerified: {
    backgroundColor: colors.badge.verified,
  },
  verificationLabel: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '500' as const,
  },
  verifiedText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '600' as const,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  actionsCard: {
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionItem: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  adminCard: {
    backgroundColor: colors.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  adminCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adminIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.text.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTextContainer: {
    flex: 1,
  },
  adminCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
    marginBottom: 4,
  },
  adminCardSubtitle: {
    fontSize: 14,
    color: colors.text.white,
    opacity: 0.9,
  },
});
