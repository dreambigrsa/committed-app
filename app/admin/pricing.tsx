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
import { DollarSign, Save, Plus, Trash2, Shield } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

export default function AdminPricingScreen() {
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [limits, setLimits] = useState<Record<string, any>>({});
  const [pricingConfig, setPricingConfig] = useState<any>({});
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState({ feature: '', value: '', period: 'daily' });

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
        <ScrollView style={styles.content}>
          {/* Pricing Configuration */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Global Pricing Settings</Text>
            <View style={styles.configCard}>
              <Text style={styles.configLabel}>Currency</Text>
              <TextInput
                style={styles.configInput}
                value={pricingConfig.currency || 'USD'}
                onChangeText={(text) => updateConfig('currency', JSON.stringify(text))}
                placeholder="USD"
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
              />
            </View>
          </View>

          {/* Subscription Plans */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription Plans</Text>
            {plans.map((plan) => (
              <View key={plan.id} style={styles.planCard}>
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.display_name}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>
                
                <View style={styles.priceRow}>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceLabel}>Monthly</Text>
                    <TextInput
                      style={styles.priceInputField}
                      value={plan.price_monthly?.toString() || '0'}
                      onChangeText={(text) => updatePlanPrice(plan.id, 'price_monthly', text)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceLabel}>Yearly</Text>
                    <TextInput
                      style={styles.priceInputField}
                      value={plan.price_yearly?.toString() || '0'}
                      onChangeText={(text) => updatePlanPrice(plan.id, 'price_yearly', text)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                </View>

                {/* Feature Limits */}
                <View style={styles.limitsContainer}>
                  <Text style={styles.limitsTitle}>Feature Limits</Text>
                  {limits[plan.name]?.map((limit: any) => (
                    <View key={limit.id} style={styles.limitRow}>
                      <Text style={styles.limitFeature}>{limit.feature_name}</Text>
                      <TextInput
                        style={styles.limitInput}
                        value={limit.limit_value === null ? 'unlimited' : limit.limit_value?.toString()}
                        onChangeText={(text) => updateLimit(limit.id, text)}
                        placeholder="unlimited"
                        keyboardType="numeric"
                      />
                      <Text style={styles.limitPeriod}>{limit.limit_period}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
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
      padding: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 16,
    },
    configCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    configLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    configInput: {
      backgroundColor: colors.background.primary,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    planCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    planHeader: {
      marginBottom: 16,
    },
    planName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
    },
    planDescription: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    priceRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    priceInput: {
      flex: 1,
    },
    priceLabel: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 4,
    },
    priceInputField: {
      backgroundColor: colors.background.primary,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    limitsContainer: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    limitsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 12,
    },
    limitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    limitFeature: {
      flex: 1,
      fontSize: 14,
      color: colors.text.primary,
    },
    limitInput: {
      width: 100,
      backgroundColor: colors.background.primary,
      borderRadius: 8,
      padding: 8,
      fontSize: 14,
      color: colors.text.primary,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    limitPeriod: {
      fontSize: 12,
      color: colors.text.secondary,
      width: 60,
    },
  });

