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
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { Briefcase, Plus, Edit, Trash2, X, Save, Settings as SettingsIcon } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalRole } from '@/types';
import colors from '@/constants/colors';

export default function AdminProfessionalRolesScreen() {
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  
  const [roles, setRoles] = useState<ProfessionalRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<ProfessionalRole | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [requiresCredentials, setRequiresCredentials] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [eligibleForLiveChat, setEligibleForLiveChat] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [disclaimerText, setDisclaimerText] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_roles')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      setRoles(data || []);
    } catch (error: any) {
      console.error('Error loading roles:', error);
      Alert.alert('Error', 'Failed to load professional roles');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (role: ProfessionalRole) => {
    setEditingRole(role);
    setName(role.name);
    setCategory(role.category);
    setDescription(role.description || '');
    setRequiresCredentials(role.requiresCredentials);
    setRequiresVerification(role.requiresVerification);
    setEligibleForLiveChat(role.eligibleForLiveChat);
    setApprovalRequired(role.approvalRequired);
    setDisclaimerText(role.disclaimerText || '');
    setIsActive(role.isActive);
    setDisplayOrder(role.displayOrder);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingRole(null);
    setName('');
    setCategory('');
    setDescription('');
    setRequiresCredentials(true);
    setRequiresVerification(true);
    setEligibleForLiveChat(true);
    setApprovalRequired(true);
    setDisclaimerText('');
    setIsActive(true);
    setDisplayOrder(roles.length);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !category.trim()) {
      Alert.alert('Error', 'Name and category are required');
      return;
    }

    try {
      const roleData = {
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || null,
        requires_credentials: requiresCredentials,
        requires_verification: requiresVerification,
        eligible_for_live_chat: eligibleForLiveChat,
        approval_required: approvalRequired,
        disclaimer_text: disclaimerText.trim() || null,
        is_active: isActive,
        display_order: displayOrder,
        ai_matching_rules: {},
      };

      if (editingRole) {
        const { error } = await supabase
          .from('professional_roles')
          .update(roleData)
          .eq('id', editingRole.id);
        
        if (error) throw error;
        Alert.alert('Success', 'Role updated successfully');
      } else {
        const { error } = await supabase
          .from('professional_roles')
          .insert([{ ...roleData, created_by: currentUser?.id }]);
        
        if (error) throw error;
        Alert.alert('Success', 'Role created successfully');
      }

      setShowModal(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      Alert.alert('Error', error.message || 'Failed to save role');
    }
  };

  const handleDelete = (role: ProfessionalRole | any) => {
    Alert.alert(
      'Delete Role',
      `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('professional_roles')
                .delete()
                .eq('id', role.id);
              
              if (error) throw error;
              Alert.alert('Success', 'Role deleted successfully');
              loadRoles();
            } catch (error: any) {
              console.error('Error deleting role:', error);
              Alert.alert('Error', 'Failed to delete role. It may be in use by active professionals.');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (role: ProfessionalRole) => {
    try {
      const { error } = await supabase
        .from('professional_roles')
        .update({ is_active: !role.isActive })
        .eq('id', role.id);
      
      if (error) throw error;
      loadRoles();
    } catch (error: any) {
      console.error('Error toggling role:', error);
      Alert.alert('Error', 'Failed to update role status');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Professional Roles' }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Professional Roles',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleCreate}
              style={styles.headerButton}
            >
              <Plus size={24} color={themeColors.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {roles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Briefcase size={64} color={themeColors.text.tertiary} />
              <Text style={styles.emptyText}>No professional roles yet</Text>
              <Text style={styles.emptySubtext}>Create your first role to get started</Text>
              <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
                <Plus size={20} color={colors.text.white} />
                <Text style={styles.createButtonText}>Create Role</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rolesList}>
              {roles.map((role: ProfessionalRole | any) => (
                <View key={role.id} style={styles.roleCard}>
                  <View style={styles.roleHeader}>
                    <View style={styles.roleInfo}>
                      <View style={styles.roleTitleRow}>
                        <Text style={styles.roleName}>{role.name}</Text>
                        <View style={[styles.statusBadge, role.isActive ? styles.activeBadge : styles.inactiveBadge]}>
                          <Text style={[styles.statusText, role.isActive ? styles.activeText : styles.inactiveText]}>
                            {role.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.roleCategory}>{role.category}</Text>
                      {role.description && (
                        <Text style={styles.roleDescription}>{role.description}</Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.roleDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Credentials Required:</Text>
                      <Text style={styles.detailValue}>{role.requiresCredentials ? 'Yes' : 'No'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Live Chat Eligible:</Text>
                      <Text style={styles.detailValue}>{role.eligibleForLiveChat ? 'Yes' : 'No'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Approval Required:</Text>
                      <Text style={styles.detailValue}>{role.approvalRequired ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>

                  <View style={styles.roleActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.toggleButton]}
                      onPress={() => handleToggleActive(role)}
                    >
                      <Text style={[styles.actionButtonText, role.isActive ? styles.deactivateText : styles.activateText]}>
                        {role.isActive ? 'Deactivate' : 'Activate'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => handleEdit(role)}
                    >
                      <Edit size={16} color={themeColors.primary} />
                      <Text style={[styles.actionButtonText, styles.editText]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(role)}
                    >
                      <Trash2 size={16} color={colors.danger} />
                      <Text style={[styles.actionButtonText, styles.deleteText]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Create/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingRole ? 'Edit Role' : 'Create Role'}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X size={24} color={themeColors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Counselor, Relationship Therapist"
                placeholderTextColor={themeColors.text.tertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="e.g., Therapy, Coaching, Legal"
                placeholderTextColor={themeColors.text.tertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe this professional role"
                multiline
                numberOfLines={4}
                placeholderTextColor={themeColors.text.tertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Disclaimer Text</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={disclaimerText}
                onChangeText={setDisclaimerText}
                placeholder="Role-specific disclaimer shown to users"
                multiline
                numberOfLines={4}
                placeholderTextColor={themeColors.text.tertiary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Display Order</Text>
              <TextInput
                style={styles.input}
                value={displayOrder.toString()}
                onChangeText={(text: string) => setDisplayOrder(parseInt(text) || 0)}
                keyboardType="numeric"
                placeholderTextColor={themeColors.text.tertiary}
              />
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Requires Credentials</Text>
                  <Text style={styles.switchDescription}>Professionals must provide credentials</Text>
                </View>
                <Switch
                  value={requiresCredentials}
                  onValueChange={setRequiresCredentials}
                  trackColor={{ false: themeColors.border.light, true: themeColors.primary + '80' }}
                  thumbColor={requiresCredentials ? themeColors.primary : themeColors.text.tertiary}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Requires Verification</Text>
                  <Text style={styles.switchDescription}>Credentials must be verified by admin</Text>
                </View>
                <Switch
                  value={requiresVerification}
                  onValueChange={setRequiresVerification}
                  trackColor={{ false: themeColors.border.light, true: themeColors.primary + '80' }}
                  thumbColor={requiresVerification ? themeColors.primary : themeColors.text.tertiary}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Eligible for Live Chat</Text>
                  <Text style={styles.switchDescription}>Can join live conversations with users</Text>
                </View>
                <Switch
                  value={eligibleForLiveChat}
                  onValueChange={setEligibleForLiveChat}
                  trackColor={{ false: themeColors.border.light, true: themeColors.primary + '80' }}
                  thumbColor={eligibleForLiveChat ? themeColors.primary : themeColors.text.tertiary}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Approval Required</Text>
                  <Text style={styles.switchDescription}>Admin must approve professionals</Text>
                </View>
                <Switch
                  value={approvalRequired}
                  onValueChange={setApprovalRequired}
                  trackColor={{ false: themeColors.border.light, true: themeColors.primary + '80' }}
                  thumbColor={approvalRequired ? themeColors.primary : themeColors.text.tertiary}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                  <Text style={styles.switchLabel}>Active</Text>
                  <Text style={styles.switchDescription}>Role is visible and available</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: themeColors.border.light, true: themeColors.primary + '80' }}
                  thumbColor={isActive ? themeColors.primary : themeColors.text.tertiary}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.footerButton, styles.cancelButton]}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerButton, styles.saveButton]}
              onPress={handleSave}
            >
                  <Save size={20} color={colors.text.white} />
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
    fontWeight: '600',
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
  headerButton: {
    padding: 8,
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
  rolesList: {
    padding: 16,
    gap: 16,
  },
  roleCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleHeader: {
    marginBottom: 12,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roleName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: colors.success + '20',
  },
  inactiveBadge: {
    backgroundColor: colors.text.tertiary + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: colors.success,
  },
  inactiveText: {
    color: colors.text.tertiary,
  },
  roleCategory: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  roleDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  roleActions: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  toggleButton: {
    backgroundColor: colors.background.secondary,
  },
  editButton: {
    backgroundColor: colors.primary + '15',
  },
  deleteButton: {
    backgroundColor: colors.danger + '15',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editText: {
    color: colors.primary,
  },
  deleteText: {
    color: colors.danger,
  },
  activateText: {
    color: colors.success,
  },
  deactivateText: {
    color: colors.text.secondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background.primary,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchGroup: {
    marginTop: 8,
    gap: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background.primary,
    gap: 12,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: colors.background.secondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.white,
  },
});

