import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, Heart, Shield, UserPlus, UserMinus, MessageCircle, Grid, Film, X, UserX, MoreVertical, Flag } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { User, Post, Reel } from '@/types';
import { supabase } from '@/lib/supabase';
import ReportContentModal from '@/components/ReportContentModal';
import StatusIndicator from '@/components/StatusIndicator';

const { width } = Dimensions.get('window');
const itemWidth = (width - 44) / 3;

type TabType = 'posts' | 'reels';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { currentUser, getUserRelationship, posts: allPosts, reels: allReels, createOrGetConversation, followUser, unfollowUser, isFollowing: checkIsFollowing, blockUser, unblockUser, isBlocked: checkIsBlocked, reportContent, getUserStatus, userStatuses } = useApp();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followerCount, setFollowerCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userReels, setUserReels] = useState<Reel[]>([]);
  const [viewingImages, setViewingImages] = useState<{ urls: string[]; index: number } | null>(null);
  const [viewingReel, setViewingReel] = useState<Reel | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [reportingProfile, setReportingProfile] = useState(false);
  const [userStatus, setUserStatus] = useState<any>(null);
  const imageViewerScrollRef = useRef<ScrollView>(null);
  
  const relationship = user ? getUserRelationship(user.id) : null;

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      checkFollowStatus();
      loadFollowCounts();
      checkBlockStatus();
      loadUserStatus();
    }
  }, [userId, checkIsFollowing, checkIsBlocked]);

  // Load user status
  const loadUserStatus = async () => {
    if (userId && getUserStatus) {
      const status = await getUserStatus(userId);
      setUserStatus(status);
    }
  };

  useEffect(() => {
    loadUserStatus();
  }, [userId, getUserStatus]);

  // Subscribe to real-time status updates and refresh periodically
  useEffect(() => {
    if (!userId || !getUserStatus) return;

    // Load status immediately
    const refreshStatus = async () => {
      const status = await getUserStatus(userId);
      setUserStatus(status);
    };
    refreshStatus();

    let isMounted = true;

    // Refresh status every 30 seconds to recalculate based on last_active_at
    const refreshInterval = setInterval(() => {
      if (isMounted) {
        refreshStatus();
      }
    }, 30 * 1000);

    const channel = supabase
      .channel(`user_status:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_status',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const status = await getUserStatus(userId);
          if (isMounted) {
            setUserStatus(status);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [userId, getUserStatus]);

  useEffect(() => {
    loadUserContent();
  }, [allPosts, allReels, userId]);

  // Sync local isFollowing state with AppContext's isFollowing function
  useEffect(() => {
    if (userId && currentUser) {
      setIsFollowing(checkIsFollowing(userId));
    }
  }, [userId, currentUser, checkIsFollowing]);

  const checkBlockStatus = () => {
    if (userId && currentUser) {
      setIsBlocked(checkIsBlocked(userId));
    }
  };

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (data) {
        const userProfile: User = {
          id: data.id,
          fullName: data.full_name,
          email: data.email,
          phoneNumber: data.phone_number,
          profilePicture: data.profile_picture,
          role: data.role,
          verifications: {
            phone: data.phone_verified,
            email: data.email_verified,
            id: data.id_verified,
          },
          createdAt: data.created_at,
        };
        setUser(userProfile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserContent = () => {
    const posts = allPosts.filter(p => p.userId === userId);
    const reels = allReels.filter(r => r.userId === userId);
    setUserPosts(posts);
    setUserReels(reels);
  };

  const checkFollowStatus = async () => {
    if (!currentUser || !userId) return;
    // Use AppContext's isFollowing function to check follow status
    setIsFollowing(checkIsFollowing(userId));
  };

  const loadFollowCounts = async () => {
    if (!userId) return;
    try {
      const { count: followers } = await supabase
        .from('follows')
        .select('id', { count: 'exact' })
        .eq('following_id', userId);
      
      const { count: following } = await supabase
        .from('follows')
        .select('id', { count: 'exact' })
        .eq('follower_id', userId);
      
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);
    } catch (error) {
      console.error('Failed to load follow counts:', error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !userId) return;
    try {
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else {
        await followUser(userId);
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
    } catch (error: any) {
      console.error('Failed to toggle follow:', error?.message || error);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !userId || currentUser.id === userId) return;
    
    try {
      const conversation = await createOrGetConversation(userId);
      if (conversation) {
        router.push(`/messages/${conversation.id}` as any);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  const handleBlock = async () => {
    if (!currentUser || !userId || currentUser.id === userId) return;
    
    if (isBlocked) {
      // Unblock
      Alert.alert(
        'Unblock User',
        `Are you sure you want to unblock ${user?.fullName}? They will be able to see your profile and send you messages again.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setShowBlockMenu(false) },
          {
            text: 'Unblock',
            style: 'default',
            onPress: async () => {
              try {
                setIsBlocking(true);
                await unblockUser(userId);
                setIsBlocked(false);
                Alert.alert('Success', `${user?.fullName} has been unblocked.`);
                setShowBlockMenu(false);
              } catch (error: any) {
                console.error('Failed to unblock user:', error);
                Alert.alert('Error', error.message || 'Failed to unblock user. Please try again.');
              } finally {
                setIsBlocking(false);
              }
            },
          },
        ]
      );
    } else {
      // Block
      Alert.alert(
        'Block User',
        `Are you sure you want to block ${user?.fullName}? They won't be able to see your profile, send you messages, or interact with your content.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setShowBlockMenu(false) },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsBlocking(true);
                await blockUser(userId);
                setIsBlocked(true);
                Alert.alert('Success', `${user?.fullName} has been blocked.`, [
                  { text: 'OK', onPress: () => router.back() }
                ]);
                setShowBlockMenu(false);
              } catch (error: any) {
                console.error('Failed to block user:', error);
                Alert.alert('Error', error.message || 'Failed to block user. Please try again.');
              } finally {
                setIsBlocking(false);
              }
            },
          },
        ]
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>User not found</Text>
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

  const handlePostPress = (post: Post) => {
    const imageUrls = post.mediaUrls.filter(url => {
      const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('video');
      return !isVideo;
    });
    if (imageUrls.length > 0) {
      setViewingImages({ urls: imageUrls, index: 0 });
    }
  };

  const handleReelPress = (reel: Reel) => {
    setViewingReel(reel);
  };

  const renderPostGrid = () => {
    if (activeTab === 'posts') {
      if (userPosts.length === 0) {
        return (
          <View style={styles.emptyContent}>
            <Grid size={48} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyContentText}>No posts yet</Text>
          </View>
        );
      }
      return (
        <FlatList
          data={userPosts}
          numColumns={3}
          key="posts"
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.gridItem}
              onPress={() => handlePostPress(item)}
              activeOpacity={0.8}
            >
              {item.mediaUrls[0] ? (
                <Image source={{ uri: item.mediaUrls[0] }} style={styles.gridImage} contentFit="cover" />
              ) : (
                <View style={[styles.gridImage, styles.gridPlaceholder]}>
                  <Text style={styles.gridPlaceholderText} numberOfLines={3}>{item.content}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      );
    } else {
      if (userReels.length === 0) {
        return (
          <View style={styles.emptyContent}>
            <Film size={48} color={colors.text.tertiary} strokeWidth={1.5} />
            <Text style={styles.emptyContentText}>No reels yet</Text>
          </View>
        );
      }
      return (
        <FlatList
          data={userReels}
          numColumns={3}
          key="reels"
          scrollEnabled={false}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.gridItem}
              onPress={() => handleReelPress(item)}
              activeOpacity={0.8}
            >
              {item.thumbnailUrl ? (
                <Image source={{ uri: item.thumbnailUrl }} style={styles.gridImage} contentFit="cover" />
              ) : (
                <View style={[styles.gridImage, styles.gridPlaceholder]}>
                  <Film size={32} color={colors.text.white} />
                </View>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      );
    }
  };

  const isOwnProfile = currentUser?.id === userId;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {user.fullName.charAt(0)}
                </Text>
              </View>
            )}
            {userStatus && (
              <StatusIndicator 
                status={userStatus.statusType} 
                size="medium" 
                showBorder={true}
              />
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{user.fullName}</Text>
              {user.verifications.phone && (
                <CheckCircle2 size={20} color={colors.secondary} />
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{userPosts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followerCount}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{followingCount}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

            {!isOwnProfile && (
              <View style={styles.actionButtons}>
                {!isBlocked ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionButton, isFollowing ? styles.actionButtonUnfollow : styles.actionButtonFollow]}
                      onPress={handleFollow}
                      activeOpacity={0.8}
                      disabled={isBlocking}
                    >
                      {isFollowing ? (
                        <UserMinus size={18} color={colors.text.primary} />
                      ) : (
                        <UserPlus size={18} color={colors.text.white} />
                      )}
                      <Text style={[styles.actionButtonText, isFollowing && styles.actionButtonTextUnfollow]}>
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionButtonMessage} 
                      onPress={handleMessage}
                      activeOpacity={0.8}
                      disabled={isBlocking}
                    >
                      <MessageCircle size={18} color={colors.primary} />
                      <Text style={styles.actionButtonTextMessage}>Message</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.blockedNotice}>
                    <Text style={styles.blockedNoticeText}>You have blocked this user</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.actionButtonMore}
                  onPress={() => setShowBlockMenu(true)}
                  activeOpacity={0.8}
                  disabled={isBlocking}
                >
                  <MoreVertical size={20} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.verificationBadges}>
              {user.verifications.phone && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Phone Verified</Text>
                </View>
              )}
              {user.verifications.email && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Email Verified</Text>
                </View>
              )}
              {user.verifications.id && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>ID Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleContainer}>
              <Heart size={20} color={colors.danger} />
              <Text style={styles.cardTitle}>Relationship Status</Text>
            </View>
          </View>

          {relationship ? (
            <>
              <View
                style={[
                  styles.statusBanner,
                  relationship.status === 'verified'
                    ? styles.statusBannerVerified
                    : styles.statusBannerPending,
                ]}
              >
                <Shield size={20} color={relationship.status === 'verified' ? colors.secondary : colors.accent} />
                <Text
                  style={[
                    styles.statusBannerText,
                    relationship.status === 'verified'
                      ? styles.statusTextVerified
                      : styles.statusTextPending,
                  ]}
                >
                  {relationship.status === 'verified'
                    ? 'Verified Relationship'
                    : 'Pending Verification'}
                </Text>
              </View>

              <View style={styles.relationshipDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>
                    In a {getRelationshipTypeLabel(relationship.type).toLowerCase()}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Partner</Text>
                  <Text style={styles.detailValue}>{relationship.partnerName}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Since</Text>
                  <Text style={styles.detailValue}>
                    {new Date(relationship.startDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                {relationship.status === 'verified' && relationship.verifiedDate && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Verified On</Text>
                    <Text style={styles.detailValue}>
                      {new Date(relationship.verifiedDate).toLocaleDateString(
                        'en-US',
                        {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        }
                      )}
                    </Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.noRelationship}>
              <Heart size={48} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.noRelationshipText}>
                No registered relationship
              </Text>
            </View>
          )}
        </View>

        {relationship && relationship.status === 'verified' && (
          <View style={styles.infoCard}>
            <Shield size={18} color={colors.secondary} />
            <Text style={styles.infoText}>
              This relationship has been verified by both partners. The information
              displayed is accurate as of the verification date.
            </Text>
          </View>
        )}

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Grid size={20} color={activeTab === 'posts' ? colors.primary : colors.text.tertiary} />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reels' && styles.tabActive]}
            onPress={() => setActiveTab('reels')}
          >
            <Film size={20} color={activeTab === 'reels' ? colors.primary : colors.text.tertiary} />
            <Text style={[styles.tabText, activeTab === 'reels' && styles.tabTextActive]}>Reels</Text>
          </TouchableOpacity>
        </View>

        {renderPostGrid()}
      </ScrollView>

      {/* Full-screen Image Viewer Modal */}
      {viewingImages && (
        <Modal
          visible={!!viewingImages}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingImages(null)}
        >
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => setViewingImages(null)}
            >
              <X size={24} color={colors.text.white} />
            </TouchableOpacity>
            
            <ScrollView
              ref={imageViewerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setViewingImages(prev => prev ? { ...prev, index: newIndex } : null);
              }}
              style={styles.imageViewerScroll}
              contentOffset={{ x: viewingImages.index * Dimensions.get('window').width, y: 0 }}
            >
              {viewingImages.urls.map((url, index) => (
                <View key={index} style={styles.imageViewerItem}>
                  <Image
                    source={{ uri: url }}
                    style={styles.imageViewerImage}
                    contentFit="contain"
                  />
                </View>
              ))}
            </ScrollView>
            
            {viewingImages.urls.length > 1 && (
              <View style={styles.imageViewerIndicator}>
                <Text style={styles.imageViewerIndicatorText}>
                  {viewingImages.index + 1} / {viewingImages.urls.length}
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* Reel Viewer Modal */}
      {viewingReel && (
        <Modal
          visible={!!viewingReel}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setViewingReel(null)}
        >
          <View style={styles.reelViewerContainer}>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => setViewingReel(null)}
            >
              <X size={24} color={colors.text.white} />
            </TouchableOpacity>
            
            <Video
              source={{ uri: viewingReel.videoUrl }}
              style={styles.reelViewerVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          </View>
        </Modal>
      )}

      {/* Block Menu Modal */}
      <Modal
        visible={showBlockMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowBlockMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBlockMenu(false)}
        >
          <View style={styles.blockMenuContainer}>
            <TouchableOpacity
              style={styles.blockMenuItem}
              onPress={handleBlock}
              disabled={isBlocking}
            >
              <UserX size={20} color={isBlocked ? colors.primary : colors.danger} />
              <Text style={[styles.blockMenuText, isBlocked && styles.blockMenuTextUnblock]}>
                {isBlocked ? 'Unblock' : 'Block'} {user?.fullName}
              </Text>
            </TouchableOpacity>
            {!isOwnProfile && (
              <TouchableOpacity
                style={styles.blockMenuItem}
                onPress={() => {
                  setShowBlockMenu(false);
                  setReportingProfile(true);
                }}
              >
                <Flag size={20} color={colors.danger} />
                <Text style={styles.blockMenuText}>Report {user?.fullName}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.blockMenuCancel}
              onPress={() => setShowBlockMenu(false)}
            >
              <Text style={styles.blockMenuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Profile Modal */}
      {user && (
        <ReportContentModal
          visible={reportingProfile}
          onClose={() => setReportingProfile(false)}
          contentType="profile"
          reportedUserId={user.id}
          onReport={reportContent}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  profileInfo: {
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  verificationBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: colors.badge.verified,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.badge.verifiedText,
  },
  card: {
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    marginBottom: 16,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusBannerVerified: {
    backgroundColor: colors.badge.verified,
  },
  statusBannerPending: {
    backgroundColor: colors.badge.pending,
  },
  statusBannerText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  statusTextVerified: {
    color: colors.badge.verifiedText,
  },
  statusTextPending: {
    color: colors.badge.pendingText,
  },
  relationshipDetails: {
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 15,
    color: colors.text.secondary,
    fontWeight: '500' as const,
  },
  detailValue: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600' as const,
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  noRelationship: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noRelationshipText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginTop: 16,
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginVertical: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 12,
    marginBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'stretch',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 44,
  },
  actionButtonFollow: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonUnfollow: {
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  actionButtonMessage: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.background.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    minHeight: 44,
  },
  actionButtonMore: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border.light,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.white,
    letterSpacing: 0.2,
  },
  actionButtonTextUnfollow: {
    color: colors.text.primary,
  },
  actionButtonTextMessage: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.background.secondary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  gridItem: {
    width: itemWidth,
    height: itemWidth,
    margin: 2,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.secondary,
  },
  gridPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  gridPlaceholderText: {
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyContentText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 16,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerScroll: {
    flex: 1,
  },
  imageViewerItem: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageViewerIndicator: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageViewerIndicatorText: {
    color: colors.text.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  reelViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelViewerVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockMenuContainer: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 16,
    width: '80%',
    maxWidth: 300,
  },
  blockMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background.secondary,
  },
  blockMenuText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.danger,
  },
  blockMenuTextUnblock: {
    color: colors.primary,
  },
  blockMenuCancel: {
    marginTop: 12,
    padding: 16,
    alignItems: 'center',
  },
  blockMenuCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  blockedNotice: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  blockedNoticeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
});
