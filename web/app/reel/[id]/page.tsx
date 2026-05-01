'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';
import ExpoMirrorRoute from '@/components/ExpoMirrorRoute';
import { buildReelCommentsByReelId, fetchReelCommentsAndLikes } from '@committed/shared';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getDisplayName } from '@/lib/identity';

const FALLBACK_DELAY_MS = 1200;

export default function ReelPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const isCreateRoute = id === 'create';
  const webMode = searchParams.get('web') === '1';
  const [showFallback, setShowFallback] = useState(false);
  const [loadingReel, setLoadingReel] = useState(true);
  const [reel, setReel] = useState<any>(null);
  const [sessionUserId, setSessionUserId] = useState('');
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [shareNotice, setShareNotice] = useState('');

  const deepLinkUrl = `${APP_SCHEME}reel/${id}`;

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
    const loadReel = async () => {
      if (isCreateRoute) {
        setLoadingReel(false);
        return;
      }
      if (!id) {
        setLoadingReel(false);
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
          .from('reels')
          .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,username,email,profile_picture)')
          .eq('id', id)
          .maybeSingle();
        if (!cancelled) setReel(data || null);

        if (!data?.id) return;
        const [likesRes, commentsBundle, myLikeRes] = await Promise.all([
          supabase.from('reel_likes').select('id', { count: 'exact', head: true }).eq('reel_id', data.id),
          fetchReelCommentsAndLikes(supabase, [data.id]),
          currentUserId ? supabase.from('reel_likes').select('id').eq('reel_id', data.id).eq('user_id', currentUserId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        setLikesCount(likesRes.count || 0);
        const byReel = buildReelCommentsByReelId(commentsBundle.commentsData, commentsBundle.commentLikesData);
        const top = byReel[data.id] || [];
        const sorted = [...top].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const forUi = sorted.slice(0, 20).map((c) => ({
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
        if (!cancelled) setLoadingReel(false);
      }
    };
    void loadReel();
    return () => {
      cancelled = true;
    };
  }, [id, isCreateRoute]);

  if (isCreateRoute) {
    return <ExpoMirrorRoute initialTab="reels" />;
  }

  const toggleLike = async () => {
    if (!reel?.id || !sessionUserId || likePending) return;
    const supabase = getSupabaseBrowser() as any;
    const nextLiked = !isLiked;
    setLikePending(true);
    setIsLiked(nextLiked);
    setLikesCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    try {
      if (nextLiked) {
        const { error } = await supabase.from('reel_likes').insert({ reel_id: reel.id, user_id: sessionUserId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', sessionUserId);
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
    if (!text || !reel?.id || !sessionUserId || commentPending) return;
    setCommentPending(true);
    try {
      const supabase = getSupabaseBrowser() as any;
      const { data, error } = await supabase
        .from('reel_comments')
        .insert({ reel_id: reel.id, user_id: sessionUserId, content: text, message_type: 'text' })
        .select('id,reel_id,user_id,content,created_at,users!reel_comments_user_id_fkey(full_name,username,email,profile_picture)')
        .single();
      if (error || !data) throw error || new Error('Unable to add comment');
      setComments((list) => [data, ...list]);
      setCommentsCount((count) => count + 1);
      setCommentDraft('');
    } finally {
      setCommentPending(false);
    }
  };

  const shareReel = async () => {
    const webUrl = typeof window !== 'undefined' ? window.location.href : '';
    if (!webUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Committed Reel', url: webUrl });
      } else {
        await navigator.clipboard.writeText(webUrl);
        setShareNotice('Reel link copied');
        window.setTimeout(() => setShareNotice(''), 1800);
      }
    } catch {
      // user cancelled share sheet or clipboard failed
    }
  };

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl text-center">
          <h1 className="font-display text-xl font-bold text-slate-900">Reel not found</h1>
          <p className="mt-2 text-slate-600">This link appears to be invalid.</p>
          <a href="/" className="mt-6 inline-block text-primary-600 hover:underline">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-3 py-4 text-white md:px-4 md:py-6">
      <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl">
          {loadingReel ? (
            <div className="aspect-[9/16] animate-pulse bg-neutral-800 lg:aspect-video" />
          ) : reel?.video_url ? (
            <video
              className="aspect-[9/16] w-full bg-black lg:aspect-video"
              src={reel.video_url}
              poster={reel.thumbnail_url || undefined}
              controls
              preload="metadata"
              playsInline
            />
          ) : reel?.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reel.thumbnail_url} alt={reel.caption || 'Reel'} className="aspect-[9/16] w-full object-cover lg:aspect-video" />
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center bg-neutral-900 text-neutral-400 lg:aspect-video">Reel preview unavailable</div>
          )}
          <div className="p-4 md:p-5">
            <p className="text-sm font-semibold text-neutral-300">{getDisplayName(reel?.users)}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-100">{reel?.caption || 'Open in app for full interactions and comments.'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!sessionUserId || likePending}
                onClick={() => void toggleLike()}
                className={`min-h-[40px] rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.98] disabled:opacity-60 ${isLiked ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-white/10 text-white hover:bg-white/15'}`}
              >
                {isLiked ? 'Liked' : 'Like'} · {likesCount}
              </button>
              <a
                href="#comments"
                className="min-h-[40px] rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white"
              >
                Comments · {commentsCount}
              </a>
              <button
                type="button"
                onClick={() => void shareReel()}
                className="min-h-[40px] rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15"
              >
                Share
              </button>
              {!sessionUserId ? <span className="text-xs text-neutral-400">Sign in on web app to react</span> : null}
              {shareNotice ? <span className="text-xs text-emerald-300">{shareNotice}</span> : null}
            </div>
          </div>
        </div>
        <div id="comments" className="rounded-2xl border border-white/15 bg-neutral-950 p-4 md:p-5">
          <p className="text-lg font-bold text-white">Comments</p>
          <div className="mt-3 flex gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder={sessionUserId ? 'Write a comment...' : 'Sign in to comment'}
              disabled={!sessionUserId}
              className="min-h-[42px] flex-1 rounded-xl border border-white/15 bg-black px-3 text-sm text-white outline-none placeholder:text-neutral-500"
            />
            <button
              type="button"
              disabled={!sessionUserId || !commentDraft.trim() || commentPending}
              onClick={() => void submitComment()}
              className="min-h-[42px] rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-500 active:scale-[0.98] disabled:opacity-60"
            >
              Send
            </button>
          </div>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs font-semibold text-neutral-300">{getDisplayName(comment.users)}</p>
                <p className="mt-1 text-sm text-white">{comment.content}</p>
              </div>
            ))}
            {comments.length === 0 ? <p className="text-sm text-neutral-400">No comments yet.</p> : null}
          </div>
        </div>
        {!showFallback ? (
          <div className="rounded-2xl border border-white/15 bg-neutral-950 p-5 text-center">
            <p className="text-lg text-white">Opening reel in Committed...</p>
            <p className="mt-2 text-sm text-neutral-400">If the app does not open, use the options below.</p>
          </div>
        ) : (
          <OpenAppFallback
            deepLinkUrl={deepLinkUrl}
            title="Watch reel in app"
            description="Tap below to open this reel in Committed, or download the app if you don't have it yet."
          />
        )}
        <div className="rounded-2xl border border-white/15 bg-neutral-950 p-4 text-sm text-neutral-400 lg:col-span-2">
          Deep links remain active. This web preview exists as a fallback so shared reel links are still useful in browser sessions.
        </div>
      </div>
    </div>
  );
}
