import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Stack } from 'expo-router';
import { UserCog, Shield, Trash2, Plus, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import colors from '@/constants/colors';
import { User, UserRole } from '@/types';

export default function AdminRolesScreen() {
  const { currentUser } = useApp();
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('moderator');
  const [searchEmail, setSearchEmail] = useState<string>('');

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['moderator', 'admin', 'super_admin'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formattedUsers: User[] = data.map((u: any) => ({
          id: u.id,
          fullName: u.full_name,
          email: u.email,
          phoneNumber: u.phone_number,
          profilePicture: u.profile_picture,
          role: u.role,
          verifications: {
            phone: u.phone_verified,
            email: u.email_verified,
            id: u.id_verified,
          },
          createdAt: u.created_at,
        }));
        setAdmins(formattedUsers);
      }
    } catch (error) {
      console.error('Failed to load admins:', error);
      Alert.alert('Error', 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLevel = (role: UserRole): number => {
    switch (role) {
      case 'user': return 0;
      case 'moderator': return 1;
      case 'admin': return 2;
      case 'super_admin': return 3;
      default: return 0;
    }
  };

  const canModifyRole = (targetRole: UserRole): boolean => {
    if (!currentUser) return false;
    const currentLevel = getRoleLevel(currentUser.role as UserRole);
    const targetLevel = getRoleLevel(targetRole);
    return currentLevel > targetLevel;
  };

  const handleChangeRole = async (userId: string, currentRole: UserRole, newRole: UserRole) => {
    if (!canModifyRole(currentRole)) {
      Alert.alert('Error', 'You cannot modify users with equal or higher role than yours');
      return;
    }

    if (!canModifyRole(newRole) && newRole !== currentUser?.role) {
      Alert.alert('Error', 'You cannot promote users to a role equal or higher than yours');
      return;
    }

    try {
      await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      Alert.alert('Success', 'Role updated successfully');
      loadAdmins();
    } catch (error) {
      Alert.alert('Error', 'Failed to update role');
    }
  };

  const handleAddAdmin = async () => {
    if (!searchEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', searchEmail.trim().toLowerCase())
        .single();

      if (error || !user) {
        Alert.alert('Error', 'User not found');
        return;
      }

      await supabase
        .from('users')
        .update({ role: selectedRole })
        .eq('id', user.id);

      Alert.alert('Success', `User promoted to ${selectedRole}`);
      setShowAddModal(false);
      setSearchEmail('');
      loadAdmins();
    } catch (error) {
      Alert.alert('Error', 'Failed to add admin');
    }
  };

  const handleRemoveAdmin = async (userId: string, userName: string, userRole: UserRole) => {
    if (!canModifyRole(userRole)) {
      Alert.alert('Error', 'You cannot remove users with equal or higher role than yours');
      return;
    }

    Alert.alert(
      'Remove Admin',
      `Are you sure you want to remove ${userName} as admin?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('users')
                .update({ role: 'user' })
                .eq('id', userId);

              Alert.alert('Success', 'Admin removed successfully');
              loadAdmins();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove admin');
            }
          },
        },
      ]
    );
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return '#9B59B6';
      case 'admin':
        return colors.primary;
      case 'moderator':
        return colors.secondary;
      default:
        return colors.text.tertiary;
    }
  };

  if (!currentUser || currentUser.role !== 'super_admin') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Admin Roles', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only Super Admins can manage roles</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Manage Admin Roles', headerShown: true }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admins & Moderators</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Plus size={20} color={colors.text.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsBar}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {admins.filter(a => a.role === 'super_admin').length}
              </Text>
              <Text style={styles.statLabel}>Super Admins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {admins.filter(a => a.role === 'admin').length}
              </Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {admins.filter(a => a.role === 'moderator').length}
              </Text>
              <Text style={styles.statLabel}>Moderators</Text>
            </View>
          </View>

          <View style={styles.adminsList}>
            {admins.map((admin) => (
              <View key={admin.id} style={styles.adminCard}>
                <View style={styles.adminHeader}>
                  <Image
                    source={{ uri: admin.profilePicture || 'https://via.placeholder.com/100' }}
                    style={styles.adminAvatar}
                    contentFit="cover"
                  />
                  <View style={styles.adminInfo}>
                    <Text style={styles.adminName}>{admin.fullName}</Text>
                    <Text style={styles.adminEmail}>{admin.email}</Text>
                    <View
                      style={[
                        styles.roleBadge,
                        { backgroundColor: getRoleBadgeColor(admin.role) + '20' }
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          { color: getRoleBadgeColor(admin.role) }
                        ]}
                      >
                        {admin.role.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {admin.id !== currentUser.id && canModifyRole(admin.role) && (
                  <View style={styles.adminActions}>
                    <View style={styles.roleButtons}>
                      {admin.role !== 'moderator' && canModifyRole('moderator') && (
                        <TouchableOpacity
                          style={[styles.roleButton, styles.moderatorButton]}
                          onPress={() => handleChangeRole(admin.id, admin.role, 'moderator')}
                        >
                          <Text style={styles.roleButtonText}>Moderator</Text>
                        </TouchableOpacity>
                      )}
                      {admin.role !== 'admin' && canModifyRole('admin') && (
                        <TouchableOpacity
                          style={[styles.roleButton, styles.adminButton]}
                          onPress={() => handleChangeRole(admin.id, admin.role, 'admin')}
                        >
                          <Text style={styles.roleButtonText}>Admin</Text>
                        </TouchableOpacity>
                      )}
                      {admin.role !== 'super_admin' && currentUser.role === 'super_admin' && (
                        <TouchableOpacity
                          style={[styles.roleButton, styles.superAdminButton]}
                          onPress={() => handleChangeRole(admin.id, admin.role, 'super_admin')}
                        >
                          <Text style={styles.roleButtonText}>Super Admin</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveAdmin(admin.id, admin.fullName, admin.role)}
                    >
                      <Trash2 size={16} color={colors.text.white} />
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Admin or Moderator</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>User Email</Text>
              <TextInput
                style={styles.textInput}
                placeholder="user@example.com"
                placeholderTextColor={colors.text.tertiary}
                value={searchEmail}
                onChangeText={setSearchEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectorButton,
                    selectedRole === 'moderator' && styles.roleSelectorButtonActive
                  ]}
                  onPress={() => setSelectedRole('moderator')}
                >
                  <Text
                    style={[
                      styles.roleSelectorText,
                      selectedRole === 'moderator' && styles.roleSelectorTextActive
                    ]}
                  >
                    Moderator
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleSelectorButton,
                    selectedRole === 'admin' && styles.roleSelectorButtonActive
                  ]}
                  onPress={() => setSelectedRole('admin')}
                >
                  <Text
                    style={[
                      styles.roleSelectorText,
                      selectedRole === 'admin' && styles.roleSelectorTextActive
                    ]}
                  >
                    Admin
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleSelectorButton,
                    selectedRole === 'super_admin' && styles.roleSelectorButtonActive
                  ]}
                  onPress={() => setSelectedRole('super_admin')}
                >
                  <Text
                    style={[
                      styles.roleSelectorText,
                      selectedRole === 'super_admin' && styles.roleSelectorTextActive
                    ]}
                  >
                    Super Admin
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddAdmin}
              >
                <Text style={styles.submitButtonText}>Add Admin</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
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
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
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
    textAlign: 'center',
  },
  adminsList: {
    padding: 16,
    gap: 16,
  },
  adminCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
  },
  adminHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  adminAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  adminEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  adminActions: {
    gap: 12,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  moderatorButton: {
    backgroundColor: colors.secondary,
  },
  adminButton: {
    backgroundColor: colors.primary,
  },
  superAdminButton: {
    backgroundColor: '#9B59B6',
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.danger,
    paddingVertical: 10,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  roleSelectorButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleSelectorButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  roleSelectorText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  roleSelectorTextActive: {
    color: colors.primary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});
