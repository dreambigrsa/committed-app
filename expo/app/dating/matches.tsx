import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import { useRouter , Stack } from 'expo-router';
import { MessageSquare, Sparkles, Calendar } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import * as DatingService from '@/lib/dating-service';
import { Image as ExpoImage } from 'expo-image';

export default function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser, createOrGetConversation } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState<string | null>(null);

  const loadMatches = async () => {
    try {
      setIsLoading(true);
      const data = await DatingService.getDatingMatches();
      setMatches(data || []);
    } catch (error: any) {
      console.error('Error loading matches:', error);
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadMatches();
    }, [])
  );

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future unmatch UI
  const _handleUnmatch = async (matchId: string) => {
    try {
      await DatingService.unmatchUser(matchId);
      await loadMatches();
    } catch (error: any) {
      console.error('Error unmatching:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Matches', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Matches', headerShown: true }} />
        <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
          <View style={styles.emptyIconContainer}>
            <Sparkles size={80} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Matches Yet</Text>
          <Text style={styles.emptyText}>
            Start swiping to find your perfect match!{'\n'}
            When you both like each other, you'll see them here.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Start Swiping</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const renderMatch = ({ item, index: _index }: { item: any; index: number }) => {
    const matchedUser = item.matchedUser;
    const photo = item.primaryPhoto || matchedUser?.profile_picture;

    return (
      <Animated.View
        style={[
          styles.matchCard,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.matchContent}
          onPress={async () => {
            if (!currentUser || !matchedUser?.id || openingChat === item.id) return;
            
            try {
              setOpeningChat(item.id);
              // Create or get conversation with the matched user
              const conversation = await createOrGetConversation(matchedUser.id);
              if (conversation) {
                // Small delay to ensure conversation is loaded in context
                await new Promise(resolve => setTimeout(resolve, 100));
                router.push(`/messages/${conversation.id}` as any);
              } else {
                Alert.alert('Error', 'Could not create conversation');
              }
            } catch (error: any) {
              console.error('Error opening chat:', error);
              Alert.alert('Error', error.message || 'Failed to open chat');
            } finally {
              setOpeningChat(null);
            }
          }}
          activeOpacity={0.9}
          disabled={openingChat === item.id}
        >
          <View style={styles.matchPhotoContainer}>
            <ExpoImage
              source={{ uri: photo }}
              style={styles.matchPhoto}
              contentFit="cover"
            />
            <View style={styles.matchBadge}>
              <Sparkles size={16} color={colors.primary} fill={colors.primary} />
            </View>
          </View>
          
          <View style={styles.matchInfo}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchName}>{matchedUser?.full_name}</Text>
              <View style={styles.matchSparkle}>
                <Sparkles size={20} color={colors.primary} fill={colors.primary} />
              </View>
            </View>
            <Text style={styles.matchDate}>
              Matched {formatTimeAgo(item.matched_at)}
            </Text>
            {matchedUser?.phone_verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </View>

          <View style={styles.matchActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push({
                  pathname: '/dating/create-date-request',
                  params: { matchId: item.id },
                } as any);
              }}
            >
              <Calendar size={20} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                router.push('/dating/date-requests' as any);
              }}
            >
              <Calendar size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={async (e) => {
                e.stopPropagation();
                if (!currentUser || !matchedUser?.id || openingChat === item.id) return;
                
                try {
                  setOpeningChat(item.id);
                  // Create or get conversation with the matched user
                  const conversation = await createOrGetConversation(matchedUser.id);
                  if (conversation) {
                    // Small delay to ensure conversation is loaded in context
                    await new Promise(resolve => setTimeout(resolve, 100));
                    router.push(`/messages/${conversation.id}` as any);
                  } else {
                    Alert.alert('Error', 'Could not create conversation');
                  }
                } catch (error: any) {
                  console.error('Error opening chat:', error);
                  Alert.alert('Error', error.message || 'Failed to open chat');
                } finally {
                  setOpeningChat(null);
                }
              }}
              disabled={openingChat === item.id}
            >
              {openingChat === item.id ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MessageSquare size={20} color={colors.primary} fill={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Matches',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background.primary,
          },
          headerTintColor: colors.text.primary,
        }} 
      />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Your Matches</Text>
          <Text style={styles.headerSubtitle}>{matches.length} {matches.length === 1 ? 'match' : 'matches'}</Text>
        </View>
        
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    content: {
      flex: 1,
    },
    headerSection: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 4,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 16,
      color: colors.text.secondary,
      fontWeight: '500',
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
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
      gap: 20,
    },
    emptyIconContainer: {
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 40,
      paddingVertical: 16,
      borderRadius: 16,
      marginTop: 8,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    listContent: {
      padding: 20,
      paddingTop: 16,
    },
    matchCard: {
      marginBottom: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    matchContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    matchPhotoContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      overflow: 'hidden',
      marginRight: 16,
      position: 'relative',
      borderWidth: 3,
      borderColor: colors.primary + '30',
    },
    matchPhoto: {
      width: '100%',
      height: '100%',
    },
    matchBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: colors.background.primary,
      borderRadius: 12,
      padding: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    matchInfo: {
      flex: 1,
    },
    matchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    matchName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    matchSparkle: {
      opacity: 0.7,
    },
    matchDate: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 8,
    },
    verifiedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.badge.verified,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    verifiedText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.badge.verifiedText,
    },
    matchActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border.light,
    },
  });
