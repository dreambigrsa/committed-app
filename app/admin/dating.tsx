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

      // Load badges and subscriptions for each profile
      if (profilesData && profilesData.length > 0) {
        const userIds = profilesData.map(p => p.user_id);
        
        const [badgesData, subscriptionsData] = await Promise.all([
          supabase
            .from('user_dating_badges')
            .select('user_id, badge_type')
            .in('user_id', userIds),
          supabase
            .from('user_subscriptions')
            .select('user_id, status, expires_at, plan_id')
            .in('user_id', userIds)
            .in('status', ['active', 'trial'])
        ]);

        // Attach badges and premium status to profiles
        const profilesWithBadges = profilesData.map(profile => {
          const userId = profile.user_id;
          const badges = badgesData.data?.filter(b => b.user_id === userId).map(b => b.badge_type) || [];
          
          // Check if user has active premium subscription
          const subscription = subscriptionsData.data?.find(s => s.user_id === userId);
          const isPremium = subscription && (
            subscription.status === 'active' || 
            (subscription.status === 'trial' && subscription.expires_at && new Date(subscription.expires_at) >= new Date())
          );
          
          // Also check premium_trial_ends_at from profile
          const hasTrial = profile.premium_trial_ends_at && new Date(profile.premium_trial_ends_at) >= new Date();
          
          return {
            ...profile,
            badges,
            isPremium: isPremium || hasTrial,
            subscription,
            premiumTrialEndsAt: profile.premium_trial_ends_at,
          };
        });

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
      
      console.log('Loading matches for admin...');
      console.log('Current user role:', currentUser?.role);
      console.log('Current user ID:', currentUser?.id);
      
      // First, verify admin access by checking if we can query the table at all
      const { count: totalCount, error: countError } = await supabase
        .from('dating_matches')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error('Error checking matches count:', countError);
        console.error('Error code:', countError.code);
        console.error('Error message:', countError.message);
        
        // If it's an RLS/permission error, show a helpful message
        if (countError.code === '42501' || countError.message?.includes('policy') || countError.message?.includes('permission') || countError.message?.includes('row-level security')) {
          Alert.alert(
            'Permission Denied', 
            `Admin access to matches is not enabled.\n\nYour role: ${currentUser?.role || 'unknown'}\n\nPlease run the migration file:\nmigrations/add-admin-dating-matches-access.sql\n\nin your Supabase SQL Editor to enable admin access to view matches.`,
            [{ text: 'OK' }]
          );
          setMatches([]);
          return;
        }
      } else {
        console.log('Total matches in database (accessible):', totalCount);
      }
      
      // Now try to get matches with a simple query
      const { data: matchesData, error: matchesError } = await supabase
        .from('dating_matches')
        .select('*')
        .eq('is_unmatched', false)
        .order('matched_at', { ascending: false })
        .limit(100);

      if (matchesError) {
        console.error('Error loading matches:', matchesError);
        console.error('Error code:', matchesError.code);
        console.error('Error message:', matchesError.message);
        console.error('Error details:', matchesError.details);
        console.error('Error hint:', matchesError.hint);
        
        // If it's an RLS error, show a helpful message
        if (matchesError.code === '42501' || matchesError.message?.includes('policy') || matchesError.message?.includes('permission') || matchesError.message?.includes('row-level security')) {
          Alert.alert(
            'Permission Denied', 
            `Admin access to matches is not enabled.\n\nYour role: ${currentUser?.role || 'unknown'}\n\nPlease run the migration file:\nmigrations/add-admin-dating-matches-access.sql\n\nin your Supabase SQL Editor to enable admin access to view matches.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Error', matchesError.message || 'Failed to load matches');
        }
        setMatches([]);
        return;
      }

      console.log('Matches data received:', matchesData?.length || 0);
      
      if (!matchesData || matchesData.length === 0) {
        console.log('No matches found in database (query returned empty)');
        // Show a more informative message
        if (totalCount !== undefined && totalCount !== null && totalCount > 0) {
          console.warn(`Database has ${totalCount} matches but query returned 0. This might be an RLS filtering issue.`);
        }
        setMatches([]);
        return;
      }

      // Get all unique user IDs from matches
      const userIds = new Set<string>();
      matchesData.forEach((match: any) => {
        if (match.user1_id) userIds.add(match.user1_id);
        if (match.user2_id) userIds.add(match.user2_id);
      });

      // Fetch user data for all matched users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, profile_picture')
        .in('id', Array.from(userIds));

      if (usersError) {
        console.error('Error loading users for matches:', usersError);
        // Continue with matches even if user data fails
      }

      // Create a map of user data
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

      // Combine match data with user data
      const matchesWithUsers = matchesData.map((match: any) => ({
        ...match,
        user1: usersMap.get(match.user1_id) || { id: match.user1_id, full_name: 'Unknown', profile_picture: null },
        user2: usersMap.get(match.user2_id) || { id: match.user2_id, full_name: 'Unknown', profile_picture: null },
      }));

      console.log('Loaded matches:', matchesWithUsers.length);
      setMatches(matchesWithUsers);
      
      // If no matches found, check if there are any matches at all (for debugging)
      if (matchesWithUsers.length === 0) {
        console.log('No matches displayed. Checking if any matches exist in database...');
        // Try a count query to see if matches exist
        const { count, error: countError } = await supabase
          .from('dating_matches')
          .select('*', { count: 'exact', head: true });
        
        if (!countError && count !== undefined && count !== null) {
          console.log('Total matches in database:', count);
          if (count > 0) {
            console.warn('Matches exist but are not being returned. This is likely an RLS policy issue.');
          }
        }
      }
    } catch (error: any) {
      console.error('Error in loadMatches:', error);
      const errorMessage = error?.message || 'Failed to load matches';
      
      // Check if it's an RLS/permission error
      if (error?.code === '42501' || errorMessage.includes('policy') || errorMessage.includes('permission') || errorMessage.includes('row-level security')) {
        Alert.alert(
          'Permission Denied', 
          'Admin access to matches is not enabled.\n\nPlease run the migration file:\nmigrations/add-admin-dating-matches-access.sql\n\nin your Supabase SQL Editor to enable admin access.'
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLikes = async () => {
    try {
      setLoading(true);
      
      // First, get all likes
      const { data: likesData, error: likesError } = await supabase
        .from('dating_likes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (likesError) {
        console.error('Error loading likes:', likesError);
        throw likesError;
      }

      if (!likesData || likesData.length === 0) {
        setLikes([]);
        return;
      }

      // Get all unique user IDs from likes
      const userIds = new Set<string>();
      likesData.forEach((like: any) => {
        if (like.liker_id) userIds.add(like.liker_id);
        if (like.liked_id) userIds.add(like.liked_id);
      });

      // Fetch user data for all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, profile_picture')
        .in('id', Array.from(userIds));

      if (usersError) {
        console.error('Error loading users for likes:', usersError);
        // Continue with likes even if user data fails
      }

      // Create a map of user data
      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));

      // Combine like data with user data
      const likesWithUsers = likesData.map((like: any) => ({
        ...like,
        liker: usersMap.get(like.liker_id) || { id: like.liker_id, full_name: 'Unknown', profile_picture: null },
        liked: usersMap.get(like.liked_id) || { id: like.liked_id, full_name: 'Unknown', profile_picture: null },
      }));

      console.log('Loaded likes:', likesWithUsers.length);
      setLikes(likesWithUsers);
    } catch (error: any) {
      console.error('Error in loadLikes:', error);
      Alert.alert('Error', error.message || 'Failed to load likes. Make sure you have run the admin access migration.');
      setLikes([]);
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
      
      // Close modal and clear selection first
      setShowActionModal(false);
      setSelectedProfile(null);
      setActionType(null);
      setActionReason('');
      
      // Reload profiles after a short delay to ensure modal is closed
      setTimeout(() => {
        loadProfiles();
      }, 100);
      
      Alert.alert('Success', 'Profile suspended');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to suspend profile');
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
      
      // Close modal and clear selection first
      setShowActionModal(false);
      setSelectedProfile(null);
      setActionType(null);
      setActionReason('');
      
      // Reload profiles after a short delay to ensure modal is closed
      setTimeout(() => {
        loadProfiles();
      }, 100);
      
      Alert.alert('Success', 'Profile unsuspended');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unsuspend profile');
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
      
      // Close modal and clear selection first
      setShowActionModal(false);
      setSelectedProfile(null);
      setActionType(null);
      setActionReason('');
      
      // Reload profiles after a short delay to ensure modal is closed
      setTimeout(() => {
        loadProfiles();
      }, 100);
      
      Alert.alert('Success', 'Profile limited');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to limit profile');
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
      
      // Close modal and clear selection first
      setShowActionModal(false);
      setSelectedProfile(null);
      setActionType(null);
      setActionReason('');
      
      // Reload profiles after a short delay to ensure modal is closed
      setTimeout(() => {
        loadProfiles();
      }, 100);
      
      Alert.alert('Success', 'Profile limits removed');
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
              
              // Close modal and clear selection first
              setShowActionModal(false);
              setSelectedProfile(null);
              setActionType(null);
              setActionReason('');
              
              // Reload profiles after a short delay to ensure modal is closed
              setTimeout(() => {
                loadProfiles();
              }, 100);
              
              Alert.alert('Success', 'Profile deleted');
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
      
      const userId = profile.user_id || profile.users?.id;
      if (!userId) {
        Alert.alert('Error', 'Invalid user ID');
        return;
      }
      
      console.log('Granting premium trial:', { userId, days, grantedBy: currentUser.id });
      
      const { data, error } = await supabase.rpc('grant_trial_premium', {
        p_user_id: userId,
        p_granted_by: currentUser.id,
        p_days: days,
      });

      if (error) {
        console.error('Error granting premium:', error);
        throw error;
      }
      
      console.log('Premium granted successfully:', data);
      
      // Verify the subscription was created
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trial'])
        .single();
      
      if (subError && subError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.warn('Could not verify subscription:', subError);
      } else if (subscription) {
        console.log('Subscription verified:', subscription);
      }
      
      // Close modal and clear selection first
      setShowActionModal(false);
      setSelectedProfile(null);
      setActionType(null);
      setActionReason('');
      setTrialDays('7');
      
      // Reload profiles after a short delay to ensure modal is closed
      setTimeout(() => {
        loadProfiles();
      }, 100);
      
      Alert.alert('Success', `Premium trial granted for ${days} days`);
    } catch (error: any) {
      console.error('Error in handleGrantPremium:', error);
      Alert.alert('Error', error.message || 'Failed to grant premium trial. Make sure the grant_trial_premium function exists in your database.');
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
      
      // Close modal and clear selection first
      setShowActionModal(false);
      setSelectedProfile(null);
      setActionType(null);
      setBadgeType('verified');
      
      // Reload profiles after a short delay to ensure modal is closed
      setTimeout(() => {
        loadProfiles();
      }, 100);
      
      Alert.alert('Success', `Badge "${badgeType.replace('_', ' ')}" granted`);
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
                  <View key={profile.id} style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                      {profile.users?.profile_picture ? (
                        <Image
                          source={{ uri: profile.users.profile_picture }}
                          style={styles.profileAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.profileAvatar, styles.avatarPlaceholder]}>
                          <Text style={styles.avatarPlaceholderText}>
                            {profile.users?.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.profileInfo}>
                        <View style={styles.profileTitleRow}>
                          <Text style={styles.profileName}>{profile.users?.full_name || 'Unknown'}</Text>
                          {profile.users?.phone_verified && (
                            <CheckCircle size={18} color={colors.success} fill={colors.success} />
                          )}
                          {profile.users?.id_verified && (
                            <Shield size={18} color={colors.primary} fill={colors.primary} />
                          )}
                        </View>
                        <Text style={styles.profileEmail}>{profile.users?.email || 'No email'}</Text>
                        <View style={styles.statusRow}>
                          <View style={[
                            styles.statusBadge,
                            profile.is_active ? styles.statusActive : styles.statusInactive
                          ]}>
                            <View style={[
                              styles.statusDot,
                              profile.is_active ? { backgroundColor: colors.success } : { backgroundColor: colors.text.tertiary }
                            ]} />
                            <Text style={[
                              styles.statusText,
                              profile.is_active ? { color: colors.success } : { color: colors.text.tertiary }
                            ]}>
                              {profile.is_active ? 'Active' : 'Inactive'}
                            </Text>
                          </View>
                          {profile.isPremium && (
                            <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
                              <Sparkles size={12} color={colors.primary} />
                              <Text style={[styles.statusText, { color: colors.primary }]}>Premium</Text>
                            </View>
                          )}
                          {profile.admin_suspended && (
                            <View style={[styles.statusBadge, styles.statusSuspended]}>
                              <Ban size={12} color={colors.danger} />
                              <Text style={[styles.statusText, { color: colors.danger }]}>Suspended</Text>
                            </View>
                          )}
                          {profile.admin_limited && (
                            <View style={[styles.statusBadge, styles.statusLimited]}>
                              <Shield size={12} color={colors.warning || '#FFA500'} />
                              <Text style={[styles.statusText, { color: colors.warning || '#FFA500' }]}>Limited</Text>
                            </View>
                          )}
                        </View>
                        {profile.isPremium && profile.premiumTrialEndsAt && (
                          <Text style={[styles.profileEmail, { fontSize: 11, marginTop: 4 }]}>
                            Premium expires: {new Date(profile.premiumTrialEndsAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {profile.badges && profile.badges.length > 0 && (
                      <View style={styles.badgesSection}>
                        <Text style={styles.badgesLabel}>Badges:</Text>
                        <View style={styles.badgesRow}>
                          {profile.badges.map((badge: string) => (
                            <TouchableOpacity
                              key={badge}
                              style={styles.badgeChip}
                              onPress={() => {
                                Alert.alert(
                                  'Remove Badge',
                                  `Remove "${badge.replace('_', ' ')}" badge?`,
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
                              <Text style={styles.badgeChipText}>{badge.replace('_', ' ')}</Text>
                              <Text style={styles.badgeChipRemove}>×</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, profile.admin_suspended && styles.actionBtnActive]}
                        onPress={() => {
                          if (profile.admin_suspended) {
                            // Directly unsuspend without modal
                            handleUnsuspendProfile(profile);
                          } else {
                            // Open modal to suspend with reason
                            setSelectedProfile(profile);
                            setActionType('suspend');
                            setActionReason('');
                            setShowActionModal(true);
                          }
                        }}
                      >
                        <Ban size={18} color={profile.admin_suspended ? colors.success : colors.danger} />
                        <Text style={[styles.actionBtnText, profile.admin_suspended && { color: colors.success }]}>
                          {profile.admin_suspended ? 'Unsuspend' : 'Suspend'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, profile.admin_limited && styles.actionBtnActive]}
                        onPress={() => {
                          if (profile.admin_limited) {
                            // Directly unlimit without modal
                            handleUnlimitProfile(profile);
                          } else {
                            // Open modal to limit with reason
                            setSelectedProfile(profile);
                            setActionType('limit');
                            setActionReason('');
                            setShowActionModal(true);
                          }
                        }}
                      >
                        <Shield size={18} color={profile.admin_limited ? colors.success : colors.warning || '#FFA500'} />
                        <Text style={[styles.actionBtnText, profile.admin_limited && { color: colors.success }]}>
                          {profile.admin_limited ? 'Unlimit' : 'Limit'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType('premium');
                          setTrialDays('7');
                          setShowActionModal(true);
                        }}
                      >
                        <Sparkles size={18} color={colors.primary} />
                        <Text style={styles.actionBtnText}>Premium</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType('badge');
                          setBadgeType('verified');
                          setShowActionModal(true);
                        }}
                      >
                        <CheckCircle size={18} color={colors.primary} />
                        <Text style={styles.actionBtnText}>Badge</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnDanger]}
                        onPress={() => {
                          setSelectedProfile(profile);
                          setActionType('delete');
                          setShowActionModal(true);
                        }}
                      >
                        <Trash2 size={18} color={colors.danger} />
                        <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
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
              {actionType === 'suspend' && 'Suspend Profile'}
              {actionType === 'limit' && 'Limit Profile'}
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
      backgroundColor: colors.background.primary,
      paddingHorizontal: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 16,
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
      marginHorizontal: 4,
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 15,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.background.secondary,
      gap: 12,
      marginHorizontal: 20,
      marginTop: 12,
      marginBottom: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
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
      padding: 20,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 20,
      gap: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    profileCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    profileAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 3,
      borderColor: colors.primary + '20',
      marginRight: 16,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPlaceholderText: {
      fontSize: 24,
      fontWeight: '600' as const,
      color: colors.text.white,
    },
    profileInfo: {
      flex: 1,
    },
    profileTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    profileName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      letterSpacing: -0.3,
    },
    profileEmail: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 12,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    statusActive: {
      borderColor: colors.success + '40',
      backgroundColor: colors.success + '10',
    },
    statusInactive: {
      borderColor: colors.border.light,
    },
    statusSuspended: {
      borderColor: colors.danger + '40',
      backgroundColor: colors.danger + '10',
    },
    statusLimited: {
      borderColor: (colors.warning || '#FFA500') + '40',
      backgroundColor: (colors.warning || '#FFA500') + '10',
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    badgesSection: {
      marginTop: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    badgesLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    badgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    badgeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.primary + '15',
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    badgeChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    badgeChipRemove: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      marginLeft: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.background.primary,
      borderWidth: 1.5,
      borderColor: colors.border.medium,
      flex: 1,
      minWidth: '30%',
      justifyContent: 'center',
    },
    actionBtnActive: {
      borderColor: colors.success + '60',
      backgroundColor: colors.success + '10',
    },
    actionBtnDanger: {
      borderColor: colors.danger + '60',
      backgroundColor: colors.danger + '10',
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: colors.border.light,
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
      fontSize: 17,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 6,
      letterSpacing: -0.3,
    },
    cardSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 8,
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
      padding: 10,
      marginLeft: 6,
      borderRadius: 8,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
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

