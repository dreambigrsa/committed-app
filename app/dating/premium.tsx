import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Crown, Check, ArrowLeft, Zap, Heart, Star, RotateCcw, Sparkles, Shield } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import * as DatingService from '@/lib/dating-service';
import { LinearGradient } from 'expo-linear-gradient';

export default function PremiumScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [subscriptionData, plansData] = await Promise.all([
        DatingService.getSubscriptionInfo(),
        supabase
          .from('subscription_plans')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
      ]);
      setSubscription(subscriptionData);
      setPlans(plansData.data || []);
    } catch (error: any) {
      console.error('Error loading premium data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    try {
      setIsSubscribing(true);
      // TODO: Implement payment flow
      // For now, show a message that payment integration is coming soon
      Alert.alert(
        'Coming Soon',
        'Payment integration is coming soon! This will allow you to subscribe to premium features.',
        [{ text: 'OK' }]
      );
      // When payment is implemented, navigate to:
      // router.push({
      //   pathname: '/dating/payment',
      //   params: { planId },
      // } as any);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start subscription');
    } finally {
      setIsSubscribing(false);
    }
  };

  const premiumFeatures = [
    { icon: Heart, title: 'See Who Liked You', description: 'View all profiles that liked you' },
    { icon: Star, title: 'Unlimited Super Likes', description: 'Stand out with unlimited super likes' },
    { icon: RotateCcw, title: 'Unlimited Rewinds', description: 'Go back and swipe again' },
    { icon: Zap, title: 'Boost Your Profile', description: 'Get 10x more profile views' },
    { icon: Sparkles, title: 'Priority Likes', description: 'Your likes appear first' },
    { icon: Shield, title: 'Advanced Filters', description: 'Filter by education, job, and more' },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Go Premium', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = !!subscription;
  const currentPlanId = subscription?.plan_id || subscription?.plan?.id;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Go Premium',
          headerShown: true,
        }} 
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <LinearGradient
          colors={[colors.primary, colors.primary + 'DD']}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroContent}>
            <Crown size={64} color="#fff" fill="#fff" />
            <Text style={styles.heroTitle}>
              {isPremium ? 'You\'re Premium!' : 'Unlock Premium'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isPremium 
                ? 'Enjoy all premium features'
                : 'Get more matches and unlock exclusive features'
              }
            </Text>
          </View>
        </LinearGradient>

        {/* Features List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Premium Features</Text>
          {premiumFeatures.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <feature.icon size={24} color={colors.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              {isPremium && (
                <Check size={20} color={colors.success} />
              )}
            </View>
          ))}
        </View>

        {/* Subscription Plans */}
        {plans.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === currentPlanId;
              return (
                <View
                  key={plan.id}
                  style={[
                    styles.planCard,
                    isCurrentPlan && styles.currentPlanCard
                  ]}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.display_name}</Text>
                    {plan.price_monthly > 0 && (
                      <Text style={styles.planPrice}>
                        ${plan.price_monthly.toFixed(2)}/mo
                      </Text>
                    )}
                  </View>
                  {plan.description && (
                    <Text style={styles.planDescription}>{plan.description}</Text>
                  )}
                  {isCurrentPlan ? (
                    <View style={styles.currentPlanBadge}>
                      <Check size={20} color={colors.success} />
                      <Text style={styles.currentPlanText}>Current Plan</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.planButton}
                      onPress={() => handleSubscribe(plan.id)}
                      disabled={isSubscribing}
                    >
                      <Text style={styles.planButtonText}>Subscribe</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scrollView: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroSection: {
      padding: 32,
      alignItems: 'center',
      marginBottom: 24,
    },
    heroContent: {
      alignItems: 'center',
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: '#fff',
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    heroSubtitle: {
      fontSize: 16,
      color: '#fff',
      opacity: 0.9,
      textAlign: 'center',
    },
    section: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 20,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    featureIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    featureDescription: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    planCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.border.light,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    planName: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text.primary,
    },
    planPrice: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.primary,
    },
    planDescription: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    planButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    planButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    subscriptionCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 20,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    subscriptionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    subscriptionPlan: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
    },
    subscriptionExpiry: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    currentPlanCard: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    currentPlanBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success + '20',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      gap: 8,
    },
    currentPlanText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.success,
    },
  });

