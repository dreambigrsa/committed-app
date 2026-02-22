import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Stack, router } from 'expo-router';
import {
  Users,
  Heart,
  Shield,
  UserCog,
  Settings,
  BarChart3,
  AlertTriangle,
  FileText,
  MessageSquare,
  DollarSign,
  CreditCard,
  Video,
  ScanFace,
  ShieldAlert,
  Smile,
  ChevronRight,
  LayoutDashboard,
  UserCheck,
  Sparkles,
  Briefcase,
  TrendingUp,
  Star,
  Calendar,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function AdminDashboardScreen() {
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [pendingAdPaymentsCount, setPendingAdPaymentsCount] = useState(0);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, []);

  useEffect(() => {
    const loadPendingPayments = async () => {
      try {
        const [{ count: totalPending }, { count: adPending }] = await Promise.all([
          supabase
            .from('payment_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('payment_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            .not('advertisement_id', 'is', null),
        ]);

        setPendingPaymentsCount(totalPending || 0);
        setPendingAdPaymentsCount(adPending || 0);
      } catch (error) {
        console.error('Failed to load pending payment counts:', error);
      }
    };

    loadPendingPayments();
  }, []);

  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Admin Dashboard', headerShown: true }} />
        <View style={styles.errorContainer}>
          <Shield size={64} color={colors.danger} />
          <Text style={styles.errorText}>Access Denied</Text>
          <Text style={styles.errorSubtext}>You don&apos;t have admin permissions</Text>
        </View>
      </SafeAreaView>
    );
  }

  const adminSections = [
    {
      category: 'User Management',
      items: [
        {
          title: 'Users',
          icon: Users,
          description: 'Manage all users',
          route: '/admin/users',
          color: '#4A90E2',
          gradient: ['#4A90E2', '#357ABD'],
          visible: true,
        },
        {
          title: 'Relationships',
          icon: Heart,
          description: 'Manage relationships',
          route: '/admin/relationships',
          color: '#E74C3C',
          gradient: ['#E74C3C', '#C0392B'],
          visible: true,
        },
        {
          title: 'False Relationship Reports',
          icon: AlertTriangle,
          description: 'Review false relationship reports',
          route: '/admin/false-relationship-reports',
          color: '#F39C12',
          gradient: ['#F39C12', '#E67E22'],
          visible: true,
        },
        {
          title: 'Admins & Moderators',
          icon: UserCog,
          description: 'Manage admin roles',
          route: '/admin/roles',
          color: '#9B59B6',
          gradient: ['#9B59B6', '#8E44AD'],
          visible: currentUser.role === 'super_admin',
        },
        {
          title: 'Dating Management',
          icon: Heart,
          description: 'Manage dating profiles & matches',
          route: '/admin/dating',
          color: '#E91E63',
          gradient: ['#E91E63', '#C2185B'],
          visible: true,
        },
        {
          title: 'Dating Interests',
          icon: Sparkles,
          description: 'Manage dating interests',
          route: '/admin/dating-interests',
          color: '#9C27B0',
          gradient: ['#9C27B0', '#7B1FA2'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Date Request Options',
          icon: Calendar,
          description: 'Manage date request options',
          route: '/admin/dating-date-options',
          color: '#E91E63',
          gradient: ['#E91E63', '#C2185B'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Payment Methods',
          icon: DollarSign,
          description: 'Manage payment methods',
          route: '/admin/payment-methods',
          color: '#27AE60',
          gradient: ['#27AE60', '#229954'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Payment Verifications',
          icon: CreditCard,
          description: 'Verify user payments',
          route: '/admin/payment-verifications',
          color: '#16A085',
          gradient: ['#16A085', '#138D75'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
      ],
    },
    {
      category: 'Content Management',
      items: [
        {
          title: 'Posts Review',
          icon: FileText,
          description: 'Review posts',
          route: '/admin/posts-review',
          color: '#1ABC9C',
          gradient: ['#1ABC9C', '#16A085'],
          visible: true,
        },
        {
          title: 'Reels Review',
          icon: Video,
          description: 'Review reels',
          route: '/admin/reels-review',
          color: '#E67E22',
          gradient: ['#E67E22', '#D35400'],
          visible: true,
        },
        {
          title: 'Reported Content',
          icon: AlertTriangle,
          description: 'Review reports',
          route: '/admin/reports',
          color: '#F39C12',
          gradient: ['#F39C12', '#E67E22'],
          visible: true,
        },
        {
          title: 'Stickers',
          icon: Smile,
          description: 'Manage stickers',
          route: '/admin/stickers',
          color: '#FF6B9D',
          gradient: ['#FF6B9D', '#FF8E9B'],
          visible: true,
        },
      ],
    },
    {
      category: 'Business & Marketing',
      items: [
        {
          title: 'Advertisements',
          icon: DollarSign,
          description: 'Manage ads',
          route: '/admin/advertisements',
          color: '#2ECC71',
          gradient: ['#2ECC71', '#27AE60'],
          visible: true,
        },
        {
          title: 'Analytics',
          icon: BarChart3,
          description: 'View analytics',
          route: '/admin/analytics',
          color: '#3498DB',
          gradient: ['#3498DB', '#2980B9'],
          visible: true,
        },
      ],
    },
    {
      category: 'Safety & Compliance',
      items: [
        {
          title: 'Disputes',
          icon: Shield,
          description: 'Handle disputes',
          route: '/admin/disputes',
          color: '#E74C3C',
          gradient: ['#E74C3C', '#C0392B'],
          visible: true,
        },
        {
          title: 'Trigger Words',
          icon: ShieldAlert,
          description: 'Manage infidelity detection',
          route: '/admin/trigger-words',
          color: '#E67E22',
          gradient: ['#E67E22', '#D35400'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator',
        },
        {
          title: 'Warning Templates',
          icon: FileText,
          description: 'Customize warnings',
          route: '/admin/warning-templates',
          color: '#F39C12',
          gradient: ['#F39C12', '#E67E22'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator',
        },
        {
          title: 'Ban Appeals',
          icon: AlertTriangle,
          description: 'Review appeals',
          route: '/admin/ban-appeals',
          color: '#C0392B',
          gradient: ['#C0392B', '#A93226'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator',
        },
      ],
    },
    {
      category: 'Verification',
      items: [
        {
          title: 'ID Verifications',
          icon: Shield,
          description: 'Review ID requests',
          route: '/admin/id-verifications',
          color: '#16A085',
          gradient: ['#16A085', '#138D75'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Face Matching',
          icon: ScanFace,
          description: 'Face recognition',
          route: '/admin/face-matching',
          color: '#8E44AD',
          gradient: ['#8E44AD', '#7D3C98'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Verification Services',
          icon: Shield,
          description: 'SMS & Email config',
          route: '/admin/verification-services',
          color: '#2980B9',
          gradient: ['#2980B9', '#1F618D'],
          visible: currentUser.role === 'super_admin',
        },
      ],
    },
    {
      category: 'Professional System',
      items: [
        {
          title: 'Professional Roles',
          icon: Briefcase,
          description: 'Manage professional roles',
          route: '/admin/professional-roles',
          color: '#3498DB',
          gradient: ['#3498DB', '#2980B9'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Professional Profiles',
          icon: UserCheck,
          description: 'Manage professionals',
          route: '/admin/professional-profiles',
          color: '#2ECC71',
          gradient: ['#2ECC71', '#27AE60'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator',
        },
        {
          title: 'Professional Sessions',
          icon: MessageSquare,
          description: 'View live sessions',
          route: '/admin/professional-sessions',
          color: '#9B59B6',
          gradient: ['#9B59B6', '#8E44AD'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator',
        },
        {
          title: 'Escalation Rules',
          icon: TrendingUp,
          description: 'Configure escalations',
          route: '/admin/escalation-rules',
          color: '#E67E22',
          gradient: ['#E67E22', '#D35400'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Professional Analytics',
          icon: BarChart3,
          description: 'Session analytics',
          route: '/admin/professional-analytics',
          color: '#16A085',
          gradient: ['#16A085', '#138D75'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
        {
          title: 'Professional Reviews',
          icon: Star,
          description: 'Moderate reviews',
          route: '/admin/professional-reviews',
          color: '#F39C12',
          gradient: ['#F39C12', '#E67E22'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin' || currentUser.role === 'moderator',
        },
      ],
    },
    {
      category: 'System',
      items: [
        {
          title: 'Legal & Policies',
          icon: FileText,
          description: 'Manage legal docs',
          route: '/admin/legal-policies',
          color: '#6C5CE7',
          gradient: ['#6C5CE7', '#5A4FCF'],
          visible: currentUser.role === 'super_admin',
        },
        {
          title: 'App Settings',
          icon: Settings,
          description: 'Configure app',
          route: '/admin/settings',
          color: '#9B59B6',
          gradient: ['#9B59B6', '#8E44AD'],
          visible: currentUser.role === 'super_admin',
        },
        {
          title: 'Activity Logs',
          icon: FileText,
          description: 'View activity logs',
          route: '/admin/logs',
          color: '#7F8C8D',
          gradient: ['#7F8C8D', '#5D6D7E'],
          visible: currentUser.role === 'super_admin',
        },
        {
          title: 'Pricing & Subscriptions',
          icon: DollarSign,
          description: 'Manage pricing & limits',
          route: '/admin/pricing',
          color: '#27AE60',
          gradient: ['#27AE60', '#229954'],
          visible: currentUser.role === 'super_admin' || currentUser.role === 'admin',
        },
      ],
    },
  ];

  const visibleSections = adminSections.map(category => ({
    ...category,
    items: category.items.filter(item => item.visible),
  })).filter(category => category.items.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Admin Dashboard', 
          headerShown: true,
          headerStyle: { backgroundColor: themeColors.background.primary },
          headerTintColor: themeColors.text.primary,
          headerTitleStyle: { fontWeight: '700' },
        }} 
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconContainer}>
                  <LayoutDashboard size={32} color={themeColors.primary} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.welcomeText}>Welcome back</Text>
                  <Text style={styles.userName}>{currentUser.fullName}</Text>
                </View>
              </View>
              <View style={[styles.roleBadge, { backgroundColor: themeColors.primary }]}>
                <Shield size={18} color={themeColors.text.white} />
                <Text style={styles.roleText}>
                  {currentUser.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Categories */}
        <Animated.View style={[styles.sectionsContainer, { opacity: fadeAnim }]}>
          {visibleSections.map((category, _categoryIndex) => (
            <View key={category.category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.category.toUpperCase()}</Text>
              
              <View style={styles.cardsGrid}>
                {category.items.map((item, _itemIndex) => {
                  const Icon = item.icon;
                  const showPaymentBadge = item.route === '/admin/payment-verifications' && pendingPaymentsCount > 0;
                  const pendingSubscriptionCount = Math.max(pendingPaymentsCount - pendingAdPaymentsCount, 0);
                  return (
                    <TouchableOpacity
                      key={item.route}
                      style={styles.sectionCard}
                      onPress={() => router.push(item.route as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.cardContent, { borderLeftColor: item.gradient[0] }]}>
                        <View style={[styles.iconContainer, { backgroundColor: item.gradient[0] + '15' }]}>
                          <Icon size={24} color={item.gradient[0]} />
                        </View>
                        <View style={styles.cardTextContainer}>
                          <Text style={styles.sectionTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.sectionDescription} numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>
                        {showPaymentBadge && (
                          <View style={styles.paymentBadgeContainer}>
                            <View style={styles.paymentBadge}>
                              <Text style={styles.paymentBadgeText}>{pendingPaymentsCount}</Text>
                            </View>
                            <Text style={styles.paymentBadgeLabel}>Pending</Text>
                            <View style={styles.paymentBadgeBreakdown}>
                              {pendingAdPaymentsCount > 0 && (
                                <Text style={styles.paymentBadgeBreakdownText}>Ads {pendingAdPaymentsCount}</Text>
                              )}
                              {pendingSubscriptionCount > 0 && (
                                <Text style={styles.paymentBadgeBreakdownText}>Subs {pendingSubscriptionCount}</Text>
                              )}
                            </View>
                          </View>
                        )}
                        <ChevronRight size={20} color={themeColors.text.tertiary} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 24,
  },
  headerContent: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  headerTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.text.white,
    letterSpacing: 0.3,
  },
  sectionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  categorySection: {
    marginBottom: 28,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.secondary,
    marginBottom: 14,
    letterSpacing: 1.2,
  },
  cardsGrid: {
    gap: 10,
  },
  sectionCard: {
    marginBottom: 10,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
  },
  paymentBadgeContainer: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  paymentBadge: {
    backgroundColor: colors.danger,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  paymentBadgeText: {
    color: colors.text.white,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  paymentBadgeLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  paymentBadgeBreakdown: {
    marginTop: 2,
    flexDirection: 'row',
    gap: 6,
  },
  paymentBadgeBreakdownText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: colors.text.tertiary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
});
