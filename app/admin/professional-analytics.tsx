import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Stack } from 'expo-router';
import { BarChart3, Users, MessageSquare, TrendingUp, Clock, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface AnalyticsData {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  averageSessionDuration: number;
  totalProfessionals: number;
  activeProfessionals: number;
  totalEscalations: number;
  averageRating: number;
  totalReviews: number;
}

export default function AdminProfessionalAnalyticsScreen() {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const dateFilter = getDateFilter(dateRange);

      // Total sessions
      let sessionsQuery = supabase
        .from('professional_sessions')
        .select('id, status, created_at, professional_joined_at, professional_ended_at', { count: 'exact' });
      
      if (dateFilter) {
        sessionsQuery = sessionsQuery.gte('created_at', dateFilter);
      }

      const { data: sessionsData, count: totalSessions } = await sessionsQuery;

      // Active sessions
      const { count: activeSessions } = await supabase
        .from('professional_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      // Completed sessions
      const { count: completedSessions } = await supabase
        .from('professional_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ended');

      // Average session duration
      const { data: endedSessions } = await supabase
        .from('professional_sessions')
        .select('professional_joined_at, professional_ended_at')
        .eq('status', 'ended')
        .not('professional_joined_at', 'is', null)
        .not('professional_ended_at', 'is', null);

      let totalDuration = 0;
      let sessionCount = 0;
      if (endedSessions) {
        endedSessions.forEach((session: any) => {
          const start = new Date(session.professional_joined_at).getTime();
          const end = new Date(session.professional_ended_at).getTime();
          const duration = (end - start) / 1000 / 60; // in minutes
          if (duration > 0) {
            totalDuration += duration;
            sessionCount++;
          }
        });
      }
      const averageSessionDuration = sessionCount > 0 ? totalDuration / sessionCount : 0;

      // Total professionals
      const { count: totalProfessionals } = await supabase
        .from('professional_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'approved');

      // Active professionals (with active status)
      const { data: activeProfessionalsData } = await supabase
        .from('professional_status')
        .select('status')
        .in('status', ['online', 'busy']);
      
      const activeProfessionals = activeProfessionalsData?.length || 0;

      // Total escalations
      let escalationsQuery = supabase
        .from('escalation_events')
        .select('id', { count: 'exact', head: true });
      
      if (dateFilter) {
        escalationsQuery = escalationsQuery.gte('created_at', dateFilter);
      }

      const { count: totalEscalations } = await escalationsQuery;

      // Average rating and total reviews
      const { data: reviewsData } = await supabase
        .from('professional_reviews')
        .select('rating')
        .eq('moderation_status', 'approved');

      let totalRating = 0;
      const reviewCount = reviewsData?.length || 0;
      if (reviewsData && reviewsData.length > 0) {
        reviewsData.forEach((review: any) => {
          totalRating += review.rating || 0;
        });
      }
      const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;

      setAnalytics({
        totalSessions: totalSessions || 0,
        activeSessions: activeSessions || 0,
        completedSessions: completedSessions || 0,
        averageSessionDuration: Math.round(averageSessionDuration),
        totalProfessionals: totalProfessionals || 0,
        activeProfessionals,
        totalEscalations: totalEscalations || 0,
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: reviewCount,
      });
    } catch (error: any) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getDateFilter = (range: string): string | null => {
    const now = new Date();
    switch (range) {
      case '7d':
        now.setDate(now.getDate() - 7);
        return now.toISOString();
      case '30d':
        now.setDate(now.getDate() - 30);
        return now.toISOString();
      case '90d':
        now.setDate(now.getDate() - 90);
        return now.toISOString();
      default:
        return null;
    }
  };

  if (loading && !analytics) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Professional Analytics' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Professional Analytics' }} />
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAnalytics();
            }}
            colors={[themeColors.primary]}
          />
        }
      >
        {/* Date Range Filter */}
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Time Range:</Text>
          <View style={styles.filterButtons}>
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.filterButton,
                  dateRange === range && styles.filterButtonActive,
                ]}
                onPress={() => setDateRange(range)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    dateRange === range && styles.filterButtonTextActive,
                  ]}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : 'All Time'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {analytics && (
          <>
            {/* Overview Cards */}
            <View style={styles.overviewGrid}>
              <View style={styles.statCard}>
                <MessageSquare size={24} color={themeColors.primary} />
                <Text style={styles.statValue}>{analytics.totalSessions}</Text>
                <Text style={styles.statLabel}>Total Sessions</Text>
              </View>

              <View style={styles.statCard}>
                <CheckCircle2 size={24} color={themeColors.secondary} />
                <Text style={styles.statValue}>{analytics.activeSessions}</Text>
                <Text style={styles.statLabel}>Active Sessions</Text>
              </View>

              <View style={styles.statCard}>
                <Users size={24} color={themeColors.accent} />
                <Text style={styles.statValue}>{analytics.totalProfessionals}</Text>
                <Text style={styles.statLabel}>Total Professionals</Text>
              </View>

              <View style={styles.statCard}>
                <TrendingUp size={24} color={themeColors.secondary} />
                <Text style={styles.statValue}>{analytics.activeProfessionals}</Text>
                <Text style={styles.statLabel}>Active Now</Text>
              </View>
            </View>

            {/* Detailed Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Session Statistics</Text>
              
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Completed Sessions</Text>
                  <Text style={styles.detailValue}>{analytics.completedSessions}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Avg. Duration</Text>
                  <Text style={styles.detailValue}>{analytics.averageSessionDuration} min</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quality Metrics</Text>
              
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Average Rating</Text>
                  <Text style={styles.detailValue}>
                    {analytics.averageRating > 0 ? `${analytics.averageRating} ⭐` : 'N/A'}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Total Reviews</Text>
                  <Text style={styles.detailValue}>{analytics.totalReviews}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Escalation Metrics</Text>
              
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Total Escalations</Text>
                  <Text style={styles.detailValue}>{analytics.totalEscalations}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Escalation Rate</Text>
                  <Text style={styles.detailValue}>
                    {analytics.totalSessions > 0
                      ? `${Math.round((analytics.totalEscalations / analytics.totalSessions) * 100)}%`
                      : '0%'}
                  </Text>
                </View>
              </View>
            </View>
          </>
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
    filterContainer: {
      padding: 16,
      backgroundColor: colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 12,
    },
    filterButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      alignItems: 'center',
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    filterButtonTextActive: {
      color: colors.text.white,
    },
    overviewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 16,
      gap: 12,
    },
    statCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.light,
      gap: 8,
    },
    statValue: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text.primary,
    },
    statLabel: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    section: {
      backgroundColor: colors.background.primary,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 16,
    },
    detailRow: {
      flexDirection: 'row',
      gap: 16,
    },
    detailItem: {
      flex: 1,
    },
    detailLabel: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
  });
