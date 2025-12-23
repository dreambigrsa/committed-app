import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Eye } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import * as DatingService from '@/lib/dating-service';
import UserProfileScreen from './user-profile';

export default function ProfilePreviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await DatingService.getDatingProfile();
        setProfile(data);
      } catch (error: any) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  // Redirect to user profile view with current user's ID
  useEffect(() => {
    if (currentUser?.id && profile && !loading) {
      // Small delay to show the preview badge
      const timer = setTimeout(() => {
        router.replace({
          pathname: '/dating/user-profile',
          params: { userId: currentUser.id },
        } as any);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.id, profile, loading, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ArrowLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Preview</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Eye size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No Profile Yet</Text>
          <Text style={styles.emptyText}>
            Create your dating profile to see how it looks to others
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/dating/profile-setup')}
          >
            <Text style={styles.createButtonText}>Create Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Preview</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.previewBadge}>
        <Eye size={16} color={colors.primary} />
        <Text style={styles.previewBadgeText}>This is how others see your profile</Text>
      </View>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.previewContent}>
          <Text style={styles.noteText}>
            Loading your profile preview...
          </Text>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      gap: 20,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    createButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 8,
    },
    createButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    previewBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.primary + '15',
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    previewBadgeText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    previewContent: {
      padding: 20,
      alignItems: 'center',
      gap: 20,
    },
    noteText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 20,
    },
    viewButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 16,
    },
    viewButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
  });

