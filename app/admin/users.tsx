import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Search, Shield, Ban, CheckCircle, XCircle, Edit2, Trash2, X } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { User } from '@/types';

export default function AdminUsersScreen() {
  const { currentUser } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<any[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*, banned_at, banned_by, ban_reason')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Check ban status - use database field as primary source
        // Also check for active "all" restrictions
        const usersWithBanStatus = await Promise.all(
          data.map(async (u: any) => {
            let isBanned = !!u.banned_at;
            
            // Also check if user has "all" restriction
            if (!isBanned) {
              try {
                const { data: restrictions } = await supabase
                  .from('user_restrictions')
                  .select('restricted_feature')
                  .eq('user_id', u.id)
                  .eq('restricted_feature', 'all')
                  .eq('is_active', true)
                  .limit(1);
                
                isBanned = !!(restrictions && restrictions.length > 0);
              } catch (err) {
                // If we can't check restrictions, rely on database field
                console.log('Could not check restrictions for user:', u.id);
              }
            }
            
            return {
              ...u,
              isBanned,
            };
          })
        );

        const formattedUsers: (User & { isBanned?: boolean; bannedAt?: string; bannedBy?: string; banReason?: string })[] = usersWithBanStatus.map((u: any) => ({
          id: u.id || '',
          fullName: u.full_name || 'Unknown',
          email: u.email || '',
          phoneNumber: u.phone_number || '',
          profilePicture: u.profile_picture || undefined,
          role: u.role || 'user',
          verifications: {
            phone: u.phone_verified || false,
            email: u.email_verified || false,
            id: u.id_verified || false,
          },
          createdAt: u.created_at || new Date().toISOString(),
          isBanned: u.isBanned || false,
          bannedAt: u.banned_at || undefined,
          bannedBy: u.banned_by || undefined,
          banReason: u.ban_reason || undefined,
        }));
        setUsers(formattedUsers as any);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, isCurrentlyBanned: boolean) => {
    if (isCurrentlyBanned) {
      // Unban user
      Alert.alert(
        'Unban User',
        'Are you sure you want to unban this user?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unban',
            style: 'default',
            onPress: async () => {
              try {
                // Update database - Auth admin API requires service role (backend only)
                const { error: dbError } = await supabase
                  .from('users')
                  .update({ 
                    banned_at: null as any,
                    banned_by: null as any,
                    ban_reason: null as any,
                  })
                  .eq('id', userId);
                
                if (dbError) {
                  console.error('DB update error:', dbError);
                  throw dbError;
                }
                
                // Remove all active restrictions
                await supabase
                  .from('user_restrictions')
                  .update({ is_active: false })
                  .eq('user_id', userId)
                  .eq('is_active', true);
                
                Alert.alert('Success', 'User has been unbanned');
                // Force reload users to update button state
                await loadUsers();
              } catch (error: any) {
                console.error('Unban error:', error);
                Alert.alert('Error', error?.message || 'Failed to unban user');
              }
            },
          },
        ]
      );
    } else {
      // Ban user
      Alert.alert(
        'Ban User',
        'Are you sure you want to ban this user?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Ban',
            style: 'destructive',
            onPress: async () => {
              try {
                // Update database - Auth admin API requires service role (backend only)
                const { error: dbError } = await supabase
                  .from('users')
                  .update({ 
                    banned_at: new Date().toISOString(),
                    banned_by: currentUser?.id,
                    ban_reason: 'Banned by admin',
                  })
                  .eq('id', userId);
                
                if (dbError) {
                  console.error('DB update error:', dbError);
                  throw dbError;
                }
                
                // Add restriction for all features
                await supabase
                  .from('user_restrictions')
                  .insert({
                    user_id: userId,
                    restricted_feature: 'all',
                    reason: 'Banned by admin',
                    restricted_by: currentUser?.id,
                    is_active: true,
                  });
                
                Alert.alert('Success', 'User has been banned');
                // Force reload users to update button state
                await loadUsers();
              } catch (error: any) {
                console.error('Ban error:', error);
                Alert.alert('Error', error?.message || 'Failed to ban user');
              }
            },
          },
        ]
      );
    }
  };

  const handleDeleteUser = async (userId: string) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to permanently delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('users')
                .delete()
                .eq('id', userId);
              Alert.alert('Success', 'User has been deleted');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const handleVerifyUser = async (userId: string, verificationType: 'phone' | 'email' | 'id') => {
    try {
      const updateData: any = {};
      if (verificationType === 'phone') updateData.phone_verified = true;
      if (verificationType === 'email') updateData.email_verified = true;
      if (verificationType === 'id') updateData.id_verified = true;

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      Alert.alert('Success', `User ${verificationType} verified`);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', 'Failed to verify user');
    }
  };

  const loadUserRestrictions = async (userId: string) => {
    // Toggle restrictions view
    if (selectedUserId === userId) {
      setSelectedUserId(null);
      setRestrictions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_restrictions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('restricted_at', { ascending: false });

      if (error) throw error;
      setRestrictions(data || []);
      setSelectedUserId(userId);
    } catch (error) {
      console.error('Failed to load restrictions:', error);
      Alert.alert('Error', 'Failed to load user restrictions');
    }
  };

  const handleRemoveRestriction = async (restrictionId: string, userId: string) => {
    Alert.alert(
      'Remove Restriction',
      'Are you sure you want to remove this restriction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_restrictions')
                .update({ is_active: false })
                .eq('id', restrictionId);

              if (error) throw error;

              Alert.alert('Success', 'Restriction removed');
              loadUserRestrictions(userId);
            } catch (error: any) {
              console.error('Remove restriction error:', error);
              Alert.alert('Error', error?.message || 'Failed to remove restriction');
            }
          },
        },
      ]
    );
  };

  const handleChangeRole = async (userId: string, currentRole: string) => {
    if (currentUser?.role !== 'super_admin') {
      Alert.alert('Error', 'Only Super Admins can change roles');
      return;
    }

    Alert.alert(
      'Change User Role',
      'Select new role for this user:',
      [
        {
          text: 'User',
          onPress: async () => {
            try {
              await supabase.from('users').update({ role: 'user' }).eq('id', userId);
              Alert.alert('Success', 'Role updated to User');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update role');
            }
          },
        },
        {
          text: 'Moderator',
          onPress: async () => {
            try {
              await supabase.from('users').update({ role: 'moderator' }).eq('id', userId);
              Alert.alert('Success', 'Role updated to Moderator');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update role');
            }
          },
        },
        {
          text: 'Admin',
          onPress: async () => {
            try {
              await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
              Alert.alert('Success', 'Role updated to Admin');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update role');
            }
          },
        },
        currentUser.role === 'super_admin' && {
          text: 'Super Admin',
          onPress: async () => {
            try {
              await supabase.from('users').update({ role: 'super_admin' }).eq('id', userId);
              Alert.alert('Success', 'Role updated to Super Admin');
              loadUsers();
            } catch (error) {
              Alert.alert('Error', 'Failed to update role');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ].filter(Boolean) as any
    );
  };

  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phoneNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Users', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Users', headerShown: true }} />
      
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Search size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{users.length}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {users.filter(u => u.verifications.phone).length}
              </Text>
              <Text style={styles.statLabel}>Verified</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
              </Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
          </View>

          <View style={styles.usersList}>
            {filteredUsers.map((user) => (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.userHeader}>
                  <Image
                    source={{ uri: user.profilePicture || 'https://via.placeholder.com/100' }}
                    style={styles.userAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <Text style={styles.userName}>{user.fullName}</Text>
                      {user.verifications.id && (
                        <CheckCircle size={16} color={colors.secondary} />
                      )}
                    </View>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.userPhone}>{user.phoneNumber}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleText}>{user.role.replace('_', ' ')}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.verificationsRow}>
                  <TouchableOpacity
                    style={[styles.verificationBadge, user.verifications.phone && styles.verified]}
                    onPress={() => !user.verifications.phone && handleVerifyUser(user.id, 'phone')}
                  >
                    <Text style={styles.verificationText}>
                      Phone {user.verifications.phone ? '✓' : '✗'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.verificationBadge, user.verifications.email && styles.verified]}
                    onPress={() => !user.verifications.email && handleVerifyUser(user.id, 'email')}
                  >
                    <Text style={styles.verificationText}>
                      Email {user.verifications.email ? '✓' : '✗'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.verificationBadge, user.verifications.id && styles.verified]}
                    onPress={() => !user.verifications.id && handleVerifyUser(user.id, 'id')}
                  >
                    <Text style={styles.verificationText}>
                      ID {user.verifications.id ? '✓' : '✗'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {user.id !== currentUser.id && (
                  <>
                    <View style={styles.userActions}>
                      {currentUser.role === 'super_admin' && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton]}
                          onPress={() => handleChangeRole(user.id, user.role)}
                        >
                          <Edit2 size={16} color={colors.text.white} />
                          <Text style={styles.actionButtonText}>Role</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[
                          styles.actionButton, 
                          (user as any).isBanned ? styles.unbanButton : styles.banButton
                        ]}
                        onPress={() => handleBanUser(user.id, (user as any).isBanned || false)}
                      >
                        <Ban size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>
                          {(user as any).isBanned ? 'Unban' : 'Ban'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.restrictionsButton]}
                        onPress={() => loadUserRestrictions(user.id)}
                      >
                        <Shield size={16} color={colors.text.white} />
                        <Text style={styles.actionButtonText}>Restrictions</Text>
                      </TouchableOpacity>
                      {currentUser.role === 'super_admin' && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 size={16} color={colors.text.white} />
                          <Text style={styles.actionButtonText}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {selectedUserId === user.id && (
                      <View style={styles.restrictionsContainer}>
                        <View style={styles.restrictionsHeader}>
                          <Text style={styles.restrictionsTitle}>Active Restrictions</Text>
                          <TouchableOpacity onPress={() => {
                            setSelectedUserId(null);
                            setRestrictions([]);
                          }}>
                            <X size={18} color={colors.text.secondary} />
                          </TouchableOpacity>
                        </View>
                        {restrictions.length > 0 ? (
                          <View style={styles.restrictionsList}>
                            {restrictions.map((restriction) => (
                              <View key={restriction.id} style={styles.restrictionCard}>
                                <View style={styles.restrictionInfo}>
                                  <View style={styles.restrictionHeaderRow}>
                                    <View style={[styles.restrictionBadge, { backgroundColor: colors.primary + '20' }]}>
                                      <Text style={[styles.restrictionFeature, { color: colors.primary }]}>
                                        {restriction.restricted_feature === 'all' 
                                          ? 'All Features' 
                                          : restriction.restricted_feature.charAt(0).toUpperCase() + restriction.restricted_feature.slice(1).replace('_', ' ')}
                                      </Text>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.removeRestrictionButton}
                                      onPress={() => handleRemoveRestriction(restriction.id, user.id)}
                                    >
                                      <XCircle size={18} color={colors.danger} />
                                    </TouchableOpacity>
                                  </View>
                                  {restriction.reason && (
                                    <Text style={styles.restrictionReason}>{restriction.reason}</Text>
                                  )}
                                  <Text style={styles.restrictionDate}>
                                    Since: {new Date(restriction.restricted_at).toLocaleDateString()}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.noRestrictionsContainer}>
                            <Text style={styles.noRestrictionsText}>No active restrictions</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  usersList: {
    padding: 16,
    gap: 16,
  },
  userCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  userHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  userAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  userEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.primary,
    textTransform: 'capitalize',
  },
  verificationsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  verificationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.background.secondary,
  },
  verified: {
    backgroundColor: colors.secondary + '20',
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: colors.secondary,
  },
  banButton: {
    backgroundColor: colors.danger,
  },
  unbanButton: {
    backgroundColor: colors.secondary,
  },
  restrictionsButton: {
    backgroundColor: colors.primary,
  },
  deleteButton: {
    backgroundColor: '#8B0000',
  },
  restrictionsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  restrictionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  restrictionsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  restrictionsList: {
    gap: 12,
  },
  restrictionCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  restrictionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  restrictionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  restrictionFeature: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  restrictionInfo: {
    flex: 1,
  },
  restrictionReason: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 6,
    lineHeight: 18,
  },
  restrictionDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  removeRestrictionButton: {
    padding: 4,
  },
  noRestrictionsContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noRestrictionsText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
});
