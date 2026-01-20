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
} from 'react-native';
import { Stack } from 'expo-router';
import { DollarSign, Plus, Shield, Infinity, TrendingUp, Edit2, Save } from 'lucide-react-native';
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, limitsRes, configRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('display_order'),
        supabase.from('dating_feature_limits').select('*, subscription_plans!inner(name)'),
        supabase.from('pricing_configuration').select('*'),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (limitsRes.error) throw limitsRes.error;
      if (configRes.error) throw configRes.error;

      setPlans(plansRes.data || []);
      
      // Organize limits by plan
      const limitsByPlan: Record<string, any[]> = {};
      (limitsRes.data || []).forEach((limit: any) => {
        const planName = limit.subscription_plans.name;
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

  const addNewPlan = async () => {
    try {
      const { data: existingPlans } = await supabase
        .from('subscription_plans')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1);

      const maxOrder = existingPlans?.[0]?.display_order || 0;

      const { error } = await supabase
        .from('subscription_plans')
        .insert({
          name: `plan_${Date.now()}`,
          display_name: 'New Plan',
          description: 'Plan description',
          price_monthly: 0,
          price_yearly: 0,
          display_order: maxOrder + 1,
          is_active: true,
        });

      if (error) throw error;
      loadData();
      Alert.alert('Success', 'New plan created! You can now edit it.');
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
                    <TouchableOpacity
                      style={styles.editToggleButton}
                      onPress={() => setEditingPlan(isEditing ? null : plan.id)}
                    >
                      <Edit2 size={18} color={isEditing ? colors.primary : colors.text.secondary} />
                    </TouchableOpacity>
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
                  {planLimits.length > 0 && (
                    <View style={styles.limitsSection}>
                      <Text style={styles.limitsTitle}>Feature Limits</Text>
                      <View style={styles.limitsGrid}>
                        {planLimits.map((limit: any) => (
                          <View key={limit.id} style={styles.limitCard}>
                            <View style={styles.limitHeader}>
                              <Text style={styles.limitFeatureName}>
                                {limit.feature_name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Text>
                              <Text style={styles.limitPeriod}>{limit.limit_period}</Text>
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
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
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
    editToggleButton: {
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
    limitsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 16,
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
  });
