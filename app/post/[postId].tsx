import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

export default function PostDeepLinkScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams();
  const postId = String(params.postId || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!postId) {
        setError('Missing post id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from('posts')
          .select('id, content, media_urls, media_type, created_at, user_id, users!posts_user_id_fkey(full_name, profile_picture)')
          .eq('id', postId)
          .maybeSingle();

        if (err) throw err;
        if (!data) throw new Error('Post not found');
        if (!cancelled) setPost(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Post', headerShown: true }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading post…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.title}>Couldn’t open post</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={styles.buttonText}>Go to Feed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{post?.users?.full_name || 'User'}’s post</Text>
          {!!post?.content && <Text style={styles.body}>{String(post.content)}</Text>}

          {Array.isArray(post?.media_urls) && post.media_urls.length > 0 && (
            <View style={styles.mediaGrid}>
              {post.media_urls.slice(0, 6).map((url: string, idx: number) => (
                <Image 
                  key={`${url}-${idx}`} 
                  source={{ uri: url }} 
                  style={styles.media} 
                  contentFit="cover"
                  onError={(error) => {
                    console.error('Error loading post media:', error);
                  }}
                />
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={styles.buttonText}>Open Feed</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.secondary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
    content: { padding: 16, gap: 12 },
    title: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary },
    body: { fontSize: 15, color: colors.text.primary, lineHeight: 20 },
    muted: { fontSize: 13, color: colors.text.secondary, textAlign: 'center' },
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    media: { width: '48%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.background.primary },
    button: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: { color: colors.text.white, fontWeight: '700' as const },
  });


