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
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { Plus, Edit2, Trash2, Shield, X, Save } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { TriggerWord } from '@/types';

export default function TriggerWordsManagementScreen() {
  const { currentUser, getTriggerWords, addTriggerWord, updateTriggerWord, deleteTriggerWord } = useApp();
  const [triggerWords, setTriggerWords] = useState<TriggerWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWord, setEditingWord] = useState<TriggerWord | null>(null);
  
  const [newWord, setNewWord] = useState({
    wordPhrase: '',
    severity: 'low' as 'low' | 'medium' | 'high',
    category: 'general' as 'romantic' | 'intimate' | 'suspicious' | 'meetup' | 'secret' | 'general',
  });

  useEffect(() => {
    loadTriggerWords();
  }, []);

  const loadTriggerWords = async () => {
    setLoading(true);
    try {
      const words = await getTriggerWords();
      setTriggerWords(words);
    } catch (error) {
      console.error('Error loading trigger words:', error);
      Alert.alert('Error', 'Failed to load trigger words');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newWord.wordPhrase.trim()) {
      Alert.alert('Error', 'Please enter a word or phrase');
      return;
    }

    const success = await addTriggerWord(newWord.wordPhrase, newWord.severity, newWord.category);
    if (success) {
      Alert.alert('Success', 'Trigger word added successfully');
      setShowAddModal(false);
      setNewWord({ wordPhrase: '', severity: 'low', category: 'general' });
      loadTriggerWords();
    } else {
      Alert.alert('Error', 'Failed to add trigger word');
    }
  };

  const handleEdit = async () => {
    if (!editingWord || !editingWord.wordPhrase.trim()) {
      Alert.alert('Error', 'Please enter a word or phrase');
      return;
    }

    const success = await updateTriggerWord(editingWord.id, {
      wordPhrase: editingWord.wordPhrase,
      severity: editingWord.severity,
      category: editingWord.category,
      active: editingWord.active,
    });
    if (success) {
      Alert.alert('Success', 'Trigger word updated successfully');
      setShowEditModal(false);
      setEditingWord(null);
      loadTriggerWords();
    } else {
      Alert.alert('Error', 'Failed to update trigger word');
    }
  };

  const handleDelete = (word: TriggerWord) => {
    Alert.alert(
      'Delete Trigger Word',
      `Are you sure you want to delete "${word.wordPhrase}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteTriggerWord(word.id);
            if (success) {
              Alert.alert('Success', 'Trigger word deleted successfully');
              loadTriggerWords();
            } else {
              Alert.alert('Error', 'Failed to delete trigger word');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (word: TriggerWord) => {
    const success = await updateTriggerWord(word.id, { active: !word.active });
    if (success) {
      loadTriggerWords();
    } else {
      Alert.alert('Error', 'Failed to update trigger word');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#2196F3';
      default: return colors.text.secondary;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'romantic': return '#E91E63';
      case 'intimate': return '#9C27B0';
      case 'suspicious': return '#F44336';
      case 'meetup': return '#FF9800';
      case 'secret': return '#607D8B';
      default: return colors.text.secondary;
    }
  };

  if (!currentUser || !['admin', 'super_admin', 'moderator'].includes(currentUser.role)) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Trigger Words', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>Only admins can manage trigger words</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeWords = triggerWords.filter(w => w.active);
  const inactiveWords = triggerWords.filter(w => !w.active);

  // Group words by category
  const categories = ['romantic', 'intimate', 'suspicious', 'meetup', 'secret', 'general'] as const;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(categories));

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getWordsByCategory = (category: string, words: TriggerWord[]) => {
    return words.filter(w => w.category === category);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'romantic': return '💕';
      case 'intimate': return '💋';
      case 'suspicious': return '⚠️';
      case 'meetup': return '📍';
      case 'secret': return '🔒';
      default: return '📝';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Trigger Words', 
          headerShown: true,
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerAddButton}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={22} color={colors.primary} />
            </TouchableOpacity>
          ),
        }} 
      />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trigger Words Management</Text>
        <Text style={styles.headerSubtitle}>
          Manage words and phrases that trigger infidelity warnings
        </Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{activeWords.length}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{inactiveWords.length}</Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{triggerWords.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Active Words by Category */}
            {activeWords.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active Words</Text>
                {categories.map((category) => {
                  const categoryWords = getWordsByCategory(category, activeWords);
                  if (categoryWords.length === 0) return null;
                  const isExpanded = expandedCategories.has(category);
                  
                  return (
                    <View key={category} style={styles.categorySection}>
                      <TouchableOpacity
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(category)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.categoryHeaderLeft}>
                          <Text style={styles.categoryIcon}>{getCategoryIcon(category)}</Text>
                          <View>
                            <Text style={styles.categoryTitle}>
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </Text>
                            <Text style={styles.categoryCount}>
                              {categoryWords.length} word{categoryWords.length !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.expandIcon, !isExpanded && styles.expandIconCollapsed]}>
                          ▼
                        </Text>
                      </TouchableOpacity>
                      
                      {isExpanded && (
                        <View style={styles.categoryContent}>
                          {categoryWords.map((word) => (
                            <View key={word.id} style={styles.wordCard}>
                              <View style={styles.wordInfo}>
                                <Text style={styles.wordPhrase}>{word.wordPhrase}</Text>
                                <View style={styles.wordTags}>
                                  <View style={[styles.tag, { backgroundColor: getSeverityColor(word.severity) + '20' }]}>
                                    <Text style={[styles.tagText, { color: getSeverityColor(word.severity) }]}>
                                      {word.severity.toUpperCase()}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                              <View style={styles.wordActions}>
                                <TouchableOpacity
                                  style={styles.actionButton}
                                  onPress={() => {
                                    setEditingWord(word);
                                    setShowEditModal(true);
                                  }}
                                >
                                  <Edit2 size={18} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.actionButton}
                                  onPress={() => handleToggleActive(word)}
                                >
                                  <Text style={styles.deactivateText}>Deactivate</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionButton, styles.deleteButton]}
                                  onPress={() => handleDelete(word)}
                                >
                                  <Trash2 size={18} color={colors.danger} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Inactive Words by Category */}
            {inactiveWords.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Inactive Words</Text>
                {categories.map((category) => {
                  const categoryWords = getWordsByCategory(category, inactiveWords);
                  if (categoryWords.length === 0) return null;
                  const isExpanded = expandedCategories.has(category);
                  
                  return (
                    <View key={`inactive-${category}`} style={styles.categorySection}>
                      <TouchableOpacity
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(category)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.categoryHeaderLeft}>
                          <Text style={styles.categoryIcon}>{getCategoryIcon(category)}</Text>
                          <View>
                            <Text style={styles.categoryTitle}>
                              {category.charAt(0).toUpperCase() + category.slice(1)} (Inactive)
                            </Text>
                            <Text style={styles.categoryCount}>
                              {categoryWords.length} word{categoryWords.length !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.expandIcon, !isExpanded && styles.expandIconCollapsed]}>
                          ▼
                        </Text>
                      </TouchableOpacity>
                      
                      {isExpanded && (
                        <View style={styles.categoryContent}>
                          {categoryWords.map((word) => (
                            <View key={word.id} style={[styles.wordCard, styles.inactiveCard]}>
                              <View style={styles.wordInfo}>
                                <Text style={[styles.wordPhrase, styles.inactiveText]}>
                                  {word.wordPhrase}
                                </Text>
                                <View style={styles.wordTags}>
                                  <View style={[styles.tag, { backgroundColor: getSeverityColor(word.severity) + '20' }]}>
                                    <Text style={[styles.tagText, { color: getSeverityColor(word.severity) }]}>
                                      {word.severity.toUpperCase()}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                              <View style={styles.wordActions}>
                                <TouchableOpacity
                                  style={styles.actionButton}
                                  onPress={() => {
                                    setEditingWord(word);
                                    setShowEditModal(true);
                                  }}
                                >
                                  <Edit2 size={18} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.actionButton}
                                  onPress={() => handleToggleActive(word)}
                                >
                                  <Text style={styles.activateText}>Activate</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.actionButton, styles.deleteButton]}
                                  onPress={() => handleDelete(word)}
                                >
                                  <Trash2 size={18} color={colors.danger} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Plus size={24} color={colors.text.white} />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Trigger Word</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Word or Phrase</Text>
                <TextInput
                  style={styles.input}
                  value={newWord.wordPhrase}
                  onChangeText={(text) => setNewWord({ ...newWord, wordPhrase: text })}
                  placeholder="e.g., i love you"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Severity</Text>
                <View style={styles.severityButtons}>
                  {(['low', 'medium', 'high'] as const).map((severity) => (
                    <TouchableOpacity
                      key={severity}
                      style={[
                        styles.severityButton,
                        newWord.severity === severity && styles.severityButtonActive,
                        { borderColor: getSeverityColor(severity) },
                      ]}
                      onPress={() => setNewWord({ ...newWord, severity })}
                    >
                      <Text
                        style={[
                          styles.severityButtonText,
                          newWord.severity === severity && { color: getSeverityColor(severity) },
                        ]}
                      >
                        {severity.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryButtons}>
                  {(['romantic', 'intimate', 'suspicious', 'meetup', 'secret', 'general'] as const).map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        newWord.category === category && styles.categoryButtonActive,
                        { borderColor: getCategoryColor(category) },
                      ]}
                      onPress={() => setNewWord({ ...newWord, category })}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          newWord.category === category && { color: getCategoryColor(category) },
                        ]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
                <Save size={18} color={colors.text.white} />
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Trigger Word</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {editingWord && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Word or Phrase</Text>
                  <TextInput
                    style={styles.input}
                    value={editingWord.wordPhrase}
                    onChangeText={(text) => setEditingWord({ ...editingWord, wordPhrase: text })}
                    placeholder="e.g., i love you"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Severity</Text>
                  <View style={styles.severityButtons}>
                    {(['low', 'medium', 'high'] as const).map((severity) => (
                      <TouchableOpacity
                        key={severity}
                        style={[
                          styles.severityButton,
                          editingWord.severity === severity && styles.severityButtonActive,
                          { borderColor: getSeverityColor(severity) },
                        ]}
                        onPress={() => setEditingWord({ ...editingWord, severity })}
                      >
                        <Text
                          style={[
                            styles.severityButtonText,
                            editingWord.severity === severity && { color: getSeverityColor(severity) },
                          ]}
                        >
                          {severity.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.categoryButtons}>
                    {(['romantic', 'intimate', 'suspicious', 'meetup', 'secret', 'general'] as const).map((category) => (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryButton,
                          editingWord.category === category && styles.categoryButtonActive,
                          { borderColor: getCategoryColor(category) },
                        ]}
                        onPress={() => setEditingWord({ ...editingWord, category })}
                      >
                        <Text
                          style={[
                            styles.categoryButtonText,
                            editingWord.category === category && { color: getCategoryColor(category) },
                          ]}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Status</Text>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      editingWord.active ? styles.toggleButtonActive : styles.toggleButtonInactive,
                    ]}
                    onPress={() => setEditingWord({ ...editingWord, active: !editingWord.active })}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        editingWord.active ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive,
                      ]}
                    >
                      {editingWord.active ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleEdit}>
                <Save size={18} color={colors.text.white} />
                <Text style={styles.saveButtonText}>Save</Text>
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
    backgroundColor: colors.background.primary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.light,
    marginHorizontal: 8,
  },
  headerAddButton: {
    padding: 8,
    marginRight: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 12,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background.secondary,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.text.secondary,
    transform: [{ rotate: '0deg' }],
  },
  expandIconCollapsed: {
    transform: [{ rotate: '-90deg' }],
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  wordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  wordInfo: {
    flex: 1,
  },
  wordPhrase: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  inactiveText: {
    textDecorationLine: 'line-through',
  },
  wordTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  wordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  deleteButton: {
    marginLeft: 4,
  },
  deactivateText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  activateText: {
    fontSize: 12,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalBody: {
    padding: 20,
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
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  severityButtonActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  severityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
  },
  categoryButtonActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  categoryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  toggleButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  toggleButtonInactive: {
    backgroundColor: colors.background.secondary,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: colors.primary,
  },
  toggleButtonTextInactive: {
    color: colors.text.secondary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.white,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
});

