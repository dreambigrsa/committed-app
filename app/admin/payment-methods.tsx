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
  Switch,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { Plus, Trash2, Shield, CreditCard, Edit2, X, Save, Info } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as PaymentAdminService from '@/lib/payment-admin-service';
import { LinearGradient } from 'expo-linear-gradient';

const PAYMENT_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦', color: '#3B82F6' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱', color: '#10B981' },
  { value: 'cash', label: 'Cash Payment', icon: '💵', color: '#F59E0B' },
  { value: 'crypto', label: 'Cryptocurrency', icon: '₿', color: '#8B5CF6' },
  { value: 'other', label: 'Other', icon: '💳', color: '#6B7280' },
];

export default function AdminPaymentMethodsScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    paymentType: 'bank_transfer' as 'bank_transfer' | 'mobile_money' | 'cash' | 'crypto' | 'other',
    accountDetails: '',
    instructions: '',
    displayOrder: '0',
    iconEmoji: '',
  });
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setIsLoading(true);
      const methods = await PaymentAdminService.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      paymentType: 'bank_transfer',
      accountDetails: '',
      instructions: '',
      displayOrder: '0',
      iconEmoji: '',
    });
  };

  const handleEdit = (method: any) => {
    setEditingMethod(method);
    setFormData({
      name: method.name || '',
      description: method.description || '',
      paymentType: method.payment_type || 'bank_transfer',
      accountDetails: JSON.stringify(method.account_details || {}, null, 2),
      instructions: method.instructions || '',
      displayOrder: method.display_order?.toString() || '0',
      iconEmoji: method.icon_emoji || '',
    });
    setShowAddModal(true);
  };

  const handleToggleActive = async (methodId: string, currentStatus: boolean) => {
    try {
      await PaymentAdminService.updatePaymentMethod(methodId, {
        isActive: !currentStatus,
      });
      Alert.alert('Success', 'Payment method updated');
      loadPaymentMethods();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update payment method');
    }
  };

  const handleDelete = (methodId: string, name: string) => {
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await PaymentAdminService.deletePaymentMethod(methodId);
              Alert.alert('Success', 'Payment method deleted');
              loadPaymentMethods();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete payment method');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Please enter a payment method name');
      return;
    }

    let accountDetailsObj = {};
    if (formData.accountDetails.trim()) {
      try {
        accountDetailsObj = JSON.parse(formData.accountDetails);
      } catch (e) {
        Alert.alert('Error', 'Invalid JSON in account details. Please check the format.');
        return;
      }
    }

    try {
      if (editingMethod) {
        await PaymentAdminService.updatePaymentMethod(editingMethod.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          accountDetails: Object.keys(accountDetailsObj).length > 0 ? accountDetailsObj : undefined,
          instructions: formData.instructions.trim() || undefined,
          displayOrder: parseInt(formData.displayOrder) || 0,
          iconEmoji: formData.iconEmoji.trim() || undefined,
        });
        Alert.alert('Success', 'Payment method updated successfully');
      } else {
        await PaymentAdminService.createPaymentMethod({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          paymentType: formData.paymentType,
          accountDetails: Object.keys(accountDetailsObj).length > 0 ? accountDetailsObj : undefined,
          instructions: formData.instructions.trim() || undefined,
          displayOrder: parseInt(formData.displayOrder) || 0,
          iconEmoji: formData.iconEmoji.trim() || undefined,
        });
        Alert.alert('Success', 'Payment method created successfully');
      }
      setShowAddModal(false);
      resetForm();
      setEditingMethod(null);
      loadPaymentMethods();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save payment method');
    }
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Payment Methods', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedType = PAYMENT_TYPES.find(t => t.value === formData.paymentType);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Payment Methods', headerShown: true }} />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
            {paymentMethods?.length === 0 ? (
              <View style={styles.emptyState}>
                <CreditCard size={64} color={colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No Payment Methods</Text>
                <Text style={styles.emptyText}>
                  Add payment methods to allow users to subscribe
                </Text>
              </View>
            ) : (
              paymentMethods?.map((method: any) => {
                const typeInfo = PAYMENT_TYPES.find(t => t.value === method.payment_type);
                return (
                  <View key={method.id} style={[styles.methodCard, !method.is_active && styles.inactiveCard]}>
                    <View style={styles.methodHeader}>
                      <View style={[styles.iconContainer, { backgroundColor: (typeInfo?.color || colors.primary) + '15' }]}>
                        <Text style={styles.methodIcon}>{method.icon_emoji || typeInfo?.icon || '💳'}</Text>
                      </View>
                      <View style={styles.methodInfo}>
                        <View style={styles.methodTitleRow}>
                          <Text style={styles.methodName}>{method.name}</Text>
                          {!method.is_active && (
                            <View style={styles.inactiveBadge}>
                              <Text style={styles.inactiveText}>Inactive</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.methodType}>
                          {typeInfo?.label || method.payment_type}
                        </Text>
                      </View>
                      <View style={styles.methodActions}>
                        <Switch
                          value={method.is_active}
                          onValueChange={() => handleToggleActive(method.id, method.is_active)}
                          trackColor={{ false: colors.border.light, true: colors.primary + '50' }}
                          thumbColor={method.is_active ? colors.primary : colors.text.tertiary}
                        />
                      </View>
                    </View>

                    {method.description && (
                      <Text style={styles.methodDescription}>{method.description}</Text>
                    )}

                    {method.account_details && Object.keys(method.account_details).length > 0 && (
                      <View style={styles.detailsSection}>
                        <Text style={styles.detailsTitle}>Account Details</Text>
                        <View style={styles.detailsGrid}>
                          {Object.entries(method.account_details).map(([key, value]: [string, any]) => (
                            <View key={key} style={styles.detailItem}>
                              <Text style={styles.detailLabel}>
                                {key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Text>
                              <Text style={styles.detailValue}>{value}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {method.instructions && (
                      <View style={styles.instructionsSection}>
                        <Text style={styles.instructionsTitle}>Instructions</Text>
                        <Text style={styles.instructionsText}>{method.instructions}</Text>
                      </View>
                    )}

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEdit(method)}
                      >
                        <Edit2 size={18} color={colors.primary} />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(method.id, method.name)}
                      >
                        <Trash2 size={18} color={colors.danger} />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </TouchableOpacity>
                      <View style={styles.orderBadge}>
                        <Text style={styles.orderText}>Order: {method.display_order}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Floating Add Button */}
          <TouchableOpacity
            style={styles.floatingAddButton}
            onPress={() => {
              resetForm();
              setEditingMethod(null);
              setShowAddModal(true);
            }}
          >
            <LinearGradient
              colors={[colors.primary, colors.primary + 'DD']}
              style={styles.floatingButtonGradient}
            >
              <Plus size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
          setEditingMethod(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={[styles.modalIconContainer, { backgroundColor: (selectedType?.color || colors.primary) + '15' }]}>
                    <Text style={styles.modalIcon}>{selectedType?.icon || '💳'}</Text>
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>
                      {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      {selectedType?.label || 'Configure payment settings'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                    setEditingMethod(null);
                  }}
                >
                  <X size={24} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <View style={styles.formContent}>
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Bank Transfer"
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Brief description of the payment method"
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Payment Type *</Text>
                  <View style={styles.typeGrid}>
                    {PAYMENT_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeCard,
                          formData.paymentType === type.value && {
                            borderColor: type.color,
                            backgroundColor: type.color + '10',
                          },
                        ]}
                        onPress={() => setFormData({ ...formData, paymentType: type.value as any })}
                      >
                        <Text style={styles.typeCardIcon}>{type.icon}</Text>
                        <Text
                          style={[
                            styles.typeCardText,
                            formData.paymentType === type.value && { color: type.color, fontWeight: '600' },
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Account Details (JSON)</Text>
                    <Info size={16} color={colors.text.tertiary} />
                  </View>
                  <Text style={styles.inputHint}>
                    Example: {'{"bank_name": "Example Bank", "account_number": "1234567890"}'}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea, styles.codeInput]}
                    placeholder='{"bank_name": "Example Bank", "account_number": "1234567890"}'
                    value={formData.accountDetails}
                    onChangeText={(text) => setFormData({ ...formData, accountDetails: text })}
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={6}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>Instructions</Text>
                  <Text style={styles.inputHint}>
                    Step-by-step instructions for users (use \n for new lines)
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="1. Step one\n2. Step two\n3. Step three"
                    value={formData.instructions}
                    onChangeText={(text) => setFormData({ ...formData, instructions: text })}
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={5}
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Icon Emoji</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="🏦"
                      value={formData.iconEmoji}
                      onChangeText={(text) => setFormData({ ...formData, iconEmoji: text })}
                      placeholderTextColor={colors.text.tertiary}
                      maxLength={2}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Display Order</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      value={formData.displayOrder}
                      onChangeText={(text) => setFormData({ ...formData, displayOrder: text })}
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowAddModal(false);
                    resetForm();
                    setEditingMethod(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSubmit}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primary + 'DD']}
                    style={styles.saveButtonGradient}
                  >
                    <Save size={18} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      {editingMethod ? 'Update' : 'Create'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 100,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      gap: 16,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    methodCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    inactiveCard: {
      opacity: 0.6,
    },
    methodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    iconContainer: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    methodIcon: {
      fontSize: 28,
    },
    methodInfo: {
      flex: 1,
    },
    methodTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    methodName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    inactiveBadge: {
      backgroundColor: colors.danger + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    inactiveText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.danger,
    },
    methodType: {
      fontSize: 14,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    methodActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    methodDescription: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: 16,
    },
    detailsSection: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    detailsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 12,
    },
    detailsGrid: {
      gap: 12,
    },
    detailItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    detailLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
      textTransform: 'capitalize',
    },
    detailValue: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      fontFamily: 'monospace',
    },
    instructionsSection: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    instructionsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    instructionsText: {
      fontSize: 13,
      color: colors.text.primary,
      lineHeight: 20,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 10,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.danger + '15',
      borderRadius: 10,
    },
    deleteButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.danger,
    },
    orderBadge: {
      marginLeft: 'auto',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.background.primary,
      borderRadius: 8,
    },
    orderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    floatingAddButton: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 32,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    floatingButtonGradient: {
      width: '100%',
      height: '100%',
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 16,
    },
    modalScroll: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      flex: 1,
    },
    modalIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalIcon: {
      fontSize: 24,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    modalCloseButton: {
      padding: 8,
    },
    formContent: {
      padding: 24,
      gap: 20,
    },
    formGroup: {
      gap: 8,
    },
    formRow: {
      flexDirection: 'row',
      gap: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    inputHint: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    codeInput: {
      fontFamily: 'monospace',
      fontSize: 14,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    typeCard: {
      width: '47%',
      padding: 16,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border.light,
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background.secondary,
    },
    typeCardIcon: {
      fontSize: 32,
    },
    typeCardText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.primary,
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      padding: 24,
      paddingTop: 0,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.primary,
    },
    saveButton: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
    },
    saveButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      gap: 8,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
