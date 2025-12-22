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
      const { data, error } = await supabase
        .from('dating_profiles')
        .select(`
          *,
          users!inner(id, full_name, email, profile_picture, phone_verified, email_verified, id_verified)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setProfiles(data || []);
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
              {profiles.map((profile) => (
                <View key={profile.id} style={styles.card}>
                  <Image
                    source={{ uri: profile.users?.profile_picture }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{profile.users?.full_name}</Text>
                    <Text style={styles.cardSubtitle}>{profile.users?.email}</Text>
                    <View style={styles.badges}>
                      {profile.users?.phone_verified && <CheckCircle size={16} color={colors.success} />}
                      {profile.is_active ? (
                        <Text style={styles.badgeText}>Active</Text>
                      ) : (
                        <Text style={[styles.badgeText, styles.badgeInactive]}>Inactive</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => deactivateProfile(profile.id, profile.user_id)}
                  >
                    <Ban size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'matches' && (
            <View style={styles.list}>
              {matches.map((match) => (
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
              {likes.map((like) => (
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
  });

