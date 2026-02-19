import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Stack } from 'expo-router';
import { Briefcase, Plus, Edit, Trash2, X, Save, CheckCircle2, Shield, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { ProfessionalRole } from '@/types';
import { colors } from '@/constants/colors';

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

  const mapRole = (role: any): ProfessionalRole => {
    return {
      id: role.id,
      name: role.name,
      category: role.category,
      description: role.description,
      requiresCredentials: role.requires_credentials ?? role.requiresCredentials ?? false,
      requiresVerification: role.requires_verification ?? role.requiresVerification ?? false,
      eligibleForLiveChat: role.eligible_for_live_chat ?? role.eligibleForLiveChat ?? false,
      approvalRequired: role.approval_required ?? role.approvalRequired ?? false,
      disclaimerText: role.disclaimer_text ?? role.disclaimerText,
      aiMatchingRules: role.ai_matching_rules ?? role.aiMatchingRules ?? {},
      isActive: role.is_active ?? role.isActive ?? false,
      displayOrder: role.display_order ?? role.displayOrder ?? 0,
      createdAt: role.created_at ?? role.createdAt ?? new Date().toISOString(),
      updatedAt: role.updated_at ?? role.updatedAt ?? new Date().toISOString(),
    };
  };

  const loadRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_roles')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      setRoles((data || []).map(mapRole));
    } catch (error: any) {
      console.error('Error loading roles:', error);
      Alert.alert('Error', 'Failed to load professional roles');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (role: ProfessionalRole | any) => {
    // Map role if it's from database (snake_case)
    const mappedRole = role.id && (role.is_active !== undefined || role.isActive !== undefined) 
      ? mapRole(role) 
      : role;
    
    setEditingRole(mappedRole);
    setName(mappedRole.name || '');
    setCategory(mappedRole.category || '');
    setDescription(mappedRole.description || '');
    setRequiresCredentials(mappedRole.requiresCredentials ?? false);
    setRequiresVerification(mappedRole.requiresVerification ?? false);
    setEligibleForLiveChat(mappedRole.eligibleForLiveChat ?? false);
    setApprovalRequired(mappedRole.approvalRequired ?? false);
    setDisclaimerText(mappedRole.disclaimerText || '');
    setIsActive(mappedRole.isActive ?? false);
    setDisplayOrder(mappedRole.displayOrder ?? 0);
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
          .update({
            ...roleData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRole.id);
        
        if (error) throw error;
        Alert.alert('Success', 'Role updated successfully');
      } else {
        const { error } = await supabase
          .from('professional_roles')
          .insert([{ 
            ...roleData, 
            created_by: currentUser?.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
        
        if (error) throw error;
        Alert.alert('Success', 'Role created successfully');
      }

      setShowModal(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      
      // Extract error message properly
      let errorMessage = 'Failed to save role';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error_description) {
        errorMessage = error.error_description;
      } else if (error?.hint) {
        errorMessage = error.hint;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.code) {
        errorMessage = `Error ${error.code}: ${error.message || 'Unknown error'}`;
      }
      
      Alert.alert('Error Saving Role', errorMessage);
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

  const handleToggleActive = async (role: ProfessionalRole | any) => {
    try {
      // Get current active status (handle both snake_case and camelCase)
      const currentStatus = role.is_active ?? role.isActive ?? false;
      const newStatus = !currentStatus;
      
      const { error } = await supabase
        .from('professional_roles')
        .update({ is_active: newStatus })
        .eq('id', role.id);
      
      if (error) throw error;
      
      // Reload roles to reflect the change
      await loadRoles();
    } catch (error: any) {
      console.error('Error toggling role:', error);
      Alert.alert('Error', error.message || 'Failed to update role status');
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
              {roles.map((role: ProfessionalRole | any, index: number) => {
                // Ensure role is properly mapped
                const mappedRole = role.id ? (role.is_active !== undefined || role.isActive !== undefined ? mapRole(role) : role) : role;
                const isActive = mappedRole.isActive ?? false;
                const requiresCredentials = mappedRole.requiresCredentials ?? false;
                const eligibleForLiveChat = mappedRole.eligibleForLiveChat ?? false;
                
                return (
                  <TouchableOpacity
                    key={mappedRole.id}
                    style={styles.roleCard}
                    activeOpacity={0.9}
                    onPress={() => handleEdit(mappedRole)}
                  >
                    <LinearGradient
                      colors={isActive ? [themeColors.primary + '10', 'transparent'] : [themeColors.background.secondary, themeColors.background.secondary]}
                      style={styles.roleCardGradient}
                    >
                      <View style={styles.roleCardHeader}>
                        <View style={styles.roleCardIconContainer}>
                          <Briefcase size={24} color={isActive ? themeColors.primary : themeColors.text.secondary} />
                        </View>
                        <View style={styles.roleCardContent}>
                          <View style={styles.roleCardTitleRow}>
                            <Text style={[styles.roleCardName, !isActive && styles.roleCardNameInactive]}>
                              {mappedRole.name}
                            </Text>
                            <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.inactiveBadge]}>
                              {isActive ? (
                                <CheckCircle2 size={14} color={colors.secondary} />
                              ) : (
                                <AlertCircle size={14} color={themeColors.text.tertiary} />
                              )}
                              <Text style={[styles.statusText, isActive ? styles.activeText : styles.inactiveText]}>
                                {isActive ? 'Active' : 'Inactive'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.roleCategoryBadge}>
                            <Text style={styles.roleCategoryText}>{mappedRole.category}</Text>
                          </View>
                          {mappedRole.description && (
                            <Text style={styles.roleCardDescription} numberOfLines={2}>
                              {mappedRole.description}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.roleFeaturesGrid}>
                        <View style={styles.featureItem}>
                          <Shield size={16} color={requiresCredentials ? colors.secondary : themeColors.text.tertiary} />
                          <Text style={[styles.featureText, !requiresCredentials && styles.featureTextInactive]}>
                            {requiresCredentials ? 'Credentials' : 'No Credentials'}
                          </Text>
                        </View>
                        <View style={styles.featureItem}>
                          <CheckCircle2 size={16} color={eligibleForLiveChat ? colors.secondary : themeColors.text.tertiary} />
                          <Text style={[styles.featureText, !eligibleForLiveChat && styles.featureTextInactive]}>
                            {eligibleForLiveChat ? 'Live Chat' : 'No Live Chat'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.roleCardActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.toggleButtonSmall]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleToggleActive(mappedRole);
                          }}
                        >
                          <Text style={[styles.actionButtonSmallText, isActive ? styles.deactivateText : styles.activateText]}>
                            {isActive ? 'Deactivate' : 'Activate'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(mappedRole);
                          }}
                        >
                          <Edit size={16} color={themeColors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.deleteButtonSmall]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(mappedRole);
                          }}
                        >
                          <Trash2 size={16} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
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

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Basic Information Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Basic Information</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Counselor, Relationship Therapist"
                  placeholderTextColor={themeColors.text.tertiary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
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
            </View>

            {/* Additional Information Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Additional Information</Text>
              
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
                  value={(displayOrder ?? 0).toString()}
                  onChangeText={(text: string) => setDisplayOrder(parseInt(text) || 0)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={themeColors.text.tertiary}
                />
                <Text style={styles.helperText}>Lower numbers appear first in lists</Text>
              </View>
            </View>

            {/* Settings Section */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Settings</Text>
              
              <View style={styles.switchGroup}>
                <View style={styles.switchCard}>
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

                <View style={styles.switchCard}>
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

                <View style={styles.switchCard}>
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

                <View style={styles.switchCard}>
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

                <View style={styles.switchCard}>
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
    padding: 20,
    gap: 20,
  },
  roleCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  roleCardGradient: {
    padding: 20,
  },
  roleCardHeader: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  roleCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCardContent: {
    flex: 1,
    gap: 8,
  },
  roleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  roleCardName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    flex: 1,
  },
  roleCardNameInactive: {
    color: colors.text.secondary,
    opacity: 0.7,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadge: {
    backgroundColor: colors.secondary + '20',
  },
  inactiveBadge: {
    backgroundColor: colors.text.tertiary + '20',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeText: {
    color: colors.secondary,
  },
  inactiveText: {
    color: colors.text.tertiary,
  },
  roleCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleCategoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  roleCardDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginTop: 4,
  },
  roleFeaturesGrid: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  featureTextInactive: {
    color: colors.text.tertiary,
  },
  roleCardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  actionButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    flex: 1,
  },
  toggleButtonSmall: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  editButtonSmall: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  deleteButtonSmall: {
    backgroundColor: colors.danger + '20',
    borderWidth: 1,
    borderColor: colors.danger + '40',
  },
  actionButtonSmallText: {
    fontSize: 13,
    fontWeight: '700',
  },
  activateText: {
    color: colors.secondary,
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
  formSection: {
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 10,
  },
  required: {
    color: colors.danger,
  },
  input: {
    backgroundColor: colors.background.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text.primary,
    minHeight: 48,
  },
  helperText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 6,
    fontStyle: 'italic',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  switchGroup: {
    gap: 12,
  },
  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
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

