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
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { DollarSign, Plus, Shield, Infinity, TrendingUp, Edit2, Save, Trash2, X } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminPricingScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [limits, setLimits] = useState<Record<string, any>>({});
  const [pricingConfig, setPricingConfig] = useState<any>({});
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [showAddFeature, setShowAddFeature] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state for creating new plan
  const [newPlanForm, setNewPlanForm] = useState({
    name: '',
    display_name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    selectedFeatures: [] as string[],
    featureLimits: {} as Record<string, { value: string; period: string; unlimited: boolean }>,
  });

  // Available features that can be added to plans
  const availableFeatures = [
    { name: 'daily_likes', label: 'Daily Likes', defaultPeriod: 'daily' },
    { name: 'daily_super_likes', label: 'Daily Super Likes', defaultPeriod: 'daily' },
    { name: 'rewinds', label: 'Rewinds', defaultPeriod: 'daily' },
    { name: 'boosts', label: 'Boosts', defaultPeriod: 'daily' },
    { name: 'conversation_starter', label: 'Conversation Starter', defaultPeriod: 'lifetime' },
    { name: 'pre_match_messages', label: 'Pre-Match Messages', defaultPeriod: 'lifetime' },
    { name: 'messages_per_conversation', label: 'Messages Per Conversation', defaultPeriod: 'lifetime' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, limitsRes, configRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('display_order'),
        supabase.from('dating_feature_limits').select('*, subscription_plans!inner(id, name)'),
        supabase.from('pricing_configuration').select('*'),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (limitsRes.error) throw limitsRes.error;
      if (configRes.error) throw configRes.error;

      setPlans(plansRes.data || []);
      
      // Organize limits by plan name (for display) and also by plan_id
      const limitsByPlan: Record<string, any[]> = {};
      (limitsRes.data || []).forEach((limit: any) => {
        const planName = limit.subscription_plans?.name || limit.plan_id;
        if (!limitsByPlan[planName]) limitsByPlan[planName] = [];
        limitsByPlan[planName].push(limit);
      });
      setLimits(limitsByPlan);

      // Organize config
      const config: any = {};
      (configRes.data || []).forEach((item: any) => {
        config[item.setting_key] = item.setting_value;
      });
      setPricingConfig(config);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePlanPrice = async (planId: string, field: 'price_monthly' | 'price_yearly', value: string) => {
    try {
      const numValue = parseFloat(value) || 0;
      const { error } = await supabase
        .from('subscription_plans')
        .update({ [field]: numValue, updated_at: new Date().toISOString() })
        .eq('id', planId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updatePlanName = async (planId: string, field: 'display_name' | 'description', value: string) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', planId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const openCreateModal = () => {
    setNewPlanForm({
      name: '',
      display_name: '',
      description: '',
      price_monthly: '',
      price_yearly: '',
      selectedFeatures: [],
      featureLimits: {},
    });
    setShowCreateModal(true);
  };

  const toggleFeatureSelection = (featureName: string) => {
    const isSelected = newPlanForm.selectedFeatures.includes(featureName);
    if (isSelected) {
      // Remove feature
      const newSelected = newPlanForm.selectedFeatures.filter(f => f !== featureName);
      const newLimits = { ...newPlanForm.featureLimits };
      delete newLimits[featureName];
      setNewPlanForm({
        ...newPlanForm,
        selectedFeatures: newSelected,
        featureLimits: newLimits,
      });
    } else {
      // Add feature with default values
      const feature = availableFeatures.find(f => f.name === featureName);
      setNewPlanForm({
        ...newPlanForm,
        selectedFeatures: [...newPlanForm.selectedFeatures, featureName],
        featureLimits: {
          ...newPlanForm.featureLimits,
          [featureName]: {
            value: '0',
            period: feature?.defaultPeriod || 'daily',
            unlimited: false,
          },
        },
      });
    }
  };

  const updateFeatureLimit = (featureName: string, field: 'value' | 'period' | 'unlimited', newValue: any) => {
    setNewPlanForm({
      ...newPlanForm,
      featureLimits: {
        ...newPlanForm.featureLimits,
        [featureName]: {
          ...newPlanForm.featureLimits[featureName],
          [field]: newValue,
        },
      },
    });
  };

  const createPlanWithFeatures = async () => {
    try {
      // Validation
      if (!newPlanForm.name.trim()) {
        Alert.alert('Error', 'Plan name is required');
        return;
      }
      if (!newPlanForm.display_name.trim()) {
        Alert.alert('Error', 'Display name is required');
        return;
      }

      // Check if plan name already exists
      const { data: existingPlan } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', newPlanForm.name.trim().toLowerCase().replace(/\s+/g, '_'))
        .single();

      if (existingPlan) {
        Alert.alert('Error', 'A plan with this name already exists');
        return;
      }

      // Get max display order
      const { data: existingPlans } = await supabase
        .from('subscription_plans')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = existingPlans?.[0]?.display_order || 0;

      // Create the plan
      const planName = newPlanForm.name.trim().toLowerCase().replace(/\s+/g, '_');
      const { data: newPlan, error: planError } = await supabase
        .from('subscription_plans')
        .insert({
          name: planName,
          display_name: newPlanForm.display_name.trim(),
          description: newPlanForm.description.trim() || null,
          price_monthly: parseFloat(newPlanForm.price_monthly) || 0,
          price_yearly: parseFloat(newPlanForm.price_yearly) || 0,
          display_order: maxOrder + 1,
          is_active: true,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Create feature limits for selected features
      if (newPlanForm.selectedFeatures.length > 0 && newPlan) {
        const featureLimits = newPlanForm.selectedFeatures.map(featureName => {
          const limit = newPlanForm.featureLimits[featureName];
          return {
            plan_id: newPlan.id,
            feature_name: featureName,
            limit_value: limit.unlimited ? null : (parseInt(limit.value) || 0),
            limit_period: limit.period,
          };
        });

        const { error: limitsError } = await supabase
          .from('dating_feature_limits')
          .insert(featureLimits);

        if (limitsError) throw limitsError;
      }

      setShowCreateModal(false);
      loadData();
      Alert.alert('Success', 'Plan created successfully with selected features!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateLimit = async (limitId: string, value: string) => {
    try {
      const numValue = value === '' || value === 'unlimited' ? null : parseInt(value);
      const { error } = await supabase
        .from('dating_feature_limits')
        .update({ limit_value: numValue, updated_at: new Date().toISOString() })
        .eq('id', limitId);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('pricing_configuration')
        .upsert({
          setting_key: key,
          setting_value: typeof value === 'string' ? JSON.parse(value) : value,
          updated_by: currentUser?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      loadData();
      Alert.alert('Success', 'Configuration updated');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const deletePlan = async (planId: string, planName: string) => {
    // Prevent deletion of default plans
    if (planName === 'free' || planName === 'premium') {
      Alert.alert('Error', 'Cannot delete default plans (Free or Premium)');
      return;
    }

    Alert.alert(
      'Delete Plan',
      `Are you sure you want to delete this plan? This will also delete all associated feature limits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('subscription_plans')
                .delete()
                .eq('id', planId);

              if (error) throw error;
              loadData();
              Alert.alert('Success', 'Plan deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const addFeature = async (planId: string, featureName: string, limitPeriod: string = 'daily') => {
    try {
      const { error } = await supabase
        .from('dating_feature_limits')
        .insert({
          plan_id: planId,
          feature_name: featureName,
          limit_value: 0, // Default to 0, admin can change it
          limit_period: limitPeriod,
        });

      if (error) throw error;
      loadData();
      setShowAddFeature(null);
      Alert.alert('Success', 'Feature added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const removeFeature = async (limitId: string, featureName: string) => {
    Alert.alert(
      'Remove Feature',
      `Are you sure you want to remove "${featureName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}" from this plan?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('dating_feature_limits')
                .delete()
                .eq('id', limitId);

              if (error) throw error;
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getAvailableFeaturesForPlan = (plan: any) => {
    const planLimits = limits[plan.name] || [];
    const existingFeatureNames = planLimits.map((l: any) => l.feature_name);
    return availableFeatures.filter(f => !existingFeatureNames.includes(f.name));
  };

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Pricing Management', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Pricing Management', headerShown: true }} />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Global Settings Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionIconContainer}>
                  <TrendingUp size={20} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Global Settings</Text>
              </View>
            </View>
            <View style={styles.configGrid}>
              <View style={styles.configCard}>
                <Text style={styles.configLabel}>Currency</Text>
                <TextInput
                  style={styles.configInput}
                  value={pricingConfig.currency || 'USD'}
                  onChangeText={(text) => updateConfig('currency', JSON.stringify(text))}
                  placeholder="USD"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
              <View style={styles.configCard}>
                <Text style={styles.configLabel}>Free Trial Days</Text>
                <TextInput
                  style={styles.configInput}
                  value={pricingConfig.free_trial_days?.toString() || '7'}
                  onChangeText={(text) => updateConfig('free_trial_days', JSON.stringify(parseInt(text) || 7))}
                  keyboardType="numeric"
                  placeholder="7"
                  placeholderTextColor={colors.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* Subscription Plans Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionIconContainer}>
                  <DollarSign size={20} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Subscription Plans</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addNewPlan}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primary + 'DD']}
                  style={styles.addButtonGradient}
                >
                  <Plus size={18} color="#fff" />
                  <Text style={styles.addButtonText}>Add Plan</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {plans.map((plan, index) => {
              const isEditing = editingPlan === plan.id;
              const planLimits = limits[plan.name] || [];
              const isFreePlan = plan.name === 'free';
              const isPremiumPlan = plan.name === 'premium';

              return (
                <View
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isPremiumPlan && styles.premiumPlanCard,
                    isFreePlan && styles.freePlanCard,
                  ]}
                >
                  {/* Plan Header */}
                  <View style={styles.planHeader}>
                    <View style={styles.planHeaderLeft}>
                      <View style={[styles.planBadge, isPremiumPlan && styles.premiumBadge]}>
                        <Text style={styles.planBadgeText}>
                          {isFreePlan ? 'FREE' : isPremiumPlan ? 'PREMIUM' : plan.display_name?.toUpperCase()}
                        </Text>
                      </View>
                      {!isEditing ? (
                        <View style={styles.planNameDisplay}>
                          <Text style={styles.planNameText}>{plan.display_name}</Text>
                          {plan.description && (
                            <Text style={styles.planDescriptionText}>{plan.description}</Text>
                          )}
                        </View>
                      ) : (
                        <View style={styles.planNameEdit}>
                          <TextInput
                            style={styles.planNameInput}
                            value={plan.display_name}
                            onChangeText={(text) => updatePlanName(plan.id, 'display_name', text)}
                            placeholder="Plan Name"
                            placeholderTextColor={colors.text.tertiary}
                          />
                          <TextInput
                            style={[styles.planNameInput, styles.planDescriptionInput]}
                            value={plan.description || ''}
                            onChangeText={(text) => updatePlanName(plan.id, 'description', text)}
                            placeholder="Plan description"
                            placeholderTextColor={colors.text.tertiary}
                            multiline
                            numberOfLines={2}
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.planHeaderActions}>
                      <TouchableOpacity
                        style={styles.editToggleButton}
                        onPress={() => setEditingPlan(isEditing ? null : plan.id)}
                      >
                        <Edit2 size={18} color={isEditing ? colors.primary : colors.text.secondary} />
                      </TouchableOpacity>
                      {!isFreePlan && !isPremiumPlan && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => deletePlan(plan.id, plan.name)}
                        >
                          <Trash2 size={18} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Pricing Row */}
                  <View style={styles.pricingRow}>
                    <View style={styles.priceCard}>
                      <Text style={styles.priceLabel}>Monthly</Text>
                      <View style={styles.priceInputContainer}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={plan.price_monthly?.toString() || '0'}
                          onChangeText={(text) => updatePlanPrice(plan.id, 'price_monthly', text)}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.text.tertiary}
                        />
                      </View>
                    </View>
                    <View style={styles.priceCard}>
                      <Text style={styles.priceLabel}>Yearly</Text>
                      <View style={styles.priceInputContainer}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={plan.price_yearly?.toString() || '0'}
                          onChangeText={(text) => updatePlanPrice(plan.id, 'price_yearly', text)}
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor={colors.text.tertiary}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Feature Limits */}
                  <View style={styles.limitsSection}>
                    <View style={styles.limitsHeader}>
                      <Text style={styles.limitsTitle}>Feature Limits</Text>
                      {isEditing && (
                        <TouchableOpacity
                          style={styles.addFeatureButton}
                          onPress={() => setShowAddFeature(showAddFeature === plan.id ? null : plan.id)}
                        >
                          <Plus size={16} color={colors.primary} />
                          <Text style={styles.addFeatureButtonText}>Add Feature</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Add Feature Dropdown */}
                    {isEditing && showAddFeature === plan.id && (
                      <View style={styles.addFeatureDropdown}>
                        {getAvailableFeaturesForPlan(plan).length > 0 ? (
                          getAvailableFeaturesForPlan(plan).map((feature) => (
                            <TouchableOpacity
                              key={feature.name}
                              style={styles.featureOption}
                              onPress={() => addFeature(plan.id, feature.name, feature.defaultPeriod)}
                            >
                              <Text style={styles.featureOptionText}>{feature.label}</Text>
                              <Text style={styles.featureOptionPeriod}>{feature.defaultPeriod}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text style={styles.noFeaturesText}>All features have been added</Text>
                        )}
                      </View>
                    )}

                    {planLimits.length > 0 ? (
                      <View style={styles.limitsGrid}>
                        {planLimits.map((limit: any) => (
                          <View key={limit.id} style={styles.limitCard}>
                            <View style={styles.limitHeader}>
                              <Text style={styles.limitFeatureName}>
                                {limit.feature_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Text>
                              <View style={styles.limitHeaderRight}>
                                <Text style={styles.limitPeriod}>{limit.limit_period}</Text>
                                {isEditing && (
                                  <TouchableOpacity
                                    style={styles.removeFeatureButton}
                                    onPress={() => removeFeature(limit.id, limit.feature_name)}
                                  >
                                    <X size={14} color={colors.danger} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                            <View style={styles.limitValueContainer}>
                              {limit.limit_value === null ? (
                                <View style={styles.unlimitedBadge}>
                                  <Infinity size={16} color={colors.primary} />
                                  <Text style={styles.unlimitedText}>Unlimited</Text>
                                </View>
                              ) : (
                                <TextInput
                                  style={styles.limitInput}
                                  value={limit.limit_value?.toString() || ''}
                                  onChangeText={(text) => updateLimit(limit.id, text)}
                                  placeholder="0"
                                  placeholderTextColor={colors.text.tertiary}
                                  keyboardType="numeric"
                                />
                              )}
                              <TouchableOpacity
                                style={styles.unlimitedToggle}
                                onPress={() => updateLimit(limit.id, limit.limit_value === null ? '0' : 'unlimited')}
                              >
                                <Text style={styles.unlimitedToggleText}>
                                  {limit.limit_value === null ? 'Set Limit' : 'Unlimited'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.noLimitsContainer}>
                        <Text style={styles.noLimitsText}>No features added yet</Text>
                        {isEditing && (
                          <Text style={styles.noLimitsSubtext}>Click "Add Feature" to add features to this plan</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Create Plan Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={Platform.OS === 'android'}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <SafeAreaView style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Plan</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowCreateModal(false)}
              >
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Plan Details */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Plan Details</Text>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Plan Name (Internal) *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newPlanForm.name}
                    onChangeText={(text) => setNewPlanForm({ ...newPlanForm, name: text })}
                    placeholder="e.g., basic, premium_plus"
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <Text style={styles.formHint}>Lowercase, no spaces (e.g., basic_plan)</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Display Name *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newPlanForm.display_name}
                    onChangeText={(text) => setNewPlanForm({ ...newPlanForm, display_name: text })}
                    placeholder="e.g., Basic Plan"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={newPlanForm.description}
                    onChangeText={(text) => setNewPlanForm({ ...newPlanForm, description: text })}
                    placeholder="Plan description"
                    placeholderTextColor={colors.text.tertiary}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.priceRow}>
                  <View style={styles.priceInputGroup}>
                    <Text style={styles.formLabel}>Monthly Price ($)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newPlanForm.price_monthly}
                      onChangeText={(text) => setNewPlanForm({ ...newPlanForm, price_monthly: text })}
                      placeholder="0.00"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={styles.priceInputGroup}>
                    <Text style={styles.formLabel}>Yearly Price ($)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={newPlanForm.price_yearly}
                      onChangeText={(text) => setNewPlanForm({ ...newPlanForm, price_yearly: text })}
                      placeholder="0.00"
                      placeholderTextColor={colors.text.tertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Feature Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Select Features</Text>
                <Text style={styles.formSectionSubtitle}>Choose which features this plan includes</Text>
                
                <View style={styles.featuresList}>
                  {availableFeatures.map((feature) => {
                    const isSelected = newPlanForm.selectedFeatures.includes(feature.name);
                    const limit = newPlanForm.featureLimits[feature.name];

                    return (
                      <View key={feature.name} style={styles.featureItem}>
                        <TouchableOpacity
                          style={styles.featureCheckbox}
                          onPress={() => toggleFeatureSelection(feature.name)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <View style={styles.featureInfo}>
                            <Text style={styles.featureLabel}>{feature.label}</Text>
                            <Text style={styles.featurePeriod}>Default: {feature.defaultPeriod}</Text>
                          </View>
                        </TouchableOpacity>

                        {isSelected && limit && (
                          <View style={styles.featureLimitConfig}>
                            <View style={styles.limitConfigRow}>
                              <View style={styles.limitInputGroup}>
                                <Text style={styles.limitLabel}>Limit Value</Text>
                                <TextInput
                                  style={styles.limitInput}
                                  value={limit.value}
                                  onChangeText={(text) => updateFeatureLimit(feature.name, 'value', text)}
                                  placeholder="0"
                                  placeholderTextColor={colors.text.tertiary}
                                  keyboardType="numeric"
                                  editable={!limit.unlimited}
                                />
                              </View>
                              <View style={styles.periodInputGroup}>
                                <Text style={styles.limitLabel}>Period</Text>
                                <View style={styles.periodButtons}>
                                  {['daily', 'weekly', 'monthly', 'lifetime'].map((period) => (
                                    <TouchableOpacity
                                      key={period}
                                      style={[
                                        styles.periodButton,
                                        limit.period === period && styles.periodButtonActive,
                                      ]}
                                      onPress={() => updateFeatureLimit(feature.name, 'period', period)}
                                    >
                                      <Text
                                        style={[
                                          styles.periodButtonText,
                                          limit.period === period && styles.periodButtonTextActive,
                                        ]}
                                      >
                                        {period}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.unlimitedToggleButton}
                              onPress={() => updateFeatureLimit(feature.name, 'unlimited', !limit.unlimited)}
                            >
                              <View style={[styles.toggleSwitch, limit.unlimited && styles.toggleSwitchActive]}>
                                <View style={[styles.toggleThumb, limit.unlimited && styles.toggleThumbActive]} />
                              </View>
                              <Text style={styles.unlimitedLabel}>Unlimited</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={createPlanWithFeatures}
              >
                <Save size={18} color="#fff" />
                <Text style={styles.createButtonText}>Create Plan</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
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
    section: {
      padding: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sectionIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    addButton: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    addButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    addButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    configGrid: {
      gap: 12,
    },
    configCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    configLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 12,
    },
    configInput: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    planCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      padding: 24,
      marginBottom: 20,
      borderWidth: 2,
      borderColor: colors.border.light,
    },
    premiumPlanCard: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '05',
    },
    freePlanCard: {
      borderColor: colors.text.tertiary,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20,
    },
    planHeaderLeft: {
      flex: 1,
      gap: 12,
    },
    planBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.background.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    premiumBadge: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary,
    },
    planBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text.primary,
      letterSpacing: 1,
    },
    planNameDisplay: {
      gap: 4,
    },
    planNameText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    planDescriptionText: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    planNameEdit: {
      gap: 12,
    },
    planNameInput: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 14,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    planDescriptionInput: {
      fontSize: 14,
      fontWeight: '400',
      minHeight: 60,
      textAlignVertical: 'top',
    },
    planHeaderActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    editToggleButton: {
      padding: 8,
    },
    deleteButton: {
      padding: 8,
    },
    pricingRow: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 24,
    },
    priceCard: {
      flex: 1,
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    priceLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    priceInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    currencySymbol: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    priceInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: '700',
      color: colors.text.primary,
    },
    limitsSection: {
      marginTop: 8,
      paddingTop: 24,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    limitsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    limitsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    addFeatureButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.primary + '15',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    addFeatureButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    addFeatureDropdown: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      marginBottom: 16,
      maxHeight: 200,
      overflow: 'hidden',
    },
    featureOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    featureOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      flex: 1,
    },
    featureOptionPeriod: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text.secondary,
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    noFeaturesText: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      padding: 16,
    },
    noLimitsContainer: {
      padding: 24,
      alignItems: 'center',
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderStyle: 'dashed',
    },
    noLimitsText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 4,
    },
    noLimitsSubtext: {
      fontSize: 13,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    limitsGrid: {
      gap: 12,
    },
    limitCard: {
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    limitHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    limitHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    removeFeatureButton: {
      padding: 4,
      backgroundColor: colors.danger + '15',
      borderRadius: 6,
    },
    limitFeatureName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      flex: 1,
    },
    limitPeriod: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text.tertiary,
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    limitValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    limitInput: {
      flex: 1,
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      padding: 12,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
      textAlign: 'center',
    },
    unlimitedBadge: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary + '15',
      padding: 12,
      borderRadius: 10,
    },
    unlimitedText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    unlimitedToggle: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.background.secondary,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    unlimitedToggleText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
    },
    modalContent: {
      flex: 1,
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: Platform.OS === 'android' ? 24 : 0,
      borderTopRightRadius: Platform.OS === 'android' ? 24 : 0,
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
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    modalCloseButton: {
      padding: 4,
    },
    modalScroll: {
      flex: 1,
      padding: 20,
    },
    formSection: {
      marginBottom: 32,
    },
    formSectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    formSectionSubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 16,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    formHint: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 4,
    },
    formInput: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    formTextArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    priceRow: {
      flexDirection: 'row',
      gap: 12,
    },
    priceInputGroup: {
      flex: 1,
    },
    featuresList: {
      gap: 12,
    },
    featureItem: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    featureCheckbox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border.light,
      backgroundColor: colors.background.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    checkmark: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    featureInfo: {
      flex: 1,
    },
    featureLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    featurePeriod: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    featureLimitConfig: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      gap: 12,
    },
    limitConfigRow: {
      flexDirection: 'row',
      gap: 12,
    },
    limitInputGroup: {
      flex: 1,
    },
    limitLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 6,
    },
    limitInput: {
      backgroundColor: colors.background.primary,
      borderRadius: 8,
      padding: 10,
      fontSize: 14,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    periodInputGroup: {
      flex: 1,
    },
    periodButtons: {
      flexDirection: 'row',
      gap: 6,
      flexWrap: 'wrap',
    },
    periodButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    periodButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    periodButtonText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    periodButtonTextActive: {
      color: '#fff',
    },
    unlimitedToggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    toggleSwitch: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.background.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
      padding: 2,
      justifyContent: 'center',
    },
    toggleSwitchActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.text.secondary,
      alignSelf: 'flex-start',
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
      backgroundColor: '#fff',
    },
    unlimitedLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      backgroundColor: colors.background.primary,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    createButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });
