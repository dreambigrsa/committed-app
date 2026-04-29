import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, CheckCircle2, X, Camera, Image as ImageIcon, AlertCircle, ChevronRight, ShieldCheck, Clock, Users } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { LegalDocument } from '@/types';
import StatusIndicator from '@/components/StatusIndicator';
import { getAdaptiveImageQuality, optimizeImageForUpload } from '@/lib/media-optimizer';

export default function SearchScreen() {
  const router = useRouter();
  const { searchUsers, getUserRelationship, searchByFace, userStatuses = {} } = useApp();
  const { colors } = useTheme();
  const [query, setQuery] = useState<string>('');

  const styles = useMemo(() => createStyles(colors), [colors]);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<'text' | 'face'>('text');
  const [searchPhoto, setSearchPhoto] = useState<string | null>(null);
  const [disclaimerDoc, setDisclaimerDoc] = useState<LegalDocument | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'verified' | 'pending' | 'single' | 'registered'>('all');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  useEffect(() => {
    loadDisclaimerDocument();
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const loadDisclaimerDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_active', true)
        .eq('slug', 'public-registry-disclaimer')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to load disclaimer document:', error);
        return;
      }

      if (data) {
        setDisclaimerDoc({
          id: data.id,
          title: data.title,
          slug: data.slug,
          content: data.content,
          version: data.version,
          isActive: data.is_active,
          isRequired: data.is_required,
          displayLocation: data.display_location || [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          createdBy: data.created_by,
          lastUpdatedBy: data.last_updated_by,
        });
      }
    } catch (error) {
      console.error('Error loading disclaimer document:', error);
    }
  };

  const handleSearch = async (text: string) => {
    if (searchMode === 'face') return; // Face search is handled separately
    
    setQuery(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!text.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchUsers(text);
        if (requestId === searchRequestRef.current) {
          setResults(searchResults);
        }
      } finally {
        if (requestId === searchRequestRef.current) {
          setIsSearching(false);
        }
      }
    }, 300);
  };

  const handleFaceSearch = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to search by photo');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: await getAdaptiveImageQuality(),
      });

      if (!result.canceled && result.assets[0]) {
        const optimizedUri = await optimizeImageForUpload(result.assets[0].uri);
        setSearchPhoto(optimizedUri);
        setIsSearching(true);
        
        try {
          const faceResults = await searchByFace(optimizedUri);
          setResults(faceResults);
        } catch (error) {
          console.error('Face search error:', error);
          Alert.alert('Error', 'Failed to search by face. Please try again.');
        } finally {
          setIsSearching(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const clearSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchRequestRef.current += 1;
    setQuery('');
    setResults([]);
    setSearchPhoto(null);
    setSearchMode('text');
    setResultFilter('all');
  };

  const getRelationshipTypeLabel = (type: string) => {
    const labels = {
      married: 'Married',
      engaged: 'Engaged',
      serious: 'Serious Relationship',
      dating: 'Dating',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getStatusLabel = (status?: string) => {
    if (status === 'verified' || status === 'confirmed') return 'Verified';
    if (status === 'pending') return 'Pending';
    return 'No record';
  };

  const getPrivacyLabel = (privacy?: string) => {
    if (privacy === 'public') return 'Public';
    if (privacy === 'verified-only') return 'Verified members';
    if (privacy === 'private') return 'Private';
    return '';
  };

  const filteredResults = useMemo(() => {
    if (resultFilter === 'all') return results;

    return results.filter((item) => {
      if (resultFilter === 'verified') return item.relationshipStatus === 'verified' || item.relationshipStatus === 'confirmed';
      if (resultFilter === 'pending') return item.relationshipStatus === 'pending';
      if (resultFilter === 'single') return item.isRegisteredUser && !item.relationshipType && !item.relationshipStatus;
      if (resultFilter === 'registered') return item.isRegisteredUser && item.id;
      return true;
    });
  }, [results, resultFilter]);

  const renderFilterChip = (value: typeof resultFilter, label: string, icon?: React.ReactNode) => (
    <TouchableOpacity
      key={value}
      style={[styles.resultFilterChip, resultFilter === value && styles.resultFilterChipActive]}
      onPress={() => setResultFilter(value)}
      activeOpacity={0.8}
    >
      {icon}
      <Text style={[styles.resultFilterText, resultFilter === value && styles.resultFilterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }: { item: any }) => {
    // For face search results, item structure is different
    const isFaceSearchResult = item.relationshipId !== undefined;
    const relationship = item.id ? getUserRelationship(item.id) : null;
    const isNonRegistered = !item.isRegisteredUser || !item.id;
    
    // Get relationship info from face search result if available
    const faceSearchRelationship = isFaceSearchResult ? {
      type: item.relationshipType,
      status: item.relationshipStatus,
      privacy: item.relationshipPrivacy,
      partnerName: item.partnerName,
      partnerPhone: item.partnerPhone,
    } : null;
    const relationshipType = faceSearchRelationship?.type || item.relationshipType || relationship?.type;
    const relationshipStatus = faceSearchRelationship?.status || item.relationshipStatus || relationship?.status;
    const relationshipPrivacy = faceSearchRelationship?.privacy || item.relationshipPrivacy || relationship?.privacyLevel;
    const partnerName = faceSearchRelationship?.partnerName || item.partnerName || relationship?.partnerName;

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => {
          if (item.id) {
            router.push(`/profile/${item.id}` as any);
          } else {
            // Non-registered user - can't view profile, but show info
            // Could show a modal or just do nothing
          }
        }}
        disabled={!item.id}
      >
        <View style={styles.userLeft}>
          <View style={styles.userAvatarContainer}>
            {(item.profilePicture || (isFaceSearchResult && item.facePhotoUrl)) ? (
              <Image 
                source={{ uri: item.profilePicture || (isFaceSearchResult ? item.facePhotoUrl : '') }} 
                style={styles.userAvatar} 
              />
            ) : (
              <View style={styles.userAvatarPlaceholder}>
                <Text style={styles.userAvatarText}>{item.fullName?.charAt(0) || '?'}</Text>
              </View>
            )}
            {item.id && userStatuses[item.id] && (
              <StatusIndicator 
                status={userStatuses[item.id].statusType} 
                size="small" 
                showBorder={true}
              />
            )}
          </View>

          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{item.fullName}</Text>
              {item.username && (
                <Text style={styles.username}>@{item.username}</Text>
              )}
              {isNonRegistered && (
                <View style={styles.nonRegisteredBadge}>
                  <Text style={styles.nonRegisteredText}>Not Registered</Text>
                </View>
              )}
              {item.verifications?.phone && (
                <CheckCircle2 size={16} color={colors.secondary} />
              )}
            </View>

            {item.phoneNumber && (
              <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
            )}

            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  relationshipStatus === 'verified' || relationshipStatus === 'confirmed'
                    ? styles.verifiedStatusBadge
                    : relationshipStatus === 'pending'
                      ? styles.pendingStatusBadge
                      : styles.neutralStatusBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    relationshipStatus === 'verified' || relationshipStatus === 'confirmed'
                      ? styles.verifiedStatusText
                      : relationshipStatus === 'pending'
                        ? styles.pendingStatusText
                        : styles.neutralStatusText,
                  ]}
                >
                  {getStatusLabel(relationshipStatus)}
                </Text>
              </View>
              {relationshipType && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{getRelationshipTypeLabel(relationshipType)}</Text>
                </View>
              )}
              {relationshipPrivacy && (
                <View style={styles.privacyBadge}>
                  <Text style={styles.privacyBadgeText}>{getPrivacyLabel(relationshipPrivacy)}</Text>
                </View>
              )}
            </View>

            {/* Show relationship info for face search results */}
            {isFaceSearchResult && faceSearchRelationship && (
              <>
                <Text style={styles.relationshipInfo}>
                  {faceSearchRelationship.status === 'verified' ? 'Verified: ' : 'Pending: '}
                  In a {getRelationshipTypeLabel(faceSearchRelationship.type).toLowerCase()} with{' '}
                  {item.userName || 'Unknown'}
                </Text>
                {faceSearchRelationship.status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>
                      Verified Relationship
                    </Text>
                  </View>
                )}
                {item.similarityScore && (
                  <Text style={styles.similarityScore}>
                    Match: {Math.round(item.similarityScore * 100)}%
                  </Text>
                )}
              </>
            )}

            {/* Show relationship info for non-registered partners */}
            {isNonRegistered && item.relationshipType && !isFaceSearchResult && (
              <View style={styles.relationshipInfoContainer}>
                <Text style={styles.relationshipInfo}>
                  {item.relationshipStatus === 'verified' ? 'Verified: ' : 'Pending: '}
                  {partnerName 
                    ? `In a ${getRelationshipTypeLabel(item.relationshipType).toLowerCase()} with ${partnerName}`
                    : `Listed as partner in a ${getRelationshipTypeLabel(item.relationshipType).toLowerCase()}`
                  }
                  {item.relationshipStatus === 'verified' ? ' (Verified)' : ''}
                </Text>
              </View>
            )}

            {/* Show relationship info for registered users */}
            {relationship && !isNonRegistered && !isFaceSearchResult ? (
              <>
                <Text style={styles.relationshipInfo}>
                  {relationship.status === 'verified' ? 'Verified: ' : 'Pending: '}
                  In a {getRelationshipTypeLabel(relationship.type).toLowerCase()} with{' '}
                  {partnerName}
                </Text>
                {relationship.status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>
                      Verified Relationship
                    </Text>
                  </View>
                )}
              </>
            ) : !isNonRegistered && !isFaceSearchResult && (
              <Text style={styles.noRelationship}>No registered relationship</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.secondary }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <Text style={styles.subtitle}>
          Find verified relationship statuses
        </Text>
      </View>

      {disclaimerDoc && (
        <TouchableOpacity
          style={styles.disclaimerBanner}
          onPress={() => router.push(`/legal/${disclaimerDoc.slug}` as any)}
          activeOpacity={0.7}
        >
          <AlertCircle size={18} color={colors.primary} />
          <Text style={styles.disclaimerText}>
            Search results are based on user-submitted information and confirmations.
          </Text>
          <ChevronRight size={18} color={colors.primary} />
        </TouchableOpacity>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchHero}>
          <View style={styles.searchHeroIcon}>
            <ShieldCheck size={24} color={colors.primary} />
          </View>
          <View style={styles.searchHeroCopy}>
            <Text style={styles.searchHeroTitle}>Relationship registry</Text>
            <Text style={styles.searchHeroText}>
              Search by name, phone, or face photo. Results show submitted and confirmed relationship records.
            </Text>
          </View>
        </View>

        {/* Search Mode Toggle */}
        <View style={styles.searchModeContainer}>
          <TouchableOpacity
            style={[styles.searchModeButton, searchMode === 'text' && styles.searchModeButtonActive]}
            onPress={() => {
              setSearchMode('text');
              setSearchPhoto(null);
              setResults([]);
              setResultFilter('all');
            }}
          >
            <SearchIcon size={18} color={searchMode === 'text' ? colors.text.white : colors.text.secondary} />
            <Text style={[styles.searchModeText, searchMode === 'text' && styles.searchModeTextActive]}>
              Text Search
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchModeButton, searchMode === 'face' && styles.searchModeButtonActive]}
            onPress={() => {
              setSearchMode('face');
              setQuery('');
              setResults([]);
              setResultFilter('all');
            }}
          >
            <Camera size={18} color={searchMode === 'face' ? colors.text.white : colors.text.secondary} />
            <Text style={[styles.searchModeText, searchMode === 'face' && styles.searchModeTextActive]}>
              Face Search
            </Text>
          </TouchableOpacity>
        </View>

        {searchMode === 'text' ? (
          <View style={styles.searchInputContainer}>
            <SearchIcon size={20} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone number"
              placeholderTextColor={colors.text.tertiary}
              value={query}
              onChangeText={handleSearch}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <X size={20} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.faceSearchContainer}>
            {searchPhoto ? (
              <View style={styles.faceSearchPreview}>
                <Image source={{ uri: searchPhoto }} style={styles.faceSearchImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={clearSearch}
                >
                  <X size={20} color={colors.text.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchPhotoButton}
                  onPress={handleFaceSearch}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color={colors.text.white} />
                  ) : (
                    <>
                      <SearchIcon size={18} color={colors.text.white} />
                      <Text style={styles.searchPhotoButtonText}>Search Again</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.faceSearchButton}
                onPress={handleFaceSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Camera size={24} color={colors.primary} />
                    <Text style={styles.faceSearchButtonText}>Upload Photo to Search</Text>
                    <Text style={styles.faceSearchHint}>Find people by their face photo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsToolbar}>
          <Text style={styles.resultsCount}>
            {filteredResults.length} of {results.length} result{results.length === 1 ? '' : 's'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultFilters}>
            {renderFilterChip('all', 'All', <Users size={14} color={resultFilter === 'all' ? colors.text.white : colors.text.secondary} />)}
            {renderFilterChip('verified', 'Verified', <ShieldCheck size={14} color={resultFilter === 'verified' ? colors.text.white : colors.text.secondary} />)}
            {renderFilterChip('pending', 'Pending', <Clock size={14} color={resultFilter === 'pending' ? colors.text.white : colors.text.secondary} />)}
            {renderFilterChip('single', 'No record')}
            {renderFilterChip('registered', 'Registered')}
          </ScrollView>
        </View>
      )}

      {isSearching ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (searchMode === 'text' && query.length === 0) || (searchMode === 'face' && !searchPhoto) ? (
        <View style={styles.centerContainer}>
          {searchMode === 'text' ? (
            <>
              <SearchIcon size={64} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Search for People</Text>
              <Text style={styles.emptyText}>
                Enter a name or phone number to search for verified relationships
              </Text>
            </>
          ) : (
            <>
              <Camera size={64} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>Search by Face</Text>
              <Text style={styles.emptyText}>
                Upload a photo to find people using AI face recognition
              </Text>
            </>
          )}
        </View>
      ) : results.length === 0 ? (
        <View style={styles.centerContainer}>
          {searchMode === 'text' ? (
            <>
              <SearchIcon size={64} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptyText}>
                Try searching with a different name or phone number
              </Text>
            </>
          ) : (
            <>
              <ImageIcon size={64} color={colors.text.tertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No Face Matches Found</Text>
              <Text style={styles.emptyText}>
                No matching faces found. Try a different photo or ensure the face is clearly visible.
              </Text>
            </>
          )}
        </View>
      ) : filteredResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <SearchIcon size={64} color={colors.text.tertiary} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No Results in This Filter</Text>
          <Text style={styles.emptyText}>
            Try another result type or clear the search and look again.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          renderItem={renderUserItem}
          keyExtractor={(item, index) => item.id || item.relationshipId || `result-${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '25',
    marginBottom: 14,
  },
  searchHeroIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  searchHeroCopy: {
    flex: 1,
  },
  searchHeroTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.text.primary,
    marginBottom: 3,
  },
  searchHeroText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  clearButton: {
    padding: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  resultsToolbar: {
    paddingHorizontal: 20,
    marginTop: -8,
    marginBottom: 12,
    gap: 10,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  resultFilters: {
    gap: 8,
    paddingRight: 20,
  },
  resultFilterChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  resultFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  resultFilterText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  resultFilterTextActive: {
    color: colors.text.white,
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  userAvatarContainer: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  userAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  username: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  phoneNumber: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifiedStatusBadge: {
    backgroundColor: colors.secondary + '20',
  },
  pendingStatusBadge: {
    backgroundColor: colors.accent + '20',
  },
  neutralStatusBadge: {
    backgroundColor: colors.background.secondary,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
  },
  verifiedStatusText: {
    color: colors.secondary,
  },
  pendingStatusText: {
    color: colors.accent,
  },
  neutralStatusText: {
    color: colors.text.secondary,
  },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colors.primary,
  },
  privacyBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  privacyBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.text.secondary,
  },
  relationshipInfoContainer: {
    marginTop: 4,
  },
  nonRegisteredBadge: {
    backgroundColor: colors.accent + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  nonRegisteredText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: colors.accent,
  },
  relationshipInfo: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  noRelationship: {
    fontSize: 14,
    color: colors.text.tertiary,
    fontStyle: 'italic' as const,
  },
  verifiedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.badge.verified,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.badge.verifiedText,
  },
  searchModeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  searchModeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.text.secondary,
  },
  searchModeTextActive: {
    color: colors.text.white,
  },
  faceSearchContainer: {
    marginBottom: 0,
  },
  faceSearchButton: {
    backgroundColor: colors.background.primary,
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.light,
    borderStyle: 'dashed',
  },
  faceSearchButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
    marginTop: 12,
  },
  faceSearchHint: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  faceSearchPreview: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  faceSearchImage: {
    width: '100%',
    aspectRatio: 1,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPhotoButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  searchPhotoButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.text.white,
  },
  similarityScore: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  disclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    lineHeight: 18,
  },
});
