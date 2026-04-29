/**
 * Landing screen - UI only. No auth redirects. AppGate handles routing.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  Heart,
  CheckCircle2,
  Search,
  Bell,
  Users,
  Lock,
  Award,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  MessageCircleHeart,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type PublicRelationshipResult = {
  relationship_id: string;
  person_name: string;
  partner_name: string;
  relationship_type: string;
  relationship_status: string;
  verified_date?: string;
  start_date?: string;
};

export default function LandingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { authInitialized, authLoading, isAuthenticated, user } = useAuth();
  const [publicSearchQuery, setPublicSearchQuery] = useState('');
  const [publicSearchResults, setPublicSearchResults] = useState<PublicRelationshipResult[]>([]);
  const [publicSearchLoading, setPublicSearchLoading] = useState(false);
  const [publicSearchMessage, setPublicSearchMessage] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
  }, [fadeAnim, slideAnim]);

  const features = [
    {
      icon: Shield,
      title: 'Verified Relationships',
      description: 'Register your relationship and get verified with your partner',
      tone: colors.primary,
      badge: 'Trust',
    },
    {
      icon: Search,
      title: 'Public Registry',
      description: 'Search anyone by name or phone to check their relationship status',
      tone: colors.secondary,
      badge: 'Check',
    },
    {
      icon: MessageCircleHeart,
      title: 'Committed Dating',
      description: 'Meet intentional singles, match safely, chat, and plan real dates',
      tone: colors.danger,
      badge: 'Love',
    },
    {
      icon: Bell,
      title: 'Cheating Alerts',
      description: 'Get notified if your partner attempts to register with someone else',
      tone: colors.accent,
      badge: 'Alert',
    },
    {
      icon: Lock,
      title: 'Privacy Control',
      description: 'Control who can see your relationship history and personal information',
      tone: colors.primary,
      badge: 'Privacy',
    },
    {
      icon: Award,
      title: 'Digital Certificates',
      description: 'Get verified couple badges and downloadable certificates',
      tone: colors.secondary,
      badge: 'Proof',
    },
    {
      icon: Users,
      title: 'Accountability',
      description: 'Build trust through transparency and public verification',
      tone: colors.accent,
      badge: 'Care',
    },
  ];

  const stats = [
    { number: '10K+', label: 'Verified Couples' },
    { number: 'Dating', label: 'Find Love' },
    { number: '24/7', label: 'Trust Tools' },
  ];

  const styles = createStyles(colors);

  const getRelationshipTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      married: 'Married',
      engaged: 'Engaged',
      serious: 'Serious Relationship',
      dating: 'Dating',
    };
    return labels[type] || type;
  };

  const getPublicInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'C';
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  };

  const formatPublicDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const normalizePublicRelationshipRows = (rows: any[]): PublicRelationshipResult[] => (
    rows.map((row) => ({
      relationship_id: row.relationship_id || row.id,
      person_name: row.person_name || row.users?.full_name || 'Committed member',
      partner_name: row.partner_name || row.partner?.full_name || 'Partner',
      relationship_type: row.relationship_type || row.type,
      relationship_status: row.relationship_status || row.status,
      verified_date: row.verified_date,
      start_date: row.start_date,
    }))
  );

  const runPublicSearchFallback = async (query: string) => {
    const digits = query.replace(/\D/g, '');
    const clauses = [
      `partner_name.ilike.%${query}%`,
      `partner_phone.ilike.%${query}%`,
    ];
    if (digits.length >= 2) {
      clauses.push(`partner_phone.ilike.%${digits}%`);
    }

    const { data, error } = await supabase
      .from('relationships')
      .select(`
        id,
        type,
        status,
        start_date,
        verified_date,
        partner_name,
        partner_phone,
        users!relationships_user_id_fkey(full_name, phone_number),
        partner:users!relationships_partner_user_id_fkey(full_name, phone_number)
      `)
      .eq('status', 'verified')
      .eq('privacy_level', 'public')
      .or(clauses.join(','))
      .order('verified_date', { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) throw error;
    return normalizePublicRelationshipRows(data || []);
  };

  const handlePublicSearch = async () => {
    const query = publicSearchQuery.trim();
    if (query.length < 2) {
      setPublicSearchMessage('Enter at least 2 characters to search the public registry.');
      setPublicSearchResults([]);
      return;
    }

    try {
      setPublicSearchLoading(true);
      setPublicSearchMessage('');
      const { data, error } = await supabase.rpc('public_relationship_search', {
        search_query: query,
      });
      const results = error
        ? await runPublicSearchFallback(query)
        : normalizePublicRelationshipRows(data || []);
      setPublicSearchResults(results);
      if (results.length === 0) {
        setPublicSearchMessage('No public verified relationship record matched that search.');
      }
    } catch (error) {
      console.error('Public registry search error:', error);
      setPublicSearchResults([]);
      setPublicSearchMessage('Public search needs the public registry database migration applied. Members can still sign in to use full registry search.');
    } finally {
      setPublicSearchLoading(false);
    }
  };

  if (!authInitialized || authLoading || (isAuthenticated && user?.id)) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        <LinearGradient
          colors={['#1A73E8', '#1557B0', '#0D47A1']}
          style={styles.heroSection}
        >
          <Animated.View
            style={[
              styles.heroContent,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Shield size={56} color={colors.text.white} strokeWidth={2} />
                <View style={styles.heartBadge}>
                  <Heart size={28} color={colors.danger} fill={colors.danger} />
                </View>
              </View>
            </View>

            <Text style={styles.heroTitle}>Committed</Text>
            <Text style={styles.heroSubtitle}>
              Verified relationships, trusted dating, and safer love in one app
            </Text>

            <View style={styles.heroTagline}>
              <Sparkles size={20} color={colors.accent} />
              <Text style={styles.heroTaglineText}>
                Build trust. Meet intentionally. Stay accountable.
              </Text>
            </View>

            <View style={styles.ctaButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.primaryButtonText}>Get Started</Text>
                <ArrowRight size={20} color={colors.text.white} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.secondaryButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.publicSearchCard}>
              <View style={styles.publicSearchHeader}>
                <View style={styles.publicSearchIcon}>
                  <Search size={20} color={colors.primary} />
                </View>
                <View style={styles.publicSearchHeaderCopy}>
                  <Text style={styles.publicSearchTitle}>Public relationship check</Text>
                  <Text style={styles.publicSearchSubtitle}>
                    Search verified public records before you sign up.
                  </Text>
                </View>
              </View>
              <View style={styles.publicSearchInputRow}>
                <TextInput
                  style={styles.publicSearchInput}
                  placeholder="Name or phone number"
                  placeholderTextColor={colors.text.tertiary}
                  value={publicSearchQuery}
                  onChangeText={setPublicSearchQuery}
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={handlePublicSearch}
                />
                <TouchableOpacity style={styles.publicSearchButton} onPress={handlePublicSearch} disabled={publicSearchLoading}>
                  {publicSearchLoading ? (
                    <ActivityIndicator color={colors.text.white} size="small" />
                  ) : (
                    <Search size={18} color={colors.text.white} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.publicSearchTrustRow}>
                <Shield size={14} color={colors.secondary} />
                <Text style={styles.publicSearchTrustText}>Only verified public relationships appear here.</Text>
              </View>
              {!!publicSearchMessage && <Text style={styles.publicSearchMessage}>{publicSearchMessage}</Text>}
              {publicSearchResults.length > 0 && (
                <View style={styles.publicSearchResults}>
                  {publicSearchResults.map((result) => {
                    const verifiedDate = formatPublicDate(result.verified_date);
                    const startDate = formatPublicDate(result.start_date);
                    return (
                      <View key={result.relationship_id} style={styles.publicSearchResult}>
                        <View style={styles.publicResultHero}>
                          <View style={styles.publicResultInitials}>
                            <Text style={styles.publicResultInitialsText}>
                              {getPublicInitials(result.person_name)}
                            </Text>
                          </View>
                          <View style={styles.publicResultHeart}>
                            <Heart size={15} color={colors.text.white} fill={colors.text.white} />
                          </View>
                          <View style={[styles.publicResultInitials, styles.publicResultPartnerInitials]}>
                            <Text style={styles.publicResultInitialsText}>
                              {getPublicInitials(result.partner_name)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.publicResultTopRow}>
                          <View style={styles.publicResultNames}>
                            <Text style={styles.publicResultName}>{result.person_name}</Text>
                            <Text style={styles.publicResultPartnerLabel}>with {result.partner_name}</Text>
                          </View>
                          <View style={styles.publicVerifiedBadge}>
                            <CheckCircle2 size={12} color={colors.secondary} />
                            <Text style={styles.publicVerifiedText}>Verified</Text>
                          </View>
                        </View>
                        <Text style={styles.publicResultText}>
                          {getRelationshipTypeLabel(result.relationship_type)} relationship
                        </Text>
                        <View style={styles.publicResultDetailRow}>
                          <View style={styles.publicResultDetailPill}>
                            <Shield size={12} color={colors.primary} />
                            <Text style={styles.publicResultDetailText}>Public record</Text>
                          </View>
                          {verifiedDate && (
                            <View style={styles.publicResultDetailPill}>
                              <CheckCircle2 size={12} color={colors.secondary} />
                              <Text style={styles.publicResultDetailText}>Verified {verifiedDate}</Text>
                            </View>
                          )}
                          {startDate && (
                            <View style={styles.publicResultDetailPill}>
                              <Heart size={12} color={colors.danger} />
                              <Text style={styles.publicResultDetailText}>Started {startDate}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>

          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statNumber}>{stat.number}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={[styles.section, styles.journeySection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>How it works</Text>
            <Text style={styles.sectionTitle}>From curiosity to clarity</Text>
            <Text style={styles.sectionDescription}>
              Whether you are single, dating, or already committed, the app guides every step with privacy and verification controls.
            </Text>
          </View>

          <View style={styles.journeyGrid}>
            <View style={styles.journeyCard}>
              <View style={styles.journeyIcon}>
                <Search size={24} color={colors.primary} />
              </View>
              <Text style={styles.journeyNumber}>01</Text>
              <Text style={styles.journeyTitle}>Search or discover</Text>
              <Text style={styles.journeyText}>Check public records, create a dating profile, or start by inviting your partner.</Text>
            </View>

            <View style={styles.journeyCard}>
              <View style={styles.journeyIcon}>
                <Heart size={24} color={colors.danger} fill={colors.danger} />
              </View>
              <Text style={styles.journeyNumber}>02</Text>
              <Text style={styles.journeyTitle}>Build the connection</Text>
              <Text style={styles.journeyText}>Match, chat, register the relationship type, choose visibility, and preview before submitting.</Text>
            </View>

            <View style={styles.journeyCard}>
              <View style={styles.journeyIcon}>
                <Shield size={24} color={colors.secondary} />
              </View>
              <Text style={styles.journeyNumber}>03</Text>
              <Text style={styles.journeyTitle}>Verify and protect</Text>
              <Text style={styles.journeyText}>Partner, admin, or moderator checks confirm the record while privacy settings control visibility.</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.featuresSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>What you can do</Text>
            <Text style={styles.sectionTitle}>Dating and commitment tools together</Text>
            <Text style={styles.sectionDescription}>
              One experience for meeting someone, becoming exclusive, proving commitment, and staying accountable.
            </Text>
          </View>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={[styles.featureIconContainer, { backgroundColor: feature.tone + '16' }]}>
                  <feature.icon size={28} color={feature.tone} strokeWidth={2} />
                </View>
                <View style={[styles.featureBadge, { backgroundColor: feature.tone + '14' }]}>
                  <Text style={[styles.featureBadgeText, { color: feature.tone }]}>{feature.badge}</Text>
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.section, styles.datingSection]}>
          <View style={styles.datingCard}>
            <View style={styles.datingIconRow}>
              <View style={styles.datingIconBubble}>
                <MessageCircleHeart size={30} color={colors.danger} />
              </View>
              <View style={styles.datingIconBubble}>
                <SlidersHorizontal size={30} color={colors.primary} />
              </View>
              <View style={styles.datingIconBubble}>
                <Shield size={30} color={colors.secondary} />
              </View>
            </View>
            <Text style={styles.datingTitle}>Find love with more confidence</Text>
            <Text style={styles.datingDescription}>
              Committed is not only for verifying couples. Singles can create dating profiles, discover people nearby, match, chat, use filters, and move toward real relationships with safety signals built in.
            </Text>
            <View style={styles.datingHighlights}>
              <View style={styles.datingHighlight}>
                <Heart size={18} color={colors.danger} fill={colors.danger} />
                <Text style={styles.datingHighlightText}>Swipe and match</Text>
              </View>
              <View style={styles.datingHighlight}>
                <Search size={18} color={colors.primary} />
                <Text style={styles.datingHighlightText}>Filter by intention</Text>
              </View>
              <View style={styles.datingHighlight}>
                <Shield size={18} color={colors.secondary} />
                <Text style={styles.datingHighlightText}>Trust-first profiles</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.datingButton}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.datingButtonText}>Start Dating</Text>
              <ArrowRight size={18} color={colors.text.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, styles.warningSection]}>
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <View style={styles.warningIcon}>
                <AlertTriangle size={30} color={colors.accent} />
              </View>
              <Text style={styles.warningTitle}>Integrity shield protection</Text>
            </View>
            <Text style={styles.warningDescription}>
              If someone tries to register another relationship while already verified, the app creates accountability through alerts, review, and relationship records.
            </Text>
            <View style={styles.warningFeatures}>
              <View style={styles.warningFeature}>
                <CheckCircle2 size={18} color={colors.secondary} />
                <Text style={styles.warningFeatureText}>Real-time alerts</Text>
              </View>
              <View style={styles.warningFeature}>
                <CheckCircle2 size={18} color={colors.secondary} />
                <Text style={styles.warningFeatureText}>Partner notifications</Text>
              </View>
              <View style={styles.warningFeature}>
                <CheckCircle2 size={18} color={colors.secondary} />
                <Text style={styles.warningFeatureText}>Privacy-aware records</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.whySection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>Why Committed?</Text>
            <Text style={styles.sectionTitle}>Love feels better with clarity</Text>
          </View>

          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <CheckCircle2 size={22} color={colors.secondary} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Transparency:</Text> No more secrets. Your relationship status is clear and verified.
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <MessageCircleHeart size={22} color={colors.danger} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Dating:</Text> Meet people who are looking for intentional, accountable connection.
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Bell size={22} color={colors.accent} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Protection:</Text> Get notified if someone tries to register with your partner.
              </Text>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Lock size={22} color={colors.primary} />
              </View>
              <Text style={styles.benefitText}>
                <Text style={styles.benefitBold}>Privacy:</Text> Control what information is visible and to whom.
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.finalCta]}>
          <View style={styles.finalCtaCard}>
            <Text style={styles.finalCtaTitle}>Ready for love with clarity?</Text>
            <Text style={styles.finalCtaDescription}>
              Join to date intentionally, verify commitment, and protect the relationships that matter.
            </Text>
            <TouchableOpacity
              style={styles.finalCtaButton}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.finalCtaButtonText}>Join Committed</Text>
              <ArrowRight size={20} color={colors.text.white} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Committed. All rights reserved.
          </Text>
          <Text style={styles.footerSubtext}>
            Dating, verification, and accountability in one place
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: typeof import('@/constants/colors').default) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroSection: {
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  heroContent: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heartBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#1A73E8',
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '800' as const,
    color: colors.text.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  heroTagline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 32,
  },
  heroTaglineText: {
    fontSize: 14,
    color: colors.text.white,
    fontWeight: '600' as const,
  },
  ctaButtons: {
    width: '100%',
    gap: 12,
  },
  publicSearchCard: {
    width: '100%',
    marginTop: 24,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 4,
  },
  publicSearchHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  publicSearchIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '12',
  },
  publicSearchHeaderCopy: {
    flex: 1,
  },
  publicSearchTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  publicSearchSubtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.text.secondary,
  },
  publicSearchInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  publicSearchInput: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    color: colors.text.primary,
    fontSize: 15,
  },
  publicSearchButton: {
    width: 54,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  publicSearchButtonText: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: colors.text.white,
  },
  publicSearchTrustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  publicSearchTrustText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.secondary,
  },
  publicSearchMessage: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.background.secondary,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  publicSearchResults: {
    marginTop: 12,
    gap: 10,
  },
  publicSearchResult: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.primary + '20',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  publicResultHero: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  publicResultInitials: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  publicResultPartnerInitials: {
    marginLeft: -10,
    backgroundColor: colors.danger,
  },
  publicResultInitialsText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: colors.text.white,
  },
  publicResultHeart: {
    zIndex: 2,
    width: 28,
    height: 28,
    marginHorizontal: -4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  publicResultTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  publicResultNames: {
    flex: 1,
  },
  publicResultName: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: colors.text.primary,
  },
  publicResultPartnerLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  publicVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.secondary + '20',
  },
  publicVerifiedText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colors.secondary,
  },
  publicResultText: {
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
  publicResultDetailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  publicResultDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  publicResultDetailText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  primaryButton: {
    backgroundColor: colors.text.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 48,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500' as const,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  journeySection: {
    backgroundColor: colors.background.primary,
  },
  featuresSection: {
    backgroundColor: colors.background.secondary,
  },
  sectionHeader: {
    marginBottom: 32,
    alignItems: 'center',
  },
  sectionEyebrow: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  journeyGrid: {
    gap: 14,
  },
  journeyCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  journeyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    marginBottom: 16,
  },
  journeyNumber: {
    fontSize: 12,
    fontWeight: '900' as const,
    color: colors.text.tertiary,
    marginBottom: 8,
  },
  journeyTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  journeyText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  stepsContainer: {
    gap: 0,
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  stepConnector: {
    width: 2,
    height: 32,
    backgroundColor: colors.border.light,
    marginLeft: 23,
    marginVertical: 8,
  },
  featuresGrid: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  featureBadgeText: {
    fontSize: 11,
    fontWeight: '900' as const,
    textTransform: 'uppercase',
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  datingSection: {
    backgroundColor: colors.background.primary,
    paddingTop: 16,
  },
  datingCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border.light,
    alignItems: 'center',
  },
  datingIconRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  datingIconBubble: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  datingTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  datingDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 22,
  },
  datingHighlights: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  datingHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.background.primary,
  },
  datingHighlightText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  datingButton: {
    backgroundColor: colors.danger,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  datingButtonText: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: colors.text.white,
  },
  warningSection: {
    backgroundColor: colors.background.secondary,
    paddingVertical: 56,
  },
  warningCard: {
    backgroundColor: colors.background.primary,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 3,
  },
  warningHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  warningIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '18',
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  warningDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  warningFeatures: {
    gap: 12,
  },
  warningFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningFeatureText: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: '600' as const,
  },
  benefitsContainer: {
    gap: 14,
  },
  whySection: {
    backgroundColor: colors.background.primary,
  },
  benefitItem: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    backgroundColor: colors.background.secondary,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  benefitIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  benefitBold: {
    fontWeight: '700' as const,
    color: colors.text.primary,
  },
  finalCta: {
    backgroundColor: colors.background.secondary,
  },
  finalCtaCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  finalCtaTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.text.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  finalCtaDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  finalCtaButton: {
    backgroundColor: colors.text.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finalCtaButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footerText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
