import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MessageSquare, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import { Image as ExpoImage } from 'expo-image';

export default function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: matches, isLoading, refetch } = trpc.dating.getMatches.useQuery();
  const unmatchMutation = trpc.dating.unmatch.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Matches Yet</Text>
          <Text style={styles.emptyText}>
            Start swiping to find your match!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderMatch = ({ item }: { item: any }) => {
    const matchedUser = item.matchedUser;
    const photo = item.primaryPhoto || matchedUser?.profile_picture;

    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => {
          // Navigate to conversation or profile
          router.push(`/messages/${item.id}`);
        }}
      >
        <View style={styles.matchPhotoContainer}>
          <ExpoImage
            source={{ uri: photo }}
            style={styles.matchPhoto}
            contentFit="cover"
          />
        </View>
        <View style={styles.matchInfo}>
          <Text style={styles.matchName}>{matchedUser?.full_name}</Text>
          <Text style={styles.matchDate}>
            Matched {new Date(item.matched_at).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => router.push(`/messages/${item.id}`)}
        >
          <MessageSquare size={20} color={colors.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
      </View>
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    listContent: {
      padding: 20,
    },
    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    matchPhotoContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      overflow: 'hidden',
      marginRight: 12,
    },
    matchPhoto: {
      width: '100%',
      height: '100%',
    },
    matchInfo: {
      flex: 1,
    },
    matchName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    matchDate: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    messageButton: {
      padding: 8,
    },
  });

