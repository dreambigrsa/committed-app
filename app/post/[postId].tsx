import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Heart, MessageCircle, Share2, X, Send } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import LoginPromptModal from '@/components/LoginPromptModal';
import type { Comment } from '@/types';

const DESKTOP_BREAKPOINT = 600;

const FETCH_TIMEOUT_MS = 18000;
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

export default function PostDeepLinkScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const { currentUser, sharePost, addComment } = useApp();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ postId?: string }>();
  const postId = (params?.postId != null ? String(params.postId) : '').trim();
  const windowWidth = Dimensions.get('window').width;
  const isDesktop = windowWidth >= DESKTOP_BREAKPOINT;

  const scrollViewRef = useRef<ScrollView>(null);
  const commentsSectionRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  const [commentsSectionY, setCommentsSectionY] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!postId) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    let cancelled = false;
    if (__DEV__) console.log('[Post] Deep link postId:', postId);

    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (__DEV__) console.log('[Post] Fetching post...');
        const postQuery = supabase
          .from('posts')
          .select('id, content, media_urls, media_type, created_at, user_id')
          .eq('id', postId)
          .maybeSingle();

        const { data: postData, error: err } = await fetchWithTimeout(postQuery, FETCH_TIMEOUT_MS);

        if (__DEV__) console.log('[Post] Fetch result:', postData ? 'ok' : 'null', 'error:', err?.message ?? null);

        if (err) throw err;
        if (!postData) throw new Error('Post not found');
        if (cancelled) return;

        const userId = postData.user_id;
        let userData: { full_name?: string; profile_picture?: string } | null = null;
        if (userId) {
          try {
            const userQuery = supabase.from('users').select('full_name, profile_picture').eq('id', userId).maybeSingle();
            const { data: u } = await fetchWithTimeout(userQuery, 5000);
            userData = u;
          } catch (_) {
            userData = null;
          }
        }
        if (cancelled) return;

        setPost({ ...postData, users: userData });
        setError(null);
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to load post';
        if (__DEV__) console.log('[Post] Fetch error:', msg);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId, retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const isValidId = postId.length > 0;

  const hasAutoRetriedRef = React.useRef(false);
  useEffect(() => {
    if (!error || !postId || hasAutoRetriedRef.current) return;
    const t = setTimeout(() => {
      hasAutoRetriedRef.current = true;
      setRetryCount((c) => c + 1);
    }, AUTO_RETRY_DELAY_MS);
    return () => clearTimeout(t);
  }, [error, postId]);

  useEffect(() => {
    if (!post?.id || !postId) return;
    let cancelled = false;
    (async () => {
      try {
        const [likesRes, commentsRes] = await Promise.all([
          supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', postId),
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', postId),
        ]);
        if (cancelled) return;
        setLikeCount(likesRes.count ?? 0);
        setCommentCount(commentsRes.count ?? 0);
        if (currentUser?.id) {
          const { data: userLike } = await supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', currentUser.id).maybeSingle();
          setIsLiked(!!userLike);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [post?.id, postId, currentUser?.id]);

  useEffect(() => {
    if (!postId || !post?.id) return;
    let cancelled = false;
    setCommentsLoading(true);
    (async () => {
      try {
        const { data: commentsData } = await supabase
          .from('comments')
          .select(`
            *,
            users!comments_user_id_fkey(full_name, profile_picture),
            stickers!comments_sticker_id_fkey(image_url, is_animated)
          `)
          .eq('post_id', postId)
          .order('created_at', { ascending: true });
        if (cancelled) return;
        const { data: commentLikesData } = await supabase.from('comment_likes').select('comment_id, user_id');
        const likesByComment: Record<string, string[]> = {};
        (commentLikesData || []).forEach((l: any) => {
          if (!likesByComment[l.comment_id]) likesByComment[l.comment_id] = [];
          likesByComment[l.comment_id].push(l.user_id);
        });
        const all: Comment[] = (commentsData || []).map((c: any) => ({
          id: c.id,
          postId: c.post_id,
          userId: c.user_id,
          userName: c.users?.full_name ?? 'User',
          userAvatar: c.users?.profile_picture,
          content: c.content || '',
          stickerId: c.sticker_id,
          stickerImageUrl: c.stickers?.image_url,
          messageType: (c.message_type || 'text') as 'text' | 'sticker',
          likes: likesByComment[c.id] || [],
          createdAt: c.created_at,
          parentCommentId: c.parent_comment_id,
          replies: [],
        }));
        const byParent: Record<string, Comment[]> = {};
        const topLevel: Comment[] = [];
        all.forEach((c) => {
          if (!c.parentCommentId) {
            topLevel.push(c);
          } else {
            if (!byParent[c.parentCommentId]) byParent[c.parentCommentId] = [];
            byParent[c.parentCommentId].push(c);
          }
        });
        topLevel.forEach((c) => {
          c.replies = byParent[c.id] || [];
        });
        if (!cancelled) setComments(topLevel);
      } catch (_) {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, post?.id]);

  const scrollToComments = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: Math.max(0, commentsSectionY - 24), animated: true });
  }, [commentsSectionY]);

  const focusCommentInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  const handleLike = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    if (!postId || liking) return;
    setLiking(true);
    (async () => {
      try {
        if (isLiked) {
          await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
          setLikeCount((c) => Math.max(0, c - 1));
          setIsLiked(false);
        } else {
          await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });
          setLikeCount((c) => c + 1);
          setIsLiked(true);
        }
      } finally {
        setLiking(false);
      }
    })();
  }, [isAuthenticated, currentUser, postId, isLiked, liking]);

  const handleComment = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    scrollToComments();
    focusCommentInput();
  }, [isAuthenticated, currentUser, scrollToComments, focusCommentInput]);

  const handleShare = useCallback(() => {
    if (!isAuthenticated || !currentUser) {
      setShowLoginPrompt(true);
      return;
    }
    sharePost(postId);
  }, [isAuthenticated, currentUser, postId, sharePost]);

  const handleSubmitComment = useCallback(async () => {
    const text = commentText.trim();
    if (!text || !currentUser || !addComment || submittingComment) return;
    setSubmittingComment(true);
    try {
      await addComment(postId, text);
      setCommentText('');
      setCommentCount((c) => c + 1);
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`
          *,
          users!comments_user_id_fkey(full_name, profile_picture),
          stickers!comments_sticker_id_fkey(image_url, is_animated)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      const { data: commentLikesData } = await supabase.from('comment_likes').select('comment_id, user_id');
      const likesByComment: Record<string, string[]> = {};
      (commentLikesData || []).forEach((l: any) => {
        if (!likesByComment[l.comment_id]) likesByComment[l.comment_id] = [];
        likesByComment[l.comment_id].push(l.user_id);
      });
      const all: Comment[] = (commentsData || []).map((c: any) => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        userName: c.users?.full_name ?? 'User',
        userAvatar: c.users?.profile_picture,
        content: c.content || '',
        stickerId: c.sticker_id,
        stickerImageUrl: c.stickers?.image_url,
        messageType: (c.message_type || 'text') as 'text' | 'sticker',
        likes: likesByComment[c.id] || [],
        createdAt: c.created_at,
        parentCommentId: c.parent_comment_id,
        replies: [],
      }));
      const byParent: Record<string, Comment[]> = {};
      const topLevel: Comment[] = [];
      all.forEach((c) => {
        if (!c.parentCommentId) topLevel.push(c);
        else {
          if (!byParent[c.parentCommentId]) byParent[c.parentCommentId] = [];
          byParent[c.parentCommentId].push(c);
        }
      });
      topLevel.forEach((c) => { c.replies = byParent[c.id] || []; });
      setComments(topLevel);
    } catch (_) {}
    finally {
      setSubmittingComment(false);
    }
  }, [commentText, currentUser, addComment, postId, submittingComment]);

  const formatTimeAgo = useCallback((dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(m / 60);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m`;
    if (h < 24) return `${h}h`;
    return new Date(dateString).toLocaleDateString();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Post',
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
          <Text style={styles.muted}>This post link is invalid or incomplete.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/' as any)}>
            <Text style={styles.buttonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading post…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.title}>Couldn’t open post</Text>
          <Text style={styles.muted}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={handleRetry}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => router.replace('/(tabs)/feed' as any)}>
            <Text style={[styles.buttonText, styles.buttonSecondaryText]}>Go to Feed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.modalContent, isDesktop && styles.modalContentRow]}>
            {isDesktop && (
              <View style={styles.mediaPanel}>
                {Array.isArray(post?.media_urls) && post.media_urls.length > 0 ? (
                  post.media_urls.length === 1 ? (
                    <Image source={{ uri: post.media_urls[0] }} style={styles.mediaPanelImage} contentFit="contain" />
                  ) : (
                    <View style={styles.mediaGrid}>
                      {post.media_urls.slice(0, 6).map((url: string, idx: number) => (
                        <Image key={`${url}-${idx}`} source={{ uri: url }} style={styles.media} contentFit="cover" />
                      ))}
                    </View>
                  )
                ) : (
                  <View style={styles.mediaPanelPlaceholder} />
                )}
              </View>
            )}
            <View style={styles.detailsPanel}>
              <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {!isDesktop && (
                  <View style={styles.card}>
                    {Array.isArray(post?.media_urls) && post.media_urls.length > 0 && (
                      <View style={styles.mediaGrid}>
                        {post.media_urls.slice(0, 6).map((url: string, idx: number) => (
                          <Image key={`${url}-${idx}`} source={{ uri: url }} style={styles.media} contentFit="cover" />
                        ))}
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.card}>
                  <View style={styles.authorRow}>
                    <Image source={{ uri: post?.users?.profile_picture || undefined }} style={styles.avatar} />
                    <Text style={styles.authorName}>{post?.users?.full_name || 'User'}</Text>
                  </View>
                  {!!post?.content && <Text style={styles.body}>{String(post.content)}</Text>}
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
                <View
                  ref={commentsSectionRef}
                  onLayout={(e) => setCommentsSectionY(e.nativeEvent.layout.y)}
                  collapsable={false}
                  style={styles.commentsSection}
                >
                  <Text style={styles.commentsSectionTitle}>Comments</Text>
                  {commentsLoading ? (
                    <ActivityIndicator style={styles.commentsLoader} />
                  ) : comments.length === 0 ? (
                    <Text style={styles.muted}>No comments yet.</Text>
                  ) : (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentRow}>
                        {comment.userAvatar ? (
                          <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatar} />
                        ) : (
                          <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
                            <Text style={styles.commentAvatarLetter}>{comment.userName?.charAt(0) || '?'}</Text>
                          </View>
                        )}
                        <View style={styles.commentBubble}>
                          <Text style={styles.commentUserName}>{comment.userName}</Text>
                          {comment.messageType === 'sticker' && comment.stickerImageUrl ? (
                            <Image source={{ uri: comment.stickerImageUrl }} style={styles.commentSticker} />
                          ) : (
                            <Text style={styles.commentText}>{comment.content}</Text>
                          )}
                          <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>
                <View style={styles.spacer} />
              </ScrollView>
              {isAuthenticated && currentUser && (
                <View style={styles.composer}>
                  <TextInput
                    ref={inputRef}
                    style={styles.composerInput}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.text.tertiary}
                    value={commentText}
                    onChangeText={setCommentText}
                    multiline
                    maxLength={2000}
                    editable={!submittingComment}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, (!commentText.trim() || submittingComment) && styles.sendBtnDisabled]}
                    onPress={handleSubmitComment}
                    disabled={!commentText.trim() || submittingComment}
                  >
                    <Send size={20} color={colors.text.white} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.buttonSecondary} onPress={() => router.replace('/(tabs)/feed' as any)}>
              <Text style={styles.buttonSecondaryText}>Open Feed</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    flex1: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.background.secondary },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
    content: { padding: 16, paddingBottom: 32 },
    modalContent: { flex: 1, minHeight: 0 },
    modalContentRow: { flexDirection: 'row' as const },
    mediaPanel: {
      width: '50%',
      minHeight: 320,
      backgroundColor: colors.background.primary,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    mediaPanelImage: { width: '100%', maxHeight: 400, aspectRatio: 1, borderRadius: 12 },
    mediaPanelPlaceholder: { width: '100%', height: 200, backgroundColor: colors.background.secondary, borderRadius: 12 },
    detailsPanel: { flex: 1, minWidth: 0, minHeight: 0 },
    scrollContent: { padding: 16, paddingBottom: 24 },
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
    title: { fontSize: 18, fontWeight: '700' as const, color: colors.text.primary },
    body: { fontSize: 15, color: colors.text.primary, lineHeight: 22, marginBottom: 12 },
    muted: { fontSize: 13, color: colors.text.secondary, textAlign: 'center' },
    mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    media: { width: '48%', aspectRatio: 1, borderRadius: 12, backgroundColor: colors.background.secondary },
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
    commentsSection: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.background.secondary },
    commentsSectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 12 },
    commentsLoader: { marginVertical: 16 },
    commentRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
    commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
    commentAvatarPlaceholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    commentAvatarLetter: { color: colors.text.white, fontSize: 14, fontWeight: '600' },
    commentBubble: { flex: 1, minWidth: 0 },
    commentUserName: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: 2 },
    commentText: { fontSize: 14, color: colors.text.primary, lineHeight: 20 },
    commentSticker: { width: 80, height: 80, marginVertical: 4 },
    commentTime: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
    spacer: { height: 80 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.background.secondary,
      backgroundColor: colors.background.primary,
      gap: 8,
    },
    composerInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      backgroundColor: colors.background.secondary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text.primary,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.5 },
    footer: { padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.background.secondary },
    button: {
      marginTop: 12,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonSecondary: {
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.text.tertiary,
    },
    buttonSecondaryText: { color: colors.text.primary, fontWeight: '600' },
    buttonText: { color: colors.text.white, fontWeight: '700' as const },
  });


