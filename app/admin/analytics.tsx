import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { BarChart3, Users, Heart, Film, MessageSquare, TrendingUp } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';

export default function AdminAnalyticsScreen() {
  const { currentUser } = useApp();
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    verifiedUsers: 0,
    totalRelationships: 0,
    verifiedRelationships: 0,
    totalPosts: 0,
    totalReels: 0,
    totalMessages: 0,
    activeToday: 0,
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const [
        usersResult,
        verifiedUsersResult,
        relationshipsResult,
        verifiedRelationshipsResult,
        postsResult,
        reelsResult,
        messagesResult,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('phone_verified', true),
        supabase.from('relationships').select('id', { count: 'exact', head: true }),
        supabase.from('relationships').select('id', { count: 'exact', head: true }).eq('status', 'verified'),
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('reels').select('id', { count: 'exact', head: true }),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        verifiedUsers: verifiedUsersResult.count || 0,
        totalRelationships: relationshipsResult.count || 0,
        verifiedRelationships: verifiedRelationshipsResult.count || 0,
        totalPosts: postsResult.count || 0,
        totalReels: reelsResult.count || 0,
        totalMessages: messagesResult.count || 0,
        activeToday: 0,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Analytics', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Analytics Dashboard', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <BarChart3 size={32} color={colors.primary} />
            <Text style={styles.headerTitle}>Platform Analytics</Text>
            <Text style={styles.headerSubtitle}>Overview of your platform</Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Users size={28} color={colors.primary} />
              </View>
              <Text style={styles.statValue}>{stats.totalUsers}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
              <Text style={styles.statSubtext}>
                {stats.verifiedUsers} verified
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Heart size={28} color={colors.secondary} />
              </View>
              <Text style={styles.statValue}>{stats.totalRelationships}</Text>
              <Text style={styles.statLabel}>Relationships</Text>
              <Text style={styles.statSubtext}>
                {stats.verifiedRelationships} verified
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <TrendingUp size={28} color={colors.accent} />
              </View>
              <Text style={styles.statValue}>{stats.totalPosts}</Text>
              <Text style={styles.statLabel}>Total Posts</Text>
              <Text style={styles.statSubtext}>
                All time
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Film size={28} color='#FF6B6B' />
              </View>
              <Text style={styles.statValue}>{stats.totalReels}</Text>
              <Text style={styles.statLabel}>Total Reels</Text>
              <Text style={styles.statSubtext}>
                All time
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MessageSquare size={28} color='#4ECDC4' />
              </View>
              <Text style={styles.statValue}>{stats.totalMessages}</Text>
              <Text style={styles.statLabel}>Messages</Text>
              <Text style={styles.statSubtext}>
                All time
              </Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <TrendingUp size={28} color='#95E1D3' />
              </View>
              <Text style={styles.statValue}>
                {stats.totalUsers > 0 
                  ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100)
                  : 0}%
              </Text>
              <Text style={styles.statLabel}>Verification Rate</Text>
              <Text style={styles.statSubtext}>
                User verification
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Engagement Metrics</Text>
            <View style={styles.metricsCard}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Avg. Posts per User</Text>
                <Text style={styles.metricValue}>
                  {stats.totalUsers > 0 
                    ? (stats.totalPosts / stats.totalUsers).toFixed(2)
                    : '0'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Avg. Reels per User</Text>
                <Text style={styles.metricValue}>
                  {stats.totalUsers > 0 
                    ? (stats.totalReels / stats.totalUsers).toFixed(2)
                    : '0'}
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Relationship Rate</Text>
                <Text style={styles.metricValue}>
                  {stats.totalUsers > 0 
                    ? Math.round((stats.totalRelationships / stats.totalUsers) * 100)
                    : 0}%
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  header: {
    padding: 24,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  statsGrid: {
    padding: 16,
    gap: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  metricsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  metricLabel: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
});
