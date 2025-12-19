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
  Switch,
} from 'react-native';
import { Stack } from 'expo-router';
import { Edit2, Save, X, FileText, AlertTriangle, AlertCircle, Info } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import { WarningTemplate } from '@/types';

export default function WarningTemplatesManagementScreen() {
  const { currentUser, getWarningTemplates, updateWarningTemplate } = useApp();
  const [templates, setTemplates] = useState<WarningTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WarningTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    titleTemplate: '',
    messageTemplate: '',
    inChatWarningTemplate: '',
    description: '',
    active: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templateList = await getWarningTemplates();
      setTemplates(templateList);
    } catch (error) {
      console.error('Error loading warning templates:', error);
      Alert.alert('Error', 'Failed to load warning templates');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: WarningTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      titleTemplate: template.titleTemplate,
      messageTemplate: template.messageTemplate,
      inChatWarningTemplate: template.inChatWarningTemplate,
      description: template.description || '',
      active: template.active,
    });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    if (!editForm.titleTemplate.trim() || !editForm.messageTemplate.trim() || !editForm.inChatWarningTemplate.trim()) {
      Alert.alert('Error', 'All template fields are required');
      return;
    }

    const success = await updateWarningTemplate(editingTemplate.id, {
      titleTemplate: editForm.titleTemplate,
      messageTemplate: editForm.messageTemplate,
      inChatWarningTemplate: editForm.inChatWarningTemplate,
      description: editForm.description,
      active: editForm.active,
    });

    if (success) {
      Alert.alert('Success', 'Warning template updated successfully');
      setShowEditModal(false);
      setEditingTemplate(null);
      loadTemplates();
    } else {
      Alert.alert('Error', 'Failed to update warning template');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return '#FF3B30';
      case 'medium':
        return '#FF9500';
      case 'low':
        return '#FFCC00';
      default:
        return colors.text.secondary;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle size={24} color="#FF3B30" />;
      case 'medium':
        return <AlertCircle size={24} color="#FF9500" />;
      case 'low':
        return <Info size={24} color="#FFCC00" />;
      default:
        return <FileText size={24} color={colors.text.secondary} />;
    }
  };

  const getSeverityLabel = (severity: string) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1) + ' Risk';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Warning Templates',
          headerStyle: { backgroundColor: colors.background.primary },
          headerTintColor: colors.text.primary,
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Infidelity Warning Templates</Text>
          <Text style={styles.headerSubtitle}>
            Customize warning messages for different severity levels. Use {'{trigger_words}'} and {'{severity}'} as variables.
          </Text>
        </View>

        {templates.map((template) => (
          <View key={template.id} style={styles.templateCard}>
            <View style={styles.templateHeader}>
              <View style={styles.severityHeader}>
                {getSeverityIcon(template.severity)}
                <View style={styles.severityInfo}>
                  <Text style={[styles.severityLabel, { color: getSeverityColor(template.severity) }]}>
                    {getSeverityLabel(template.severity)}
                  </Text>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: template.active ? '#34C759' : '#8E8E93' }]} />
                    <Text style={styles.statusText}>{template.active ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleEdit(template)}
                activeOpacity={0.7}
              >
                <Edit2 size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.templateContent}>
              <View style={styles.templateSection}>
                <Text style={styles.templateLabel}>Notification Title:</Text>
                <Text style={styles.templatePreview}>{template.titleTemplate}</Text>
              </View>

              <View style={styles.templateSection}>
                <Text style={styles.templateLabel}>Notification Message:</Text>
                <Text style={styles.templatePreview}>{template.messageTemplate}</Text>
              </View>

              <View style={styles.templateSection}>
                <Text style={styles.templateLabel}>In-Chat Warning:</Text>
                <Text style={styles.templatePreview}>{template.inChatWarningTemplate}</Text>
              </View>

              {template.description && (
                <View style={styles.templateSection}>
                  <Text style={styles.templateLabel}>Description:</Text>
                  <Text style={styles.templateDescription}>{template.description}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {templates.length === 0 && (
          <View style={styles.emptyContainer}>
            <FileText size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No warning templates found</Text>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Edit {editingTemplate ? getSeverityLabel(editingTemplate.severity) : ''} Template
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowEditModal(false);
                setEditingTemplate(null);
              }}
            >
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContent}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Notification Title Template *</Text>
              <Text style={styles.formHint}>
                Use {'{trigger_words}'} and {'{severity}'} as variables
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editForm.titleTemplate}
                onChangeText={(text) => setEditForm({ ...editForm, titleTemplate: text })}
                placeholder="Enter title template"
                multiline
                numberOfLines={2}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Notification Message Template *</Text>
              <Text style={styles.formHint}>
                Use {'{trigger_words}'} and {'{severity}'} as variables
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editForm.messageTemplate}
                onChangeText={(text) => setEditForm({ ...editForm, messageTemplate: text })}
                placeholder="Enter message template"
                multiline
                numberOfLines={4}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>In-Chat Warning Template *</Text>
              <Text style={styles.formHint}>
                This is shown in the chat. Use {'{trigger_words}'} and {'{severity}'} as variables
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editForm.inChatWarningTemplate}
                onChangeText={(text) => setEditForm({ ...editForm, inChatWarningTemplate: text })}
                placeholder="Enter in-chat warning template"
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editForm.description}
                onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                placeholder="Enter description"
                multiline
                numberOfLines={2}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            <View style={styles.formSection}>
              <View style={styles.switchRow}>
                <Text style={styles.formLabel}>Active</Text>
                <Switch
                  value={editForm.active}
                  onValueChange={(value) => setEditForm({ ...editForm, active: value })}
                  trackColor={{ false: colors.border.light, true: colors.primary }}
                  thumbColor={colors.text.white}
                />
              </View>
              <Text style={styles.formHint}>
                Inactive templates will use default fallback messages
              </Text>
            </View>

            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Preview (with example trigger words)</Text>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Title:</Text>
                <Text style={styles.previewText}>
                  {editForm.titleTemplate
                    .replace('{trigger_words}', 'I love you')
                    .replace('{severity}', editingTemplate?.severity || 'high')}
                </Text>
              </View>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Message:</Text>
                <Text style={styles.previewText}>
                  {editForm.messageTemplate
                    .replace('{trigger_words}', 'I love you')
                    .replace('{severity}', editingTemplate?.severity || 'high')}
                </Text>
              </View>
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>In-Chat:</Text>
                <Text style={styles.previewText}>
                  {editForm.inChatWarningTemplate
                    .replace('{trigger_words}', 'I love you')
                    .replace('{severity}', editingTemplate?.severity || 'high')}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowEditModal(false);
                setEditingTemplate(null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Save size={20} color={colors.text.white} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  templateCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  severityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  severityInfo: {
    gap: 4,
  },
  severityLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  editButton: {
    padding: 8,
  },
  templateContent: {
    gap: 16,
  },
  templateSection: {
    gap: 8,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  templatePreview: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  templateDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.tertiary,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  formHint: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  previewSection: {
    marginTop: 8,
    marginBottom: 24,
    padding: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  previewCard: {
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.white,
  },
});

