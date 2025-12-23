import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Heart, Users, Sparkles, Calendar, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as DatingService from '@/lib/dating-service';
import { useFocusEffect } from '@react-navigation/native';

export default function DatingDashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [matches, setMatches] = useState<any[]>([]);
  const [likes, setLikes] = useState<any[]>([]);
  const [dateRequests, setDateRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [matchesData, likesData, requestsData] = await Promise.all([
        DatingService.getDatingMatches().catch(() => []),
        DatingService.getLikesReceived().catch(() => []),
        DatingService.getDateRequests().catch(() => []),
      ]);
      setMatches(matchesData || []);
      setLikes(likesData || []);
      setDateRequests(requestsData || []);
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const pendingDateRequests = (dateRequests || []).filter(
    (req: any) => req.status === 'pending' && req.recipient_id === (matches?.[0]?.matchedUser?.id || '')
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Dating',
          headerShown: true,
        }} 
      />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/dating/matches')}
          >
            <View style={styles.statIconContainer}>
              <Sparkles size={24} color={colors.primary} fill={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{matches?.length || 0}</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/dating/likes-received')}
          >
            <View style={styles.statIconContainer}>
              <Heart size={24} color={colors.danger} fill={colors.danger} />
            </View>
            <Text style={styles.statNumber}>{likes?.length || 0}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push('/dating/date-requests')}
          >
            <View style={styles.statIconContainer}>
              <Calendar size={24} color={colors.accent} fill={colors.accent} />
            </View>
            <Text style={styles.statNumber}>{pendingDateRequests.length}</Text>
            <Text style={styles.statLabel}>Dates</Text>
          </TouchableOpacity>
        </View>

        {/* Main Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/dating')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '15' }]}>
                <Heart size={24} color={colors.primary} fill={colors.primary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Discover</Text>
                <Text style={styles.actionSubtitle}>Swipe and find matches</Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/dating/matches')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary + '15' }]}>
                <Users size={24} color={colors.secondary} fill={colors.secondary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>My Matches</Text>
                <Text style={styles.actionSubtitle}>
                  {matches?.length || 0} {matches?.length === 1 ? 'match' : 'matches'}
                </Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/dating/likes-received')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: colors.danger + '15' }]}>
                <Heart size={24} color={colors.danger} fill={colors.danger} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Who Liked Me</Text>
                <Text style={styles.actionSubtitle}>
                  {likes?.length || 0} {likes?.length === 1 ? 'like' : 'likes'}
                </Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/dating/date-requests')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: colors.accent + '15' }]}>
                <Calendar size={24} color={colors.accent} fill={colors.accent} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Date Requests</Text>
                <Text style={styles.actionSubtitle}>
                  {pendingDateRequests.length} pending
                </Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/dating/profile-setup')}
          >
            <View style={styles.actionLeft}>
              <View style={[styles.actionIcon, { backgroundColor: colors.text.secondary + '15' }]}>
                <Users size={24} color={colors.text.secondary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={styles.actionTitle}>Edit Profile</Text>
                <Text style={styles.actionSubtitle}>Update your dating profile</Text>
              </View>
            </View>
            <ArrowRight size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    scrollContent: {
      padding: 20,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    statIconContainer: {
      marginBottom: 8,
    },
    statNumber: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 16,
    },
    actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    actionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    actionIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    actionInfo: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    actionSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
    },
  });

