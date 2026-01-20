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
import { Plus, Trash2, Save, Shield, Calendar } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

const OPTION_TYPES = [
  { value: 'dress_code', label: 'Dress Codes' },
  { value: 'budget_range', label: 'Budget Ranges' },
  { value: 'expense_handling', label: 'Expense Handling' },
  { value: 'suggested_activity', label: 'Suggested Activities' },
  { value: 'date_duration', label: 'Date Duration' },
  { value: 'group_size', label: 'Group Size' },
  { value: 'time_of_day', label: 'Time of Day' },
];

export default function AdminDatingDateOptionsScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [selectedType, setSelectedType] = useState<string>('dress_code');
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOption, setNewOption] = useState({ value: '', label: '', order: '0', description: '', icon: '' });
  const [optionsData, setOptionsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadOptions = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('dating_date_options')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Group by option_type
      const grouped: any = {};
      (data || []).forEach((option: any) => {
        if (!grouped[option.option_type]) {
          grouped[option.option_type] = [];
        }
        grouped[option.option_type].push(option);
      });

      setOptionsData({ all: data || [], grouped });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load options');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const handleToggleActive = async (optionId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('dating_date_options')
        .update({ is_active: !currentStatus })
        .eq('id', optionId);

      if (error) throw error;
      Alert.alert('Success', 'Option updated successfully');
      loadOptions();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update option');
    }
  };

  const handleDelete = async (optionId: string, label: string) => {
    Alert.alert(
      'Delete Option',
      `Are you sure you want to delete "${label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('dating_date_options')
                .delete()
                .eq('id', optionId);

              if (error) throw error;
              Alert.alert('Success', 'Option deleted successfully');
              loadOptions();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete option');
            }
          },
        },
      ]
    );
  };

  const handleAddOption = async () => {
    if (!newOption.value.trim() || !newOption.label.trim()) {
      Alert.alert('Error', 'Please fill in value and label');
      return;
    }

    try {
      const { error } = await supabase
        .from('dating_date_options')
        .insert({
          option_type: selectedType,
          option_value: newOption.value.trim(),
          display_label: newOption.label.trim(),
          display_order: parseInt(newOption.order) || 0,
          description: newOption.description.trim() || null,
          icon_emoji: newOption.icon.trim() || null,
          is_active: true,
        });

      if (error) throw error;
      Alert.alert('Success', 'Option created successfully');
      setShowAddModal(false);
      setNewOption({ value: '', label: '', order: '0', description: '', icon: '' });
      loadOptions();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create option');
    }
  };

  const filteredOptions = optionsData?.grouped?.[selectedType] || [];

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Date Options', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Date Options', headerShown: true }} />
      
      {/* Type Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeScroll}
        contentContainerStyle={styles.typeContainer}
      >
        {OPTION_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[styles.typeChip, selectedType === type.value && styles.typeChipActive]}
            onPress={() => setSelectedType(type.value)}
          >
            <Text style={[styles.typeText, selectedType === type.value && styles.typeTextActive]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {filteredOptions.length === 0 ? (
            <View style={styles.emptyState}>
              <Calendar size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No {OPTION_TYPES.find(t => t.value === selectedType)?.label.toLowerCase()} found</Text>
              <Text style={styles.emptySubtext}>Tap the + button to add a new option</Text>
            </View>
          ) : (
            filteredOptions.map((option: any) => (
            <View key={option.id} style={styles.optionCard}>
              <View style={styles.optionLeft}>
                <View style={styles.optionInfo}>
                  <Text style={styles.optionValue}>{option.option_value}</Text>
                  <Text style={styles.optionLabel}>{option.display_label}</Text>
                  <Text style={styles.optionOrder}>Order: {option.display_order}</Text>
                </View>
              </View>
              <View style={styles.optionActions}>
                <Switch
                  value={option.is_active}
                  onValueChange={() => handleToggleActive(option.id, option.is_active)}
                  trackColor={{ false: colors.border.light, true: colors.primary + '50' }}
                  thumbColor={option.is_active ? colors.primary : colors.text.tertiary}
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(option.id, option.display_label)}
                >
                  <Trash2 size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Option</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Option Value *</Text>
                <Text style={styles.inputHint}>
                  Internal value (e.g., "casual", "low", "coffee")
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., casual"
                  value={newOption.value}
                  onChangeText={(text) => setNewOption({ ...newOption, value: text })}
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Label *</Text>
                <Text style={styles.inputHint}>
                  What users will see (e.g., "Casual", "Low Budget", "Coffee & Conversation")
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Casual"
                  value={newOption.label}
                  onChangeText={(text) => setNewOption({ ...newOption, label: text })}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Order</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={newOption.order}
                  onChangeText={(text) => setNewOption({ ...newOption, order: text })}
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Under $50"
                  value={newOption.description}
                  onChangeText={(text) => setNewOption({ ...newOption, description: text })}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Icon Emoji (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., ☕"
                  value={newOption.icon}
                  onChangeText={(text) => setNewOption({ ...newOption, icon: text })}
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewOption({ value: '', label: '', order: '0', description: '', icon: '' });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddOption}
              >
                <Text style={styles.saveButtonText}>Add Option</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    typeScroll: {
      maxHeight: 60,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    typeContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
    },
    typeChip: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginRight: 8,
    },
    typeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    typeTextActive: {
      color: '#fff',
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
    optionCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    optionLeft: {
      flex: 1,
    },
    optionInfo: {
      gap: 4,
    },
    optionValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      fontFamily: 'monospace',
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    optionOrder: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    optionActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
      maxWidth: 400,
      backgroundColor: colors.background.primary,
      borderRadius: 24,
      padding: 24,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
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
    modalContent: {
      gap: 16,
    },
    inputGroup: {
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
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
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
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
  });

