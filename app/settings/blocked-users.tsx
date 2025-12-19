import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft, Users, UserX, User } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Image as ExpoImage } from 'expo-image';

interface BlockedUser {
  id: string;
  blocked_id: string;
  full_name: string;
  profile_picture?: string;
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlockedUsers();
  }, [currentUser]);

  const loadBlockedUsers = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          id,
          blocked_id,
          users!blocked_users_blocked_id_fkey(
            full_name,
            profile_picture
          )
        `)
        .eq('blocker_id', currentUser.id);

      if (error) throw error;

      const formatted = (data || []).map((item: any) => ({
        id: item.id,
        blocked_id: item.blocked_id,
        full_name: item.users?.full_name || 'Unknown User',
        profile_picture: item.users?.profile_picture,
      }));

      setBlockedUsers(formatted);
    } catch (error) {
      console.error('Failed to load blocked users:', error);
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (blockedUserId: string, blockedUserName: string) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${blockedUserName}? They will be able to see your profile and send you messages again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('blocker_id', currentUser?.id)
                .eq('blocked_id', blockedUserId);

              if (error) throw error;

              setBlockedUsers(blockedUsers.filter(u => u.blocked_id !== blockedUserId));
              Alert.alert('Success', `${blockedUserName} has been unblocked.`);
            } catch (error) {
              console.error('Failed to unblock user:', error);
              Alert.alert('Error', 'Failed to unblock user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View
      style={[styles.userCard, { backgroundColor: colors.background.primary, borderColor: colors.border.light }]}
    >
      <View style={styles.userInfo}>
        {item.profile_picture ? (
          <ExpoImage source={{ uri: item.profile_picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <User size={20} color={colors.text.white} />
          </View>
        )}
        <Text style={[styles.userName, { color: colors.text.primary }]}>
          {item.full_name}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.unblockButton, { borderColor: colors.border.light }]}
        onPress={() => unblockUser(item.blocked_id, item.full_name)}
      >
        <UserX size={16} color={colors.primary} />
        <Text style={[styles.unblockText, { color: colors.primary }]}>Unblock</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Blocked Users',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()}>
                <ArrowLeft size={24} color={colors.text.primary} />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Blocked Users',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: colors.background.primary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Blocked Users ({blockedUsers.length})
          </Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>
            Users you've blocked won't be able to see your profile, send you messages, or interact with your content.
          </Text>
        </View>

        {blockedUsers.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.background.primary }]}>
            <Users size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
              No blocked users
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.text.tertiary }]}>
              Users you block will appear here
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedUsers}
            renderItem={renderBlockedUser}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  listContent: {
    gap: 12,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

