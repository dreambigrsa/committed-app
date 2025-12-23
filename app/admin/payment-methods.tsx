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
} from 'react-native';
import { Stack } from 'expo-router';
import { Plus, Trash2, Shield, CreditCard, Edit2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as PaymentAdminService from '@/lib/payment-admin-service';

const PAYMENT_TYPES = [
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
  { value: 'cash', label: 'Cash Payment', icon: '💵' },
  { value: 'crypto', label: 'Cryptocurrency', icon: '₿' },
  { value: 'other', label: 'Other', icon: '💳' },
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

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Payment Methods', headerShown: true }} />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {paymentMethods?.map((method: any) => (
            <View key={method.id} style={styles.methodCard}>
              <View style={styles.methodLeft}>
                <View style={styles.methodHeader}>
                  <Text style={styles.methodIcon}>{method.icon_emoji || '💳'}</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>{method.name}</Text>
                    <Text style={styles.methodType}>
                      {PAYMENT_TYPES.find(t => t.value === method.payment_type)?.label || method.payment_type}
                    </Text>
                  </View>
                </View>
                {method.description && (
                  <Text style={styles.methodDescription}>{method.description}</Text>
                )}
                {method.account_details && Object.keys(method.account_details).length > 0 && (
                  <View style={styles.accountDetailsContainer}>
                    <Text style={styles.accountDetailsLabel}>Account Details:</Text>
                    {Object.entries(method.account_details).map(([key, value]: [string, any]) => (
                      <Text key={key} style={styles.accountDetail}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}: {value}
                      </Text>
                    ))}
                  </View>
                )}
                {method.instructions && (
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsLabel}>Instructions:</Text>
                    <Text style={styles.instructionsText}>{method.instructions}</Text>
                  </View>
                )}
                <Text style={styles.methodOrder}>Order: {method.display_order}</Text>
              </View>
              <View style={styles.methodActions}>
                <Switch
                  value={method.is_active}
                  onValueChange={() => handleToggleActive(method.id, method.is_active)}
                  trackColor={{ false: colors.border.light, true: colors.primary + '50' }}
                  thumbColor={method.is_active ? colors.primary : colors.text.tertiary}
                />
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEdit(method)}
                >
                  <Edit2 size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(method.id, method.name)}
                >
                  <Trash2 size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          resetForm();
          setEditingMethod(null);
          setShowAddModal(true);
        }}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modal} contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowAddModal(false);
                resetForm();
                setEditingMethod(null);
              }}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
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
              <View style={styles.typeContainer}>
                {PAYMENT_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeChip,
                      formData.paymentType === type.value && styles.typeChipActive,
                    ]}
                    onPress={() => setFormData({ ...formData, paymentType: type.value as any })}
                  >
                    <Text style={styles.typeIcon}>{type.icon}</Text>
                    <Text
                      style={[
                        styles.typeText,
                        formData.paymentType === type.value && styles.typeTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Account Details (JSON)</Text>
              <Text style={styles.inputHint}>
                Example: {"{"}"bank_name": "Example Bank", "account_number": "1234567890"{"}"}
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

            <View style={styles.formGroup}>
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

            <View style={styles.formGroup}>
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
                <Text style={styles.saveButtonText}>
                  {editingMethod ? 'Update' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}
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
    },
    methodCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    methodLeft: {
      flex: 1,
      gap: 8,
    },
    methodHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    methodIcon: {
      fontSize: 32,
    },
    methodInfo: {
      flex: 1,
    },
    methodName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    methodType: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 2,
    },
    methodDescription: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    accountDetailsContainer: {
      marginTop: 8,
      padding: 12,
      backgroundColor: colors.background.primary,
      borderRadius: 8,
    },
    accountDetailsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 6,
    },
    accountDetail: {
      fontSize: 13,
      color: colors.text.primary,
      marginBottom: 4,
      fontFamily: 'monospace',
    },
    instructionsContainer: {
      marginTop: 8,
      padding: 12,
      backgroundColor: colors.background.primary,
      borderRadius: 8,
    },
    instructionsLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 6,
    },
    instructionsText: {
      fontSize: 13,
      color: colors.text.primary,
      lineHeight: 18,
    },
    methodOrder: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 4,
    },
    methodActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    editButton: {
      padding: 8,
    },
    deleteButton: {
      padding: 8,
    },
    addButton: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modal: {
      width: '90%',
      maxWidth: 500,
      maxHeight: '90%',
      backgroundColor: colors.background.primary,
      borderRadius: 24,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 12,
    },
    modalContent: {
      gap: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    closeButton: {
      fontSize: 24,
      color: colors.text.primary,
      fontWeight: '300',
    },
    formGroup: {
      gap: 8,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    inputHint: {
      fontSize: 12,
      color: colors.text.secondary,
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
    typeContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    typeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeIcon: {
      fontSize: 18,
    },
    typeText: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.primary,
    },
    typeTextActive: {
      color: '#fff',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });

