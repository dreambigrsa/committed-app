'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Heart, Loader2, MessageCircle, Send } from 'lucide-react';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';
import ExpoMirrorRoute from '@/components/ExpoMirrorRoute';
import { buildPostCommentsByPostId, fetchPostCommentsAndLikes } from '@committed/shared';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getDisplayName } from '@/lib/identity';

const FALLBACK_DELAY_MS = 1200;

export default function PostPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const isCreateRoute = id === 'create';
  const webMode = searchParams.get('web') === '1';
  const [showFallback, setShowFallback] = useState(webMode);
  const [loadingPost, setLoadingPost] = useState(true);
  const [post, setPost] = useState<any>(null);
  const [sessionUserId, setSessionUserId] = useState('');
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [comments, setComments] = useState<any[]>([]);

  const deepLinkUrl = `${APP_SCHEME}post/${id}`;

  useEffect(() => {
    if (isCreateRoute) return;
    if (!id || webMode) {
      setShowFallback(true);
      return;
    }
    window.location.href = deepLinkUrl;
    const t = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, [id, deepLinkUrl, isCreateRoute, webMode]);

  useEffect(() => {
    let cancelled = false;
    const loadPost = async () => {
      if (isCreateRoute) {
        setLoadingPost(false);
        return;
      }
      if (!id) {
        setLoadingPost(false);
        return;
      }
      try {
        const supabase = getSupabaseBrowser() as any;
        const [
          {
            data: { user: authUser },
          },
          {
            data: { session },
          },
        ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
        const currentUserId = authUser?.id || session?.user?.id || '';
        if (!cancelled) setSessionUserId(currentUserId);

        const { data } = await supabase
          .from('posts')
          .select('id,user_id,content,media_urls,media_type,created_at,users!posts_user_id_fkey(full_name,username,email,profile_picture)')
          .eq('id', id)
          .maybeSingle();
        if (!cancelled) setPost(data || null);
        if (!data?.id) return;

        const [likesRes, commentsBundle, myLikeRes] = await Promise.all([
          supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', data.id),
          fetchPostCommentsAndLikes(supabase, [data.id]),
          currentUserId ? supabase.from('post_likes').select('id').eq('post_id', data.id).eq('user_id', currentUserId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        setLikesCount(likesRes.count || 0);
        const byPost = buildPostCommentsByPostId(commentsBundle.commentsData, commentsBundle.commentLikesData);
        const top = byPost[data.id] || [];
        const sorted = [...top].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const forUi = sorted.slice(0, 30).map((c) => ({
          id: c.id,
          content: c.content,
          users: {
            full_name: c.userName,
            username: null as string | null,
            email: null as string | null,
            profile_picture: c.userAvatar ?? null,
          },
        }));
        setComments(forUi);
        setCommentsCount(forUi.length);
        setIsLiked(Boolean(myLikeRes.data));
      } finally {
        if (!cancelled) setLoadingPost(false);
      }
    };
    void loadPost();
    return () => {
      cancelled = true;
    };
  }, [id, isCreateRoute]);

  if (isCreateRoute) {
    return <ExpoMirrorRoute initialTab="feed" />;
  }

  const toggleLike = async () => {
    if (!post?.id || !sessionUserId || likePending) return;
    const supabase = getSupabaseBrowser() as any;
    const nextLiked = !isLiked;
    setLikePending(true);
    setIsLiked(nextLiked);
    setLikesCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    try {
      if (nextLiked) {
        const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: sessionUserId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', sessionUserId);
        if (error) throw error;
      }
    } catch {
      setIsLiked(!nextLiked);
      setLikesCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
    } finally {
      setLikePending(false);
    }
  };

  const submitComment = async () => {
    const text = commentDraft.trim();
    if (!text || !post?.id || !sessionUserId || commentPending) return;
    setCommentPending(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const { data, error } = await supabase
        .from('comments')
        .insert({ post_id: post.id, user_id: sessionUserId, content: text, message_type: 'text' })
        .select('id,post_id,user_id,content,created_at,users!comments_user_id_fkey(full_name,username,email,profile_picture)')
        .single();
      if (error || !data) throw error || new Error('Unable to add comment');
      setComments((list) => [data, ...list]);
      setCommentsCount((count) => count + 1);
      setCommentDraft('');
    } finally {
      setCommentPending(false);
    }
  };

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-slate-900">Post not found</h1>
          <p className="mt-2 text-slate-600">This link appears to be invalid.</p>
          <a href="/" className="mt-6 inline-block text-blue-600 hover:underline">Go to homepage</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-4 text-slate-950 md:px-4 md:py-6">
      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_0.9fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loadingPost ? (
            <div className="h-72 animate-pulse bg-slate-200" />
          ) : (
            <>
              <div className="flex items-center gap-3 p-4">
                {post?.users?.profile_picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.users.profile_picture} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 font-black text-white">
                    {getDisplayName(post?.users).charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-black">{getDisplayName(post?.users)}</p>
                  <p className="text-xs font-semibold text-slate-400">Shared post</p>
                </div>
              </div>
              {post?.content ? <p className="whitespace-pre-wrap px-4 pb-4 text-[15px] leading-6">{post.content}</p> : null}
              {post?.media_urls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.media_urls[0]} alt="" className="max-h-[520px] w-full object-cover" />
              ) : null}
              <div className="flex items-center gap-2 border-t border-slate-100 p-4">
                <button
                  type="button"
                  disabled={!sessionUserId || likePending}
                  onClick={() => void toggleLike()}
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-black disabled:opacity-60 ${isLiked ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                  {likesCount}
                </button>
                <span className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                  <MessageCircle className="h-4 w-4" />
                  {commentsCount}
                </span>
              </div>
            </>
          )}
        </article>

        <section id="comments" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <p className="text-lg font-black text-slate-950">Comments</p>
          <div className="mt-3 flex gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder={sessionUserId ? 'Write a comment...' : 'Sign in to comment'}
              disabled={!sessionUserId}
              className="min-h-[42px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={!sessionUserId || !commentDraft.trim() || commentPending}
              onClick={() => void submitComment()}
              className="grid min-h-[42px] w-12 place-items-center rounded-xl bg-blue-600 text-white disabled:opacity-60"
            >
              {commentPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">{getDisplayName(comment.users)}</p>
                <p className="mt-1 text-sm text-slate-900">{comment.content}</p>
              </div>
            ))}
            {comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
          </div>
        </section>

        {!webMode ? (
          !showFallback ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
              <p className="text-lg text-slate-700">Opening post in Committed...</p>
              <p className="mt-2 text-sm text-slate-500">If the app does not open, use the options below.</p>
            </div>
          ) : (
            <OpenAppFallback
              deepLinkUrl={deepLinkUrl}
              title="View post in app"
              description="Tap below to open this post in Committed, or download the app if you don't have it yet."
            />
          )
        ) : null}
      </div>
    </div>
  );
}
