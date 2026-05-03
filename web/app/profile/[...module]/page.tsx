'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Film, Heart, Loader2, MessageCircle, UserPlus } from 'lucide-react';
import { APP_SCHEME, buildWebAppUrl } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getDisplayName } from '@/lib/identity';
import { resolveProfilePictureUrl } from '@/lib/profile-media-url';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function initials(name?: string | null) {
  return (name || 'Committed')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';
}

export default function PublicProfilePage() {
  const params = useParams();
  const module = Array.isArray(params.module) ? params.module : [];
  const target = decodeURIComponent(module[0] || '');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [error, setError] = useState('');

  const deepLinkUrl = useMemo(() => `${APP_SCHEME}profile/${encodeURIComponent(target)}`, [target]);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      if (!target) {
        setError('This profile link is missing a user identifier.');
        setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseBrowser() as any;
        const userQuery = supabase
          .from('users')
          .select('id,full_name,username,email,profile_picture,verified,email_verified,phone_verified,id_verified,created_at');
        const { data: userRow, error: userError } = UUID_RE.test(target)
          ? await userQuery.eq('id', target).maybeSingle()
          : await userQuery.eq('username', target).maybeSingle();

        if (userError) throw userError;
        if (!userRow?.id) {
          if (!cancelled) setError('This profile could not be found.');
          return;
        }

        const [postsResult, reelsResult] = await Promise.all([
          supabase
            .from('posts')
            .select('id,content,media_urls,media_type,created_at')
            .eq('user_id', userRow.id)
            .order('created_at', { ascending: false })
            .limit(6),
          supabase
            .from('reels')
            .select('id,caption,thumbnail_url,video_url,created_at')
            .eq('user_id', userRow.id)
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        if (cancelled) return;
        setProfile(userRow);
        setPosts(postsResult.data || []);
        setReels(reelsResult.data || []);
      } catch {
        if (!cancelled) setError('Failed to load this profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading profile...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-[28px] bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
          <Heart className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Profile not found</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error || 'This profile is not available.'}</p>
          <a href="/" className="mt-6 inline-flex rounded-[18px] bg-blue-600 px-6 py-3 font-black text-white">
            Go home
          </a>
        </section>
      </main>
    );
  }

  const name = getDisplayName(profile);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5">
      <section className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[32px] bg-white shadow-xl ring-1 ring-slate-200">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950 px-5 pb-8 pt-10 text-white">
          <div className="flex items-center gap-4">
            {profile.profile_picture ? (
              <img
                src={resolveProfilePictureUrl(profile.profile_picture) || profile.profile_picture}
                alt=""
                className="h-20 w-20 rounded-full object-cover ring-4 ring-white/25"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white/20 text-2xl font-black ring-4 ring-white/25">
                {initials(name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-3xl font-black">{name}</h1>
              <p className="mt-1 text-sm font-semibold text-blue-100">@{profile.username || profile.email?.split('@')[0] || 'committed'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                {profile.verified || profile.id_verified ? <span className="rounded-full bg-white/20 px-3 py-1">Verified</span> : null}
                {profile.email_verified ? <span className="rounded-full bg-white/20 px-3 py-1">Email</span> : null}
                {profile.phone_verified ? <span className="rounded-full bg-white/20 px-3 py-1">Phone</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-[20px] bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-2xl font-black text-slate-950">{posts.length}</p>
              <p className="text-sm font-bold text-slate-500">Recent posts</p>
            </div>
            <div className="rounded-[20px] bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-2xl font-black text-slate-950">{reels.length}</p>
              <p className="text-sm font-bold text-slate-500">Recent reels</p>
            </div>
          </div>

          <OpenAppFallback
            deepLinkUrl={deepLinkUrl}
            title="Open this profile in Committed"
            description="Continue in the app for messaging, following, full posts, reels, and relationship context."
          />

          <a href={buildWebAppUrl(`/app/profile/${profile.id}`)} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white">
            <UserPlus className="h-5 w-5" />
            Continue on web
          </a>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-950">Recent posts</h2>
            </div>
            {!posts.length ? <p className="rounded-[20px] bg-slate-50 p-4 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">No public posts loaded for this profile.</p> : null}
            <div className="space-y-3">
              {posts.map((post) => (
                <a key={post.id} href={`/post/${post.id}?web=1`} className="block rounded-[20px] bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="line-clamp-3 text-sm font-semibold leading-6 text-slate-700">{post.content || 'Post'}</p>
                  {post.media_urls?.[0] ? <img src={post.media_urls[0]} alt="" className="mt-3 max-h-48 w-full rounded-[16px] object-cover" /> : null}
                </a>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Film className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-950">Recent reels</h2>
            </div>
            {!reels.length ? <p className="rounded-[20px] bg-slate-50 p-4 text-sm font-semibold text-slate-500 ring-1 ring-slate-200">No public reels loaded for this profile.</p> : null}
            <div className="grid grid-cols-2 gap-3">
              {reels.map((reel) => (
                <a key={reel.id} href={`/reel/${reel.id}?web=1`} className="min-h-32 rounded-[20px] bg-slate-950 p-3 text-white">
                  {reel.thumbnail_url ? <img src={reel.thumbnail_url} alt="" className="h-32 w-full rounded-[16px] object-cover" /> : null}
                  <p className="mt-2 line-clamp-2 text-xs font-semibold">{reel.caption || 'Reel'}</p>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
