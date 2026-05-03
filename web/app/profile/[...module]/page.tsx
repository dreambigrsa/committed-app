'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Film,
  Grid,
  Heart,
  Loader2,
  Shield,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { APP_SCHEME, buildWebAppUrl } from '@/lib/appLinks';
import OpenAppFallback from '@/components/OpenAppFallback';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getDisplayName } from '@/lib/identity';
import { resolveProfilePictureUrl, resolveReelThumbnailUrl } from '@/lib/profile-media-url';
import { getPostVisibilityOrFilter, getReelVisibilityOrFilter } from '@/lib/content-visibility';
import { parseSupabaseCount } from '@/lib/supabase-count';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProfileTab = 'posts' | 'reels';

type PublicRelationshipRow = {
  id: string;
  type?: string | null;
  status?: string | null;
  partner_name?: string | null;
  start_date?: string | null;
  verified_date?: string | null;
};

function initials(name?: string | null) {
  return (name || 'Committed')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'C';
}

function relationshipTypeLabel(type?: string | null) {
  if (!type) return 'relationship';
  const map: Record<string, string> = {
    married: 'Married',
    engaged: 'Engaged',
    serious: 'Serious relationship',
    dating: 'Dating',
  };
  return map[type] || type.replace(/_/g, ' ');
}

export default function PublicProfilePage() {
  const params = useParams();
  const module = Array.isArray(params.module) ? params.module : [];
  const target = decodeURIComponent(module[0] || '');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [relationship, setRelationship] = useState<PublicRelationshipRow | null>(null);
  const [statusType, setStatusType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
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
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const viewerId = (session?.user?.id || '').trim();

        const userQuery = supabase
          .from('users')
          .select('id,full_name,username,email,profile_picture,verified,email_verified,phone_verified,id_verified,created_at');
        const usernameLookup = target.replace(/^@/, '').trim();
        if (!UUID_RE.test(target) && !usernameLookup) {
          if (!cancelled) setError('This profile link is missing a user identifier.');
          return;
        }
        const { data: userRow, error: userError } = UUID_RE.test(target)
          ? await userQuery.eq('id', target).maybeSingle()
          : await userQuery.eq('username', usernameLookup).maybeSingle();

        if (userError) throw userError;
        if (!userRow?.id) {
          if (!cancelled) setError('This profile could not be found.');
          return;
        }

        const visibilityUid = viewerId || userRow.id;
        const postFilter = getPostVisibilityOrFilter(visibilityUid);
        const reelFilter = getReelVisibilityOrFilter(visibilityUid);

        const [
          postsResult,
          reelsResult,
          postsCountResult,
          followersResult,
          followingResult,
          statusResult,
          relResult,
        ] = await Promise.all([
          supabase
            .from('posts')
            .select('id,content,media_urls,media_type,created_at')
            .eq('user_id', userRow.id)
            .or(postFilter)
            .order('created_at', { ascending: false })
            .limit(60),
          supabase
            .from('reels')
            .select('id,caption,thumbnail_url,video_url,created_at')
            .eq('user_id', userRow.id)
            .or(reelFilter)
            .order('created_at', { ascending: false })
            .limit(60),
          supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userRow.id)
            .or(postFilter),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userRow.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userRow.id),
          supabase.from('user_status').select('status_type').eq('user_id', userRow.id).maybeSingle(),
          supabase
            .from('relationships')
            .select('id,type,status,partner_name,start_date,verified_date')
            .eq('user_id', userRow.id)
            .in('status', ['pending', 'verified'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        setProfile(userRow);
        setPosts(postsResult.data || []);
        setReels(reelsResult.data || []);
        {
          const parsedPostsTotal = parseSupabaseCount(postsCountResult);
          setPostsTotal(parsedPostsTotal > 0 ? parsedPostsTotal : (postsResult.data || []).length);
        }
        setFollowersCount(parseSupabaseCount(followersResult));
        setFollowingCount(parseSupabaseCount(followingResult));
        setStatusType((statusResult.data as { status_type?: string } | null)?.status_type ?? null);
        setRelationship((relResult.data as PublicRelationshipRow | null) ?? null);
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
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading profile...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
        <section className="w-full max-w-md rounded-[28px] bg-white p-6 text-center shadow-xl ring-1 ring-slate-200">
          <Heart className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 text-2xl font-black text-slate-950">Profile not found</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error || 'This profile is not available.'}</p>
          <Link href="/" className="mt-6 inline-flex rounded-[18px] bg-blue-600 px-6 py-3 font-black text-white">
            Go home
          </Link>
        </section>
      </main>
    );
  }

  const name = getDisplayName(profile);
  const online = statusType === 'online';
  const relVerified = relationship?.status === 'verified';

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-center border-b border-slate-200/80 bg-slate-100/95 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="absolute left-3 top-1/2 inline-flex -translate-y-1/2 items-center rounded-full p-2 text-slate-700 outline-none ring-offset-2 hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-lg font-black text-slate-950">Profile</h1>
      </header>

      <div className="mx-auto w-full max-w-[430px] space-y-4 px-4 pt-4">
        <section className="rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <div className="relative mx-auto w-fit">
            {profile.profile_picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveProfilePictureUrl(profile.profile_picture) || profile.profile_picture}
                alt=""
                className="h-28 w-28 rounded-full object-cover ring-4 ring-slate-100"
              />
            ) : (
              <div className="grid h-28 w-28 place-items-center rounded-full bg-blue-600 text-3xl font-black text-white ring-4 ring-slate-100">
                {initials(name)}
              </div>
            )}
            <span
              className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}
              title={online ? 'Online' : 'Offline'}
              aria-hidden
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <h2 className="text-2xl font-black text-slate-950">{name}</h2>
            {profile.phone_verified ? <CheckCircle2 className="h-6 w-6 shrink-0 text-blue-500" aria-label="Phone verified" /> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">@{profile.username || profile.email?.split('@')[0] || 'committed'}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[18px] bg-slate-50 py-3 ring-1 ring-slate-100">
              <p className="text-xl font-black text-slate-950">{postsTotal}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Posts</p>
            </div>
            <div className="rounded-[18px] bg-slate-50 py-3 ring-1 ring-slate-100">
              <p className="text-xl font-black text-slate-950">{followersCount}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Followers</p>
            </div>
            <div className="rounded-[18px] bg-slate-50 py-3 ring-1 ring-slate-100">
              <p className="text-xl font-black text-slate-950">{followingCount}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Following</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {profile.phone_verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Phone Verified</span>
            ) : null}
            {profile.email_verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Email Verified</span>
            ) : null}
            {profile.id_verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">ID Verified</span>
            ) : null}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
            <h3 className="text-base font-black text-slate-950">Relationship Status</h3>
          </div>
          {relationship ? (
            <div className="mt-4 space-y-3 text-left">
              <div
                className={`flex items-center gap-2 rounded-[14px] px-3 py-2 ${
                  relVerified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                }`}
              >
                <Shield className={`h-5 w-5 shrink-0 ${relVerified ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span className="text-sm font-black">{relVerified ? 'Verified Relationship' : 'Pending Verification'}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="font-bold text-slate-500">Status</span>
                  <span className="font-semibold text-slate-900">In a {relationshipTypeLabel(relationship.type)}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="font-bold text-slate-500">Partner</span>
                  <span className="truncate font-semibold text-slate-900">{relationship.partner_name || '—'}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="font-bold text-slate-500">Since</span>
                  <span className="font-semibold text-slate-900">
                    {relationship.start_date ? new Date(relationship.start_date).toLocaleDateString() : '—'}
                  </span>
                </div>
                {relVerified && relationship.verified_date ? (
                  <div className="flex justify-between gap-3 py-2">
                    <span className="font-bold text-slate-500">Verified On</span>
                    <span className="font-semibold text-slate-900">{new Date(relationship.verified_date).toLocaleDateString()}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center py-2 text-slate-400">
              <Heart className="h-12 w-12" strokeWidth={1.25} />
              <p className="mt-3 text-sm font-bold text-slate-500">No registered relationship</p>
            </div>
          )}
        </section>

        {relationship && relVerified ? (
          <section className="flex gap-3 rounded-[20px] bg-emerald-50/80 p-4 ring-1 ring-emerald-100">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs font-semibold leading-relaxed text-emerald-900">
              This relationship has been verified by both partners. The information shown is accurate as of the verification date.
            </p>
          </section>
        ) : null}

        <OpenAppFallback
          deepLinkUrl={deepLinkUrl}
          title="Open this profile in Committed"
          description="Continue in the app for messaging, following, and full activity."
        />

        <a
          href={buildWebAppUrl(`/app/profile/${profile.id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white shadow-sm"
        >
          <UserPlus className="h-5 w-5" />
          Continue on web
        </a>

        <div className="flex border-b border-slate-200 bg-transparent">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-3 text-sm font-black ${
              activeTab === 'posts' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400'
            }`}
          >
            <Grid className="h-5 w-5" />
            Posts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-3 text-sm font-black ${
              activeTab === 'reels' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400'
            }`}
          >
            <Film className="h-5 w-5" />
            Reels
          </button>
        </div>

        {activeTab === 'posts' ? (
          <section>
            {!posts.length ? (
              <div className="flex flex-col items-center rounded-[22px] bg-white py-12 text-slate-400 shadow-sm ring-1 ring-slate-200">
                <Grid className="h-12 w-12" strokeWidth={1.25} />
                <p className="mt-3 text-sm font-bold text-slate-500">No posts to show</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {posts.map((post) => {
                  const raw = Array.isArray(post.media_urls) && post.media_urls[0] ? String(post.media_urls[0]) : '';
                  const thumb = raw ? resolveProfilePictureUrl(raw) || raw : '';
                  return (
                    <Link
                      key={post.id}
                      href={`/post/${post.id}?web=1`}
                      className="aspect-square overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] font-semibold leading-snug text-slate-600 line-clamp-4">
                          {post.content || 'Post'}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section>
            {!reels.length ? (
              <div className="flex flex-col items-center rounded-[22px] bg-white py-12 text-slate-400 shadow-sm ring-1 ring-slate-200">
                <Film className="h-12 w-12" strokeWidth={1.25} />
                <p className="mt-3 text-sm font-bold text-slate-500">No reels to show</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {reels.map((reel) => {
                  const thumb = resolveReelThumbnailUrl(reel.thumbnail_url);
                  return (
                  <Link
                    key={reel.id}
                    href={`/reel/${reel.id}?web=1`}
                    className="relative aspect-[9/16] overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200"
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] font-black text-white">Reel</div>
                    )}
                    {reel.caption ? (
                      <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/55 px-1 py-1 text-[9px] font-semibold text-white">
                        {reel.caption}
                      </p>
                    ) : null}
                  </Link>
                );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
