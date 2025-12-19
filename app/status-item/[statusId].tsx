import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';

export default function StatusDeepLinkScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams();
  const statusId = String(params.statusId || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!statusId) {
        setError('Missing status id');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
          .from('statuses')
          .select('id, user_id, caption, media_type, media_path, created_at, expires_at')
          .eq('id', statusId)
          .maybeSingle();

        if (err) throw err;
        if (!data) throw new Error('Status not found');
        if (!cancelled) setStatus(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusId]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Status', headerShown: true }} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading status…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.title}>Couldn’t open status</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(tabs)/home' as any)}>
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Status</Text>
          {!!status?.caption && <Text style={styles.body}>{String(status.caption)}</Text>}

          {!!status?.media_path && String(status.media_path).startsWith('http') && (
            <>
              {String(status.media_type) === 'video' ? (
                <View style={styles.videoWrap}>
                  <Video
                    source={{ uri: String(status.media_path) }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                  />
                </View>
              ) : (
                <Image source={{ uri: String(status.media_path) }} style={styles.image} contentFit="cover" />
              )}
            </>
          )}

          <TouchableOpacity style={styles.button} onPress={() => router.replace(`/status/${status.user_id}` as any)}>
            <Text style={styles.buttonText}>Open Status Feed</Text>
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
    image: { width: '100%', aspectRatio: 9 / 16, borderRadius: 16, backgroundColor: colors.background.primary },
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


