import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Search, Shield, Ban, CheckCircle, XCircle, Eye, Trash2, Users, Heart, Sparkles } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function AdminDatingScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [activeTab, setActiveTab] = useState<'profiles' | 'matches' | 'likes' | 'stats'>('profiles');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [likes, setLikes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'profiles') loadProfiles();
    if (activeTab === 'matches') loadMatches();
    if (activeTab === 'likes') loadLikes();
    if (activeTab === 'stats') loadStats();
  }, [activeTab]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: profilesError } = await supabase
        .from('dating_profiles')
        .select(`
          *,
          users!dating_profiles_user_id_fkey(id, full_name, email, profile_picture, phone_verified, email_verified, id_verified)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (profilesError) throw profilesError;

      // Load badges for each profile
      if (profilesData && profilesData.length > 0) {
        const userIds = profilesData.map(p => p.user_id);
        const { data: badgesData } = await supabase
          .from('user_dating_badges')
          .select('user_id, badge_type')
          .in('user_id', userIds);

        // Attach badges to profiles
        const profilesWithBadges = profilesData.map(profile => ({
          ...profile,
          badges: badgesData?.filter(b => b.user_id === profile.user_id).map(b => b.badge_type) || [],
        }));

        setProfiles(profilesWithBadges);
      } else {
        setProfiles([]);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dating_matches')
        .select(`
          *,
          user1:users!dating_matches_user1_id_fkey(id, full_name, profile_picture),
          user2:users!dating_matches_user2_id_fkey(id, full_name, profile_picture)
        `)
        .eq('is_unmatched', false)
        .order('matched_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setMatches(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLikes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dating_likes')
        .select(`
          *,
          liker:users!dating_likes_liker_id_fkey(id, full_name, profile_picture),
          liked:users!dating_likes_liked_id_fkey(id, full_name, profile_picture)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLikes(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const [profilesRes, matchesRes, likesRes, activeRes] = await Promise.all([
        supabase.from('dating_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('dating_matches').select('id', { count: 'exact', head: true }).eq('is_unmatched', false),
        supabase.from('dating_likes').select('id', { count: 'exact', head: true }),
        supabase.from('dating_profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      setStats({
        totalProfiles: profilesRes.count || 0,
        activeProfiles: activeRes.count || 0,
        totalMatches: matchesRes.count || 0,
        totalLikes: likesRes.count || 0,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'suspend' | 'limit' | 'delete' | 'premium' | 'badge' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [trialDays, setTrialDays] = useState('7');
  const [badgeType, setBadgeType] = useState<'verified' | 'good_conversationalist' | 'replies_fast' | 'respectful_member' | 'active_member' | 'premium'>('verified');

  const deactivateProfile = async (profileId: string, userId: string) => {
    Alert.alert(
      'Deactivate Profile',
      'Are you sure you want to deactivate this dating profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('dating_profiles')
                .update({ is_active: false, show_me: false })
                .eq('id', profileId);

              if (error) throw error;
              Alert.alert('Success', 'Profile deactivated');
              loadProfiles();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleSuspendProfile = async (profile: any) => {
    try {
      const { error } = await supabase
        .from('dating_profiles')
        .update({
          admin_suspended: true,
          admin_suspended_at: new Date().toISOString(),
          admin_suspended_by: currentUser?.id,
          admin_suspended_reason: actionReason || 'No reason provided',
          is_active: false,
        })
        .eq('id', profile.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile suspended');
      setShowActionModal(false);
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUnsuspendProfile = async (profile: any) => {
    try {
      const { error } = await supabase
        .from('dating_profiles')
        .update({
          admin_suspended: false,
          admin_suspended_at: null,
          admin_suspended_by: null,
          admin_suspended_reason: null,
          is_active: true,
        })
        .eq('id', profile.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile unsuspended');
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLimitProfile = async (profile: any) => {
    try {
      const { error } = await supabase
        .from('dating_profiles')
        .update({
          admin_limited: true,
          admin_limited_at: new Date().toISOString(),
          admin_limited_by: currentUser?.id,
          admin_limited_reason: actionReason || 'No reason provided',
        })
        .eq('id', profile.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile limited');
      setShowActionModal(false);
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUnlimitProfile = async (profile: any) => {
    try {
      const { error } = await supabase
        .from('dating_profiles')
        .update({
          admin_limited: false,
          admin_limited_at: null,
          admin_limited_by: null,
          admin_limited_reason: null,
        })
        .eq('id', profile.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile limits removed');
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteProfile = async (profile: any) => {
    Alert.alert(
      'Delete Profile',
      'Are you sure you want to permanently delete this dating profile? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete photos and videos first
              const { data: photos } = await supabase
                .from('dating_photos')
                .select('photo_url')
                .eq('dating_profile_id', profile.id);

              const { data: videos } = await supabase
                .from('dating_videos')
                .select('video_url, thumbnail_url')
                .eq('dating_profile_id', profile.id);

              // Delete from storage
              if (photos) {
                for (const photo of photos) {
                  if (photo.photo_url && photo.photo_url.includes('supabase.co/storage')) {
                    try {
                      const urlParts = photo.photo_url.split('/storage/v1/object/public/');
                      if (urlParts.length === 2) {
                        const pathParts = urlParts[1].split('/');
                        const bucket = pathParts[0];
                        const filePath = pathParts.slice(1).join('/');
                        await supabase.storage.from(bucket).remove([filePath]);
                      }
                    } catch (e) {
                      console.warn('Error deleting photo:', e);
                    }
                  }
                }
              }

              if (videos) {
                for (const video of videos) {
                  if (video.video_url && video.video_url.includes('supabase.co/storage')) {
                    try {
                      const urlParts = video.video_url.split('/storage/v1/object/public/');
                      if (urlParts.length === 2) {
                        const pathParts = urlParts[1].split('/');
                        const bucket = pathParts[0];
                        const filePath = pathParts.slice(1).join('/');
                        await supabase.storage.from(bucket).remove([filePath]);
                      }
                    } catch (e) {
                      console.warn('Error deleting video:', e);
                    }
                  }
                }
              }

              // Delete the profile (cascade will handle related records)
              const { error } = await supabase
                .from('dating_profiles')
                .delete()
                .eq('id', profile.id);

              if (error) throw error;
              Alert.alert('Success', 'Profile deleted');
              setShowActionModal(false);
              loadProfiles();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleGrantPremium = async (profile: any) => {
    try {
      const days = parseInt(trialDays) || 7;
      if (!currentUser?.id) {
        Alert.alert('Error', 'You must be logged in to grant premium');
        return;
      }
      
      const { error } = await supabase.rpc('grant_trial_premium', {
        p_user_id: profile.user_id || profile.users?.id,
        p_granted_by: currentUser.id,
        p_days: days,
      });

      if (error) throw error;
      Alert.alert('Success', `Premium trial granted for ${days} days`);
      setShowActionModal(false);
      setActionReason('');
      setTrialDays('7');
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to grant premium trial');
    }
  };

  const handleGrantBadge = async (profile: any) => {
    try {
      const userId = profile.user_id || profile.users?.id;
      if (!userId) {
        Alert.alert('Error', 'Invalid user ID');
        return;
      }

      const { error } = await supabase
        .from('user_dating_badges')
        .upsert({
          user_id: userId,
          badge_type: badgeType,
          earned_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,badge_type',
        });

      if (error) throw error;
      Alert.alert('Success', `Badge "${badgeType.replace('_', ' ')}" granted`);
      setShowActionModal(false);
      setBadgeType('verified');
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to grant badge');
    }
  };

  const handleRemoveBadge = async (profile: any, badgeTypeToRemove: string) => {
    try {
      const userId = profile.user_id || profile.users?.id;
      if (!userId) {
        Alert.alert('Error', 'Invalid user ID');
        return;
      }

      const { error } = await supabase
        .from('user_dating_badges')
        .delete()
        .eq('user_id', userId)
        .eq('badge_type', badgeTypeToRemove);

      if (error) throw error;
      Alert.alert('Success', 'Badge removed');
      loadProfiles();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to remove badge');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Dating Management', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Dating Management', headerShown: true }} />
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profiles' && styles.tabActive]}
          onPress={() => setActiveTab('profiles')}
        >
          <Text style={[styles.tabText, activeTab === 'profiles' && styles.tabTextActive]}>Profiles</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text style={[styles.tabText, activeTab === 'matches' && styles.tabTextActive]}>Matches</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
          onPress={() => setActiveTab('likes')}
        >
          <Text style={[styles.tabText, activeTab === 'likes' && styles.tabTextActive]}>Likes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>Stats</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      {activeTab !== 'stats' && (
        <View style={styles.searchContainer}>
          <Search size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {activeTab === 'profiles' && (
            <View style={styles.list}>
              {profiles.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <Users size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>No profiles found</Text>
                </View>
              )}
              {profiles
                .filter((profile) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    profile.users?.full_name?.toLowerCase().includes(query) ||
                    profile.users?.email?.toLowerCase().includes(query)
                  );
                })
                .map((profile) => (
                  <View key={profile.id} style={styles.card}>
                    <Image
                      source={{ uri: profile.users?.profile_picture || 'https://via.placeholder.com/50' }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{profile.users?.full_name || 'Unknown'}</Text>
                      <Text style={styles.cardSubtitle}>{profile.users?.email || 'No email'}</Text>
                      <View style={styles.badges}>
                        {profile.users?.phone_verified && <CheckCircle size={16} color={colors.success} />}
                        {profile.users?.id_verified && <CheckCircle size={16} color={colors.primary} />}
                        {profile.is_active ? (
                          <Text style={styles.badgeText}>Active</Text>
                        ) : (
                          <Text style={[styles.badgeText, styles.badgeInactive]}>Inactive</Text>
                        )}
                        {profile.admin_suspended && (
                          <Text style={[styles.badgeText, { color: colors.danger }]}>Suspended</Text>
                        )}
                        {profile.admin_limited && (
                          <Text style={[styles.badgeText, { color: colors.warning || '#FFA500' }]}>Limited</Text>
                        )}
                        {profile.badges && profile.badges.length > 0 && (
                          <View style={styles.badgeList}>
                            {profile.badges.map((badge: string) => (
                              <TouchableOpacity
                                key={badge}
                                style={styles.badgeItem}
                                onPress={() => {
                                  Alert.alert(
                                    'Remove Badge',
                                    `Remove "${badge.replace('_', ' ')}" badge from this user?`,
                                    [
                                      { text: 'Cancel', style: 'cancel' },
                                      {
                                        text: 'Remove',
                                        style: 'destructive',
                                        onPress: () => handleRemoveBadge(profile, badge),
                                      },
                                    ]
                                  );
                                }}
                              >
                                <Text style={styles.badgeItemText}>
                                  {badge.replace('_', ' ')} ×
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType(profile.admin_suspended ? null : 'suspend');
                          setActionReason('');
                          setShowActionModal(true);
                        }}
                      >
                        {profile.admin_suspended ? (
                          <CheckCircle size={20} color={colors.success} />
                        ) : (
                          <Ban size={20} color={colors.danger} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType(profile.admin_limited ? null : 'limit');
                          setActionReason('');
                          setShowActionModal(true);
                        }}
                      >
                        <Shield size={20} color={profile.admin_limited ? colors.success : colors.warning || '#FFA500'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType('premium');
                          setTrialDays('7');
                          setShowActionModal(true);
                        }}
                      >
                        <Sparkles size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType('badge');
                          setBadgeType('verified');
                          setShowActionModal(true);
                        }}
                      >
                        <CheckCircle size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType('delete');
                          setShowActionModal(true);
                        }}
                      >
                        <Trash2 size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            </View>
          )}

          {activeTab === 'matches' && (
            <View style={styles.list}>
              {matches.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <Heart size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>No matches found</Text>
                </View>
              )}
              {matches
                .filter((match) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    match.user1?.full_name?.toLowerCase().includes(query) ||
                    match.user2?.full_name?.toLowerCase().includes(query)
                  );
                })
                .map((match) => (
                <View key={match.id} style={styles.card}>
                  <View style={styles.matchUsers}>
                    <Image
                      source={{ uri: match.user1?.profile_picture }}
                      style={styles.matchAvatar}
                      contentFit="cover"
                    />
                    <Heart size={20} color={colors.primary} />
                    <Image
                      source={{ uri: match.user2?.profile_picture }}
                      style={styles.matchAvatar}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>
                      {match.user1?.full_name} & {match.user2?.full_name}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      Matched {new Date(match.matched_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'likes' && (
            <View style={styles.list}>
              {likes.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <Sparkles size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyText}>No likes found</Text>
                </View>
              )}
              {likes
                .filter((like) => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    like.liker?.full_name?.toLowerCase().includes(query) ||
                    like.liked?.full_name?.toLowerCase().includes(query)
                  );
                })
                .map((like) => (
                <View key={like.id} style={styles.card}>
                  <View style={styles.likeRow}>
                    <Image
                      source={{ uri: like.liker?.profile_picture }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                    <Text style={styles.arrow}>→</Text>
                    <Image
                      source={{ uri: like.liked?.profile_picture }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>
                      {like.liker?.full_name} liked {like.liked?.full_name}
                    </Text>
                    {like.is_super_like && (
                      <View style={styles.superLikeBadge}>
                        <Sparkles size={14} color={colors.primary} />
                        <Text style={styles.superLikeText}>Super Like</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'stats' && stats && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Users size={32} color={colors.primary} />
                <Text style={styles.statValue}>{stats.totalProfiles}</Text>
                <Text style={styles.statLabel}>Total Profiles</Text>
              </View>
              <View style={styles.statCard}>
                <CheckCircle size={32} color={colors.success} />
                <Text style={styles.statValue}>{stats.activeProfiles}</Text>
                <Text style={styles.statLabel}>Active Profiles</Text>
              </View>
              <View style={styles.statCard}>
                <Heart size={32} color={colors.danger} />
                <Text style={styles.statValue}>{stats.totalMatches}</Text>
                <Text style={styles.statLabel}>Total Matches</Text>
              </View>
              <View style={styles.statCard}>
                <Sparkles size={32} color={colors.primary} />
                <Text style={styles.statValue}>{stats.totalLikes}</Text>
                <Text style={styles.statLabel}>Total Likes</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {actionType === 'suspend' && (selectedProfile?.admin_suspended ? 'Unsuspend Profile' : 'Suspend Profile')}
              {actionType === 'limit' && (selectedProfile?.admin_limited ? 'Remove Limits' : 'Limit Profile')}
              {actionType === 'delete' && 'Delete Profile'}
              {actionType === 'premium' && 'Grant Premium Trial'}
              {actionType === 'badge' && 'Grant Badge'}
            </Text>

            {actionType === 'suspend' && !selectedProfile?.admin_suspended && (
              <>
                <Text style={styles.modalLabel}>Reason (optional):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter reason for suspension..."
                  value={actionReason}
                  onChangeText={setActionReason}
                  multiline
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={() => handleSuspendProfile(selectedProfile)}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Suspend</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {actionType === 'suspend' && selectedProfile?.admin_suspended && (
              <>
                <Text style={styles.modalText}>
                  Suspended by: {selectedProfile.admin_suspended_by || 'Unknown'}{'\n'}
                  Reason: {selectedProfile.admin_suspended_reason || 'No reason provided'}{'\n'}
                  Date: {selectedProfile.admin_suspended_at ? new Date(selectedProfile.admin_suspended_at).toLocaleString() : 'Unknown'}
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={() => {
                      handleUnsuspendProfile(selectedProfile);
                      setShowActionModal(false);
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Unsuspend</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {actionType === 'limit' && !selectedProfile?.admin_limited && (
              <>
                <Text style={styles.modalLabel}>Reason (optional):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter reason for limiting..."
                  value={actionReason}
                  onChangeText={setActionReason}
                  multiline
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={() => handleLimitProfile(selectedProfile)}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Limit</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {actionType === 'limit' && selectedProfile?.admin_limited && (
              <>
                <Text style={styles.modalText}>
                  Limited by: {selectedProfile.admin_limited_by || 'Unknown'}{'\n'}
                  Reason: {selectedProfile.admin_limited_reason || 'No reason provided'}{'\n'}
                  Date: {selectedProfile.admin_limited_at ? new Date(selectedProfile.admin_limited_at).toLocaleString() : 'Unknown'}
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={() => {
                      handleUnlimitProfile(selectedProfile);
                      setShowActionModal(false);
                    }}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Remove Limits</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {actionType === 'delete' && (
              <>
                <Text style={styles.modalText}>
                  Are you sure you want to permanently delete this profile? This action cannot be undone.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.danger }]}
                    onPress={() => handleDeleteProfile(selectedProfile)}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {actionType === 'premium' && (
              <>
                <Text style={styles.modalLabel}>Trial Duration (days):</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="7"
                  value={trialDays}
                  onChangeText={setTrialDays}
                  keyboardType="numeric"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={() => handleGrantPremium(selectedProfile)}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Grant Trial</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {actionType === 'badge' && (
              <>
                <Text style={styles.modalLabel}>Badge Type:</Text>
                <View style={styles.badgeOptions}>
                  {['verified', 'good_conversationalist', 'replies_fast', 'respectful_member', 'active_member', 'premium'].map((badge) => (
                    <TouchableOpacity
                      key={badge}
                      style={[styles.badgeOption, badgeType === badge && styles.badgeOptionSelected]}
                      onPress={() => setBadgeType(badge as any)}
                    >
                      <Text style={[styles.badgeOptionText, badgeType === badge && styles.badgeOptionTextSelected]}>
                        {badge.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setShowActionModal(false)}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={() => handleGrantBadge(selectedProfile)}
                  >
                    <Text style={[styles.modalButtonText, { color: '#fff' }]}>Grant Badge</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
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
    tabsContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background.secondary,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text.primary,
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
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      gap: 12,
    },
    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    matchAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    matchUsers: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    likeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    arrow: {
      fontSize: 20,
      color: colors.text.secondary,
    },
    cardContent: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    badges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    badgeText: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '500',
    },
    badgeInactive: {
      color: colors.text.tertiary,
    },
    superLikeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    superLikeText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
    },
    actionButton: {
      padding: 8,
      marginLeft: 4,
    },
    badgeList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 4,
    },
    badgeItem: {
      backgroundColor: colors.primary + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    badgeItemText: {
      fontSize: 10,
      color: colors.primary,
      fontWeight: '600',
    },
    statsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 16,
      gap: 16,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 20,
      alignItems: 'center',
      gap: 8,
    },
    statValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      padding: 24,
      width: '90%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    modalText: {
      fontSize: 16,
      color: colors.text.secondary,
      marginBottom: 20,
      lineHeight: 22,
    },
    modalInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: colors.text.primary,
      marginBottom: 20,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'flex-end',
    },
    modalButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 100,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: colors.background.secondary,
    },
    modalButtonConfirm: {
      backgroundColor: colors.primary,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    badgeOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 20,
    },
    badgeOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    badgeOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    badgeOptionText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '500',
    },
    badgeOptionTextSelected: {
      color: '#fff',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      gap: 16,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '500',
    },
  });

