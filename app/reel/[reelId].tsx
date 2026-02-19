import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { Heart, MessageCircle, Share2, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import LoginPromptModal from '@/components/LoginPromptModal';

const FETCH_TIMEOUT_MS = 12000;
const AUTO_RETRY_DELAY_MS = 2000;

function fetchWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export default function ReelDeepLinkScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const { currentUser, shareReel } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ reelId?: string }>();
  const reelId = (params?.reelId != null ? String(params.reelId) : '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reel, setReel] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
      if (!reelId) {
      setError('Invalid link');
        setLoading(false);
        return;
      }

    let cancelled = false;
    if (__DEV__) console.log('[Reel] Deep link reelId:', reelId);

    (async () => {
        setLoading(true);
        setError(null);

      try {
        if (__DEV__) console.log('[Reel] Fetching reel...');
        const query = supabase
          .from('reels')
          .select('id, caption, video_url, thumbnail_url, created_at, user_id, users!reels_user_id_fkey(full_name, profile_picture)')
          .eq('id', reelId)
          .maybeSingle();

        const { data, error: err } = await fetchWithTimeout(query, FETCH_TIMEOUT_MS);

        if (__DEV__) console.log('[Reel] Fetch result:', data ? 'ok' : 'null', 'error:', err?.message ?? null);

        if (err) throw err;
        if (!data) throw new Error('Reel not found');
        if (!cancelled) {
          setReel(data);
          setError(null);
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to load reel';
        if (__DEV__) console.log('[Reel] Fetch error:', msg);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reelId, retryCount]);

  const handleRetry = useCallback(() => setRetryCount((c) => c + 1), []);

  const hasAutoRetriedRef = React.useRef(false);
  useEffect(() => {
    if (!error || !reelId || hasAutoRetriedRef.current) return;
    const t = setTimeout(() => {
      hasAutoRetriedRef.current = true;
      setRetryCount((c) => c + 1);
    }, AUTO_RETRY_DELAY_MS);
    return () => clearTimeout(t);
  }, [error, reelId]);

  useEffect(() => {
    if (!reel?.id || !reelId) return;
    let cancelled = false;
    (async () => {
      try {
        const [likesRes, commentsRes] = await Promise.all([
          supabase.from('reel_likes').select('id', { count: 'exact', head: true }).eq('reel_id', reelId),
          supabase.from('reel_comments').select('id', { count: 'exact', head: true }).eq('reel_id', reelId),
        ]);
        if (cancelled) return;
        setLikeCount(likesRes.count ?? 0);
        setCommentCount(commentsRes.count ?? 0);
        if (currentUser?.id) {
          const { data: userLike } = await supabase.from('reel_likes').select('id').eq('reel_id', reelId).eq('user_id', currentUser.id).maybeSingle();
          setIsLiked(!!userLike);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [reel?.id, reelId, currentUser?.id]);

  const handleLike = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    if (!reelId || liking) return;
    setLiking(true);
    (async () => {
      try {
        if (isLiked) {
          await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', currentUser.id);
          setLikeCount((c) => Math.max(0, c - 1));
          setIsLiked(false);
        } else {
          await supabase.from('reel_likes').insert({ reel_id: reelId, user_id: currentUser.id });
          setLikeCount((c) => c + 1);
          setIsLiked(true);
        }
      } finally {
        setLiking(false);
      }
    })();
  }, [isAuthenticated, currentUser, reelId, isLiked, liking]);

  const handleComment = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    router.push({ pathname: '/(tabs)/reels', params: { reelId } } as any);
  }, [isAuthenticated, currentUser, reelId, router]);

  const handleShare = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    shareReel(reelId);
  }, [isAuthenticated, currentUser, reelId, shareReel]);

  const isValidId = reelId.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Reel',
          headerShown: true,
          presentation: 'modal',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginRight: 8 }}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <LoginPromptModal visible={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />

      {!isValidId ? (
        <View style={styles.center}>
          <Text style={styles.title}>Invalid link</Text>
          <Text style={styles.muted}>This reel link is invalid or incomplete.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/' as any)}>
            <Text style={styles.buttonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading reel…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.title}>Couldn’t open reel</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.replace('/(tabs)/reels' as any)}>
            <Text style={styles.buttonSecondaryText}>Go to Reels</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.authorRow}>
              <Image source={{ uri: reel?.users?.profile_picture || undefined }} style={styles.avatar} />
              <Text style={styles.authorName}>{reel?.users?.full_name || 'User'}</Text>
            </View>
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
            {!!reel?.caption && <Text style={styles.caption}>{String(reel.caption)}</Text>}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleLike} disabled={liking}>
                <Heart size={22} color={isLiked ? colors.danger : colors.text.secondary} fill={isLiked ? colors.danger : 'transparent'} />
                <Text style={[styles.actionCount, isLiked && styles.actionCountActive]}>{likeCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleComment}>
                <MessageCircle size={22} color={colors.text.secondary} />
                <Text style={styles.actionCount}>{commentCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Share2 size={22} color={colors.text.secondary} />
                <Text style={styles.actionCount}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.replace('/(tabs)/reels' as any)}>
            <Text style={styles.buttonSecondaryText}>Open Reels</Text>
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
    content: { padding: 16, paddingBottom: 32 },
    card: {
      backgroundColor: colors.background.primary,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      overflow: 'hidden',
    },
    authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background.secondary },
    authorName: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginLeft: 12 },
    videoWrap: { width: '100%', aspectRatio: 9 / 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: 12 },
    video: { width: '100%', height: '100%' },
    caption: { fontSize: 15, color: colors.text.primary, lineHeight: 22, marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary },
    muted: { fontSize: 13, color: colors.text.secondary, textAlign: 'center' },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.background.secondary,
      paddingTop: 12,
      gap: 24,
    },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionCount: { fontSize: 14, color: colors.text.secondary },
    actionCountActive: { color: colors.danger },
    button: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonSecondary: {
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.text.tertiary,
    },
    buttonSecondaryText: { color: colors.text.primary, fontWeight: '600' },
    buttonText: { color: colors.text.white, fontWeight: '700' as const },
  });
