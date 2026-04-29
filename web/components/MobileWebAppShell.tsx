'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { HTMLAttributes } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  Camera,
  CheckCircle2,
  Film,
  Heart,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { buildPostWebUrl, buildReelWebUrl } from '@/lib/appLinks';

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

type RelationshipRow = {
  id: string;
  user_id?: string | null;
  partner_user_id?: string | null;
  partner_name?: string | null;
  partner_phone?: string | null;
  type?: string | null;
  status?: string | null;
  start_date?: string | null;
  privacy_level?: string | null;
};

type DatingLike = {
  id: string;
  liker_id: string;
  is_super_like?: boolean | null;
  created_at?: string | null;
  user?: WebUser | null;
};

type DatingMatch = {
  id: string;
  user1_id?: string | null;
  user2_id?: string | null;
  matched_at?: string | null;
  created_at?: string | null;
  user?: WebUser | null;
};

type NotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  created_at?: string | null;
  read?: boolean | null;
  type?: string | null;
  data?: any;
};

type ConversationRow = {
  id: string;
  last_message?: string | null;
  updated_at?: string | null;
  participant_one?: string | null;
  participant_two?: string | null;
};

type SearchResult = {
  id?: string;
  fullName?: string;
  phoneNumber?: string;
  profilePicture?: string | null;
  relationshipType?: string | null;
  relationshipStatus?: string | null;
  relationshipPrivacy?: string | null;
  partnerName?: string | null;
  isRegisteredUser?: boolean;
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
  'dating-profile': 'dating',
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
  const [relationship, setRelationship] = useState<RelationshipRow | null>(null);
  const [datingProfiles, setDatingProfiles] = useState<DatingProfile[]>([]);
  const [myDatingProfile, setMyDatingProfile] = useState<DatingProfile | null>(null);
  const [datingLikes, setDatingLikes] = useState<DatingLike[]>([]);
  const [datingMatches, setDatingMatches] = useState<DatingMatch[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [feedLimit, setFeedLimit] = useState(5);
  const [datingIndex, setDatingIndex] = useState(0);
  const [reactionNotice, setReactionNotice] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [reelDraft, setReelDraft] = useState({ caption: '', videoUrl: '', thumbnailUrl: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ fullName: '', phoneNumber: '' });
  const [datingForm, setDatingForm] = useState({
    bio: '',
    age: '',
    city: '',
    country: '',
    lookingFor: 'everyone',
    minAge: '18',
    maxAge: '99',
    distance: '50',
    religion: '',
    intention: 'serious',
  });
  const [saving, setSaving] = useState(false);

  const activeTab = useMemo<TabKey>(() => {
    const segment = pathname?.split('/').filter(Boolean)[1] || initialTab;
    return routeToTab[segment] || routeToTab[initialTab] || 'home';
  }, [initialTab, pathname]);

  const appPath = useMemo(() => pathname?.split('/').filter(Boolean).slice(1) || [], [pathname]);
  const subPath = appPath.slice(1).join('/');

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
      setSettingsForm({
        fullName: currentUser.full_name || '',
        phoneNumber: currentUser.phone_number || '',
      });

      const [postsResult, reelsResult, relationshipResult, myDatingResult, datingResult, notificationsResult, conversationsResult, likesResult, matchesResult] = await Promise.all([
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
          .from('relationships')
          .select('id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level')
          .or(`user_id.eq.${authUser.id},partner_user_id.eq.${authUser.id}`)
          .in('status', ['pending', 'verified'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('dating_profiles')
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,religion,intention_tag,looking_for,age_range_min,age_range_max,max_distance_km')
          .eq('user_id', authUser.id)
          .maybeSingle(),
        supabase
          .from('dating_profiles')
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,religion,intention_tag,users!dating_profiles_user_id_fkey(full_name,profile_picture),dating_photos(photo_url,is_primary)')
          .eq('is_active', true)
          .neq('user_id', authUser.id)
          .limit(20),
        supabase
          .from('notifications')
          .select('id,title,message,created_at,read,type,data')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('conversations')
          .select('id,last_message,updated_at,participant_one,participant_two')
          .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase
          .from('dating_likes')
          .select('id,liker_id,is_super_like,created_at')
          .eq('liked_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('dating_matches')
          .select('id,user1_id,user2_id,matched_at,created_at')
          .or(`user1_id.eq.${authUser.id},user2_id.eq.${authUser.id}`)
          .order('created_at', { ascending: false })
          .limit(30),
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
      setRelationship((relationshipResult.data || null) as RelationshipRow | null);
      const ownDating = myDatingResult.data as any;
      setMyDatingProfile((ownDating || null) as DatingProfile | null);
      setDatingForm({
        bio: ownDating?.bio || '',
        age: ownDating?.age ? String(ownDating.age) : '',
        city: ownDating?.location_city || '',
        country: ownDating?.location_country || '',
        lookingFor: ownDating?.looking_for || 'everyone',
        minAge: ownDating?.age_range_min ? String(ownDating.age_range_min) : '18',
        maxAge: ownDating?.age_range_max ? String(ownDating.age_range_max) : '99',
        distance: ownDating?.max_distance_km ? String(ownDating.max_distance_km) : '50',
        religion: ownDating?.religion || '',
        intention: ownDating?.intention_tag || 'serious',
      });
      setDatingProfiles(((datingResult.data || []) as DatingProfile[]).filter(Boolean));
      setNotifications(((notificationsResult.data || []) as NotificationRow[]).filter(Boolean));
      setConversations(((conversationsResult.data || []) as ConversationRow[]).filter(Boolean));

      const likeRows = ((likesResult.data || []) as DatingLike[]).filter(Boolean);
      const matchRows = ((matchesResult.data || []) as DatingMatch[]).filter(Boolean);
      const relatedUserIds = Array.from(new Set([
        ...likeRows.map((item) => item.liker_id).filter(Boolean),
        ...matchRows.map((item) => (item.user1_id === authUser.id ? item.user2_id : item.user1_id)).filter(Boolean),
      ]));
      if (relatedUserIds.length) {
        const { data: relatedUsers } = await supabase
          .from('users')
          .select('id,full_name,email,phone_number,profile_picture,role,verified')
          .in('id', relatedUserIds);
        const userMap = new Map<string, WebUser>((relatedUsers || []).map((item: WebUser) => [item.id, item]));
        setDatingLikes(likeRows.map((item) => ({ ...item, user: userMap.get(item.liker_id) || null })));
        setDatingMatches(matchRows.map((item) => {
          const otherId = item.user1_id === authUser.id ? item.user2_id : item.user1_id;
          return { ...item, user: otherId ? userMap.get(otherId) || null : null };
        }));
      } else {
        setDatingLikes([]);
        setDatingMatches([]);
      }
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

  const runSearch = async (value = searchQuery) => {
    if (!supabase) return;
    const query = value.trim();
    setSearchQuery(value);
    if (!query) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      let usersData: any[] = [];
      const rpc = await supabase.rpc('search_users', { search_query: query.toLowerCase() });
      if (!rpc.error && Array.isArray(rpc.data)) {
        usersData = rpc.data;
      } else {
        const fallback = await supabase
          .from('users')
          .select('id,full_name,phone_number,profile_picture,verified')
          .or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
          .limit(20);
        usersData = fallback.data || [];
      }

      const mapped = await Promise.all(usersData.map(async (item: any) => {
        const { data: rel } = await supabase
          .from('relationships')
          .select('id,type,status,privacy_level,partner_name,user_id,partner_user_id')
          .or(`user_id.eq.${item.id},partner_user_id.eq.${item.id}`)
          .in('status', ['pending', 'verified'])
          .limit(1)
          .maybeSingle();
        return {
          id: item.id,
          fullName: item.full_name,
          phoneNumber: item.phone_number,
          profilePicture: item.profile_picture,
          isRegisteredUser: true,
          relationshipType: rel?.type,
          relationshipStatus: rel?.status,
          relationshipPrivacy: rel?.privacy_level,
          partnerName: rel?.partner_name,
        } as SearchResult;
      }));
      setSearchResults(mapped);
    } finally {
      setIsSearching(false);
    }
  };

  const createPost = async () => {
    if (!supabase || !user || !postDraft.trim()) return;
    setIsCreatingContent(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content: postDraft.trim(), media_urls: [], media_type: 'text' })
        .select('id,user_id,content,media_urls,media_type,comment_count,created_at')
        .single();
      if (error) throw error;
      setPosts((prev) => [{ ...data, users: { full_name: user.full_name, profile_picture: user.profile_picture }, likes: [] }, ...prev]);
      setPostDraft('');
      setReactionNotice('Post created');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/feed');
    } finally {
      setIsCreatingContent(false);
    }
  };

  const createReel = async () => {
    if (!supabase || !user || !reelDraft.videoUrl.trim()) return;
    setIsCreatingContent(true);
    try {
      const { data, error } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          video_url: reelDraft.videoUrl.trim(),
          thumbnail_url: reelDraft.thumbnailUrl.trim() || null,
          caption: reelDraft.caption.trim(),
        })
        .select('id,user_id,caption,video_url,thumbnail_url,created_at')
        .single();
      if (error) throw error;
      setReels((prev) => [{ ...data, users: { full_name: user.full_name, profile_picture: user.profile_picture }, likes: [] }, ...prev]);
      setReelDraft({ caption: '', videoUrl: '', thumbnailUrl: '' });
      setReactionNotice('Reel created');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/reels');
    } finally {
      setIsCreatingContent(false);
    }
  };

  const openCommittedAI = async () => {
    if (!supabase || !user || !aiPrompt.trim()) return;
    setIsCreatingContent(true);
    try {
      const { data: aiUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'ai@committed.app')
        .maybeSingle();
      if (!aiUser?.id) {
        setReactionNotice('Committed AI is not configured yet');
        window.setTimeout(() => setReactionNotice(null), 2200);
        return;
      }
      let { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .contains('participant_ids', [user.id, aiUser.id])
        .limit(1)
        .maybeSingle();
      if (!existing?.id) {
        const created = await supabase
          .from('conversations')
          .insert({ participant_ids: [user.id, aiUser.id], last_message: aiPrompt.trim(), last_message_at: new Date().toISOString() })
          .select('id')
          .single();
        existing = created.data;
      }
      if (existing?.id) {
        await supabase.from('messages').insert({
          conversation_id: existing.id,
          sender_id: user.id,
          receiver_id: aiUser.id,
          content: aiPrompt.trim(),
          message_type: 'text',
        });
        setAiPrompt('');
        setReactionNotice('Sent to Committed AI');
        window.setTimeout(() => setReactionNotice(null), 1800);
        await loadAppData();
      }
    } finally {
      setIsCreatingContent(false);
    }
  };

  const saveSettings = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: settingsForm.fullName.trim(), phone_number: settingsForm.phoneNumber.trim() })
        .eq('id', user.id);
      if (error) throw error;
      setUser((prev) => prev ? { ...prev, full_name: settingsForm.fullName.trim(), phone_number: settingsForm.phoneNumber.trim() } : prev);
      setReactionNotice('Settings saved');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const saveDatingProfile = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('dating_profiles')
        .upsert({
          user_id: user.id,
          bio: datingForm.bio.trim(),
          age: datingForm.age ? Number(datingForm.age) : null,
          location_city: datingForm.city.trim() || null,
          location_country: datingForm.country.trim() || null,
          looking_for: datingForm.lookingFor,
          age_range_min: Number(datingForm.minAge || 18),
          age_range_max: Number(datingForm.maxAge || 99),
          max_distance_km: Number(datingForm.distance || 50),
          religion: datingForm.religion.trim() || null,
          intention_tag: datingForm.intention,
          is_active: true,
        }, { onConflict: 'user_id' });
      if (error) throw error;
      setReactionNotice('Dating saved');
      window.setTimeout(() => setReactionNotice(null), 1800);
      await loadAppData();
    } finally {
      setSaving(false);
    }
  };

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setReactionNotice('Location is not available');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setReactionNotice('Location detected. Add your city to improve matches.');
        window.setTimeout(() => setReactionNotice(null), 2200);
      },
      () => {
        setReactionNotice('Allow location or type your city');
        window.setTimeout(() => setReactionNotice(null), 2200);
      }
    );
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
              <Link href="/app/dating/likes-received" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-red-500">
                <Heart className="h-5 w-5" />
              </Link>
              <Link href="/app/dating/filters" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900">
                <Settings className="h-5 w-5" />
              </Link>
            </>
          ) : activeTab === 'feed' ? (
            <Link href="/app/create-post" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-blue-600">
              <Camera className="h-5 w-5" />
            </Link>
          ) : (
            <button type="button" onClick={() => setShowHeaderMenu((prev) => !prev)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-700">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )}
        </div>
        {showHeaderMenu ? (
          <div className="absolute right-3 top-14 z-50 w-56 rounded-[18px] border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 shadow-2xl">
            <Link href="/app/create-post" className="block rounded-xl px-3 py-3 hover:bg-slate-50" onClick={() => setShowHeaderMenu(false)}>Create post</Link>
            <Link href="/app/create-reel" className="block rounded-xl px-3 py-3 hover:bg-slate-50" onClick={() => setShowHeaderMenu(false)}>Create reel</Link>
            <Link href="/app/settings" className="block rounded-xl px-3 py-3 hover:bg-slate-50" onClick={() => setShowHeaderMenu(false)}>Settings</Link>
            {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'moderator') ? (
              <Link href="/app/admin" className="block rounded-xl px-3 py-3 hover:bg-slate-50" onClick={() => setShowHeaderMenu(false)}>Admin</Link>
            ) : null}
          </div>
        ) : null}
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
          { href: '/app/relationship', label: 'Register', icon: Shield, text: 'Register relationship' },
          { href: '/app/professionals', label: 'Professional', icon: Briefcase, text: 'Share expertise' },
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
      <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-black text-slate-950">Relationship Status</h2>
        </div>
        {relationship ? (
          <div className="mt-4 rounded-[20px] bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase text-slate-500">{relationship.status === 'verified' ? 'Verified' : 'Pending confirmation'}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${relationship.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{relationship.status}</span>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-950">{relationship.partner_name || 'Partner'}</p>
            <p className="text-sm font-semibold capitalize text-slate-500">{relationship.type || 'relationship'}</p>
          </div>
        ) : (
          <div className="mt-4 text-center">
            <Heart className="mx-auto h-14 w-14 fill-red-500 text-red-500" />
            <p className="mt-3 text-lg font-black text-slate-950">Ready to build something special?</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Registering your relationship creates a foundation of trust and transparency.</p>
            <Link href="/app/relationship" className="mt-4 inline-flex items-center gap-2 rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">
              <Plus className="h-5 w-5" />
              Get Started
            </Link>
          </div>
        )}
      </section>
      {user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'moderator' ? (
        <Link href="/app/admin" className="mt-5 flex items-center gap-3 rounded-[24px] bg-slate-950 p-5 text-white shadow-sm">
          <Settings className="h-7 w-7" />
          <div>
            <p className="text-lg font-black">Admin Dashboard</p>
            <p className="text-sm text-slate-300">Control panel</p>
          </div>
        </Link>
      ) : null}
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

  const renderCreatePost = () => (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <Avatar src={user?.profile_picture} name={user?.full_name} />
        <div>
          <p className="font-black text-slate-950">{user?.full_name || 'Committed member'}</p>
          <p className="text-sm text-slate-500">Create post</p>
        </div>
      </div>
      <textarea
        value={postDraft}
        onChange={(event) => setPostDraft(event.target.value)}
        placeholder="What is on your heart?"
        rows={8}
        className="w-full resize-none rounded-[22px] border border-slate-200 bg-white p-4 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
      <button type="button" onClick={() => void createPost()} disabled={!postDraft.trim() || isCreatingContent} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
        {isCreatingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Post
      </button>
    </div>
  );

  const renderCreateReel = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[26px] bg-slate-950 p-5 text-white">
        <Film className="h-9 w-9 text-blue-300" />
        <h2 className="mt-3 text-2xl font-black">Create Reel</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Paste a hosted video URL to publish a reel on web.</p>
      </section>
      <FormField label="Video URL" value={reelDraft.videoUrl} onChange={(videoUrl) => setReelDraft((prev) => ({ ...prev, videoUrl }))} placeholder="https://..." />
      <FormField label="Caption" value={reelDraft.caption} onChange={(caption) => setReelDraft((prev) => ({ ...prev, caption }))} multiline placeholder="Write a caption..." />
      <FormField label="Thumbnail URL" value={reelDraft.thumbnailUrl} onChange={(thumbnailUrl) => setReelDraft((prev) => ({ ...prev, thumbnailUrl }))} placeholder="Optional" />
      <button type="button" onClick={() => void createReel()} disabled={!reelDraft.videoUrl.trim() || isCreatingContent} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
        {isCreatingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Publish reel
      </button>
    </div>
  );

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

  const renderDatingLikes = () => {
    if (!datingLikes.length) {
      return <EmptyState icon={Heart} title="No Likes Yet" text="Keep swiping. When someone likes you, they will appear here." action="Start Swiping" onAction={() => router.push('/app/dating')} />;
    }
    return (
      <div className="space-y-3 px-4 py-4">
        {datingLikes.map((like) => (
          <article key={like.id} className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <Avatar src={like.user?.profile_picture} name={like.user?.full_name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{like.user?.full_name || 'Someone liked you'}</p>
              <p className="text-sm font-semibold text-slate-500">{like.is_super_like ? 'Sent a super like' : 'Liked your profile'} · {timeAgo(like.created_at)}</p>
            </div>
            <Heart className="h-6 w-6 fill-pink-500 text-pink-500" />
          </article>
        ))}
      </div>
    );
  };

  const renderDatingMatches = () => {
    if (!datingMatches.length) {
      return <EmptyState icon={Sparkles} title="No Matches Yet" text="When you both like each other, your matches will appear here." action="Start Swiping" onAction={() => router.push('/app/dating')} />;
    }
    return (
      <div className="space-y-3 px-4 py-4">
        {datingMatches.map((match) => (
          <article key={match.id} className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <Avatar src={match.user?.profile_picture} name={match.user?.full_name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{match.user?.full_name || 'Matched member'}</p>
              <p className="text-sm font-semibold text-slate-500">Matched {timeAgo(match.matched_at || match.created_at)}</p>
            </div>
            <Link href="/app/messages" className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white">
              <MessageCircle className="h-5 w-5" />
            </Link>
          </article>
        ))}
      </div>
    );
  };

  const renderDatingProfileForm = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[26px] bg-blue-50 p-5 text-blue-950 ring-1 ring-blue-100">
        <Sparkles className="h-9 w-9 text-blue-600" />
        <h2 className="mt-3 text-2xl font-black">{myDatingProfile ? 'Edit Dating Profile' : 'Create Dating Profile'}</h2>
        <p className="mt-2 text-sm leading-6 text-blue-800">Add the same profile basics used by mobile Discover.</p>
      </section>
      <FormField label="Bio" value={datingForm.bio} onChange={(bio) => setDatingForm((prev) => ({ ...prev, bio }))} multiline placeholder="Tell people about yourself..." />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Age" value={datingForm.age} onChange={(age) => setDatingForm((prev) => ({ ...prev, age }))} placeholder="31" inputMode="numeric" />
        <FormField label="Religion" value={datingForm.religion} onChange={(religion) => setDatingForm((prev) => ({ ...prev, religion }))} placeholder="Optional" />
      </div>
      <FormField label="City" value={datingForm.city} onChange={(city) => setDatingForm((prev) => ({ ...prev, city }))} placeholder="Kwekwe" />
      <FormField label="Country" value={datingForm.country} onChange={(country) => setDatingForm((prev) => ({ ...prev, country }))} placeholder="Zimbabwe" />
      <button type="button" onClick={() => void saveDatingProfile()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Save profile
      </button>
    </div>
  );

  const renderDatingFilters = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[26px] bg-blue-50 p-5 text-blue-950 ring-1 ring-blue-100">
        <Settings className="h-9 w-9 text-blue-600" />
        <h2 className="mt-3 text-2xl font-black">Find a better fit</h2>
        <p className="mt-2 text-sm leading-6 text-blue-800">These preferences save to your dating profile and guide Discover.</p>
      </section>
      <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-white p-2 ring-1 ring-slate-200">
        {['men', 'women', 'everyone'].map((option) => (
          <button key={option} type="button" onClick={() => setDatingForm((prev) => ({ ...prev, lookingFor: option }))} className={`rounded-[16px] py-3 text-sm font-black capitalize ${datingForm.lookingFor === option ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
            {option}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Min age" value={datingForm.minAge} onChange={(minAge) => setDatingForm((prev) => ({ ...prev, minAge }))} inputMode="numeric" />
        <FormField label="Max age" value={datingForm.maxAge} onChange={(maxAge) => setDatingForm((prev) => ({ ...prev, maxAge }))} inputMode="numeric" />
      </div>
      <button type="button" onClick={useBrowserLocation} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-50 py-4 text-base font-black text-blue-700 ring-1 ring-blue-200">
        <MapPin className="h-5 w-5" />
        Use current location
      </button>
      <FormField label="City" value={datingForm.city} onChange={(city) => setDatingForm((prev) => ({ ...prev, city }))} />
      <FormField label="Country" value={datingForm.country} onChange={(country) => setDatingForm((prev) => ({ ...prev, country }))} />
      <FormField label="Maximum distance (km)" value={datingForm.distance} onChange={(distance) => setDatingForm((prev) => ({ ...prev, distance }))} inputMode="numeric" />
      <div className="grid grid-cols-2 gap-2">
        {['friendship', 'dating', 'serious', 'marriage'].map((option) => (
          <button key={option} type="button" onClick={() => setDatingForm((prev) => ({ ...prev, intention: option }))} className={`rounded-[18px] px-4 py-3 text-sm font-black capitalize ${datingForm.intention === option ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {option}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => void saveDatingProfile()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Apply preferences
      </button>
    </div>
  );

  const renderSearch = () => (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-[26px] bg-blue-600 p-5 text-white">
        <Search className="h-9 w-9" />
        <h2 className="mt-4 text-2xl font-black">Search relationships</h2>
        <p className="mt-2 text-sm leading-6 text-blue-50">Search members by name or phone and see relationship verification status.</p>
      </div>
      <div className="flex gap-2">
        <input value={searchQuery} onChange={(event) => void runSearch(event.target.value)} placeholder="Search by name or phone" className="h-14 min-w-0 flex-1 rounded-[18px] border border-slate-200 bg-white px-4 font-semibold outline-none focus:border-blue-500" />
        <button type="button" onClick={() => void runSearch()} className="grid h-14 w-14 place-items-center rounded-[18px] bg-blue-600 text-white">
          {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </button>
      </div>
      <div className="space-y-3">
        {searchResults.map((item) => (
          <article key={item.id || item.fullName} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <Avatar src={item.profilePicture} name={item.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{item.fullName || 'Unknown'}</p>
              <p className="text-sm text-slate-500">{item.phoneNumber || 'No phone shown'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.relationshipStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' : item.relationshipStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                  {item.relationshipStatus || 'No record'}
                </span>
                {item.relationshipType ? <span className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-black capitalize text-pink-700">{item.relationshipType}</span> : null}
              </div>
              {item.partnerName ? <p className="mt-2 text-sm font-semibold text-slate-600">In a relationship with {item.partnerName}</p> : null}
            </div>
          </article>
        ))}
        {searchQuery && !isSearching && !searchResults.length ? <EmptyState icon={Search} title="No Results" text="Try another name or phone number." /> : null}
      </div>
    </div>
  );

  const renderNotifications = () => {
    if (!notifications.length) return <EmptyState icon={Bell} title="No Notifications" text="Likes, approvals, messages, and relationship updates will appear here." />;
    return (
      <div className="space-y-3 px-4 py-4">
        {notifications.map((notification) => {
          const href = notification.data?.postId
            ? `/post/${notification.data.postId}`
            : notification.data?.reelId
              ? `/reel/${notification.data.reelId}`
              : notification.type?.includes('message')
                ? '/app/messages'
                : notification.type?.includes('dating')
                  ? '/app/dating'
                  : '/app/notifications';
          return (
          <Link key={notification.id} href={href} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
            <div className={`mt-1 h-3 w-3 rounded-full ${notification.read ? 'bg-slate-200' : 'bg-blue-600'}`} />
            <div>
              <p className="font-black text-slate-950">{notification.title || 'Notification'}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
              <p className="mt-2 text-xs font-semibold text-slate-400">{timeAgo(notification.created_at)}</p>
            </div>
          </Link>
        );})}
      </div>
    );
  };

  const renderMessages = () => {
    return (
      <div className="space-y-2 px-3 py-3">
        <section className="rounded-[24px] bg-gradient-to-br from-slate-950 to-blue-950 p-4 text-white">
          <div className="flex items-center gap-3">
            <Sparkles className="h-7 w-7 text-blue-300" />
            <div>
              <p className="text-lg font-black">Committed AI</p>
              <p className="text-sm text-slate-300">Ask for help, guidance, or next steps.</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Ask Committed AI..." className="h-12 min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white placeholder:text-slate-400 outline-none" />
            <button type="button" onClick={() => void openCommittedAI()} className="grid h-12 w-12 place-items-center rounded-[16px] bg-blue-600">
              {isCreatingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
        </section>
        {!conversations.length ? <EmptyState icon={MessageCircle} title="No Messages Yet" text="Conversations from matches and connections will appear here." /> : null}
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
          { href: '/app/dating/profile-setup', title: 'Dating profile', text: 'Photos, bio, goals, and discovery details' },
          { href: '/app/professionals', title: 'Professionals', text: 'Bookings, profile, and approvals' },
          ...(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'moderator'
            ? [{ href: '/app/admin', title: 'Admin', text: 'Manage approvals and verification queues' }]
            : []),
        ].map((item) => (
          <Link key={item.title} href={item.href} className="block rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-black text-slate-950">{item.title}</p>
            <p className="mt-1 text-sm text-slate-500">{item.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <Avatar src={user?.profile_picture} name={user?.full_name} size="lg" />
          <div>
            <h2 className="text-2xl font-black text-slate-950">Settings</h2>
            <p className="text-sm text-slate-500">Account and profile details</p>
          </div>
        </div>
      </section>
      <FormField label="Full name" value={settingsForm.fullName} onChange={(fullName) => setSettingsForm((prev) => ({ ...prev, fullName }))} />
      <FormField label="Phone number" value={settingsForm.phoneNumber} onChange={(phoneNumber) => setSettingsForm((prev) => ({ ...prev, phoneNumber }))} />
      <button type="button" onClick={() => void saveSettings()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Save changes
      </button>
      <button
        type="button"
        onClick={async () => {
          await supabase?.auth.signOut();
          router.replace('/auth');
        }}
        className="w-full rounded-[20px] bg-red-50 py-4 text-base font-black text-red-600 ring-1 ring-red-100"
      >
        Sign out
      </button>
    </div>
  );

  const renderContent = () => {
    if (loading) return <ScreenSkeleton />;
    if (appPath[0] === 'create-post') return renderCreatePost();
    if (appPath[0] === 'create-reel') return renderCreateReel();
    if (appPath[0] === 'settings') return renderSettings();
    if (appPath[0] === 'dating-likes') return renderDatingLikes();
    if (appPath[0] === 'dating-preferences') return renderDatingFilters();
    if (appPath[0] === 'dating-profile') return renderDatingProfileForm();
    if (activeTab === 'dating' && subPath === 'likes-received') return renderDatingLikes();
    if (activeTab === 'dating' && subPath === 'matches') return renderDatingMatches();
    if (activeTab === 'dating' && subPath === 'filters') return renderDatingFilters();
    if (activeTab === 'dating' && ['profile-setup', 'profile-preview', 'photo-gallery'].includes(subPath)) return renderDatingProfileForm();
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

function FormField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      )}
    </label>
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
        <Link href={`/post/${post.id}?web=1#comments`} className="flex items-center justify-center gap-2 py-3 text-sm font-black text-slate-600">
          <MessageCircle className="h-5 w-5" />
          Comment
        </Link>
        <button type="button" onClick={() => void onShare('Committed Post', buildPostWebUrl(post.id))} className="flex items-center justify-center gap-2 py-3 text-sm font-black text-slate-600">
          <Share2 className="h-5 w-5" />
          Share
        </button>
      </div>
    </article>
  );
}
