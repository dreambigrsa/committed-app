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
import { Plus, Trash2, Edit2, Shield, Save, X } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function AdminDatingInterestsScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [loading, setLoading] = useState(false);
  const [interests, setInterests] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [_editingInterest, _setEditingInterest] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newInterest, setNewInterest] = useState({ name: '', icon: '', category: 'hobbies' });

  useEffect(() => {
    loadInterests();
  }, []);

  const loadInterests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dating_interests')
        .select('*')
        .order('category', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;

      setInterests(data || []);
      
      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set((data || []).map((i: any) => i.category).filter(Boolean))
      );
      setCategories(uniqueCategories as string[]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInterest = async () => {
    if (!newInterest.name.trim()) {
      Alert.alert('Error', 'Please enter an interest name');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('dating_interests')
        .insert({
          name: newInterest.name.trim(),
          icon_emoji: newInterest.icon || null,
          category: newInterest.category,
          display_order: interests.length + 1,
          created_by: currentUser?.id,
        });

      if (error) throw error;

      Alert.alert('Success', 'Interest added successfully');
      setShowAddModal(false);
      setNewInterest({ name: '', icon: '', category: 'hobbies' });
      loadInterests();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (interestId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('dating_interests')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', interestId);

      if (error) throw error;
      loadInterests();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDelete = async (interestId: string, name: string) => {
    Alert.alert(
      'Delete Interest',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('dating_interests')
                .delete()
                .eq('id', interestId);

              if (error) throw error;
              loadInterests();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const filteredInterests = selectedCategory === 'all'
    ? interests
    : interests.filter((i) => i.category === selectedCategory);

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Dating Interests', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Dating Interests', headerShown: true }} />
      
      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.categoryText, selectedCategory === 'all' && styles.categoryTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {filteredInterests.map((interest) => (
            <View key={interest.id} style={styles.interestCard}>
              <View style={styles.interestLeft}>
                {interest.icon_emoji && (
                  <Text style={styles.interestIcon}>{interest.icon_emoji}</Text>
                )}
                <View style={styles.interestInfo}>
                  <Text style={styles.interestName}>{interest.name}</Text>
                  <Text style={styles.interestCategory}>{interest.category || 'uncategorized'}</Text>
                </View>
              </View>
              <View style={styles.interestActions}>
                <Switch
                  value={interest.is_active}
                  onValueChange={() => handleToggleActive(interest.id, interest.is_active)}
                  trackColor={{ false: colors.border.light, true: colors.primary + '50' }}
                  thumbColor={interest.is_active ? colors.primary : colors.text.tertiary}
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(interest.id, interest.name)}
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
        onPress={() => setShowAddModal(true)}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Modal */}
      {showAddModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Interest</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Photography"
                  value={newInterest.name}
                  onChangeText={(text) => setNewInterest({ ...newInterest, name: text })}
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Emoji Icon (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="📷"
                  value={newInterest.icon}
                  onChangeText={(text) => setNewInterest({ ...newInterest, icon: text })}
                  placeholderTextColor={colors.text.tertiary}
                  maxLength={2}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
                  {['sports', 'music', 'entertainment', 'food', 'travel', 'arts', 'tech', 'lifestyle', 'social', 'hobbies', 'other'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryOption,
                        newInterest.category === cat && styles.categoryOptionActive,
                      ]}
                      onPress={() => setNewInterest({ ...newInterest, category: cat })}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          newInterest.category === cat && styles.categoryOptionTextActive,
                        ]}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewInterest({ name: '', icon: '', category: 'hobbies' });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddInterest}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Interest</Text>
                )}
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
    categoryScroll: {
      maxHeight: 60,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    categoryContainer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
    },
    categoryChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginRight: 8,
    },
    categoryChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    categoryTextActive: {
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
    interestCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
    },
    interestLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    interestIcon: {
      fontSize: 32,
    },
    interestInfo: {
      flex: 1,
    },
    interestName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    interestCategory: {
      fontSize: 12,
      color: colors.text.secondary,
      textTransform: 'capitalize',
    },
    interestActions: {
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
    input: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    categorySelector: {
      flexDirection: 'row',
      gap: 8,
    },
    categoryOption: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    categoryOptionActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryOptionText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.primary,
    },
    categoryOptionTextActive: {
      color: '#fff',
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
  });

