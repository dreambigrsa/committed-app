'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Camera,
  CheckCircle2,
  Film,
  Heart,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Star,
  User,
  X,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { buildReelWebUrl, buildWebAppUrl } from '@/lib/appLinks';

type TabKey = 'home' | 'feed' | 'reels' | 'dating' | 'search' | 'notifications' | 'messages' | 'profile';

type WebUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  profile_picture?: string | null;
  role?: string | null;
  verified?: boolean | null;
};

type FeedPost = {
  id: string;
  user_id: string;
  content?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  comment_count?: number | null;
  created_at?: string | null;
  users?: { full_name?: string | null; profile_picture?: string | null } | null;
  likes?: string[];
};

type Reel = {
  id: string;
  user_id: string;
  caption?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  created_at?: string | null;
  users?: { full_name?: string | null; profile_picture?: string | null } | null;
  likes?: string[];
};

type DatingProfile = {
  id: string;
  user_id: string;
  bio?: string | null;
  age?: number | null;
  location_city?: string | null;
  location_country?: string | null;
  relationship_goals?: string[] | null;
  interests?: string[] | null;
  religion?: string | null;
  intention_tag?: string | null;
  users?: { full_name?: string | null; profile_picture?: string | null } | null;
  dating_photos?: { photo_url: string; is_primary?: boolean | null }[] | null;
};

type NotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  read?: boolean | null;
};

type ConversationRow = {
  id: string;
  last_message?: string | null;
  updated_at?: string | null;
  participant_one?: string | null;
  participant_two?: string | null;
};

const tabs: Array<{ key: TabKey; label: string; href: string; icon: typeof Home }> = [
  { key: 'home', label: 'Home', href: '/app', icon: Home },
  { key: 'feed', label: 'Feed', href: '/app/feed', icon: Heart },
  { key: 'reels', label: 'Reels', href: '/app/reels', icon: Film },
  { key: 'dating', label: 'Dating', href: '/app/dating', icon: Sparkles },
  { key: 'search', label: 'Search', href: '/app/search', icon: Search },
  { key: 'notifications', label: 'Notify', href: '/app/notifications', icon: Bell },
  { key: 'messages', label: 'Messages', href: '/app/messages', icon: MessageCircle },
  { key: 'profile', label: 'Profile', href: '/app/profile', icon: User },
];

const routeToTab: Record<string, TabKey> = {
  home: 'home',
  feed: 'feed',
  reels: 'reels',
  dating: 'dating',
  relationship: 'search',
  search: 'search',
  notifications: 'notifications',
  messages: 'messages',
  profile: 'profile',
  'create-post': 'feed',
  'dating-likes': 'dating',
  'dating-preferences': 'dating',
  'dating-profile': 'profile',
  professionals: 'profile',
  settings: 'profile',
  admin: 'profile',
};

function initials(name?: string | null) {
  const parts = (name || 'Committed').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C';
}

function timeAgo(value?: string | null) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function mediaImage(url?: string | null) {
  if (!url) return null;
  return url;
}

function Avatar({ src, name, size = 'md' }: { src?: string | null; name?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  if (src) {
    return <img src={src} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  }
  return (
    <div className={`${sizeClass} grid place-items-center rounded-full bg-gradient-to-br from-pink-500 to-blue-600 font-black text-white`}>
      {initials(name)}
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 h-28 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: typeof Heart;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-h-[54vh] flex-col items-center justify-center px-8 text-center">
      <Icon className="h-20 w-20 text-slate-300" strokeWidth={1.8} />
      <h2 className="mt-5 text-3xl font-bold text-slate-900">{title}</h2>
      <p className="mt-3 text-base leading-6 text-slate-500">{text}</p>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-7 rounded-[18px] bg-blue-600 px-9 py-4 text-base font-black text-white shadow-xl shadow-blue-600/20 active:scale-[0.98]"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

export default function MobileWebAppShell({ initialTab = 'home' }: { initialTab?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<WebUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [datingProfiles, setDatingProfiles] = useState<DatingProfile[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [feedLimit, setFeedLimit] = useState(5);
  const [datingIndex, setDatingIndex] = useState(0);
  const [reactionNotice, setReactionNotice] = useState<string | null>(null);

  const activeTab = useMemo<TabKey>(() => {
    const segment = pathname?.split('/').filter(Boolean)[1] || initialTab;
    return routeToTab[segment] || routeToTab[initialTab] || 'home';
  }, [initialTab, pathname]);

  const supabase = useMemo<any>(() => {
    try {
      return getSupabaseBrowser() as any;
    } catch {
      return null;
    }
  }, []);

  const loadAppData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth.user;
      if (!authUser) {
        router.replace('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('id, full_name, email, phone_number, profile_picture, role, verified')
        .eq('id', authUser.id)
        .maybeSingle();

      const currentUser: WebUser = {
        id: authUser.id,
        full_name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email || 'Committed member',
        email: profile?.email || authUser.email,
        phone_number: profile?.phone_number,
        profile_picture: profile?.profile_picture,
        role: profile?.role || 'user',
        verified: profile?.verified,
      };
      setUser(currentUser);

      const [postsResult, reelsResult, datingResult, notificationsResult, conversationsResult] = await Promise.all([
        supabase
          .from('posts')
          .select('id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,profile_picture)')
          .or(`moderation_status.eq.approved,user_id.eq.${authUser.id}`)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('reels')
          .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,profile_picture)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('dating_profiles')
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,religion,intention_tag,users!dating_profiles_user_id_fkey(full_name,profile_picture),dating_photos(photo_url,is_primary)')
          .eq('is_active', true)
          .neq('user_id', authUser.id)
          .limit(20),
        supabase
          .from('notifications')
          .select('id,title,message,created_at,read')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('conversations')
          .select('id,last_message,updated_at,participant_one,participant_two')
          .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`)
          .order('updated_at', { ascending: false })
          .limit(20),
      ]);

      const fetchedPosts = ((postsResult.data || []) as FeedPost[]).filter(Boolean);
      const postIds = fetchedPosts.map((post) => post.id);
      const postLikes = postIds.length
        ? await supabase.from('post_likes').select('post_id,user_id').in('post_id', postIds)
        : { data: [] as Array<{ post_id: string; user_id: string }> };
      const likesByPost = new Map<string, string[]>();
      (postLikes.data || []).forEach((like: any) => {
        likesByPost.set(like.post_id, [...(likesByPost.get(like.post_id) || []), like.user_id]);
      });
      setPosts(fetchedPosts.map((post) => ({ ...post, likes: likesByPost.get(post.id) || [] })));

      const fetchedReels = ((reelsResult.data || []) as Reel[]).filter(Boolean);
      const reelIds = fetchedReels.map((reel) => reel.id);
      const reelLikes = reelIds.length
        ? await supabase.from('reel_likes').select('reel_id,user_id').in('reel_id', reelIds)
        : { data: [] as Array<{ reel_id: string; user_id: string }> };
      const likesByReel = new Map<string, string[]>();
      (reelLikes.data || []).forEach((like: any) => {
        likesByReel.set(like.reel_id, [...(likesByReel.get(like.reel_id) || []), like.user_id]);
      });
      setReels(fetchedReels.map((reel) => ({ ...reel, likes: likesByReel.get(reel.id) || [] })));
      setDatingProfiles(((datingResult.data || []) as DatingProfile[]).filter(Boolean));
      setNotifications(((notificationsResult.data || []) as NotificationRow[]).filter(Boolean));
      setConversations(((conversationsResult.data || []) as ConversationRow[]).filter(Boolean));
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadAppData();
  }, [loadAppData]);

  const togglePostLike = async (post: FeedPost) => {
    if (!supabase || !user) return;
    const wasLiked = !!post.likes?.includes(user.id);
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? { ...item, likes: wasLiked ? (item.likes || []).filter((id) => id !== user.id) : [...(item.likes || []), user.id] }
          : item
      )
    );
    if (wasLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('post_likes').upsert({ post_id: post.id, user_id: user.id }, { onConflict: 'post_id,user_id' });
    }
  };

  const toggleReelLike = async (reel: Reel) => {
    if (!supabase || !user) return;
    const wasLiked = !!reel.likes?.includes(user.id);
    setReels((prev) =>
      prev.map((item) =>
        item.id === reel.id
          ? { ...item, likes: wasLiked ? (item.likes || []).filter((id) => id !== user.id) : [...(item.likes || []), user.id] }
          : item
      )
    );
    if (wasLiked) {
      await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    } else {
      await supabase.from('reel_likes').upsert({ reel_id: reel.id, user_id: user.id }, { onConflict: 'reel_id,user_id' });
    }
  };

  const reactToDatingProfile = async (profile: DatingProfile, action: 'like' | 'pass' | 'super') => {
    if (!supabase || !user) return;
    setDatingIndex((prev) => Math.min(prev + 1, datingProfiles.length));
    if (action === 'pass') {
      setReactionNotice('Passed for now');
      await supabase.from('dating_passes').upsert({ passer_id: user.id, passed_id: profile.user_id }, { onConflict: 'passer_id,passed_id' });
    } else {
      setReactionNotice(action === 'super' ? 'Super like sent' : 'Liked');
      await supabase
        .from('dating_likes')
        .upsert({ liker_id: user.id, liked_id: profile.user_id, is_super_like: action === 'super' }, { onConflict: 'liker_id,liked_id' });
    }
    window.setTimeout(() => setReactionNotice(null), 1800);
  };

  const shareText = async (title: string, url: string) => {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setReactionNotice('Link copied');
    window.setTimeout(() => setReactionNotice(null), 1800);
  };

  const renderHeader = () => {
    const current = tabs.find((tab) => tab.key === activeTab) || tabs[0];
    const isRoot = activeTab === 'home';
    return (
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-[58px] items-center gap-3 px-4">
          {!isRoot ? (
            <button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full active:bg-slate-100">
              <span className="text-3xl leading-none">‹</span>
            </button>
          ) : (
            <Avatar src={user?.profile_picture} name={user?.full_name} size="sm" />
          )}
          <h1 className="flex-1 text-xl font-black text-slate-950">{current.label === 'Notify' ? 'Notifications' : current.label}</h1>
          {activeTab === 'dating' ? (
            <>
              <Link href="/app/dating-likes" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-red-500">
                <Heart className="h-5 w-5" />
              </Link>
              <Link href="/app/dating-preferences" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900">
                <Settings className="h-5 w-5" />
              </Link>
            </>
          ) : activeTab === 'feed' ? (
            <Link href="/app/create-post" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-blue-600">
              <Camera className="h-5 w-5" />
            </Link>
          ) : (
            <button type="button" onClick={() => void loadAppData()} className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-700">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>
    );
  };

  const renderHome = () => (
    <div className="px-4 py-4">
      <section className="rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-800 px-5 py-6 text-white shadow-xl shadow-blue-700/20">
        <div className="flex items-center gap-3">
          <Avatar src={user?.profile_picture} name={user?.full_name} size="lg" />
          <div>
            <p className="text-sm font-semibold text-blue-100">Welcome back</p>
            <h2 className="text-2xl font-black">{user?.full_name || 'Committed member'}</h2>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-blue-50">Verify love, stay accountable, meet meaningful people, and keep every connection in one familiar app experience.</p>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { href: '/app/feed', label: 'Feed', icon: Heart, text: 'See updates' },
          { href: '/app/reels', label: 'Reels', icon: Film, text: 'Watch videos' },
          { href: '/app/dating', label: 'Dating', icon: Sparkles, text: 'Find love' },
          { href: '/app/search', label: 'Search', icon: Search, text: 'Check records' },
        ].map(({ href, label, icon: Icon, text }) => (
          <Link key={label} href={href} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.98]">
            <Icon className="h-7 w-7 text-blue-600" />
            <p className="mt-4 text-lg font-black text-slate-950">{label}</p>
            <p className="text-sm text-slate-500">{text}</p>
          </Link>
        ))}
      </div>
      <div className="mt-5">
        {posts.slice(0, 1).map((post) => (
          <PostCard key={post.id} post={post} user={user} onLike={togglePostLike} onShare={shareText} />
        ))}
      </div>
    </div>
  );

  const renderFeed = () => {
    const visiblePosts = posts.slice(0, feedLimit);
    if (!visiblePosts.length) return <EmptyState icon={Heart} title="No Posts Yet" text="When people share updates, they will appear here." />;
    return (
      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
          <Avatar src={user?.profile_picture} name={user?.full_name} />
          <Link href="/app/create-post" className="flex-1 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500">
            What is on your heart?
          </Link>
        </div>
        {visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} user={user} onLike={togglePostLike} onShare={shareText} />
        ))}
        {feedLimit < posts.length ? (
          <button type="button" onClick={() => setFeedLimit((prev) => prev + 5)} className="w-full rounded-[18px] bg-slate-900 py-3 font-black text-white">
            Load more
          </button>
        ) : null}
      </div>
    );
  };

  const renderReels = () => {
    if (!reels.length) return <EmptyState icon={Film} title="No Reels Yet" text="Short videos from the community will appear here." />;
    return (
      <div className="snap-y snap-mandatory overflow-y-auto bg-slate-950">
        {reels.map((reel) => (
          <article key={reel.id} className="relative min-h-[calc(100vh-122px)] snap-start overflow-hidden bg-slate-900">
            {reel.video_url ? (
              <video src={reel.video_url} poster={reel.thumbnail_url || undefined} controls className="h-full min-h-[calc(100vh-122px)] w-full object-cover" />
            ) : reel.thumbnail_url ? (
              <img src={reel.thumbnail_url} alt="" className="h-full min-h-[calc(100vh-122px)] w-full object-cover" />
            ) : (
              <div className="grid min-h-[calc(100vh-122px)] place-items-center bg-gradient-to-br from-slate-900 to-blue-950 text-white">
                <Film className="h-20 w-20" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-black">{reel.users?.full_name || 'Committed member'}</p>
                  <p className="mt-2 text-sm leading-5 text-white/85">{reel.caption || 'Shared a reel'}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => void toggleReelLike(reel)} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 backdrop-blur">
                    <Heart className={`h-6 w-6 ${user && reel.likes?.includes(user.id) ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
                  </button>
                  <button type="button" onClick={() => void shareText('Committed Reel', buildReelWebUrl(reel.id))} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 backdrop-blur">
                    <Share2 className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderDating = () => {
    const profile = datingProfiles[datingIndex];
    if (!profile) {
      return <EmptyState icon={Sparkles} title="No More Profiles" text="You have seen everyone for now. Check back soon for new people." action="Refresh" onAction={() => void loadAppData()} />;
    }
    const photo = profile.dating_photos?.find((item) => item.is_primary)?.photo_url || profile.dating_photos?.[0]?.photo_url || profile.users?.profile_picture;
    const name = profile.users?.full_name || 'Committed dater';
    const tags = [...(profile.relationship_goals || []), ...(profile.interests || [])].slice(0, 4);
    return (
      <div className="flex min-h-[calc(100vh-122px)] flex-col px-4 pb-4 pt-3">
        <div className="relative flex-1 overflow-hidden rounded-[26px] bg-slate-900 shadow-2xl shadow-slate-950/20">
          {photo ? (
            <img src={photo} alt="" className="h-full min-h-[470px] w-full object-cover" />
          ) : (
            <div className="grid h-full min-h-[470px] place-items-center bg-gradient-to-br from-orange-500 to-slate-900 text-[150px] font-black text-white">
              {initials(name)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/65 to-transparent p-5 text-white">
            <h2 className="text-3xl font-black">
              {name} {profile.age ? <span className="font-bold">{profile.age}</span> : null}
            </h2>
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
              <MapPin className="h-4 w-4" />
              {[profile.location_city, profile.location_country].filter(Boolean).join(', ') || 'Location not set'}
            </p>
            <p className="mt-3 text-sm leading-5">{profile.bio || 'Looking for meaningful connections and authentic conversations.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[profile.intention_tag, profile.religion, ...tags].filter(Boolean).slice(0, 5).map((tag) => (
                <span key={String(tag)} className="rounded-full bg-white/18 px-3 py-1.5 text-xs font-black backdrop-blur">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => void reactToDatingProfile(profile, 'pass')} className="grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/25 active:scale-95">
            <X className="h-8 w-8" />
          </button>
          <button type="button" onClick={() => void reactToDatingProfile(profile, 'super')} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/25 active:scale-95">
            <Star className="h-9 w-9 fill-white" />
          </button>
          <button type="button" onClick={() => void reactToDatingProfile(profile, 'like')} className="grid h-16 w-16 place-items-center rounded-full bg-green-500 text-white shadow-xl shadow-green-500/25 active:scale-95">
            <Heart className="h-8 w-8 fill-white" />
          </button>
        </div>
      </div>
    );
  };

  const renderSearch = () => (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-[26px] bg-blue-600 p-5 text-white">
        <Search className="h-9 w-9" />
        <h2 className="mt-4 text-2xl font-black">Search relationships</h2>
        <p className="mt-2 text-sm leading-6 text-blue-50">Check public verified records by name or phone, then sign in for the full registry experience.</p>
      </div>
      <Link href="/#public-search" className="block rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-black text-slate-950">Public search</p>
        <p className="mt-1 text-sm text-slate-500">Open the same public search used by shared website visitors.</p>
      </Link>
      <Link href="/app/relationship" className="block rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-lg font-black text-slate-950">Register a relationship</p>
        <p className="mt-1 text-sm text-slate-500">Start a verification request with partner details and consent.</p>
      </Link>
    </div>
  );

  const renderNotifications = () => {
    if (!notifications.length) return <EmptyState icon={Bell} title="No Notifications" text="Likes, approvals, messages, and relationship updates will appear here." />;
    return (
      <div className="space-y-3 px-4 py-4">
        {notifications.map((notification) => (
          <article key={notification.id} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mt-1 h-3 w-3 rounded-full ${notification.read ? 'bg-slate-200' : 'bg-blue-600'}`} />
            <div>
              <p className="font-black text-slate-950">{notification.title || 'Notification'}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
              <p className="mt-2 text-xs font-semibold text-slate-400">{timeAgo(notification.created_at)}</p>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderMessages = () => {
    if (!conversations.length) return <EmptyState icon={MessageCircle} title="No Messages Yet" text="Conversations from matches and connections will appear here." />;
    return (
      <div className="space-y-2 px-3 py-3">
        {conversations.map((conversation) => (
          <Link key={conversation.id} href="/app/messages" className="flex items-center gap-3 rounded-[20px] bg-white p-3 active:bg-slate-50">
            <Avatar name="Committed member" />
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-950">Conversation</p>
              <p className="truncate text-sm text-slate-500">{conversation.last_message || 'Open chat'}</p>
            </div>
            <Send className="h-5 w-5 text-slate-400" />
          </Link>
        ))}
      </div>
    );
  };

  const renderProfile = () => (
    <div className="px-4 py-4">
      <section className="rounded-[28px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto w-fit">
          <Avatar src={user?.profile_picture} name={user?.full_name} size="lg" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-950">{user?.full_name || 'Committed member'}</h2>
        <p className="text-sm text-slate-500">{user?.email}</p>
        <div className="mt-4 flex justify-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{user?.role || 'user'}</span>
          {user?.verified ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Verified</span> : null}
        </div>
      </section>
      <div className="mt-4 space-y-3">
        {[
          { href: '/app/settings', title: 'Settings', text: 'Account, privacy, and app preferences' },
          { href: '/app/dating-profile', title: 'Dating profile', text: 'Photos, bio, goals, and discovery details' },
          { href: '/app/professionals', title: 'Professionals', text: 'Bookings, profile, and approvals' },
          { href: '/app/admin', title: 'Admin', text: 'Manage approvals and verification queues' },
        ].map((item) => (
          <Link key={item.title} href={item.href} className="block rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-black text-slate-950">{item.title}</p>
            <p className="mt-1 text-sm text-slate-500">{item.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) return <ScreenSkeleton />;
    if (activeTab === 'home') return renderHome();
    if (activeTab === 'feed') return renderFeed();
    if (activeTab === 'reels') return renderReels();
    if (activeTab === 'dating') return renderDating();
    if (activeTab === 'search') return renderSearch();
    if (activeTab === 'notifications') return renderNotifications();
    if (activeTab === 'messages') return renderMessages();
    return renderProfile();
  };

  return (
    <div className="min-h-screen bg-slate-200 text-slate-950">
      <div className="mx-auto min-h-screen max-w-[430px] bg-slate-50 shadow-2xl md:my-4 md:min-h-[calc(100vh-2rem)] md:overflow-hidden md:rounded-[28px]">
        {renderHeader()}
        <main className="pb-[76px]">{renderContent()}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-[64px] max-w-[430px] grid-cols-8 border-t border-slate-200 bg-white">
          {tabs.map(({ key, label, href, icon: Icon }) => {
            const active = key === activeTab;
            return (
              <Link key={key} href={href} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                <Icon className={`h-5 w-5 ${active && key === 'feed' ? 'fill-current' : ''}`} strokeWidth={active ? 2.6 : 2} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      {reactionNotice ? (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-[430px] px-6">
          <div className="flex items-center gap-3 rounded-[22px] bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-2xl">
            <CheckCircle2 className="h-5 w-5 text-blue-300" />
            {reactionNotice}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PostCard({
  post,
  user,
  onLike,
  onShare,
}: {
  post: FeedPost;
  user: WebUser | null;
  onLike: (post: FeedPost) => void | Promise<void>;
  onShare: (title: string, url: string) => void | Promise<void>;
}) {
  const firstImage = mediaImage(post.media_urls?.[0]);
  const liked = !!(user && post.likes?.includes(user.id));
  return (
    <article className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <Avatar src={post.users?.profile_picture} name={post.users?.full_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-slate-950">{post.users?.full_name || 'Committed member'}</p>
          <p className="text-xs font-semibold text-slate-400">{timeAgo(post.created_at)}</p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-slate-400" />
      </div>
      {post.content ? <p className="px-4 pb-3 text-[15px] leading-6 text-slate-800">{post.content}</p> : null}
      {firstImage ? <img src={firstImage} alt="" loading="lazy" className="max-h-[460px] w-full object-cover" /> : null}
      <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-500">
        <span>{post.likes?.length || 0} likes</span>
        <span>{post.comment_count || 0} comments</span>
      </div>
      <div className="grid grid-cols-3 border-t border-slate-100">
        <button type="button" onClick={() => void onLike(post)} className={`flex items-center justify-center gap-2 py-3 text-sm font-black ${liked ? 'text-pink-600' : 'text-slate-600'}`}>
          <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          Like
        </button>
        <Link href={`/post/${post.id}`} className="flex items-center justify-center gap-2 py-3 text-sm font-black text-slate-600">
          <MessageCircle className="h-5 w-5" />
          Comment
        </Link>
        <button type="button" onClick={() => void onShare('Committed Post', buildWebAppUrl(`/post/${post.id}`))} className="flex items-center justify-center gap-2 py-3 text-sm font-black text-slate-600">
          <Share2 className="h-5 w-5" />
          Share
        </button>
      </div>
    </article>
  );
}
