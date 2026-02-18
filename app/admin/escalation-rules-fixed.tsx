import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { Save, Plus, Trash2, Clock } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { EscalationRule, EscalationTriggerType, EscalationStrategy } from '@/types';

export default function AdminEscalationRulesScreen() {
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [triggerType, setTriggerType] = useState<EscalationTriggerType>('timeout');
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [escalationStrategy, setEscalationStrategy] = useState<EscalationStrategy>('sequential');
  const [fallbackRules, setFallbackRules] = useState<Record<string, any>>({});
  const [requireUserConfirmation, setRequireUserConfirmation] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(0);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('escalation_rules')
        .select('*')
        .order('priority', { ascending: true }) // Lower priority = higher priority
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules((data || []).map(mapRule));
    } catch (error: any) {
      console.error('Error loading escalation rules:', error);
      Alert.alert('Error', 'Failed to load escalation rules');
    } finally {
      setLoading(false);
    }
  };

  const mapRule = (rule: any): EscalationRule => {
    return {
      id: rule.id,
      name: rule.name,
      description: rule.description || undefined,
      roleId: rule.role_id || undefined,
      triggerType: rule.trigger_type as EscalationTriggerType,
      timeoutSeconds: rule.timeout_seconds || undefined,
      maxEscalationAttempts: rule.max_escalation_attempts || 3,
      escalationStrategy: rule.escalation_strategy as EscalationStrategy,
      fallbackRules: rule.fallback_rules || {},
      requireUserConfirmation: rule.require_user_confirmation ?? true,
      isActive: rule.is_active ?? true,
      priority: rule.priority || 0,
      createdAt: rule.created_at,
      updatedAt: rule.updated_at,
    };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Rule name is required');
      return;
    }

    try {
      setSaving(true);

      const ruleData: any = {
        name: name.trim(),
        description: description.trim() || null,
        role_id: roleId || null,
        trigger_type: triggerType,
        timeout_seconds: triggerType === 'timeout' ? timeoutSeconds : null,
        max_escalation_attempts: maxAttempts,
        escalation_strategy: escalationStrategy,
        fallback_rules: fallbackRules,
        require_user_confirmation: requireUserConfirmation,
        is_active: enabled,
        priority,
        updated_at: new Date().toISOString(),
      };

      if (editingRule) {
        // Update existing rule
        const { error } = await supabase
          .from('escalation_rules')
          .update(ruleData)
          .eq('id', editingRule.id);

        if (error) throw error;
        Alert.alert('Success', 'Escalation rule updated successfully');
      } else {
        // Create new rule
        const { error } = await supabase.from('escalation_rules').insert(ruleData);

        if (error) throw error;
        Alert.alert('Success', 'Escalation rule created successfully');
      }

      // Reset form
      setEditingRule(null);
      setShowForm(false);
      resetForm();
      loadRules();
    } catch (error: any) {
      console.error('Error saving escalation rule:', error);
      Alert.alert('Error', 'Failed to save escalation rule');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: EscalationRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description || '');
    setRoleId(rule.roleId || null);
    setTriggerType(rule.triggerType);
    setTimeoutSeconds(rule.timeoutSeconds || 300);
    setMaxAttempts(rule.maxEscalationAttempts);
    setEscalationStrategy(rule.escalationStrategy);
    setFallbackRules(rule.fallbackRules || {});
    setRequireUserConfirmation(rule.requireUserConfirmation);
    setEnabled(rule.isActive);
    setPriority(rule.priority);
    setShowForm(true);
  };

  const handleDelete = (rule: EscalationRule) => {
    Alert.alert(
      'Delete Rule',
      `Are you sure you want to delete "${rule.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('escalation_rules')
                .delete()
                .eq('id', rule.id);

              if (error) throw error;
              loadRules();
            } catch (error: any) {
              console.error('Error deleting rule:', error);
              Alert.alert('Error', 'Failed to delete escalation rule');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setRoleId(null);
    setTriggerType('timeout');
    setTimeoutSeconds(300);
    setMaxAttempts(3);
    setEscalationStrategy('sequential');
    setFallbackRules({});
    setRequireUserConfirmation(true);
    setEnabled(true);
    setPriority(0);
  };

  const handleNewRule = () => {
    setEditingRule(null);
    resetForm();
    setShowForm(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Escalation Rules' }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={styles.loadingText}>Loading escalation rules...</Text>
        </View>
      ) : (
        <>
          {!showForm ? (
            <ScrollView style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.headerText}>
                  Configure escalation rules for professional sessions
                </Text>
                <TouchableOpacity style={styles.newButton} onPress={handleNewRule}>
                  <Plus size={20} color={themeColors.text.white} />
                  <Text style={styles.newButtonText}>New Rule</Text>
                </TouchableOpacity>
              </View>

              {rules.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Clock size={64} color={themeColors.text.tertiary} />
                  <Text style={styles.emptyTitle}>No Escalation Rules</Text>
                  <Text style={styles.emptyText}>
                    Create escalation rules to configure how professional sessions are escalated.
                  </Text>
                  <TouchableOpacity style={styles.emptyButton} onPress={handleNewRule}>
                    <Text style={styles.emptyButtonText}>Create First Rule</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.rulesList}>
                  {rules.map((rule) => (
                    <View key={rule.id} style={styles.ruleCard}>
                      <View style={styles.ruleHeader}>
                        <View style={styles.ruleHeaderLeft}>
                          <Text style={styles.ruleName}>{rule.name}</Text>
                          <View style={styles.ruleBadges}>
                            <View
                              style={[
                                styles.badge,
                                rule.isActive
                                  ? styles.badgeEnabled
                                  : styles.badgeDisabled,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.badgeText,
                                  rule.isActive && styles.badgeTextEnabled,
                                ]}
                              >
                                {rule.isActive ? 'Enabled' : 'Disabled'}
                              </Text>
                            </View>
                            <View style={[styles.badge, styles.badgeType]}>
                              <Text style={styles.badgeText}>{rule.triggerType}</Text>
                            </View>
                            {rule.escalationStrategy && (
                              <View style={[styles.badge, styles.badgeStrategy]}>
                                <Text style={styles.badgeText}>{rule.escalationStrategy}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.ruleActions}>
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => handleEdit(rule)}
                          >
                            <Text style={styles.editButtonText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDelete(rule)}
                          >
                            <Trash2 size={18} color={themeColors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {rule.description && (
                        <Text style={styles.ruleDescription}>{rule.description}</Text>
                      )}
                      <View style={styles.ruleDetails}>
                        {rule.triggerType === 'timeout' && rule.timeoutSeconds && (
                          <Text style={styles.ruleDetail}>
                            Timeout: {rule.timeoutSeconds} seconds
                          </Text>
                        )}
                        <Text style={styles.ruleDetail}>
                          Max Attempts: {rule.maxEscalationAttempts}
                        </Text>
                        <Text style={styles.ruleDetail}>Priority: {rule.priority}</Text>
                        {rule.roleId && (
                          <Text style={styles.ruleDetail}>
                            Role-Specific Rule
                          </Text>
                        )}
                        {rule.requireUserConfirmation && (
                          <Text style={styles.ruleDetail}>Requires User Confirmation</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView style={styles.content}>
              <View style={styles.form}>
                <Text style={styles.formTitle}>
                  {editingRule ? 'Edit Escalation Rule' : 'New Escalation Rule'}
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Rule Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Default Timeout Rule"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Optional description"
                    placeholderTextColor={themeColors.text.tertiary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Trigger Type</Text>
                  <View style={styles.typeButtons}>
                    {(['timeout', 'user_request', 'ai_detection', 'manual'] as EscalationTriggerType[]).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          triggerType === type && styles.typeButtonActive,
                        ]}
                        onPress={() => setTriggerType(type)}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            triggerType === type && styles.typeButtonTextActive,
                          ]}
                        >
                          {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {triggerType === 'timeout' && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Timeout (seconds)</Text>
                    <TextInput
                      style={styles.input}
                      value={timeoutSeconds.toString()}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        if (!isNaN(num)) setTimeoutSeconds(num);
                      }}
                      keyboardType="numeric"
                      placeholder="300"
                      placeholderTextColor={themeColors.text.tertiary}
                    />
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Escalation Strategy</Text>
                  <View style={styles.typeButtons}>
                    {(['sequential', 'broadcast', 'round_robin'] as EscalationStrategy[]).map((strategy) => (
                      <TouchableOpacity
                        key={strategy}
                        style={[
                          styles.typeButton,
                          escalationStrategy === strategy && styles.typeButtonActive,
                        ]}
                        onPress={() => setEscalationStrategy(strategy)}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            escalationStrategy === strategy && styles.typeButtonTextActive,
                          ]}
                        >
                          {strategy.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Max Escalation Attempts</Text>
                  <TextInput
                    style={styles.input}
                    value={maxAttempts.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) setMaxAttempts(num);
                    }}
                    keyboardType="numeric"
                    placeholder="3"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Priority (lower = higher priority)</Text>
                  <TextInput
                    style={styles.input}
                    value={priority.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num)) setPriority(num);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={themeColors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Require User Confirmation</Text>
                    <Switch
                      value={requireUserConfirmation}
                      onValueChange={setRequireUserConfirmation}
                      trackColor={{
                        false: themeColors.border.light,
                        true: themeColors.primary,
                      }}
                      thumbColor={themeColors.text.white}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.label}>Enabled</Text>
                    <Switch
                      value={enabled}
                      onValueChange={setEnabled}
                      trackColor={{
                        false: themeColors.border.light,
                        true: themeColors.primary,
                      }}
                      thumbColor={themeColors.text.white}
                    />
                  </View>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => {
                      setShowForm(false);
                      setEditingRule(null);
                      resetForm();
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={themeColors.text.white} />
                    ) : (
                      <>
                        <Save size={20} color={themeColors.text.white} />
                        <Text style={styles.saveButtonText}>Save Rule</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    header: {
      padding: 16,
      backgroundColor: colors.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerText: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 12,
    },
    newButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 8,
    },
    newButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      minHeight: 400,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginTop: 24,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
    rulesList: {
      padding: 16,
      gap: 16,
    },
    ruleCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    ruleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    ruleHeaderLeft: {
      flex: 1,
    },
    ruleName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    ruleBadges: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    badgeEnabled: {
      backgroundColor: colors.secondary + '20',
      borderColor: colors.secondary,
    },
    badgeDisabled: {
      backgroundColor: colors.text.tertiary + '20',
      borderColor: colors.text.tertiary,
    },
    badgeType: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    badgeStrategy: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    badgeTextEnabled: {
      color: colors.secondary,
    },
    ruleActions: {
      flexDirection: 'row',
      gap: 8,
    },
    editButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.background.secondary,
    },
    editButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    deleteButton: {
      padding: 6,
    },
    ruleDescription: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    ruleDetails: {
      gap: 6,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    ruleDetail: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    form: {
      padding: 16,
    },
    formTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 24,
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
    typeButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    typeButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border.light,
      backgroundColor: colors.background.primary,
      alignItems: 'center',
    },
    typeButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    typeButtonTextActive: {
      color: colors.primary,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    formActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
      marginBottom: 16,
    },
    cancelButton: {
      flex: 1,
      padding: 16,
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
      padding: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text.white,
    },
  });

