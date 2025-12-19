import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Dimensions,
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
  Video,
  ScanFace,
  ShieldAlert,
  Smile,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import colors from '@/constants/colors';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

export default function AdminDashboardScreen() {
  const { currentUser } = useApp();
  const { colors: themeColors } = useTheme();
  const styles = createStyles(themeColors);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

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
          title: 'Admins & Moderators',
          icon: UserCog,
          description: 'Manage admin roles',
          route: '/admin/roles',
          color: '#9B59B6',
          gradient: ['#9B59B6', '#8E44AD'],
          visible: currentUser.role === 'super_admin',
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
          {visibleSections.map((category, categoryIndex) => (
            <View key={category.category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category.category.toUpperCase()}</Text>
              
              <View style={styles.cardsGrid}>
                {category.items.map((item, itemIndex) => {
                  const Icon = item.icon;
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
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
