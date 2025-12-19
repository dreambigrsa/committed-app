import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Search as SearchIcon, CheckCircle2, X, Camera, Image as ImageIcon, AlertCircle, ChevronRight } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { LegalDocument } from '@/types';
import StatusIndicator from '@/components/StatusIndicator';

export default function SearchScreen() {
  const router = useRouter();
  const { searchUsers, getUserRelationship, searchByFace, getUserStatus, userStatuses } = useApp();
  const { colors } = useTheme();
  const [query, setQuery] = useState<string>('');

  const styles = useMemo(() => createStyles(colors), [colors]);
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchMode, setSearchMode] = useState<'text' | 'face'>('text');
  const [searchPhoto, setSearchPhoto] = useState<string | null>(null);
  const [disclaimerDoc, setDisclaimerDoc] = useState<LegalDocument | null>(null);

  useEffect(() => {
    loadDisclaimerDocument();
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
    setIsSearching(true);

    if (!text.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setTimeout(async () => {
      const searchResults = await searchUsers(text);
      setResults(searchResults);
      setIsSearching(false);
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
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSearchPhoto(result.assets[0].uri);
        setIsSearching(true);
        
        try {
          const faceResults = await searchByFace(result.assets[0].uri);
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
    setQuery('');
    setResults([]);
    setSearchPhoto(null);
    setSearchMode('text');
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

  const renderUserItem = ({ item }: { item: any }) => {
    // For face search results, item structure is different
    const isFaceSearchResult = item.relationshipId !== undefined;
    const relationship = item.id ? getUserRelationship(item.id) : null;
    const isNonRegistered = !item.isRegisteredUser || !item.id;
    
    // Get relationship info from face search result if available
    const faceSearchRelationship = isFaceSearchResult ? {
      type: item.relationshipType,
      status: item.relationshipStatus,
      partnerName: item.partnerName,
      partnerPhone: item.partnerPhone,
    } : null;

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

            {/* Show relationship info for face search results */}
            {isFaceSearchResult && faceSearchRelationship && (
              <>
                <Text style={styles.relationshipInfo}>
                  {faceSearchRelationship.status === 'verified' ? '❤️ ' : '⏳ '}
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
                  {item.relationshipStatus === 'verified' ? '❤️ ' : '⏳ '}
                  {item.partnerName 
                    ? `In a ${getRelationshipTypeLabel(item.relationshipType).toLowerCase()} with ${item.partnerName}`
                    : `Listed as partner in a ${getRelationshipTypeLabel(item.relationshipType).toLowerCase()}`
                  }
                  {item.relationshipStatus === 'verified' && ' (Verified)'}
                </Text>
              </View>
            )}

            {/* Show relationship info for registered users */}
            {relationship && !isNonRegistered && !isFaceSearchResult ? (
              <>
                <Text style={styles.relationshipInfo}>
                  {relationship.status === 'verified' ? '❤️ ' : '⏳ '}
                  In a {getRelationshipTypeLabel(relationship.type).toLowerCase()} with{' '}
                  {relationship.partnerName}
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
        {/* Search Mode Toggle */}
        <View style={styles.searchModeContainer}>
          <TouchableOpacity
            style={[styles.searchModeButton, searchMode === 'text' && styles.searchModeButtonActive]}
            onPress={() => {
              setSearchMode('text');
              setSearchPhoto(null);
              setResults([]);
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
      ) : (
        <FlatList
          data={results}
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
