'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { APP_SCHEME } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';
import { getSupabaseBrowser } from '@/lib/supabase-client';

const FALLBACK_DELAY_MS = 1200;

export default function ReelPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
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

  const deepLinkUrl = `${APP_SCHEME}reel/${id}`;

  useEffect(() => {
    if (!id) {
      setShowFallback(true);
      return;
    }
    window.location.href = deepLinkUrl;
    const t = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, [id, deepLinkUrl]);

  useEffect(() => {
    let cancelled = false;
    const loadReel = async () => {
      if (!id) {
        setLoadingReel(false);
        return;
      }
      try {
        const supabase = getSupabaseBrowser() as any;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || '';
        if (!cancelled) setSessionUserId(currentUserId);
        const { data } = await supabase
          .from('reels')
          .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name)')
          .eq('id', id)
          .maybeSingle();
        if (!cancelled) setReel(data || null);

        if (!data?.id) return;
        const [likesRes, commentsRes, myLikeRes] = await Promise.all([
          supabase.from('reel_likes').select('id', { count: 'exact', head: true }).eq('reel_id', data.id),
          supabase
            .from('reel_comments')
            .select('id,reel_id,user_id,content,created_at,users!reel_comments_user_id_fkey(full_name)')
            .eq('reel_id', data.id)
            .order('created_at', { ascending: false })
            .limit(20),
          currentUserId ? supabase.from('reel_likes').select('id').eq('reel_id', data.id).eq('user_id', currentUserId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        setLikesCount(likesRes.count || 0);
        setComments(commentsRes.data || []);
        setCommentsCount((commentsRes.data || []).length);
        setIsLiked(Boolean(myLikeRes.data));
      } finally {
        if (!cancelled) setLoadingReel(false);
      }
    };
    void loadReel();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
        .insert({ reel_id: reel.id, user_id: sessionUserId, content: text })
        .select('id,reel_id,user_id,content,created_at,users!reel_comments_user_id_fkey(full_name)')
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
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          {loadingReel ? (
            <div className="aspect-video animate-pulse bg-slate-200" />
          ) : reel?.video_url ? (
            <video
              className="aspect-video w-full bg-black"
              src={reel.video_url}
              poster={reel.thumbnail_url || undefined}
              controls
              preload="metadata"
              playsInline
            />
          ) : reel?.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reel.thumbnail_url} alt={reel.caption || 'Reel'} className="aspect-video w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-slate-100 text-slate-400">Reel preview unavailable</div>
          )}
          <div className="p-5">
            <p className="text-sm font-semibold text-slate-500">{reel?.users?.full_name || 'Committed member'}</p>
            <p className="mt-2 whitespace-pre-wrap text-slate-800">{reel?.caption || 'Open in app for full interactions and comments.'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!sessionUserId || likePending}
                onClick={() => void toggleLike()}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${isLiked ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}
              >
                {isLiked ? 'Liked' : 'Like'} · {likesCount}
              </button>
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">Comments · {commentsCount}</span>
              {!sessionUserId ? <span className="text-xs text-slate-500">Sign in on web app to react</span> : null}
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60">
          <p className="font-display text-xl font-bold text-slate-900">Comments</p>
          <div className="mt-3 flex gap-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder={sessionUserId ? 'Write a comment...' : 'Sign in to comment'}
              disabled={!sessionUserId}
              className="min-h-[42px] flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
            <button
              type="button"
              disabled={!sessionUserId || !commentDraft.trim() || commentPending}
              onClick={() => void submitComment()}
              className="rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">{comment.users?.full_name || 'Committed member'}</p>
                <p className="mt-1 text-sm text-slate-800">{comment.content}</p>
              </div>
            ))}
            {comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
          </div>
        </div>
        {!showFallback ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-200/60">
            <p className="text-lg text-slate-700">Opening reel in Committed…</p>
            <p className="mt-2 text-sm text-slate-500">If the app doesn&apos;t open, use the options below.</p>
          </div>
        ) : (
          <OpenAppFallback
            deepLinkUrl={deepLinkUrl}
            title="Watch reel in app"
            description="Tap below to open this reel in Committed, or download the app if you don't have it yet."
          />
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 lg:col-span-2">
          Deep links remain active. This web preview exists as a fallback so shared reel links are still useful in browser sessions.
        </div>
      </div>
    </div>
  );
}
