/**
 * Facebook-Style Stories Bar
 * 
 * Shows "What's on your mind?" input above the stories, just like Facebook
 */

import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import StatusStoriesBar from './StatusStoriesBar';

interface FacebookStyleStoriesBarProps {
  context: 'feed' | 'messenger';
}

export default function FacebookStyleStoriesBar({ context }: FacebookStyleStoriesBarProps) {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background.primary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    createPostContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 10,
    },
    inputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 40,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.text.primary,
      paddingVertical: 0,
    },
    placeholderText: {
      color: colors.text.tertiary,
    },
  });

  // Only show "What's on your mind?" in feed, not in messenger
  if (context === 'messenger') {
    return <StatusStoriesBar context={context} />;
  }

  return (
    <View style={styles.container}>
      {/* "What's on your mind?" Input */}
      <TouchableOpacity
        style={styles.createPostContainer}
        onPress={() => router.push('/post/create' as any)}
        activeOpacity={0.7}
      >
        {currentUser?.profilePicture ? (
          <Image
            source={{ uri: currentUser.profilePicture }}
            style={styles.profileImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.profileImage, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: colors.text.white, fontWeight: '600', fontSize: 16 }}>
              {currentUser?.fullName?.charAt(0)?.toUpperCase() || '+'}
            </Text>
          </View>
        )}
        
        <View style={styles.inputContainer}>
          <Text style={[styles.input, styles.placeholderText]}>
            What's on your mind?
          </Text>
        </View>
      </TouchableOpacity>

      {/* Stories Bar */}
      <StatusStoriesBar context={context} />
    </View>
  );
}

