import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

export default function ReelDeepLinkScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams();
  const reelId = String(params.reelId || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reel, setReel] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!reelId) {
        setError('Missing reel id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from('reels')
          .select('id, caption, video_url, thumbnail_url, created_at, user_id, users!reels_user_id_fkey(full_name, profile_picture)')
          .eq('id', reelId)
          .maybeSingle();

        if (err) throw err;
        if (!data) throw new Error('Reel not found');
        if (!cancelled) setReel(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load reel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reelId]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Reel', headerShown: true }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading reel…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.title}>Couldn’t open reel</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/reels' as any)}>
            <Text style={styles.buttonText}>Go to Reels</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>{reel?.users?.full_name || 'User'}’s reel</Text>
          {!!reel?.caption && <Text style={styles.body}>{String(reel.caption)}</Text>}

          {!!reel?.video_url && (
            <View style={styles.videoWrap}>
              <Video
                source={{ uri: String(reel.video_url) }}
                style={styles.video}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/reels' as any)}>
            <Text style={styles.buttonText}>Open Reels</Text>
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
    videoWrap: { width: '100%', aspectRatio: 9 / 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
    video: { width: '100%', height: '100%' },
    button: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: { color: colors.text.white, fontWeight: '700' as const },
  });


