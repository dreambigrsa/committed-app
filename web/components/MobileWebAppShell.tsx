'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { HTMLAttributes } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Ban,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  Film,
  Heart,
  Home,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  UploadCloud,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { buildPostWebUrl, buildReelWebUrl } from '@/lib/appLinks';
import { getPostVisibilityOrFilter, getReelVisibilityOrFilter } from '@/lib/content-visibility';
import { filterVisibleMessagesForUser } from '@/lib/parity-helpers';

type TabKey = 'home' | 'feed' | 'reels' | 'dating' | 'search' | 'notifications' | 'messages' | 'profile';

type WebUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  profile_picture?: string | null;
  username?: string | null;
  role?: string | null;
  verified?: boolean | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  id_verified?: boolean | null;
  banned_at?: string | null;
  banned_by?: string | null;
  ban_reason?: string | null;
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

type SocialComment = {
  id: string;
  targetId: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  content: string;
  stickerImageUrl?: string | null;
  messageType?: 'text' | 'sticker';
  likes: string[];
  createdAt?: string | null;
  parentCommentId?: string | null;
  replies?: SocialComment[];
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
  education?: string | null;
  kids?: string | null;
  smoke?: string | null;
  drink?: string | null;
  exercise?: string | null;
  pets?: string | null;
  height_cm?: number | null;
  last_active_at?: string | null;
  looking_for?: string | null;
  intention_tag?: string | null;
  users?: { full_name?: string | null; profile_picture?: string | null } | null;
  dating_photos?: { photo_url: string; is_primary?: boolean | null }[] | null;
};

type DatingDiscoveryFilters = {
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  lookingFor?: 'men' | 'women' | 'everyone';
  locationCity?: string;
  locationCountry?: string;
  intentionTags?: string[];
  religions?: string[];
  educationLevels?: string[];
  kids?: string[];
  smoke?: string[];
  drink?: string[];
  exercise?: string[];
  pets?: string[];
  interests?: string[];
  minHeightCm?: number;
  maxHeightCm?: number;
  hasPhotos?: boolean;
  verifiedOnly?: boolean;
  activeRecently?: boolean;
};

const DATING_DISCOVERY_FILTERS_KEY = 'committed:dating-discovery-filters:v1';
const RELIGION_OPTIONS = ['Christian', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Traditional', 'Spiritual', 'Agnostic', 'Atheist', 'Other'];
const EDUCATION_OPTIONS = ['High school', 'Diploma', "Bachelor's", "Master's", 'Doctorate', 'Trade/Technical', 'Self-taught'];
const KIDS_OPTIONS = ['have_kids', 'want_kids', 'dont_want_kids', 'have_and_want_more', 'not_sure'];
const LIFESTYLE_OPTIONS = {
  drink: ['no', 'sometimes'],
  smoke: ['no'],
  exercise: ['often', 'sometimes'],
  pets: ['have_pets', 'want_pets'],
} as const;
const INTEREST_OPTIONS = ['Music', 'Travel', 'Food', 'Family', 'Faith', 'Fitness', 'Movies', 'Books', 'Business', 'Adventure', 'Art', 'Dancing'];

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
  last_message_at?: string | null;
  created_at?: string | null;
  participant_ids?: string[] | null;
  participantNames?: string[];
  participantAvatars?: Record<string, string | null>;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id?: string | null;
  content?: string | null;
  message_type?: string | null;
  media_url?: string | null;
  document_url?: string | null;
  created_at?: string | null;
};

type StatusFeedItem = {
  user_id: string;
  user_name: string;
  user_avatar?: string | null;
  latest_status?: {
    id: string;
    content_type?: string | null;
    text_content?: string | null;
    media_path?: string | null;
    background_color?: string | null;
    created_at?: string | null;
  } | null;
  has_unviewed?: boolean;
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
  relationship: 'home',
  search: 'search',
  notifications: 'notifications',
  messages: 'messages',
  profile: 'profile',
  admin: 'profile',
  ads: 'profile',
  bookings: 'profile',
  professional: 'profile',
  professionals: 'profile',
  settings: 'profile',
  verification: 'profile',
  legal: 'profile',
  status: 'feed',
  post: 'feed',
  reel: 'reels',
  'create-post': 'feed',
  'create-status': 'feed',
  'create-reel': 'reels',
  'dating-likes': 'dating',
  'dating-preferences': 'dating',
  'dating-profile': 'dating',
};

const adminRouteCards = [
  ['analytics', 'Analytics', 'Product and trust metrics'],
  ['users', 'Manage Users', 'Roles, bans, restrictions, verification flags'],
  ['roles', 'Roles', 'User roles and permissions'],
  ['ban-appeals', 'Ban Appeals', 'Member appeal queue'],
  ['reports', 'Reports', 'Reported content and user issues'],
  ['disputes', 'Disputes', 'Relationship and safety disputes'],
  ['relationships', 'Manage Relationships', 'Verify, end, or remove relationships'],
  ['false-relationship-reports', 'False Reports', 'Review user reports without hiding relationships'],
  ['id-verifications', 'ID Verifications', 'Review identity documents'],
  ['face-matching', 'Face Matching', 'Face verification providers and results'],
  ['verification-services', 'Verification Services', 'Verification service configuration'],
  ['dating', 'Dating Admin', 'Dating profiles and activity'],
  ['dating-interests', 'Dating Interests', 'Interest chips available in dating'],
  ['dating-date-options', 'Date Options', 'Date suggestion options'],
  ['professional-profiles', 'Professional Profiles', 'Applications and public profiles'],
  ['professional-roles', 'Professional Roles', 'Roles professionals can apply for'],
  ['professional-sessions', 'Professional Sessions', 'Bookings and session status'],
  ['professional-reviews', 'Professional Reviews', 'Ratings and client feedback'],
  ['professional-analytics', 'Professional Analytics', 'Professional session and review metrics'],
  ['escalation-rules', 'Escalation Rules', 'Professional escalation automation'],
  ['posts-review', 'Posts Review', 'Moderation queue'],
  ['reels-review', 'Reels Review', 'Video moderation queue'],
  ['advertisements', 'Advertisements', 'Campaigns and boosted posts'],
  ['payment-methods', 'Payment Methods', 'Manual payment options'],
  ['payment-verifications', 'Payment Verifications', 'Proof and subscription approvals'],
  ['payment-proof-viewer', 'Payment Proof Viewer', 'View uploaded proof safely'],
  ['legal-policies', 'Legal Policies', 'Terms, privacy, and consent versions'],
  ['pricing', 'Pricing', 'Plans and limits'],
  ['stickers', 'Stickers', 'Sticker packs and chat assets'],
  ['trigger-words', 'Trigger Words', 'Safety trigger words'],
  ['warning-templates', 'Warning Templates', 'Reusable moderation warnings'],
  ['logs', 'Admin Logs', 'Recent admin actions'],
  ['settings', 'Admin Settings', 'Operational controls'],
] as const;

const settingsRouteCards = [
  ['2fa', 'Two-Factor Authentication', 'Protect your account'],
  ['blocked-users', 'Blocked Users', 'Manage blocked members'],
  ['become-professional', 'Become a Professional', 'Apply to offer help'],
  ['professional-availability', 'Professional Availability', 'Manage your calendar'],
  ['sessions', 'Sessions', 'Device and login sessions'],
] as const;

const verificationRouteCards = [
  ['phone', 'Phone Verification', 'Verify your number'],
  ['email', 'Email Verification', 'Confirm email delivery'],
  ['id', 'ID Verification', 'Upload identity documents'],
  ['couple-selfie', 'Couple Selfie', 'Relationship proof photo'],
] as const;

const adminGenericRoutes: Record<string, { title: string; table: string; select: string; order?: string; description: string }> = {
  analytics: { title: 'Analytics', table: 'analytics_events', select: 'id,event_name,user_id,created_at', order: 'created_at', description: 'Recent product and safety analytics events.' },
  'ban-appeals': { title: 'Ban Appeals', table: 'ban_appeals', select: 'id,user_id,restriction_id,appeal_type,restricted_feature,reason,status,admin_response,reviewed_by,reviewed_at,created_at', order: 'created_at', description: 'Member appeal queue.' },
  dating: { title: 'Dating Admin', table: 'dating_profiles', select: 'id,user_id,bio,age,location_city,location_country,is_active,show_me,admin_suspended,admin_suspended_reason,admin_limited,admin_limited_reason,premium_trial_ends_at,created_at,users!dating_profiles_user_id_fkey(full_name,email,profile_picture)', order: 'created_at', description: 'Dating profile overview.' },
  'dating-date-options': { title: 'Date Options', table: 'dating_date_options', select: 'id,title,category,is_active,created_at', order: 'created_at', description: 'Date suggestion options.' },
  'dating-interests': { title: 'Dating Interests', table: 'dating_interests', select: 'id,name,category,is_active,created_at', order: 'created_at', description: 'Interest chips available in dating.' },
  disputes: { title: 'Disputes', table: 'disputes', select: 'id,user_id,status,reason,created_at', order: 'created_at', description: 'Open disputes and resolution state.' },
  'escalation-rules': { title: 'Escalation Rules', table: 'escalation_rules', select: 'id,name,is_active,created_at', order: 'created_at', description: 'Professional escalation automation.' },
  'escalation-rules-fixed': { title: 'Escalation Rules', table: 'escalation_rules', select: 'id,name,is_active,created_at', order: 'created_at', description: 'Professional escalation automation.' },
  'face-matching': { title: 'Face Matching', table: 'face_matching_providers', select: 'id,name,is_active,created_at', order: 'created_at', description: 'Face matching provider configuration.' },
  'id-verifications': { title: 'ID Verifications', table: 'verification_documents', select: 'id,user_id,document_type,document_url,status,submitted_at,user:users!verification_documents_user_id_fkey(full_name,email)', order: 'submitted_at', description: 'Identity documents waiting for admin review.' },
  logs: { title: 'Admin Logs', table: 'activity_logs', select: 'id,user_id,action,entity_type,entity_id,created_at', order: 'created_at', description: 'Recent admin and safety activity.' },
  'payment-methods': { title: 'Payment Methods', table: 'payment_methods', select: 'id,name,type,is_active,created_at', order: 'created_at', description: 'Manual payment options.' },
  'professional-roles': { title: 'Professional Roles', table: 'professional_roles', select: 'id,name,category,is_active,created_at', order: 'created_at', description: 'Roles professionals can apply for.' },
  'professional-analytics': { title: 'Professional Analytics', table: 'professional_sessions', select: 'id,user_id,professional_id,status,scheduled_date,booking_fee_amount,payment_status,created_at', order: 'created_at', description: 'Professional sessions used for analytics.' },
  reports: { title: 'Reports', table: 'reported_content', select: 'id,reporter_id,content_type,content_id,reason,status,created_at', order: 'created_at', description: 'User and content reports.' },
  roles: { title: 'Roles', table: 'users', select: 'id,full_name,email,role,created_at', order: 'created_at', description: 'User role configuration.' },
  settings: { title: 'Admin Settings', table: 'app_settings', select: 'id,key,value,updated_at', order: 'updated_at', description: 'Operational settings.' },
  stickers: { title: 'Stickers', table: 'stickers', select: 'id,name,is_active,created_at', order: 'created_at', description: 'Sticker packs and chat assets.' },
  'trigger-words': { title: 'Trigger Words', table: 'trigger_words', select: 'id,word,severity,is_active,created_at', order: 'created_at', description: 'Safety trigger words.' },
  'verification-services': { title: 'Verification Services', table: 'verification_service_configs', select: 'id,service_name,is_enabled,created_at', order: 'created_at', description: 'Verification service configuration.' },
  'warning-templates': { title: 'Warning Templates', table: 'warning_templates', select: 'id,title,severity,is_active,created_at', order: 'created_at', description: 'Reusable moderation warnings.' },
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

function looksLikeUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function nestSocialComments(rows: any[], likesRows: any[], targetColumn: 'post_id' | 'reel_id') {
  const likesByComment = new Map<string, string[]>();
  (likesRows || []).forEach((like: any) => {
    const commentId = String(like.comment_id || '');
    if (!commentId) return;
    likesByComment.set(commentId, [...(likesByComment.get(commentId) || []), like.user_id].filter(Boolean));
  });

  const all: SocialComment[] = (rows || []).map((comment: any) => ({
    id: comment.id,
    targetId: comment[targetColumn],
    userId: comment.user_id,
    userName: comment.users?.full_name || comment.users?.email || 'Committed member',
    userAvatar: comment.users?.profile_picture || null,
    content: comment.content || '',
    stickerImageUrl: comment.stickers?.image_url || null,
    messageType: comment.message_type || 'text',
    likes: likesByComment.get(comment.id) || [],
    createdAt: comment.created_at,
    parentCommentId: comment.parent_comment_id || null,
    replies: [],
  }));
  const topLevel: SocialComment[] = [];
  const byId = new Map(all.map((comment) => [comment.id, comment]));
  all.forEach((comment) => {
    if (comment.parentCommentId && byId.has(comment.parentCommentId)) {
      byId.get(comment.parentCommentId)?.replies?.push(comment);
    } else {
      topLevel.push(comment);
    }
  });
  return topLevel;
}

function getDateStringFromParts(day?: string, month?: string, year?: string) {
  if (!day || !month || !year) return undefined;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!d || !m || !y) return undefined;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normalizeRole(role?: string | null) {
  return (role || '').trim().toLowerCase();
}

function isAdminRole(role?: string | null) {
  return ['admin', 'super_admin', 'moderator'].includes(normalizeRole(role));
}

function getUserDisplayName(user?: { full_name?: string | null; username?: string | null; email?: string | null } | null) {
  if (!user) return 'Committed member';
  if (user.username?.trim()) return user.username.trim();
  if (user.full_name?.trim() && !user.full_name.includes('@')) return user.full_name.trim();
  if (user.email?.includes('@')) return user.email.split('@')[0] || 'Committed member';
  if (user.full_name?.includes('@')) return user.full_name.split('@')[0] || 'Committed member';
  return user.email || 'Committed member';
}

function getCommittedAIReply(
  input: string,
  history: MessageRow[] = [],
  currentUser?: { full_name?: string | null; username?: string | null; email?: string | null } | null
) {
  const trimmed = input.trim();
  const value = trimmed.toLowerCase();
  const userDisplayName = getUserDisplayName(currentUser);
  const recentUserInputs = history
    .filter((item) => item.sender_id !== 'committed-ai' && item.sender_id !== 'ai@committed.app')
    .map((item) => (item.content || '').trim().toLowerCase())
    .filter(Boolean);
  const previousPrompt = recentUserInputs.length > 1 ? recentUserInputs[recentUserInputs.length - 2] : '';
  const isRepeatPrompt = !!previousPrompt && previousPrompt === value;

  if ((value.includes('register') || value.includes('registration')) && value.includes('relationship')) {
    return 'I can guide you now: open Home > Register relationship, add partner details and photo, choose relationship type/privacy, then submit. If you want, I will walk you field-by-field.';
  }
  if (value.includes('dating') || value.includes('match') || value.includes('swipe')) {
    return 'For dating: open Dating, complete profile setup, then use Discover to like/pass. You can open Filters to widen age, distance, and location if cards look limited.';
  }
  if (value.includes('verify') || value.includes('verification') || value.includes('id card') || value.includes('selfie')) {
    return 'Open Verification and complete this order: Phone -> Email -> ID -> Couple Selfie. Tell me which step you are on and I will guide that exact screen.';
  }
  if (value.includes('message') || value.includes('chat') || value.includes('ai')) {
    return 'I can help with messaging. Share what is failing (not sending, duplicate replies, delay, or blank thread) and I will give direct troubleshooting steps.';
  }
  if (value.includes('settings') || value.includes('privacy') || value.includes('security')) {
    return 'Go to Settings for profile photo, privacy/security controls, blocked users, sessions, and 2FA. Tell me what you want to change and I will map the exact path.';
  }
  if (value.includes('admin') || value.includes('dashboard') || value.includes('moderation')) {
    return 'If you are an admin/moderator, open Profile > Admin to manage users, relationship reviews, posts/reels moderation, and payment verifications.';
  }
  const asksName =
    /\b(my name|know my name|what('?s| is) my name|who am i)\b/.test(value) ||
    (value.includes('name') && value.includes('account'));
  if (asksName) {
    return `Yes. Your account name is ${userDisplayName}. If this is not correct, update it in Settings and I will use the new name.`;
  }

  const preview = trimmed.length > 90 ? `${trimmed.slice(0, 90)}...` : trimmed;
  if (isRepeatPrompt) {
    return `I saw the same message again: "${preview}". I understand. Pick one and I will guide it now: Dating, Relationship Registration, Verification, Settings, or Admin.`;
  }
  return `Understood: "${preview}". I can help with Dating, Relationship Registration, Verification, Settings, or Admin. Tell me which flow you want step-by-step.`;
}

function Avatar({ src, name, size = 'md' }: { src?: string | null; name?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} className={`${sizeClass} rounded-full object-cover`} />;
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
  secondaryAction,
  onSecondaryAction,
}: {
  icon: typeof Heart;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <div className="flex min-h-[54vh] flex-col items-center justify-center px-8 text-center">
      <Icon className="h-20 w-20 text-slate-300" strokeWidth={1.8} />
      <h2 className="mt-5 text-3xl font-bold text-slate-900">{title}</h2>
      <p className="mt-3 text-base leading-6 text-slate-500">{text}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {action && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-[18px] bg-blue-600 px-9 py-4 text-base font-black text-white shadow-xl shadow-blue-600/20 active:scale-[0.98]"
          >
            {action}
          </button>
        ) : null}
        {secondaryAction && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="rounded-[18px] border border-slate-300 bg-white px-7 py-4 text-base font-black text-slate-700 shadow-sm active:scale-[0.98]"
          >
            {secondaryAction}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function MobileWebAppShell({ initialTab = 'home' }: { initialTab?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<WebUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [routePost, setRoutePost] = useState<FeedPost | null>(null);
  const [routePostLoading, setRoutePostLoading] = useState(false);
  const [routeReel, setRouteReel] = useState<Reel | null>(null);
  const [routeReelLoading, setRouteReelLoading] = useState(false);
  const [postCommentsByPost, setPostCommentsByPost] = useState<Record<string, SocialComment[]>>({});
  const [reelCommentsByReel, setReelCommentsByReel] = useState<Record<string, SocialComment[]>>({});
  const [commentsLoadingByTarget, setCommentsLoadingByTarget] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [commentSubmittingKey, setCommentSubmittingKey] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<RelationshipRow | null>(null);
  const [datingProfiles, setDatingProfiles] = useState<DatingProfile[]>([]);
  const [myDatingProfile, setMyDatingProfile] = useState<DatingProfile | null>(null);
  const [routeDatingProfile, setRouteDatingProfile] = useState<any>(null);
  const [routeDatingProfileLoading, setRouteDatingProfileLoading] = useState(false);
  const [routeDatingReaction, setRouteDatingReaction] = useState({ liked: false, superLiked: false, matched: false });
  const [routeDatingBadges, setRouteDatingBadges] = useState<any[]>([]);
  const [routeConversationStarters, setRouteConversationStarters] = useState<string[]>([]);
  const [datingLikes, setDatingLikes] = useState<DatingLike[]>([]);
  const [datingMatches, setDatingMatches] = useState<DatingMatch[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, MessageRow[]>>({});
  const [routeConversationLoading, setRouteConversationLoading] = useState(false);
  const [statusFeed, setStatusFeed] = useState<StatusFeedItem[]>([]);
  const [adminRelationships, setAdminRelationships] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<WebUser[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [dateRequests, setDateRequests] = useState<any[]>([]);
  const [dateRequestTab, setDateRequestTab] = useState<'received' | 'sent'>('received');
  const [legalDocuments, setLegalDocuments] = useState<any[]>([]);
  const [adminPosts, setAdminPosts] = useState<any[]>([]);
  const [adminReels, setAdminReels] = useState<any[]>([]);
  const [professionalApplications, setProfessionalApplications] = useState<any[]>([]);
  const [falseRelationshipReports, setFalseRelationshipReports] = useState<any[]>([]);
  const [paymentSubmissions, setPaymentSubmissions] = useState<any[]>([]);
  const [adReceipts, setAdReceipts] = useState<any[]>([]);
  const [professionalProfile, setProfessionalProfile] = useState<any>(null);
  const [professionalStatus, setProfessionalStatus] = useState<any>(null);
  const [professionalReviews, setProfessionalReviews] = useState<any[]>([]);
  const [adminProfessionalSessions, setAdminProfessionalSessions] = useState<any[]>([]);
  const [adminProfessionalReviews, setAdminProfessionalReviews] = useState<any[]>([]);
  const [professionalDirectory, setProfessionalDirectory] = useState<any[]>([]);
  const [professionalRoles, setProfessionalRoles] = useState<any[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [twoFactorRecord, setTwoFactorRecord] = useState<any>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [routeProfileUser, setRouteProfileUser] = useState<WebUser | null>(null);
  const [routeProfileLoading, setRouteProfileLoading] = useState(false);
  const [routeProfilePosts, setRouteProfilePosts] = useState<FeedPost[]>([]);
  const [routeStatusItem, setRouteStatusItem] = useState<StatusFeedItem | null>(null);
  const [routeStatusLoading, setRouteStatusLoading] = useState(false);
  const [routeRows, setRouteRows] = useState<any[]>([]);
  const [routeRowsLoading, setRouteRowsLoading] = useState(false);
  const [routeRowsError, setRouteRowsError] = useState<string | null>(null);
  const [feedLimit, setFeedLimit] = useState(5);
  const [datingIndex, setDatingIndex] = useState(0);
  const [datingDebug, setDatingDebug] = useState<{
    initial: number;
    afterInitialFilters: number;
    likedExcluded: number;
    passedExcluded: number;
    fallbackRuns: number;
    final: number;
    lastError?: string | null;
  }>({
    initial: 0,
    afterInitialFilters: 0,
    likedExcluded: 0,
    passedExcluded: 0,
    fallbackRuns: 0,
    final: 0,
    lastError: null,
  });
  const [reactionNotice, setReactionNotice] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [reelDraft, setReelDraft] = useState({ caption: '', videoUrl: '', thumbnailUrl: '' });
  const [postImageUrl, setPostImageUrl] = useState('');
  const [reelVideoUrl, setReelVideoUrl] = useState('');
  const [reelThumbnailUploadUrl, setReelThumbnailUploadUrl] = useState('');
  const [datingPhotoUrl, setDatingPhotoUrl] = useState('');
  const [relationshipPhotoUrl, setRelationshipPhotoUrl] = useState('');
  const [statusMediaUrl, setStatusMediaUrl] = useState('');
  const [settingsProfilePictureUrl, setSettingsProfilePictureUrl] = useState('');
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [adForm, setAdForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    ctaType: 'website',
    ctaUrl: '',
    ctaPhone: '',
    ctaMessage: '',
    placement: 'feed',
    dailyBudget: '5',
    totalBudget: '20',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    locations: '',
    ageMin: '18',
    ageMax: '65',
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatMediaUrl, setChatMediaUrl] = useState('');
  const [chatDocumentUrl, setChatDocumentUrl] = useState('');
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ fullName: '', username: '', phoneNumber: '' });
  const lastAuthUserIdRef = useRef<string | null>(null);
  const [relationshipForm, setRelationshipForm] = useState({
    partnerName: '',
    partnerPhone: '',
    type: 'serious',
    startDate: '',
    startDay: '',
    startMonth: '',
    startYear: '',
    partnerBirthDay: '',
    partnerBirthMonth: '',
    partnerBirthYear: '',
    privacy: 'verified_people',
    city: '',
    consent: false,
  });
  const [relationshipStep, setRelationshipStep] = useState(1);
  const [datingProfileStep, setDatingProfileStep] = useState(1);
  const [showDatingReviewModal, setShowDatingReviewModal] = useState(false);
  const [showRelationshipReviewModal, setShowRelationshipReviewModal] = useState(false);
  const [relationshipStepAnim, setRelationshipStepAnim] = useState({ opacity: 1, y: 0 });
  const [datingStepAnim, setDatingStepAnim] = useState({ opacity: 1, y: 0 });
  const [verificationForm, setVerificationForm] = useState({ email: '', phone: '', code: '', generatedCode: '', documentUrl: '' });
  const [dateForm, setDateForm] = useState({
    recipientId: '',
    title: '',
    description: '',
    location: '',
    proposedDate: '',
    proposedTime: '',
    durationHours: '2',
    dressCode: '',
    budgetRange: '',
    expenseHandling: 'split',
    specialRequests: '',
  });
  const [bookingForm, setBookingForm] = useState({
    professionalId: '',
    roleId: '',
    conversationId: '',
    date: '',
    time: '',
    durationMinutes: '60',
    locationType: 'online',
    locationAddress: '',
    locationNotes: '',
    bookingNotes: '',
    feeAmount: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    planId: '',
    methodId: '',
    proofUrl: '',
    reference: '',
    notes: '',
  });
  const [professionalApplicationForm, setProfessionalApplicationForm] = useState({
    roleId: '',
    specialty: '',
    experience: '',
    bio: '',
    credentialsUrl: '',
    rate: '',
  });
  const [professionalAvailabilityForm, setProfessionalAvailabilityForm] = useState({
    status: 'offline',
    maxConcurrentSessions: '3',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    quietHoursTimezone: 'UTC',
    onlineAvailability: true,
    inPersonAvailability: false,
    pricingEnabled: false,
    pricingCurrency: 'USD',
    pricingRate: '',
    pricingUnit: 'session',
  });
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
  const [datingFilters, setDatingFilters] = useState<DatingDiscoveryFilters>({
    minAge: 18,
    maxAge: 99,
    maxDistance: 50,
    lookingFor: 'everyone',
    locationCity: '',
    locationCountry: '',
    intentionTags: [],
    religions: [],
    educationLevels: [],
    kids: [],
    drink: [],
    smoke: [],
    exercise: [],
    pets: [],
    interests: [],
    minHeightCm: undefined,
    maxHeightCm: undefined,
    hasPhotos: false,
    verifiedOnly: false,
    activeRecently: false,
  });
  const [saving, setSaving] = useState(false);

  const pathSegments = useMemo(() => pathname?.split('/').filter(Boolean) || [], [pathname]);
  const appPath = useMemo(() => {
    if (pathSegments[0] === 'app') return pathSegments.slice(1);
    return pathSegments;
  }, [pathSegments]);

  const activeTab = useMemo<TabKey>(() => {
    const segment = appPath[0] || initialTab;
    return routeToTab[segment] || routeToTab[initialTab] || 'home';
  }, [appPath, initialTab]);

  const subPath = appPath.slice(1).join('/');

  const supabase = useMemo<any>(() => {
    try {
      return getSupabaseBrowser() as any;
    } catch {
      return null;
    }
  }, []);

  const resetUserScopedState = useCallback(() => {
    setUser(null);
    setPosts([]);
    setReels([]);
    setRoutePost(null);
    setRoutePostLoading(false);
    setRouteReel(null);
    setRouteReelLoading(false);
    setPostCommentsByPost({});
    setReelCommentsByReel({});
    setCommentsLoadingByTarget({});
    setCommentDrafts({});
    setReplyDrafts({});
    setCommentSubmittingKey(null);
    setRelationship(null);
    setDatingProfiles([]);
    setMyDatingProfile(null);
    setRouteDatingProfile(null);
    setRouteDatingProfileLoading(false);
    setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
    setRouteDatingBadges([]);
    setRouteConversationStarters([]);
    setDatingLikes([]);
    setDatingMatches([]);
    setNotifications([]);
    setConversations([]);
    setMessagesByConversation({});
    setRouteConversationLoading(false);
    setStatusFeed([]);
    setAdminRelationships([]);
    setAdminUsers([]);
    setBlockedUsers([]);
    setBookings([]);
    setAds([]);
    setDateRequests([]);
    setDateRequestTab('received');
    setAdminPosts([]);
    setAdminReels([]);
    setProfessionalApplications([]);
    setFalseRelationshipReports([]);
    setPaymentSubmissions([]);
    setAdReceipts([]);
    setProfessionalProfile(null);
    setProfessionalStatus(null);
    setProfessionalReviews([]);
    setProfessionalAvailabilityForm({
      status: 'offline',
      maxConcurrentSessions: '3',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      quietHoursTimezone: 'UTC',
      onlineAvailability: true,
      inPersonAvailability: false,
      pricingEnabled: false,
      pricingCurrency: 'USD',
      pricingRate: '',
      pricingUnit: 'session',
    });
    setAdminProfessionalSessions([]);
    setAdminProfessionalReviews([]);
    setProfessionalDirectory([]);
    setTwoFactorRecord(null);
    setTwoFactorSecret('');
    setTwoFactorBackupCodes([]);
    setTwoFactorCode('');
    setActiveSessions([]);
    setRouteProfileUser(null);
    setRouteProfileLoading(false);
    setRouteProfilePosts([]);
    setRouteStatusItem(null);
    setRouteStatusLoading(false);
    setRouteRows([]);
    setSearchResults([]);
    setSettingsForm({ fullName: '', username: '', phoneNumber: '' });
    setSettingsProfilePictureUrl('');
    setChatDraft('');
    setChatMediaUrl('');
    setChatDocumentUrl('');
  }, []);

  useEffect(() => {
    setRelationshipStepAnim({ opacity: 0, y: 12 });
    const frame = window.requestAnimationFrame(() => {
      setRelationshipStepAnim({ opacity: 1, y: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [relationshipStep]);

  useEffect(() => {
    setDatingStepAnim({ opacity: 0, y: 12 });
    const frame = window.requestAnimationFrame(() => {
      setDatingStepAnim({ opacity: 1, y: 0 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [datingProfileStep]);

  const resolveAuthUser = useCallback(async () => {
    if (!supabase) return null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [
        { data: auth, error: authError },
        {
          data: { session },
        },
      ] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
      const authUser = auth.user || session?.user || null;
      if (authUser) {
        return { authUser, authError: null };
      }
      if (attempt < 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      } else {
        return { authUser: null, authError };
      }
    }
    return { authUser: null, authError: null };
  }, [supabase]);

  const loadAppData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const authState = await resolveAuthUser();
      const authUser = authState?.authUser || null;
      const authError = authState?.authError || null;
      console.debug('[WebAppShell] Authenticated user object', {
        id: authUser?.id ?? null,
        email: authUser?.email ?? null,
        error: authError?.message ?? null,
      });
      if (!authUser) {
        lastAuthUserIdRef.current = null;
        resetUserScopedState();
        router.replace('/auth');
        return;
      }

      if (lastAuthUserIdRef.current && lastAuthUserIdRef.current !== authUser.id) {
        console.debug('[WebAppShell] Auth user changed; clearing previous user-scoped web state', {
          previousUserId: lastAuthUserIdRef.current,
          nextUserId: authUser.id,
        });
        resetUserScopedState();
      }
      lastAuthUserIdRef.current = authUser.id;

      const { data: profile } = await supabase
        .from('users')
        .select('id, full_name, username, email, phone_number, profile_picture, role, verified, email_verified, phone_verified, id_verified, banned_at, banned_by, ban_reason')
        .eq('id', authUser.id)
        .maybeSingle();
      console.debug('[WebAppShell] Profile fetch response', {
        requestedUserId: authUser.id,
        profileUserId: profile?.id ?? null,
        email: profile?.email ?? null,
        fullName: profile?.full_name ?? null,
        username: profile?.username ?? null,
        hasProfilePicture: !!profile?.profile_picture,
      });

      if (!profile) {
        // Ensure a user profile row exists for the authenticated account so web and mobile stay aligned.
        const metadataRole = typeof authUser.user_metadata?.role === 'string' ? authUser.user_metadata.role : null;
        await supabase.from('users').upsert(
          {
            id: authUser.id,
            full_name: authUser.email || 'Committed member',
            username: null,
            email: authUser.email || null,
            phone_number: authUser.phone || null,
            role: metadataRole || 'user',
            profile_picture:
              authUser.user_metadata?.profile_picture ||
              authUser.user_metadata?.avatar_url ||
              authUser.user_metadata?.picture ||
              null,
            email_verified: !!authUser.email_confirmed_at,
            phone_verified: !!authUser.phone_confirmed_at,
          },
          { onConflict: 'id' }
        );
      }

      const resolvedProfile = profile || {
        id: authUser.id,
        full_name: authUser.email || 'Committed member',
        username: null,
        email: authUser.email || null,
        phone_number: authUser.phone || null,
        profile_picture:
          authUser.user_metadata?.profile_picture ||
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          null,
        role: (typeof authUser.user_metadata?.role === 'string' ? authUser.user_metadata.role : 'user'),
        verified: null,
        email_verified: !!authUser.email_confirmed_at,
        phone_verified: !!authUser.phone_confirmed_at,
        id_verified: null,
        banned_at: null,
        banned_by: null,
        ban_reason: null,
      };

      const currentUser: WebUser = {
        id: authUser.id,
        full_name: resolvedProfile.full_name || resolvedProfile.username || authUser.email || 'Committed member',
        email: resolvedProfile.email || authUser.email,
        phone_number: resolvedProfile.phone_number,
        profile_picture:
          resolvedProfile.profile_picture ||
          authUser.user_metadata?.profile_picture ||
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          null,
        username: resolvedProfile.username,
        role: resolvedProfile.role || (typeof authUser.user_metadata?.role === 'string' ? authUser.user_metadata.role : 'user'),
        verified: resolvedProfile.verified,
        email_verified: resolvedProfile.email_verified ?? !!authUser.email_confirmed_at,
        phone_verified: resolvedProfile.phone_verified ?? !!authUser.phone_confirmed_at,
        id_verified: resolvedProfile.id_verified,
        banned_at: resolvedProfile.banned_at,
        banned_by: resolvedProfile.banned_by,
        ban_reason: resolvedProfile.ban_reason,
      };
      setUser(currentUser);
      setSettingsForm({
        fullName: currentUser.full_name || '',
        username: currentUser.username || '',
        phoneNumber: currentUser.phone_number || '',
      });
      setSettingsProfilePictureUrl(currentUser.profile_picture || '');
      setVerificationForm((prev) => ({
        ...prev,
        email: resolvedProfile.email || authUser.email || '',
        phone: resolvedProfile.phone_number || authUser.phone || '',
      }));
      console.debug('[WebAppShell] User ID used in queries', {
        userId: authUser.id,
        email: authUser.email ?? null,
      });

      const [postsResult, reelsResult, relationshipResult, myDatingResult, datingResult, notificationsResult, conversationsResult, likesResult, matchesResult] = await Promise.all([
        supabase
          .from('posts')
          .select('id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,profile_picture)')
          .or(getPostVisibilityOrFilter(authUser.id))
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('reels')
          .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,profile_picture)')
          .or(getReelVisibilityOrFilter(authUser.id))
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
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,intention_tag,looking_for,age_range_min,age_range_max,max_distance_km')
          .eq('user_id', authUser.id)
          .maybeSingle(),
        supabase
          .from('dating_profiles')
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,intention_tag,is_active')
          .eq('is_active', true)
          .neq('user_id', authUser.id)
          .limit(50),
        supabase
          .from('notifications')
          .select('id,title,message,created_at,read,type,data')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('conversations')
          .select('id,last_message,last_message_at,created_at,participant_ids')
          .contains('participant_ids', [authUser.id])
          .order('last_message_at', { ascending: false })
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
      let savedDiscoveryFilters: DatingDiscoveryFilters = {};
      try {
        const raw = window.localStorage.getItem(DATING_DISCOVERY_FILTERS_KEY);
        savedDiscoveryFilters = raw ? JSON.parse(raw) : {};
      } catch {
        savedDiscoveryFilters = {};
      }
      const ownMinAge = Number(savedDiscoveryFilters.minAge ?? ownDating?.age_range_min ?? 18);
      const ownMaxAge = Number(savedDiscoveryFilters.maxAge ?? ownDating?.age_range_max ?? 99);
      const ownCity = String(savedDiscoveryFilters.locationCity ?? ownDating?.location_city ?? '').trim();
      const ownCountry = String(savedDiscoveryFilters.locationCountry ?? ownDating?.location_country ?? '').trim();
      const ownLookingFor = String(savedDiscoveryFilters.lookingFor ?? ownDating?.looking_for ?? 'everyone').toLowerCase();
      const intentionTags = savedDiscoveryFilters.intentionTags || [];
      const religions = savedDiscoveryFilters.religions || [];
      const educationLevels = savedDiscoveryFilters.educationLevels || [];
      const kidsFilter = savedDiscoveryFilters.kids || [];
      const smokeFilter = savedDiscoveryFilters.smoke || [];
      const drinkFilter = savedDiscoveryFilters.drink || [];
      const exerciseFilter = savedDiscoveryFilters.exercise || [];
      const petsFilter = savedDiscoveryFilters.pets || [];
      const interestsFilter = savedDiscoveryFilters.interests || [];
      const minHeightCm = savedDiscoveryFilters.minHeightCm;
      const maxHeightCm = savedDiscoveryFilters.maxHeightCm;
      const hasPhotos = !!savedDiscoveryFilters.hasPhotos;
      const verifiedOnly = !!savedDiscoveryFilters.verifiedOnly;
      const activeRecently = !!savedDiscoveryFilters.activeRecently;

      setDatingFilters({
        minAge: ownMinAge,
        maxAge: ownMaxAge,
        maxDistance: Number(savedDiscoveryFilters.maxDistance ?? ownDating?.max_distance_km ?? 50),
        lookingFor: (ownLookingFor as 'men' | 'women' | 'everyone'),
        locationCity: ownCity,
        locationCountry: ownCountry,
        intentionTags,
        religions,
        educationLevels,
        kids: kidsFilter,
        smoke: smokeFilter,
        drink: drinkFilter,
        exercise: exerciseFilter,
        pets: petsFilter,
        interests: interestsFilter,
        minHeightCm,
        maxHeightCm,
        hasPhotos,
        verifiedOnly,
        activeRecently,
      });

      const applyProfileFilters = (rows: DatingProfile[]) => {
        return rows.filter((item) => {
          if (!item?.user_id || item.user_id === authUser.id) return false;
          if (typeof item.age === 'number') {
            if (item.age < ownMinAge || item.age > ownMaxAge) return false;
          }
          if (ownCity && item.location_city && !item.location_city.toLowerCase().includes(ownCity.toLowerCase())) return false;
          if (ownCountry && item.location_country && !item.location_country.toLowerCase().includes(ownCountry.toLowerCase())) return false;
          if (ownLookingFor !== 'everyone') {
            const itemLookingFor = String((item as any).looking_for || 'everyone').toLowerCase();
            if (itemLookingFor !== 'everyone' && itemLookingFor !== ownLookingFor) return false;
          }
          if (intentionTags.length && (!item.intention_tag || !intentionTags.includes(item.intention_tag))) return false;
          if (religions.length && (!item.religion || !religions.includes(item.religion))) return false;
          if (educationLevels.length && (!item.education || !educationLevels.includes(item.education))) return false;
          if (kidsFilter.length && (!item.kids || !kidsFilter.includes(item.kids))) return false;
          if (smokeFilter.length && (!item.smoke || !smokeFilter.includes(item.smoke))) return false;
          if (drinkFilter.length && (!item.drink || !drinkFilter.includes(item.drink))) return false;
          if (exerciseFilter.length && (!item.exercise || !exerciseFilter.includes(item.exercise))) return false;
          if (petsFilter.length && (!item.pets || !petsFilter.includes(item.pets))) return false;
          if (interestsFilter.length) {
            const itemInterests = item.interests || [];
            if (!interestsFilter.some((interest) => itemInterests.includes(interest))) return false;
          }
          if (typeof minHeightCm === 'number' && typeof item.height_cm === 'number' && item.height_cm < minHeightCm) return false;
          if (typeof maxHeightCm === 'number' && typeof item.height_cm === 'number' && item.height_cm > maxHeightCm) return false;
          if (activeRecently && (!item.last_active_at || new Date(item.last_active_at).getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000)) return false;
          return true;
        });
      };

      let discoveryError: string | null = null;
      const queryDiscoveryRows = async () => {
        // Try strict discovery first, then progressively relax to avoid false "empty" states.
        const strict = await supabase
          .from('dating_profiles')
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,intention_tag,looking_for,is_active')
          .eq('is_active', true)
          .neq('user_id', authUser.id)
          .limit(80);
        if (!strict.error && strict.data) {
          return applyProfileFilters((strict.data as DatingProfile[]).filter(Boolean));
        }
        if (strict.error) discoveryError = strict.error.message || 'Strict discovery query failed';

        const relaxed = await supabase
          .from('dating_profiles')
          .select('id,user_id,bio,age,location_city,location_country,relationship_goals,interests,intention_tag,looking_for')
          .neq('user_id', authUser.id)
          .limit(80);
        if (!relaxed.error && relaxed.data) {
          return applyProfileFilters((relaxed.data as DatingProfile[]).filter(Boolean));
        }
        if (relaxed.error) discoveryError = relaxed.error.message || discoveryError;

        return [];
      };

      const initialDiscoveryRows = ((datingResult.data || []) as DatingProfile[]).filter(Boolean);
      let discoverProfiles = applyProfileFilters(initialDiscoveryRows);
      const [sentLikesResult, sentPassesResult] = await Promise.all([
        supabase
          .from('dating_likes')
          .select('liked_id')
          .eq('liker_id', authUser.id),
        supabase
          .from('dating_passes')
          .select('passed_id')
          .eq('passer_id', authUser.id),
      ]);
      const likedUserIds = new Set<string>(
        ((sentLikesResult.data || []) as Array<{ liked_id?: string | null }>).map((row) => row.liked_id || '').filter(Boolean)
      );
      const passedUserIds = new Set<string>(
        ((sentPassesResult.data || []) as Array<{ passed_id?: string | null }>).map((row) => row.passed_id || '').filter(Boolean)
      );
      const applyDatingDiscoveryExclusions = (rows: DatingProfile[], includePassed = false) =>
        rows.filter((item) => !!item.user_id && !likedUserIds.has(item.user_id) && (includePassed || !passedUserIds.has(item.user_id)));
      const beforeExclusions = discoverProfiles.length;
      discoverProfiles = applyDatingDiscoveryExclusions(discoverProfiles);
      let fallbackRuns = 0;
      if (!discoverProfiles.length) {
        fallbackRuns += 1;
        discoverProfiles = applyDatingDiscoveryExclusions(await queryDiscoveryRows());
      }
      if (!discoverProfiles.length) {
        // Last-resort parity fallback: include previously passed profiles when discovery is exhausted.
        fallbackRuns += 1;
        discoverProfiles = applyDatingDiscoveryExclusions(await queryDiscoveryRows(), true);
      }
      const discoverUserIds = Array.from(new Set(discoverProfiles.map((item) => item.user_id).filter(Boolean)));
      const discoverProfileIds = discoverProfiles.map((item) => item.id).filter(Boolean);
      const [discoverUsersResult, discoverPhotosResult] = await Promise.all([
        discoverUserIds.length
          ? supabase
              .from('users')
              .select('id,full_name,profile_picture,id_verified,email_verified,phone_verified')
              .in('id', discoverUserIds)
          : Promise.resolve({ data: [] as Array<{ id: string; full_name?: string | null; profile_picture?: string | null }> }),
        discoverProfileIds.length
          ? supabase
              .from('dating_photos')
              .select('dating_profile_id,photo_url,is_primary,display_order')
              .in('dating_profile_id', discoverProfileIds)
              .order('is_primary', { ascending: false })
              .order('display_order', { ascending: true })
          : Promise.resolve({ data: [] as Array<{ dating_profile_id: string; photo_url: string; is_primary?: boolean | null }> }),
      ]);
      const discoverUsersById = new Map<string, { full_name?: string | null; profile_picture?: string | null }>(
        ((discoverUsersResult.data || []) as Array<{ id: string; full_name?: string | null; profile_picture?: string | null }>)
          .map((row) => [row.id, { full_name: row.full_name, profile_picture: row.profile_picture }])
      );
      const discoverPhotosByProfile = new Map<string, Array<{ photo_url: string; is_primary?: boolean | null }>>();
      ((discoverPhotosResult.data || []) as Array<{ dating_profile_id: string; photo_url: string; is_primary?: boolean | null }>).forEach((photo) => {
        const existing = discoverPhotosByProfile.get(photo.dating_profile_id) || [];
        discoverPhotosByProfile.set(photo.dating_profile_id, [...existing, { photo_url: photo.photo_url, is_primary: photo.is_primary }]);
      });
      discoverProfiles = discoverProfiles.map((item) => ({
        ...item,
        users: discoverUsersById.get(item.user_id) || null,
        dating_photos: discoverPhotosByProfile.get(item.id) || [],
      }));
      if (hasPhotos) {
        discoverProfiles = discoverProfiles.filter((item) => (item.dating_photos || []).length > 0);
      }
      if (verifiedOnly) {
        discoverProfiles = discoverProfiles.filter((item) => !!(item.users as any)?.id_verified || !!(item.users as any)?.email_verified || !!(item.users as any)?.phone_verified);
      }
      setDatingDebug({
        initial: initialDiscoveryRows.length,
        afterInitialFilters: beforeExclusions,
        likedExcluded: likedUserIds.size,
        passedExcluded: passedUserIds.size,
        fallbackRuns,
        final: discoverProfiles.length,
        lastError: discoveryError,
      });
      setDatingProfiles(discoverProfiles);
      setDatingIndex(0);
      setNotifications(((notificationsResult.data || []) as NotificationRow[]).filter(Boolean));
      const conversationRows = ((conversationsResult.data || []) as ConversationRow[]).filter(Boolean);
      const conversationIds = conversationRows.map((conversation) => conversation.id).filter(Boolean);
      const participantIds = Array.from(new Set(
        conversationRows
          .flatMap((conversation) => conversation.participant_ids || [])
          .filter((id) => id && id !== authUser.id)
      ));

      const [conversationMessagesResult, participantsResult, statusesResult] = await Promise.all([
        conversationIds.length
          ? supabase
              .from('messages')
              .select('id,conversation_id,sender_id,receiver_id,content,message_type,media_url,document_url,created_at,deleted_for_sender,deleted_for_receiver')
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        participantIds.length
          ? supabase
              .from('users')
              .select('id,full_name,email,profile_picture')
              .in('id', participantIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('statuses')
          .select('id,user_id,content_type,text_content,media_path,background_color,created_at,expires_at,archived,users!statuses_user_id_fkey(full_name,profile_picture)')
          .eq('archived', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(25),
      ]);

      const participantsMap = new Map<string, WebUser>(
        ((participantsResult.data || []) as WebUser[]).map((participant) => [participant.id, participant])
      );
      setConversations(conversationRows.map((conversation) => {
        const names = (conversation.participant_ids || [])
          .filter((id) => id !== authUser.id)
          .map((id) => participantsMap.get(id)?.full_name || participantsMap.get(id)?.email || 'Committed member');
        const avatars = Object.fromEntries(
          (conversation.participant_ids || [])
            .filter((id) => id !== authUser.id)
            .map((id) => [id, participantsMap.get(id)?.profile_picture || null])
        );
        return { ...conversation, participantNames: names, participantAvatars: avatars };
      }));

      const messagesById: Record<string, MessageRow[]> = {};
      const visibleMessages = filterVisibleMessagesForUser(((conversationMessagesResult.data || []) as MessageRow[]), authUser.id);
      visibleMessages.forEach((message) => {
        messagesById[message.conversation_id] = [...(messagesById[message.conversation_id] || []), message];
      });
      setMessagesByConversation(messagesById);

      const latestStatusByUser = new Map<string, StatusFeedItem>();
      ((statusesResult.data || []) as any[]).forEach((status) => {
        if (latestStatusByUser.has(status.user_id)) return;
        latestStatusByUser.set(status.user_id, {
          user_id: status.user_id,
          user_name: status.users?.full_name || (status.user_id === authUser.id ? 'You' : 'Committed member'),
          user_avatar: status.users?.profile_picture || null,
          latest_status: status,
          has_unviewed: status.user_id !== authUser.id,
        });
      });
      setStatusFeed(Array.from(latestStatusByUser.values()));

      if (isAdminRole(currentUser.role)) {
        const [
          adminRelationshipsResult,
          adminUsersResult,
          adsResult,
          adminPostsResult,
          adminReelsResult,
          professionalApplicationsResult,
          falseReportsResult,
          paymentSubmissionsResult,
          adminProfessionalSessionsResult,
          adminProfessionalReviewsResult,
        ] = await Promise.all([
          supabase
            .from('relationships')
            .select('id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level,verified_date,end_date,created_at,users!relationships_user_id_fkey(full_name,email,phone_number)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('users')
            .select('id,full_name,username,email,phone_number,profile_picture,role,verified,email_verified,phone_verified,id_verified,banned_at,banned_by,ban_reason')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('advertisements')
            .select('id,user_id,title,description,status,budget,daily_budget,start_date,end_date,created_at')
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('posts')
            .select('id,user_id,content,media_urls,media_type,moderation_status,rejection_reason,created_at,users!posts_user_id_fkey(full_name,profile_picture)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('reels')
            .select('id,user_id,caption,video_url,thumbnail_url,moderation_status,rejection_reason,created_at,users!reels_user_id_fkey(full_name,profile_picture)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('professional_applications')
            .select('id,user_id,role_id,application_data,status,review_notes,rejection_reason,created_at,user:users!professional_applications_user_id_fkey(full_name,email,profile_picture),role:professional_roles!professional_applications_role_id_fkey(name)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('false_relationship_reports')
            .select('id,relationship_id,reported_by,reason,details,status,resolution,created_at,relationship:relationships(id,user_id,partner_user_id,partner_name,partner_phone,type,status,privacy_level),reporter:users!false_relationship_reports_reported_by_fkey(full_name,email)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('payment_submissions')
            .select('id,user_id,advertisement_id,subscription_plan_id,amount,method,reference,proof_url,payment_proof_url,transaction_reference,status,created_at,user:users!payment_submissions_user_id_fkey(full_name,email)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('professional_sessions')
            .select('id,conversation_id,user_id,professional_id,role_id,status,scheduled_date,scheduled_duration_minutes,session_type,location_type,location_address,booking_notes,booking_fee_amount,payment_status,created_at,user:users!professional_sessions_user_id_fkey(full_name,email,profile_picture),professional:professional_profiles!professional_sessions_professional_id_fkey(id,full_name)')
            .order('scheduled_date', { ascending: false })
            .limit(50),
          supabase
            .from('professional_reviews')
            .select('id,professional_id,client_id,rating,review_text,is_anonymous,moderation_status,moderation_reason,moderated_by,moderated_at,reported_count,created_at,client:users!professional_reviews_client_id_fkey(full_name,email,profile_picture),professional:professional_profiles!professional_reviews_professional_id_fkey(full_name)')
            .order('created_at', { ascending: false })
            .limit(50),
        ]);
        setAdminRelationships(adminRelationshipsResult.data || []);
        setAdminUsers(adminUsersResult.data || []);
        setAds(adsResult.data || []);
        setAdminPosts(adminPostsResult.data || []);
        setAdminReels(adminReelsResult.data || []);
        setProfessionalApplications(professionalApplicationsResult.data || []);
        setFalseRelationshipReports(falseReportsResult.data || []);
        setPaymentSubmissions(paymentSubmissionsResult.data || []);
        setAdminProfessionalSessions(adminProfessionalSessionsResult.data || []);
        setAdminProfessionalReviews(adminProfessionalReviewsResult.data || []);
      } else {
        setAdminRelationships([]);
        setAdminUsers([]);
        setAds([]);
        setAdminPosts([]);
        setAdminReels([]);
        setProfessionalApplications([]);
        setFalseRelationshipReports([]);
        setPaymentSubmissions([]);
        setAdminProfessionalSessions([]);
        setAdminProfessionalReviews([]);
      }

      const [
        blockedResult,
        bookingsResult,
        ownAdsResult,
        dateRequestsResult,
        legalDocumentsResult,
        adReceiptsResult,
        professionalProfileResult,
        professionalRolesResult,
        professionalDirectoryResult,
        subscriptionPlansResult,
        paymentMethodsResult,
        twoFactorResult,
        userSessionsResult,
        currentSessionResult,
      ] = await Promise.all([
        supabase
          .from('blocked_users')
          .select('id,blocked_id,created_at,users!blocked_users_blocked_id_fkey(id,full_name,profile_picture,email)')
          .eq('blocker_id', authUser.id)
          .limit(50),
        supabase
          .from('professional_sessions')
          .select('id,conversation_id,user_id,professional_id,role_id,status,scheduled_date,scheduled_duration_minutes,session_type,location_type,location_address,booking_notes,booking_fee_amount,created_at,professional:professional_profiles!professional_sessions_professional_id_fkey(id,full_name)')
          .eq('user_id', authUser.id)
          .order('scheduled_date', { ascending: false })
          .limit(30),
        supabase
          .from('advertisements')
          .select('id,user_id,title,description,status,budget,daily_budget,start_date,end_date,created_at')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('dating_date_requests')
          .select('id,match_id,from_user_id,to_user_id,date_title,date_description,location_name,proposed_date,proposed_time,status,responded_at,created_at,from_user:users!dating_date_requests_from_user_id_fkey(id,full_name,profile_picture),to_user:users!dating_date_requests_to_user_id_fkey(id,full_name,profile_picture)')
          .or(`from_user_id.eq.${authUser.id},to_user_id.eq.${authUser.id}`)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('legal_documents')
          .select('id,title,slug,content,version,is_active,is_required,updated_at')
          .eq('is_active', true)
          .order('title', { ascending: true }),
        supabase
          .from('ad_payment_receipts')
          .select('id,receipt_number,amount,currency,advertisement_id,created_at,advertisements(title,status)')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('professional_profiles')
          .select('id,user_id,full_name,bio,approval_status,is_active,rating_average,rating_count,review_count,max_concurrent_sessions,quiet_hours_start,quiet_hours_end,quiet_hours_timezone,online_availability,in_person_availability,pricing_info,role:professional_roles(name)')
          .eq('user_id', authUser.id)
          .maybeSingle(),
        supabase
          .from('professional_roles')
          .select('id,name,category,is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('professional_profiles')
          .select('id,user_id,role_id,full_name,bio,approval_status,is_active,rating_average,rating_count,review_count,role:professional_roles(name)')
          .eq('approval_status', 'approved')
          .eq('is_active', true)
          .order('rating_average', { ascending: false })
          .limit(50),
        supabase
          .from('subscription_plans')
          .select('id,name,display_name,description,price_monthly,price_yearly,features,is_active,display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('payment_methods')
          .select('id,name,type,description,instructions,is_active')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('user_2fa')
          .select('id,user_id,enabled,secret,backup_codes,last_used_at,created_at')
          .eq('user_id', authUser.id)
          .maybeSingle(),
        supabase
          .from('user_sessions')
          .select('id,session_token,device_info,last_active,created_at,is_active')
          .eq('user_id', authUser.id)
          .eq('is_active', true)
          .order('last_active', { ascending: false }),
        supabase.auth.getSession(),
      ]);
      setBlockedUsers(blockedResult.data || []);
      setBookings(bookingsResult.data || []);
      setDateRequests(dateRequestsResult.data || []);
      setLegalDocuments(legalDocumentsResult.data || []);
      setAdReceipts(adReceiptsResult.data || []);
      setProfessionalProfile(professionalProfileResult.data || null);
      setProfessionalRoles(professionalRolesResult.data || []);
      setProfessionalDirectory(professionalDirectoryResult.data || []);
      setSubscriptionPlans(subscriptionPlansResult.data || []);
      setPaymentMethods(paymentMethodsResult.data || []);
      setTwoFactorRecord(twoFactorResult.data || null);
      setTwoFactorBackupCodes(Array.isArray(twoFactorResult.data?.backup_codes) ? twoFactorResult.data.backup_codes : []);
      const currentSession = currentSessionResult.data?.session;
      const storedSessions = userSessionsResult.data || [];
      setActiveSessions([
        ...(currentSession ? [{
          id: currentSession.access_token,
          session_token: currentSession.access_token,
          device_info: 'Web browser (Current)',
          last_active: new Date().toISOString(),
          created_at: currentSession.expires_at ? new Date((currentSession.expires_at - 3600) * 1000).toISOString() : new Date().toISOString(),
          is_active: true,
          isCurrent: true,
        }] : []),
        ...storedSessions
          .filter((sessionRow: any) => sessionRow.session_token !== currentSession?.access_token)
          .map((sessionRow: any) => ({ ...sessionRow, isCurrent: false })),
      ]);
      if (professionalProfileResult.data?.id) {
        const pricingInfo = professionalProfileResult.data.pricing_info && typeof professionalProfileResult.data.pricing_info === 'object'
          ? professionalProfileResult.data.pricing_info
          : null;
        const [reviewRowsResult, statusRowsResult] = await Promise.all([
          supabase
            .from('professional_reviews')
            .select('id,rating,review_text,is_anonymous,created_at,client:users!professional_reviews_client_id_fkey(full_name,profile_picture)')
            .eq('professional_id', professionalProfileResult.data.id)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('professional_status')
            .select('id,professional_id,status,current_session_count,last_seen_at,status_override,status_override_by,status_override_until,updated_at')
            .eq('professional_id', professionalProfileResult.data.id)
            .maybeSingle(),
        ]);
        setProfessionalReviews(reviewRowsResult.data || []);
        setProfessionalStatus(statusRowsResult.data || null);
        setProfessionalAvailabilityForm({
          status: statusRowsResult.data?.status || 'offline',
          maxConcurrentSessions: String(professionalProfileResult.data.max_concurrent_sessions || 3),
          quietHoursEnabled: !!professionalProfileResult.data.quiet_hours_start,
          quietHoursStart: professionalProfileResult.data.quiet_hours_start || '22:00',
          quietHoursEnd: professionalProfileResult.data.quiet_hours_end || '08:00',
          quietHoursTimezone: professionalProfileResult.data.quiet_hours_timezone || 'UTC',
          onlineAvailability: professionalProfileResult.data.online_availability ?? true,
          inPersonAvailability: professionalProfileResult.data.in_person_availability ?? false,
          pricingEnabled: !!pricingInfo,
          pricingCurrency: pricingInfo?.currency || 'USD',
          pricingRate: pricingInfo?.rate != null ? String(pricingInfo.rate) : '',
          pricingUnit: pricingInfo?.unit || 'session',
        });
      } else {
        setProfessionalStatus(null);
        setProfessionalReviews([]);
      }
      if (!isAdminRole(currentUser.role)) {
        setAds(ownAdsResult.data || []);
      }

      const likeRows = ((likesResult.data || []) as DatingLike[]).filter(Boolean);
      const matchRows = ((matchesResult.data || []) as DatingMatch[]).filter(Boolean);
      const relatedUserIds = Array.from(new Set([
        ...likeRows.map((item) => item.liker_id).filter(Boolean),
        ...matchRows.map((item) => (item.user1_id === authUser.id ? item.user2_id : item.user1_id)).filter(Boolean),
      ]));
      if (relatedUserIds.length) {
        const { data: relatedUsers } = await supabase
          .from('users')
          .select('id,full_name,username,email,phone_number,profile_picture,role,verified')
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
  }, [resetUserScopedState, resolveAuthUser, router, supabase]);

  useEffect(() => {
    void loadAppData();
  }, [loadAppData]);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void loadAppData();
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [loadAppData, supabase]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadAppData();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadAppData]);

  useEffect(() => {
    if (!supabase || !user || appPath[0] !== 'admin' || !subPath || !adminGenericRoutes[subPath]) return;
    if (!isAdminRole(user.role)) return;
    let cancelled = false;
    const route = adminGenericRoutes[subPath];
    const loadRouteRows = async () => {
      setRouteRowsLoading(true);
      setRouteRowsError(null);
      try {
        let query = supabase.from(route.table).select(route.select).limit(50);
        if (route.order) query = query.order(route.order, { ascending: false });
        const { data, error } = await query;
        if (cancelled) return;
        if (error) {
          setRouteRows([]);
          setRouteRowsError(error.message || `${route.title} is not available yet.`);
        } else {
          setRouteRows(data || []);
        }
      } finally {
        if (!cancelled) setRouteRowsLoading(false);
      }
    };
    void loadRouteRows();
    return () => {
      cancelled = true;
    };
  }, [appPath, subPath, supabase, user]);

  useEffect(() => {
    if (!supabase || appPath[0] !== 'profile' || !appPath[1]) {
      setRouteProfileUser(null);
      setRouteProfilePosts([]);
      setRouteProfileLoading(false);
      return;
    }
    let cancelled = false;
    const loadProfileUser = async () => {
      setRouteProfileLoading(true);
      try {
        const identifier = decodeURIComponent(appPath[1]);
        const userQuery = supabase
          .from('users')
          .select('id,full_name,username,email,phone_number,profile_picture,role,verified,email_verified,phone_verified,id_verified');
        const { data } = looksLikeUuid(identifier)
          ? await userQuery.eq('id', identifier).maybeSingle()
          : await userQuery.eq('username', identifier.replace(/^@/, '')).maybeSingle();
        const profileUser = (data || null) as WebUser | null;
        if (!cancelled) setRouteProfileUser(profileUser);
        if (profileUser?.id) {
          const [profilePostsResult, profilePostLikesResult] = await Promise.all([
            supabase
              .from('posts')
              .select('id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,profile_picture)')
              .eq('user_id', profileUser.id)
              .or(getPostVisibilityOrFilter(user?.id || profileUser.id))
              .order('created_at', { ascending: false })
              .limit(12),
            supabase.from('post_likes').select('post_id,user_id').limit(500),
          ]);
          if (cancelled) return;
          const likesByPost = new Map<string, string[]>();
          ((profilePostLikesResult.data || []) as any[]).forEach((like) => {
            likesByPost.set(like.post_id, [...(likesByPost.get(like.post_id) || []), like.user_id].filter(Boolean));
          });
          setRouteProfilePosts(((profilePostsResult.data || []) as FeedPost[]).map((post) => ({ ...post, likes: likesByPost.get(post.id) || [] })));
        } else if (!cancelled) {
          setRouteProfilePosts([]);
        }
      } finally {
        if (!cancelled) setRouteProfileLoading(false);
      }
    };
    void loadProfileUser();
    return () => {
      cancelled = true;
    };
  }, [appPath, supabase, user?.id]);

  useEffect(() => {
    const targetUserId = appPath[0] === 'dating' && subPath === 'user-profile'
      ? (searchParams?.get('userId') || searchParams?.get('id') || '')
      : '';
    if (!supabase || !targetUserId) {
      setRouteDatingProfile(null);
      setRouteDatingProfileLoading(false);
      setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
      setRouteDatingBadges([]);
      setRouteConversationStarters([]);
      return;
    }
    let cancelled = false;
    const loadRouteDatingProfile = async () => {
      setRouteDatingProfileLoading(true);
      try {
        const { data: profileRow } = await supabase
          .from('dating_profiles')
          .select('*')
          .eq('user_id', targetUserId)
          .maybeSingle();
        if (!profileRow?.id) {
          if (!cancelled) {
            setRouteDatingProfile(null);
            setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
            setRouteDatingBadges([]);
            setRouteConversationStarters([]);
          }
          return;
        }
        const [
          photosResult,
          videosResult,
          userResult,
          badgesResult,
          likeResult,
          reciprocalLikeResult,
        ] = await Promise.all([
          supabase
            .from('dating_photos')
            .select('*')
            .eq('dating_profile_id', profileRow.id)
            .order('is_primary', { ascending: false })
            .order('display_order', { ascending: true }),
          supabase
            .from('dating_videos')
            .select('*')
            .eq('dating_profile_id', profileRow.id)
            .order('display_order', { ascending: true }),
          supabase
            .from('users')
            .select('id,full_name,username,email,profile_picture,id_verified,email_verified,phone_verified,verified')
            .eq('id', targetUserId)
            .maybeSingle(),
          supabase
            .from('user_dating_badges')
            .select('*')
            .eq('user_id', targetUserId)
            .order('earned_at', { ascending: false }),
          user?.id && user.id !== targetUserId
            ? supabase
                .from('dating_likes')
                .select('id,is_super_like')
                .eq('liker_id', user.id)
                .eq('liked_id', targetUserId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          user?.id && user.id !== targetUserId
            ? supabase
                .from('dating_likes')
                .select('id')
                .eq('liker_id', targetUserId)
                .eq('liked_id', user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const user1Id = user?.id && user.id < targetUserId ? user.id : targetUserId;
        const user2Id = user?.id && user.id > targetUserId ? user.id : targetUserId;
        const matchResult = user?.id && user.id !== targetUserId
          ? await supabase
              .from('dating_matches')
              .select('id')
              .eq('user1_id', user1Id)
              .eq('user2_id', user2Id)
              .maybeSingle()
          : { data: null };
        if (user?.id && user.id !== targetUserId) {
          void supabase.from('dating_profiles').update({ last_active_at: new Date().toISOString() }).eq('user_id', targetUserId);
        }
        const normalizedProfile = {
          ...profileRow,
          users: userResult.data || null,
          user: userResult.data || null,
          dating_photos: photosResult.data || [],
          photos: photosResult.data || [],
          dating_videos: videosResult.data || [],
          videos: videosResult.data || [],
        };
        const starters = [
          ...(Array.isArray(profileRow.conversation_starters) ? profileRow.conversation_starters : []),
          ...(Array.isArray(profileRow.prompts) ? profileRow.prompts.map((prompt: any) => prompt?.question).filter(Boolean) : []),
          profileRow.what_makes_me_different ? 'What makes you different?' : null,
          profileRow.local_spot ? `Tell me about ${profileRow.local_spot}` : null,
          profileRow.weekend_style ? 'What does your perfect weekend look like?' : null,
        ].filter(Boolean).slice(0, 4);
        if (!cancelled) {
          setRouteDatingProfile(normalizedProfile);
          setRouteDatingBadges(badgesResult.data || []);
          setRouteConversationStarters(starters as string[]);
          setRouteDatingReaction({
            liked: !!likeResult.data,
            superLiked: !!(likeResult.data as any)?.is_super_like,
            matched: !!matchResult.data || (!!likeResult.data && !!reciprocalLikeResult.data),
          });
        }
      } finally {
        if (!cancelled) setRouteDatingProfileLoading(false);
      }
    };
    void loadRouteDatingProfile();
    return () => {
      cancelled = true;
    };
  }, [appPath, searchParams, subPath, supabase, user?.id]);

  useEffect(() => {
    const targetId = (appPath[0] === 'status' || appPath[0] === 'status-item') ? appPath[1] : '';
    if (!supabase || !targetId) {
      setRouteStatusItem(null);
      setRouteStatusLoading(false);
      return;
    }
    if (
      statusFeed.some((status) =>
        appPath[0] === 'status-item'
          ? status.latest_status?.id === targetId
          : status.user_id === targetId
      )
    ) {
      setRouteStatusItem(null);
      return;
    }
    let cancelled = false;
    const loadRouteStatus = async () => {
      setRouteStatusLoading(true);
      try {
        const query = supabase
          .from('statuses')
          .select('id,user_id,content_type,text_content,media_path,background_color,created_at,expires_at,archived,users!statuses_user_id_fkey(full_name,profile_picture)')
          .eq('archived', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);
        const { data } = appPath[0] === 'status-item'
          ? await query.eq('id', targetId)
          : await query.eq('user_id', targetId);
        const status = (data || [])[0] as any;
        if (cancelled) return;
        setRouteStatusItem(status ? {
          user_id: status.user_id,
          user_name: status.users?.full_name || 'Committed member',
          user_avatar: status.users?.profile_picture || null,
          latest_status: status,
          has_unviewed: status.user_id !== user?.id,
        } : null);
      } finally {
        if (!cancelled) setRouteStatusLoading(false);
      }
    };
    void loadRouteStatus();
    return () => {
      cancelled = true;
    };
  }, [appPath, statusFeed, supabase, user?.id]);

  useEffect(() => {
    const conversationId = appPath[0] === 'messages' && appPath[1] ? appPath[1] : '';
    if (!supabase || !user || !conversationId || conversations.some((conversation) => conversation.id === conversationId)) {
      setRouteConversationLoading(false);
      return;
    }
    let cancelled = false;
    const loadRouteConversation = async () => {
      setRouteConversationLoading(true);
      try {
        const { data: conversationRow } = await supabase
          .from('conversations')
          .select('id,last_message,last_message_at,created_at,participant_ids')
          .eq('id', conversationId)
          .contains('participant_ids', [user.id])
          .maybeSingle();
        if (!conversationRow?.id) return;
        const participantIds = (conversationRow.participant_ids || []).filter((id: string) => id && id !== user.id);
        const [participantsResult, messagesResult] = await Promise.all([
          participantIds.length
            ? supabase.from('users').select('id,full_name,email,profile_picture').in('id', participantIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from('messages')
            .select('id,conversation_id,sender_id,receiver_id,content,message_type,media_url,document_url,created_at,deleted_for_sender,deleted_for_receiver')
            .eq('conversation_id', conversationRow.id)
            .order('created_at', { ascending: true }),
        ]);
        if (cancelled) return;
        const participantMap = new Map<string, WebUser>(((participantsResult.data || []) as WebUser[]).map((participant) => [participant.id, participant]));
        const hydratedConversation: ConversationRow = {
          ...conversationRow,
          participantNames: participantIds.map((id: string) => participantMap.get(id)?.full_name || participantMap.get(id)?.email || 'Committed member'),
          participantAvatars: Object.fromEntries(participantIds.map((id: string) => [id, participantMap.get(id)?.profile_picture || null])),
        };
        setConversations((prev) => prev.some((conversation) => conversation.id === conversationRow.id) ? prev : [hydratedConversation, ...prev]);
        const visibleMessages = filterVisibleMessagesForUser((messagesResult.data || []) as MessageRow[], user.id);
        setMessagesByConversation((prev) => ({ ...prev, [conversationRow.id]: visibleMessages }));
      } finally {
        if (!cancelled) setRouteConversationLoading(false);
      }
    };
    void loadRouteConversation();
    return () => {
      cancelled = true;
    };
  }, [appPath, conversations, supabase, user]);

  const loadPostComments = useCallback(async (postId: string) => {
    if (!supabase || !postId) return;
    setCommentsLoadingByTarget((prev) => ({ ...prev, [`post:${postId}`]: true }));
    try {
      const commentsResult = await supabase
        .from('comments')
        .select('id,post_id,user_id,content,message_type,parent_comment_id,created_at,users!comments_user_id_fkey(full_name,email,profile_picture),stickers!comments_sticker_id_fkey(image_url,is_animated)')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      const commentIds = ((commentsResult.data || []) as any[]).map((comment) => comment.id).filter(Boolean);
      const likesResult = commentIds.length
        ? await supabase.from('comment_likes').select('comment_id,user_id').in('comment_id', commentIds)
        : { data: [] };
      setPostCommentsByPost((prev) => ({
        ...prev,
        [postId]: nestSocialComments(commentsResult.data || [], likesResult.data || [], 'post_id'),
      }));
    } finally {
      setCommentsLoadingByTarget((prev) => ({ ...prev, [`post:${postId}`]: false }));
    }
  }, [supabase]);

  const loadReelComments = useCallback(async (reelId: string) => {
    if (!supabase || !reelId) return;
    setCommentsLoadingByTarget((prev) => ({ ...prev, [`reel:${reelId}`]: true }));
    try {
      const commentsResult = await supabase
        .from('reel_comments')
        .select('id,reel_id,user_id,content,message_type,parent_comment_id,created_at,users!reel_comments_user_id_fkey(full_name,email,profile_picture),stickers!reel_comments_sticker_id_fkey(image_url,is_animated)')
        .eq('reel_id', reelId)
        .order('created_at', { ascending: true });
      const commentIds = ((commentsResult.data || []) as any[]).map((comment) => comment.id).filter(Boolean);
      const likesResult = commentIds.length
        ? await supabase.from('reel_comment_likes').select('comment_id,user_id').in('comment_id', commentIds)
        : { data: [] };
      setReelCommentsByReel((prev) => ({
        ...prev,
        [reelId]: nestSocialComments(commentsResult.data || [], likesResult.data || [], 'reel_id'),
      }));
    } finally {
      setCommentsLoadingByTarget((prev) => ({ ...prev, [`reel:${reelId}`]: false }));
    }
  }, [supabase]);

  useEffect(() => {
    const postId = appPath[0] === 'post' && appPath[1] !== 'create' ? appPath[1] : '';
    if (!supabase || !user || !postId) {
      setRoutePost(null);
      setRoutePostLoading(false);
      return;
    }
    const alreadyLoaded = posts.find((item) => item.id === postId) || null;
    if (alreadyLoaded) {
      setRoutePost(alreadyLoaded);
      void loadPostComments(postId);
      return;
    }
    let cancelled = false;
    const loadRoutePost = async () => {
      setRoutePostLoading(true);
      try {
        const [postResult, likesResult, countResult] = await Promise.all([
          supabase
            .from('posts')
            .select('id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,profile_picture)')
            .eq('id', postId)
            .or(getPostVisibilityOrFilter(user.id))
            .maybeSingle(),
          supabase.from('post_likes').select('user_id').eq('post_id', postId),
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', postId),
        ]);
        if (cancelled) return;
        const loadedPost = postResult.data
          ? {
              ...(postResult.data as FeedPost),
              likes: ((likesResult.data || []) as Array<{ user_id: string }>).map((like) => like.user_id).filter(Boolean),
              comment_count: countResult.count ?? (postResult.data as FeedPost).comment_count ?? 0,
            }
          : null;
        setRoutePost(loadedPost);
        if (loadedPost && !posts.some((item) => item.id === loadedPost.id)) {
          setPosts((prev) => [loadedPost, ...prev]);
        }
        if (loadedPost) void loadPostComments(postId);
      } finally {
        if (!cancelled) setRoutePostLoading(false);
      }
    };
    void loadRoutePost();
    return () => {
      cancelled = true;
    };
  }, [appPath, loadPostComments, posts, supabase, user]);

  useEffect(() => {
    const reelId = appPath[0] === 'reel' && appPath[1] !== 'create' ? appPath[1] : '';
    if (!supabase || !user || !reelId) {
      setRouteReel(null);
      setRouteReelLoading(false);
      return;
    }
    const alreadyLoaded = reels.find((item) => item.id === reelId) || null;
    if (alreadyLoaded) {
      setRouteReel(alreadyLoaded);
      void loadReelComments(reelId);
      return;
    }
    let cancelled = false;
    const loadRouteReel = async () => {
      setRouteReelLoading(true);
      try {
        const [reelResult, likesResult] = await Promise.all([
          supabase
            .from('reels')
            .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,profile_picture)')
            .eq('id', reelId)
            .or(getReelVisibilityOrFilter(user.id))
            .maybeSingle(),
          supabase.from('reel_likes').select('user_id').eq('reel_id', reelId),
        ]);
        if (cancelled) return;
        const loadedReel = reelResult.data
          ? {
              ...(reelResult.data as Reel),
              likes: ((likesResult.data || []) as Array<{ user_id: string }>).map((like) => like.user_id).filter(Boolean),
            }
          : null;
        setRouteReel(loadedReel);
        if (loadedReel && !reels.some((item) => item.id === loadedReel.id)) {
          setReels((prev) => [loadedReel, ...prev]);
        }
        if (loadedReel) void loadReelComments(reelId);
      } finally {
        if (!cancelled) setRouteReelLoading(false);
      }
    };
    void loadRouteReel();
    return () => {
      cancelled = true;
    };
  }, [appPath, loadReelComments, reels, supabase, user]);

  const togglePostLike = async (post: FeedPost) => {
    if (!supabase || !user) return;
    const wasLiked = !!post.likes?.includes(user.id);
    const nextLikes = (currentLikes: string[] = []) => wasLiked ? currentLikes.filter((id) => id !== user.id) : [...currentLikes, user.id];
    setPosts((prev) =>
      prev.map((item) =>
        item.id === post.id
          ? { ...item, likes: nextLikes(item.likes) }
          : item
      )
    );
    setRoutePost((prev) => prev?.id === post.id ? { ...prev, likes: nextLikes(prev.likes) } : prev);
    if (wasLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('post_likes').upsert({ post_id: post.id, user_id: user.id }, { onConflict: 'post_id,user_id' });
    }
  };

  const toggleReelLike = async (reel: Reel) => {
    if (!supabase || !user) return;
    const wasLiked = !!reel.likes?.includes(user.id);
    const nextLikes = (currentLikes: string[] = []) => wasLiked ? currentLikes.filter((id) => id !== user.id) : [...currentLikes, user.id];
    setReels((prev) =>
      prev.map((item) =>
        item.id === reel.id
          ? { ...item, likes: nextLikes(item.likes) }
          : item
      )
    );
    setRouteReel((prev) => prev?.id === reel.id ? { ...prev, likes: nextLikes(prev.likes) } : prev);
    if (wasLiked) {
      await supabase.from('reel_likes').delete().eq('reel_id', reel.id).eq('user_id', user.id);
    } else {
      await supabase.from('reel_likes').upsert({ reel_id: reel.id, user_id: user.id }, { onConflict: 'reel_id,user_id' });
    }
  };

  const submitPostComment = async (postId: string, parentCommentId?: string) => {
    if (!supabase || !user || !postId) return;
    const draftKey = parentCommentId ? `post:${postId}:reply:${parentCommentId}` : `post:${postId}`;
    const content = (parentCommentId ? (replyDrafts[draftKey] || '') : (commentDrafts[draftKey] || '')).trim();
    if (!content) return;
    setCommentSubmittingKey(draftKey);
    const optimisticComment: SocialComment = {
      id: `pending-${Date.now()}`,
      targetId: postId,
      userId: user.id,
      userName: getUserDisplayName(user),
      userAvatar: user.profile_picture,
      content,
      messageType: 'text',
      likes: [],
      createdAt: new Date().toISOString(),
      parentCommentId: parentCommentId || null,
      replies: [],
    };
    setPostCommentsByPost((prev) => {
      const current = prev[postId] || [];
      if (!parentCommentId) return { ...prev, [postId]: [...current, optimisticComment] };
      return {
        ...prev,
        [postId]: current.map((comment) =>
          comment.id === parentCommentId
            ? { ...comment, replies: [...(comment.replies || []), optimisticComment] }
            : comment
        ),
      };
    });
    setCommentDrafts((prev) => ({ ...prev, [draftKey]: '' }));
    setReplyDrafts((prev) => ({ ...prev, [draftKey]: '' }));
    setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, comment_count: (post.comment_count || 0) + 1 } : post));
    setRoutePost((prev) => prev?.id === postId ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev);
    try {
      await supabase.from('comments').insert({
        post_id: postId,
        user_id: user.id,
        content,
        parent_comment_id: parentCommentId || null,
        message_type: 'text',
      });
      await loadPostComments(postId);
    } catch {
      setReactionNotice('Could not send comment');
      window.setTimeout(() => setReactionNotice(null), 2200);
      await loadPostComments(postId);
    } finally {
      setCommentSubmittingKey(null);
    }
  };

  const submitReelComment = async (reelId: string, parentCommentId?: string) => {
    if (!supabase || !user || !reelId) return;
    const draftKey = parentCommentId ? `reel:${reelId}:reply:${parentCommentId}` : `reel:${reelId}`;
    const content = (parentCommentId ? (replyDrafts[draftKey] || '') : (commentDrafts[draftKey] || '')).trim();
    if (!content) return;
    setCommentSubmittingKey(draftKey);
    const optimisticComment: SocialComment = {
      id: `pending-${Date.now()}`,
      targetId: reelId,
      userId: user.id,
      userName: getUserDisplayName(user),
      userAvatar: user.profile_picture,
      content,
      messageType: 'text',
      likes: [],
      createdAt: new Date().toISOString(),
      parentCommentId: parentCommentId || null,
      replies: [],
    };
    setReelCommentsByReel((prev) => {
      const current = prev[reelId] || [];
      if (!parentCommentId) return { ...prev, [reelId]: [...current, optimisticComment] };
      return {
        ...prev,
        [reelId]: current.map((comment) =>
          comment.id === parentCommentId
            ? { ...comment, replies: [...(comment.replies || []), optimisticComment] }
            : comment
        ),
      };
    });
    setCommentDrafts((prev) => ({ ...prev, [draftKey]: '' }));
    setReplyDrafts((prev) => ({ ...prev, [draftKey]: '' }));
    try {
      await supabase.from('reel_comments').insert({
        reel_id: reelId,
        user_id: user.id,
        content,
        parent_comment_id: parentCommentId || null,
        message_type: 'text',
      });
      await loadReelComments(reelId);
    } catch {
      setReactionNotice('Could not send comment');
      window.setTimeout(() => setReactionNotice(null), 2200);
      await loadReelComments(reelId);
    } finally {
      setCommentSubmittingKey(null);
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

  const reactToRouteDatingProfile = async (targetUserId: string, action: 'like' | 'pass' | 'super') => {
    if (!supabase || !user || !targetUserId || targetUserId === user.id) return;
    if (action === 'pass') {
      await supabase.from('dating_passes').upsert({ passer_id: user.id, passed_id: targetUserId }, { onConflict: 'passer_id,passed_id' });
      setReactionNotice('Passed for now');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/dating');
      return;
    }
    const isSuperLike = action === 'super';
    const { data: likeRow } = await supabase
      .from('dating_likes')
      .upsert({ liker_id: user.id, liked_id: targetUserId, is_super_like: isSuperLike }, { onConflict: 'liker_id,liked_id' })
      .select('id,is_super_like')
      .single();
    await supabase.from('dating_passes').delete().eq('passer_id', user.id).eq('passed_id', targetUserId);
    const { data: mutualLike } = await supabase
      .from('dating_likes')
      .select('id')
      .eq('liker_id', targetUserId)
      .eq('liked_id', user.id)
      .maybeSingle();
    const user1Id = user.id < targetUserId ? user.id : targetUserId;
    const user2Id = user.id > targetUserId ? user.id : targetUserId;
    let matched = false;
    if (mutualLike?.id) {
      const { error: matchError } = await supabase
        .from('dating_matches')
        .upsert({ user1_id: user1Id, user2_id: user2Id }, { onConflict: 'user1_id,user2_id' });
      matched = !matchError;
    }
    setRouteDatingReaction({ liked: true, superLiked: !!likeRow?.is_super_like || isSuperLike, matched });
    setReactionNotice(matched ? "It's a match" : isSuperLike ? 'Super like sent' : 'Liked');
    window.setTimeout(() => setReactionNotice(null), 1800);
  };

  const openConversationWithUser = async (targetUserId: string, openingMessage?: string) => {
    if (!supabase || !user || !targetUserId || targetUserId === user.id) return;
    const participantIds = [user.id, targetUserId].sort();
    let { data: existing } = await supabase
      .from('conversations')
      .select('id,participant_ids,last_message,last_message_at,created_at')
      .contains('participant_ids', participantIds)
      .limit(1)
      .maybeSingle();
    if (!existing?.id) {
      const created = await supabase
        .from('conversations')
        .insert({ participant_ids: participantIds, last_message: openingMessage || null, last_message_at: openingMessage ? new Date().toISOString() : null })
        .select('id,participant_ids,last_message,last_message_at,created_at')
        .single();
      existing = created.data;
    }
    if (existing?.id && openingMessage) {
      await supabase.from('messages').insert({
        conversation_id: existing.id,
        sender_id: user.id,
        receiver_id: targetUserId,
        content: openingMessage,
        message_type: 'text',
      });
      await supabase.from('conversations').update({ last_message: openingMessage, last_message_at: new Date().toISOString() }).eq('id', existing.id);
    }
    if (existing?.id) {
      await loadAppData();
      router.push(`/app/messages/${existing.id}`);
    }
  };

  const resetDatingPasses = async () => {
    if (!supabase || !user) return;
    await supabase.from('dating_passes').delete().eq('passer_id', user.id);
    setReactionNotice('Showing passed profiles again');
    window.setTimeout(() => setReactionNotice(null), 1800);
    await loadAppData();
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
    if (!supabase || !user || (!postDraft.trim() && !postImageUrl.trim())) return;
    setIsCreatingContent(true);
    try {
      const mediaUrls = postImageUrl.trim() ? [postImageUrl.trim()] : [];
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: postDraft.trim() || null,
          media_urls: mediaUrls,
          media_type: mediaUrls.length ? 'image' : 'text',
        })
        .select('id,user_id,content,media_urls,media_type,comment_count,created_at')
        .single();
      if (error) throw error;
      setPosts((prev) => [{ ...data, users: { full_name: user.full_name, profile_picture: user.profile_picture }, likes: [] }, ...prev]);
      setPostDraft('');
      setPostImageUrl('');
      setReactionNotice('Post created');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/feed');
    } finally {
      setIsCreatingContent(false);
    }
  };

  const createStatus = async () => {
    if (!supabase || !user || (!statusDraft.trim() && !statusMediaUrl.trim())) return;
    setIsCreatingContent(true);
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('statuses').insert({
        user_id: user.id,
        content_type: statusMediaUrl.trim() ? 'image' : 'text',
        text_content: statusDraft.trim() || null,
        media_path: statusMediaUrl.trim() || null,
        privacy_level: 'followers',
        background_color: '#2563eb',
        expires_at: expiresAt,
        archived: false,
      });
      if (error) throw error;
      setStatusDraft('');
      setStatusMediaUrl('');
      setReactionNotice('Status shared');
      window.setTimeout(() => setReactionNotice(null), 1800);
      await loadAppData();
      router.push('/app/feed');
    } finally {
      setIsCreatingContent(false);
    }
  };

  const createReel = async () => {
    const finalVideoUrl = reelVideoUrl.trim() || reelDraft.videoUrl.trim();
    const finalThumbnailUrl = reelThumbnailUploadUrl.trim() || reelDraft.thumbnailUrl.trim();
    if (!supabase || !user || !finalVideoUrl) return;
    setIsCreatingContent(true);
    try {
      const { data, error } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          video_url: finalVideoUrl,
          thumbnail_url: finalThumbnailUrl || null,
          caption: reelDraft.caption.trim(),
        })
        .select('id,user_id,caption,video_url,thumbnail_url,created_at')
        .single();
      if (error) throw error;
      setReels((prev) => [{ ...data, users: { full_name: user.full_name, profile_picture: user.profile_picture }, likes: [] }, ...prev]);
      setReelDraft({ caption: '', videoUrl: '', thumbnailUrl: '' });
      setReelVideoUrl('');
      setReelThumbnailUploadUrl('');
      setReactionNotice('Reel created');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/reels');
    } finally {
      setIsCreatingContent(false);
    }
  };

  const createAdvertisement = async () => {
    if (!supabase || !user || !adForm.title.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .insert({
          user_id: user.id,
          title: adForm.title.trim(),
          description: adForm.description.trim() || null,
          image_url: adForm.imageUrl.trim() || null,
          cta_type: adForm.ctaType,
          cta_url: adForm.ctaUrl.trim() || null,
          cta_phone: adForm.ctaPhone.trim() || null,
          cta_message: adForm.ctaMessage.trim() || null,
          placement: adForm.placement,
          daily_budget: Number(adForm.dailyBudget || 0),
          total_budget: Number(adForm.totalBudget || 0),
          start_date: adForm.startDate ? new Date(adForm.startDate).toISOString() : new Date().toISOString(),
          end_date: adForm.endDate ? new Date(adForm.endDate).toISOString() : null,
          targeting: {
            locations: adForm.locations,
            ageMin: Number(adForm.ageMin || 18),
            ageMax: Number(adForm.ageMax || 65),
          },
          billing_provider: 'manual',
          billing_status: 'pending',
          status: 'pending',
        })
        .select('id,user_id,title,description,status,budget,daily_budget,start_date,end_date,created_at')
        .single();
      if (error) throw error;
      setAds((prev) => [data, ...prev]);
      setAdForm({
        title: '',
        description: '',
        imageUrl: '',
        ctaType: 'website',
        ctaUrl: '',
        ctaPhone: '',
        ctaMessage: '',
        placement: 'feed',
        dailyBudget: '5',
        totalBudget: '20',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        locations: '',
        ageMin: '18',
        ageMax: '65',
      });
      setReactionNotice('Advertisement submitted for review');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push('/app/ads');
    } finally {
      setSaving(false);
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
        const localConversationId = 'committed-ai-local';
        const now = new Date().toISOString();
        const prompt = aiPrompt.trim();
        const localHistory = messagesByConversation[localConversationId] || [];
        const reply = getCommittedAIReply(prompt, localHistory, user);
        setConversations((prev) => {
          const exists = prev.find((item) => item.id === localConversationId);
          if (exists) return prev;
          return [{
            id: localConversationId,
            participant_ids: [user.id, 'committed-ai'],
            participantNames: ['Committed AI'],
            participantAvatars: { 'committed-ai': null },
            created_at: now,
            last_message_at: now,
            last_message: reply,
          }, ...prev];
        });
        setMessagesByConversation((prev) => ({
          ...prev,
          [localConversationId]: [
            ...(prev[localConversationId] || []),
            { id: `local-user-${Date.now()}`, conversation_id: localConversationId, sender_id: user.id, receiver_id: 'committed-ai', content: prompt, message_type: 'text', created_at: now },
            { id: `local-ai-${Date.now() + 1}`, conversation_id: localConversationId, sender_id: 'committed-ai', receiver_id: user.id, content: reply, message_type: 'text', created_at: new Date(Date.now() + 1000).toISOString() },
          ],
        }));
        setAiPrompt('');
        setReactionNotice('Committed AI replied');
        window.setTimeout(() => setReactionNotice(null), 2000);
        router.push(`/app/messages/${localConversationId}`);
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
        router.push(`/app/messages/${existing.id}`);
      }
    } finally {
      setIsCreatingContent(false);
    }
  };

  const sendChatMessage = async (conversation: ConversationRow) => {
    if (!supabase || !user || (!chatDraft.trim() && !chatMediaUrl.trim() && !chatDocumentUrl.trim())) return;
    const receiverId = (conversation.participant_ids || []).find((id) => id !== user.id);
    const messageText = chatDraft.trim();
    const mediaUrl = chatMediaUrl.trim();
    const documentUrl = chatDocumentUrl.trim();
    const messageType = documentUrl ? 'document' : mediaUrl ? 'image' : 'text';
    setChatDraft('');
    setChatMediaUrl('');
    setChatDocumentUrl('');
    const optimistic: MessageRow = {
      id: `pending-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: user.id,
      receiver_id: receiverId || null,
      content: messageText,
      media_url: mediaUrl || null,
      document_url: documentUrl || null,
      message_type: messageType,
      created_at: new Date().toISOString(),
    };
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversation.id]: [...(prev[conversation.id] || []), optimistic],
    }));
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      receiver_id: receiverId || null,
      content: messageText,
      media_url: mediaUrl || null,
      document_url: documentUrl || null,
      message_type: messageType,
    });
    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message: messageText || (documentUrl ? 'Document' : 'Photo'), last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
      const isAiConversation =
        conversation.id === 'committed-ai-local' ||
        (conversation.participantNames || []).some((name) => name.toLowerCase().includes('committed ai'));
      if (isAiConversation && messageText) {
        const aiReplyText = getCommittedAIReply(messageText, messagesByConversation[conversation.id] || [], user);
        const aiId = receiverId || 'committed-ai';
        const aiReply: MessageRow = {
          id: `ai-${Date.now()}`,
          conversation_id: conversation.id,
          sender_id: aiId,
          receiver_id: user.id,
          content: aiReplyText,
          message_type: 'text',
          created_at: new Date(Date.now() + 800).toISOString(),
        };
        setMessagesByConversation((prev) => ({
          ...prev,
          [conversation.id]: [...(prev[conversation.id] || []), aiReply],
        }));
        if (conversation.id !== 'committed-ai-local' && receiverId) {
          await supabase.from('messages').insert({
            conversation_id: conversation.id,
            sender_id: receiverId,
            receiver_id: user.id,
            content: aiReplyText,
            message_type: 'text',
          });
          await supabase
            .from('conversations')
            .update({ last_message: aiReplyText, last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);
        }
      }
      await loadAppData();
    }
  };

  const sendQuickAiPrompt = async (conversation: ConversationRow, prompt: string) => {
    if (!prompt.trim()) return;
    setChatDraft(prompt);
    await Promise.resolve();
    // Use the same message pipeline used by the composer for parity.
    if (!supabase || !user) return;
    const receiverId = (conversation.participant_ids || []).find((id) => id !== user.id);
    const messageText = prompt.trim();
    const optimistic: MessageRow = {
      id: `pending-${Date.now()}`,
      conversation_id: conversation.id,
      sender_id: user.id,
      receiver_id: receiverId || null,
      content: messageText,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };
    setMessagesByConversation((prev) => ({
      ...prev,
      [conversation.id]: [...(prev[conversation.id] || []), optimistic],
    }));
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      receiver_id: receiverId || null,
      content: messageText,
      message_type: 'text',
    });
    if (!error) {
      await supabase
        .from('conversations')
        .update({ last_message: messageText, last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
      const aiReplyText = getCommittedAIReply(messageText, messagesByConversation[conversation.id] || [], user);
      const aiId = receiverId || 'committed-ai';
      const aiReply: MessageRow = {
        id: `ai-${Date.now()}`,
        conversation_id: conversation.id,
        sender_id: aiId,
        receiver_id: user.id,
        content: aiReplyText,
        message_type: 'text',
        created_at: new Date(Date.now() + 800).toISOString(),
      };
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversation.id]: [...(prev[conversation.id] || []), aiReply],
      }));
      if (conversation.id !== 'committed-ai-local' && receiverId) {
        await supabase.from('messages').insert({
          conversation_id: conversation.id,
          sender_id: receiverId,
          receiver_id: user.id,
          content: aiReplyText,
          message_type: 'text',
        });
        await supabase
          .from('conversations')
          .update({ last_message: aiReplyText, last_message_at: new Date().toISOString() })
          .eq('id', conversation.id);
      }
      await loadAppData();
    }
    setChatDraft('');
  };

  const submitRelationship = async () => {
    if (!supabase || !user || !relationshipForm.partnerName.trim() || !relationshipForm.consent) return;
    setSaving(true);
    try {
      const normalizedPhone = relationshipForm.partnerPhone.replace(/[^\d+]/g, '').trim();
      const startDateFromParts = getDateStringFromParts(relationshipForm.startDay, relationshipForm.startMonth, relationshipForm.startYear);
      const startDateValue = relationshipForm.startDate || startDateFromParts || new Date().toISOString();
      const partnerBirthMonth = relationshipForm.partnerBirthMonth ? Number(relationshipForm.partnerBirthMonth) : null;
      const partnerBirthYear = relationshipForm.partnerBirthYear ? Number(relationshipForm.partnerBirthYear) : null;
      const partnerLookup = normalizedPhone
        ? await supabase
            .from('users')
            .select('id,full_name,phone_number')
            .eq('phone_number', normalizedPhone)
            .maybeSingle()
        : { data: null };

      const { data: createdRelationship, error } = await supabase
        .from('relationships')
        .insert({
          user_id: user.id,
          partner_user_id: partnerLookup.data?.id || null,
          partner_name: relationshipForm.partnerName.trim(),
          partner_phone: normalizedPhone || null,
          partner_face_photo: relationshipPhotoUrl.trim() || null,
          partner_date_of_birth_month: partnerBirthMonth,
          partner_date_of_birth_year: partnerBirthYear,
          type: relationshipForm.type,
          status: 'pending',
          start_date: startDateValue,
          privacy_level: relationshipForm.privacy,
          partner_city: relationshipForm.city.trim() || null,
        })
        .select('id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level')
        .single();
      if (error) throw error;

      if (partnerLookup.data?.id && createdRelationship?.id) {
        await supabase.from('relationship_requests').insert({
          relationship_id: createdRelationship.id,
          requester_id: user.id,
          partner_user_id: partnerLookup.data.id,
          partner_phone: normalizedPhone || null,
          partner_name: relationshipForm.partnerName.trim(),
          status: 'pending',
        });
        await supabase.from('notifications').insert({
          user_id: partnerLookup.data.id,
          title: 'Relationship verification request',
          message: `${user.full_name || 'Someone'} registered a relationship with you.`,
          type: 'relationship_request',
          data: { relationshipId: createdRelationship.id },
          read: false,
        });
      }

      setRelationship(createdRelationship as RelationshipRow);
      setRelationshipForm({
        partnerName: '',
        partnerPhone: '',
        type: 'serious',
        startDate: '',
        startDay: '',
        startMonth: '',
        startYear: '',
        partnerBirthDay: '',
        partnerBirthMonth: '',
        partnerBirthYear: '',
        privacy: 'verified_people',
        city: '',
        consent: false,
      });
      setRelationshipStep(1);
      setRelationshipPhotoUrl('');
      setReactionNotice('Relationship registration submitted');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push('/app');
    } finally {
      setSaving(false);
    }
  };

  const submitProfessionalApplication = async () => {
    if (!supabase || !user || !professionalApplicationForm.roleId) return;
    setSaving(true);
    try {
      const payload = {
        specialty: professionalApplicationForm.specialty.trim(),
        experience: professionalApplicationForm.experience.trim(),
        bio: professionalApplicationForm.bio.trim(),
        credentialsUrl: professionalApplicationForm.credentialsUrl.trim(),
        credential_documents: professionalApplicationForm.credentialsUrl.trim() ? [professionalApplicationForm.credentialsUrl.trim()] : [],
        rate: professionalApplicationForm.rate ? Number(professionalApplicationForm.rate) : null,
      };
      const { error } = await supabase
        .from('professional_applications')
        .insert({
          user_id: user.id,
          role_id: professionalApplicationForm.roleId,
          application_data: payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
      setProfessionalApplicationForm({ roleId: '', specialty: '', experience: '', bio: '', credentialsUrl: '', rate: '' });
      setReactionNotice('Professional application submitted');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push('/app/profile');
    } finally {
      setSaving(false);
    }
  };

  const updateAdminRelationship = async (relationshipId: string, action: 'verify' | 'end' | 'reject' | 'delete') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      if (action === 'delete') {
        const { data, error } = await supabase.from('relationships').delete().eq('id', relationshipId).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Relationship was not deleted. Admin delete permission may be missing.');
        setAdminRelationships((prev) => prev.filter((item) => item.id !== relationshipId));
        setReactionNotice('Relationship removed');
      } else if (action === 'end') {
        const { data: rel, error: relError } = await supabase
          .from('relationships')
          .select('id,user_id,partner_user_id')
          .eq('id', relationshipId)
          .single();
        if (relError) throw relError;

        const { data: existingDispute, error: existingDisputeError } = await supabase
          .from('disputes')
          .select('id,auto_resolve_at')
          .eq('relationship_id', relationshipId)
          .eq('dispute_type', 'end_relationship')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingDisputeError) throw existingDisputeError;

        if (existingDispute?.id) {
          setReactionNotice('End review already pending');
        } else {
          const autoResolveAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const { data: dispute, error: disputeError } = await supabase
            .from('disputes')
            .insert({
              relationship_id: relationshipId,
              initiated_by: user.id,
              dispute_type: 'end_relationship',
              description: 'Admin requested relationship end review',
              status: 'pending',
              auto_resolve_at: autoResolveAt,
            })
            .select('id')
            .single();
          if (disputeError) throw disputeError;

          const partnerIds = [rel.user_id, rel.partner_user_id].filter(Boolean);
          await Promise.all(partnerIds.map((partnerId: string) => supabase.from('notifications').insert({
            user_id: partnerId,
            type: 'relationship_end_request',
            title: 'Relationship End Review',
            message: 'An administrator opened a relationship end review. Confirm to end it, or reject to keep it active. If no one rejects within 7 days, it will auto-end.',
            data: { relationshipId, disputeId: dispute.id, adminInitiated: true },
            read: false,
          })));
          setReactionNotice('End review sent to partners');
        }
      } else {
        const patch = action === 'verify'
          ? { status: 'verified', verified_date: new Date().toISOString() }
          : { status: 'ended', end_date: new Date().toISOString() };
        const { data, error } = await supabase
          .from('relationships')
          .update(patch)
          .eq('id', relationshipId)
          .select('*')
          .single();
        if (error) throw error;
        setAdminRelationships((prev) => prev.map((item) => (item.id === relationshipId ? { ...item, ...data } : item)));
        setReactionNotice(action === 'verify' ? 'Relationship verified' : 'Relationship rejected');
      }
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  const unblockUser = async (blockedId: string) => {
    if (!supabase || !user) return;
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId);
    if (!error) {
      setBlockedUsers((prev) => prev.filter((item) => item.blocked_id !== blockedId));
      setReactionNotice('User unblocked');
      window.setTimeout(() => setReactionNotice(null), 1800);
    }
  };

  const respondToDateRequest = async (requestId: string, response: 'accepted' | 'declined' | 'cancelled') => {
    if (!supabase || !user) return;
    const patch = response === 'cancelled'
      ? { status: 'cancelled' }
      : { status: response, responded_at: new Date().toISOString() };
    const { error } = await supabase.from('dating_date_requests').update(patch).eq('id', requestId);
    if (!error) {
      setDateRequests((prev) => prev.map((item) => (item.id === requestId ? { ...item, ...patch } : item)));
      setReactionNotice(response === 'accepted' ? 'Date accepted' : response === 'declined' ? 'Date declined' : 'Date cancelled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    }
  };

  const createDateRequest = async () => {
    if (!supabase || !user || !dateForm.recipientId || !dateForm.title.trim() || !dateForm.location.trim()) return;
    setSaving(true);
    try {
      const user1Id = user.id < dateForm.recipientId ? user.id : dateForm.recipientId;
      const user2Id = user.id < dateForm.recipientId ? dateForm.recipientId : user.id;
      const { data: match } = await supabase
        .from('dating_matches')
        .select('id')
        .eq('user1_id', user1Id)
        .eq('user2_id', user2Id)
        .maybeSingle();
      if (!match?.id) throw new Error('Match not found');
      const { data, error } = await supabase
        .from('dating_date_requests')
        .insert({
          match_id: match.id,
          from_user_id: user.id,
          to_user_id: dateForm.recipientId,
          date_title: dateForm.title.trim(),
          date_description: dateForm.description.trim() || null,
          location_name: dateForm.location.trim(),
          proposed_date: dateForm.proposedDate || null,
          proposed_time: dateForm.proposedTime || null,
          duration_minutes: Number(dateForm.durationHours || 2) * 60,
          dress_code: dateForm.dressCode || null,
          budget_range: dateForm.budgetRange || null,
          expense_handling: dateForm.expenseHandling,
          special_requests: dateForm.specialRequests.trim() || null,
          status: 'pending',
        })
        .select('*')
        .single();
      if (error) throw error;
      setDateRequests((prev) => [data, ...prev]);
      setDateForm({ recipientId: '', title: '', description: '', location: '', proposedDate: '', proposedTime: '', durationHours: '2', dressCode: '', budgetRange: '', expenseHandling: 'split', specialRequests: '' });
      setReactionNotice('Date request sent');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/dating/date-requests');
    } finally {
      setSaving(false);
    }
  };

  const submitBooking = async () => {
    if (!supabase || !user || !bookingForm.professionalId || !bookingForm.roleId || !bookingForm.date || !bookingForm.time) return;
    setSaving(true);
    try {
      const scheduledDate = new Date(`${bookingForm.date}T${bookingForm.time}`).toISOString();
      const { data, error } = await supabase
        .from('professional_sessions')
        .insert({
          conversation_id: bookingForm.conversationId.trim() || null,
          user_id: user.id,
          professional_id: bookingForm.professionalId,
          role_id: bookingForm.roleId,
          session_type: 'offline_booking',
          status: 'scheduled',
          scheduled_date: scheduledDate,
          scheduled_duration_minutes: Number(bookingForm.durationMinutes || 60),
          location_type: bookingForm.locationType,
          location_address: bookingForm.locationAddress.trim() || null,
          location_notes: bookingForm.locationNotes.trim() || null,
          booking_notes: bookingForm.bookingNotes.trim() || null,
          booking_fee_amount: bookingForm.feeAmount ? Number(bookingForm.feeAmount) : null,
          booking_fee_currency: bookingForm.feeAmount ? 'USD' : null,
          payment_status: bookingForm.feeAmount ? 'pending' : null,
        })
        .select('*')
        .single();
      if (error) throw error;
      setBookings((prev) => [data, ...prev]);
      setBookingForm({ professionalId: '', roleId: '', conversationId: '', date: '', time: '', durationMinutes: '60', locationType: 'online', locationAddress: '', locationNotes: '', bookingNotes: '', feeAmount: '' });
      setReactionNotice('Booking created');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/bookings');
    } finally {
      setSaving(false);
    }
  };

  const submitDatingPayment = async () => {
    const planId = paymentForm.planId || searchParams?.get('planId') || subscriptionPlans[0]?.id || '';
    const methodId = paymentForm.methodId || paymentMethods[0]?.id || '';
    if (!supabase || !user || !planId || !methodId || !paymentForm.proofUrl.trim()) return;
    const plan = subscriptionPlans.find((item) => item.id === planId);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('payment_submissions')
        .insert({
          user_id: user.id,
          subscription_plan_id: planId,
          payment_method_id: methodId,
          amount: plan?.price_monthly || plan?.price_yearly || 0,
          currency: 'USD',
          payment_proof_url: paymentForm.proofUrl.trim(),
          proof_url: paymentForm.proofUrl.trim(),
          transaction_reference: paymentForm.reference.trim() || null,
          reference: paymentForm.reference.trim() || null,
          payment_date: new Date().toISOString().slice(0, 10),
          notes: paymentForm.notes.trim() || null,
          status: 'pending',
        });
      if (error) throw error;
      setPaymentForm({ planId: '', methodId: '', proofUrl: '', reference: '', notes: '' });
      setReactionNotice('Payment proof submitted');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push('/app/dating/premium');
    } finally {
      setSaving(false);
    }
  };

  const markNotificationRead = async (notification: NotificationRow) => {
    if (!supabase || notification.read) return;
    setNotifications((prev) => prev.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
  };

  const notificationHref = (notification: NotificationRow) => {
    const data = notification.data || {};
    if (data.conversationId || data.conversation_id) return `/app/messages/${data.conversationId || data.conversation_id}`;
    if (data.postId || data.post_id) return `/app/post/${data.postId || data.post_id}`;
    if (data.reelId || data.reel_id) return `/app/reel/${data.reelId || data.reel_id}`;
    if (data.statusId || data.status_id) return `/app/status-item/${data.statusId || data.status_id}`;
    if (data.dateRequestId || data.date_request_id) return '/app/dating/date-requests';
    if (data.matchId || data.match_id) return '/app/dating/matches';
    if (data.likerId || data.liker_id || data.likedByUserId || data.liked_by_user_id) return '/app/dating/likes-received';
    if (data.bookingId || data.booking_id || data.sessionId || data.session_id || data.professionalSessionId || data.professional_session_id) return '/app/bookings';
    if (data.paymentSubmissionId || data.payment_submission_id || data.paymentId || data.payment_id) return isAdminRole(user?.role) ? '/app/admin/payment-verifications' : '/app/dating/premium';
    if (data.relationshipId || data.relationship_id) return `/app/certificates/${data.relationshipId || data.relationship_id}`;
    if (data.datingUserId || data.dating_user_id) return `/app/dating/user-profile?userId=${encodeURIComponent(data.datingUserId || data.dating_user_id)}`;
    if (data.userId || data.user_id) return `/app/profile/${data.userId || data.user_id}`;
    if (notification.type === 'dating_match') return '/app/dating/matches';
    if (notification.type === 'dating_like' || notification.type === 'dating_super_like') return '/app/dating/likes-received';
    if (notification.type?.includes('payment')) return isAdminRole(user?.role) ? '/app/admin/payment-verifications' : '/app/dating/premium';
    if (notification.type?.includes('booking') || notification.type?.includes('session')) return '/app/bookings';
    if (notification.type?.includes('message')) return '/app/messages';
    if (notification.type?.includes('dating')) return '/app/dating';
    if (notification.type?.includes('professional')) return '/app/professional';
    if (notification.type?.includes('relationship')) return '/app/search';
    return '/app/notifications';
  };

  const rescheduleBooking = async (bookingId: string) => {
    if (!supabase || !user || !bookingForm.date || !bookingForm.time) return;
    setSaving(true);
    try {
      const scheduledDate = new Date(`${bookingForm.date}T${bookingForm.time}`).toISOString();
      const patch = {
        scheduled_date: scheduledDate,
        reschedule_reason: bookingForm.bookingNotes.trim() || null,
        reschedule_requested_by: 'user',
        reschedule_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('professional_sessions').update(patch).eq('id', bookingId);
      if (error) throw error;
      setBookings((prev) => prev.map((item) => (item.id === bookingId ? { ...item, ...patch } : item)));
      setReactionNotice('Booking rescheduled');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/bookings');
    } finally {
      setSaving(false);
    }
  };

  const sendVerificationCode = async (type: 'email' | 'phone') => {
    if (!supabase || !user) return;
    const target = type === 'email' ? verificationForm.email.trim() : verificationForm.phone.trim();
    if (!target) return;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from('verification_codes').insert({
      user_id: user.id,
      email: type === 'email' ? target : null,
      phone_number: type === 'phone' ? target : null,
      code,
      verification_type: type,
      used: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    setVerificationForm((prev) => ({ ...prev, generatedCode: code, code: '' }));
    setReactionNotice(`Verification code generated: ${code}`);
    window.setTimeout(() => setReactionNotice(null), 4000);
  };

  const verifyCode = async (type: 'email' | 'phone') => {
    if (!supabase || !user || !verificationForm.code.trim()) return;
    const target = type === 'email' ? verificationForm.email.trim() : verificationForm.phone.trim();
    const query = supabase
      .from('verification_codes')
      .select('id,expires_at')
      .eq('user_id', user.id)
      .eq('code', verificationForm.code.trim())
      .eq('verification_type', type)
      .eq('used', false)
      .gte('expires_at', new Date().toISOString());
    const { data } = await (type === 'email' ? query.eq('email', target) : query.eq('phone_number', target)).maybeSingle();
    if (!data?.id) {
      setReactionNotice('Invalid or expired code');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    await supabase.from('verification_codes').update({ used: true }).eq('id', data.id);
    await supabase.from('users').update(type === 'email'
      ? { email: target, email_verified: true }
      : { phone_number: target, phone_verified: true }
    ).eq('id', user.id);
    setUser((prev) => prev ? { ...prev, [type === 'email' ? 'email_verified' : 'phone_verified']: true, [type === 'email' ? 'email' : 'phone_number']: target } : prev);
    setReactionNotice(type === 'email' ? 'Email verified' : 'Phone verified');
    window.setTimeout(() => setReactionNotice(null), 1800);
  };

  const generateBackupCodes = () => Array.from({ length: 10 }, () => Math.random().toString(36).slice(2, 10).toUpperCase());

  const setupTwoFactor = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const secret = Math.random().toString(36).slice(2, 18).toUpperCase();
      const backupCodes = generateBackupCodes();
      const { data, error } = await supabase
        .from('user_2fa')
        .upsert({
          user_id: user.id,
          secret,
          enabled: false,
          backup_codes: backupCodes,
        }, { onConflict: 'user_id' })
        .select('id,user_id,enabled,secret,backup_codes,last_used_at,created_at')
        .single();
      if (error) throw error;
      setTwoFactorRecord(data);
      setTwoFactorSecret(secret);
      setTwoFactorBackupCodes(backupCodes);
      setReactionNotice('Save your backup codes, then enter any 6 digit authenticator code.');
      window.setTimeout(() => setReactionNotice(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const verifyAndEnableTwoFactor = async () => {
    if (!supabase || !user || !twoFactorRecord?.id || twoFactorCode.trim().length !== 6) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .update({
          enabled: true,
          last_used_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('id,user_id,enabled,secret,backup_codes,last_used_at,created_at')
        .single();
      if (error) throw error;
      setTwoFactorRecord(data);
      setTwoFactorSecret('');
      setTwoFactorCode('');
      setReactionNotice('Two-factor authentication enabled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_2fa')
        .update({
          enabled: false,
          secret: null,
          backup_codes: null,
        })
        .eq('user_id', user.id)
        .select('id,user_id,enabled,secret,backup_codes,last_used_at,created_at')
        .maybeSingle();
      if (error) throw error;
      setTwoFactorRecord(data || null);
      setTwoFactorSecret('');
      setTwoFactorBackupCodes([]);
      setTwoFactorCode('');
      setReactionNotice('Two-factor authentication disabled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const endStoredSession = async (sessionId: string) => {
    if (!supabase || !user) return;
    const target = activeSessions.find((session) => session.id === sessionId);
    if (target?.isCurrent) {
      setReactionNotice('Use sign out for the current device');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('id', sessionId)
      .eq('user_id', user.id);
    if (!error) {
      setActiveSessions((prev) => prev.filter((session) => session.id !== sessionId));
      setReactionNotice('Session ended');
      window.setTimeout(() => setReactionNotice(null), 1800);
    }
  };

  const saveProfessionalAvailability = async () => {
    if (!supabase || !user || !professionalProfile?.id) return;
    setSaving(true);
    try {
      const maxConcurrentSessions = Math.max(1, Number(professionalAvailabilityForm.maxConcurrentSessions) || 3);
      const pricingInfo = professionalAvailabilityForm.pricingEnabled && professionalAvailabilityForm.pricingRate.trim()
        ? {
            currency: professionalAvailabilityForm.pricingCurrency.trim() || 'USD',
            rate: Number(professionalAvailabilityForm.pricingRate) || 0,
            unit: professionalAvailabilityForm.pricingUnit || 'session',
          }
        : null;
      const { data: profileData, error: profileError } = await supabase
        .from('professional_profiles')
        .update({
          max_concurrent_sessions: maxConcurrentSessions,
          quiet_hours_start: professionalAvailabilityForm.quietHoursEnabled ? professionalAvailabilityForm.quietHoursStart : null,
          quiet_hours_end: professionalAvailabilityForm.quietHoursEnabled ? professionalAvailabilityForm.quietHoursEnd : null,
          quiet_hours_timezone: professionalAvailabilityForm.quietHoursEnabled ? professionalAvailabilityForm.quietHoursTimezone : 'UTC',
          online_availability: professionalAvailabilityForm.onlineAvailability,
          in_person_availability: professionalAvailabilityForm.inPersonAvailability,
          pricing_info: pricingInfo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', professionalProfile.id)
        .eq('user_id', user.id)
        .select('id,user_id,full_name,bio,approval_status,is_active,rating_average,rating_count,review_count,max_concurrent_sessions,quiet_hours_start,quiet_hours_end,quiet_hours_timezone,online_availability,in_person_availability,pricing_info,role:professional_roles(name)')
        .single();
      if (profileError) throw profileError;
      const { data: statusData, error: statusError } = await supabase
        .from('professional_status')
        .upsert({
          professional_id: professionalProfile.id,
          status: professionalAvailabilityForm.status,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'professional_id' })
        .select('id,professional_id,status,current_session_count,last_seen_at,status_override,status_override_by,status_override_until,updated_at')
        .single();
      if (statusError) throw statusError;
      setProfessionalProfile(profileData);
      setProfessionalStatus(statusData);
      setReactionNotice('Availability saved');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const submitIdVerification = async () => {
    if (!supabase || !user || !verificationForm.documentUrl.trim()) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('verification_documents')
        .select('id')
        .eq('user_id', user.id)
        .eq('document_type', 'government_id')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('verification_documents').update({
          document_url: verificationForm.documentUrl.trim(),
          status: 'pending',
          rejection_reason: null,
          reviewed_at: null,
          submitted_at: new Date().toISOString(),
        }).eq('id', existing.id);
      } else {
        await supabase.from('verification_documents').insert({
          user_id: user.id,
          document_url: verificationForm.documentUrl.trim(),
          document_type: 'government_id',
          status: 'pending',
          submitted_at: new Date().toISOString(),
        });
      }
      setReactionNotice('ID submitted for review');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const submitCoupleSelfieVerification = async () => {
    if (!supabase || !user || !relationship?.id || !verificationForm.documentUrl.trim()) return;
    setSaving(true);
    try {
      const certificateUrl = `https://committed.dreambig.org.za/certificates/${relationship.id}`;
      const { error } = await supabase
        .from('couple_certificates')
        .insert({
          relationship_id: relationship.id,
          certificate_url: certificateUrl,
          verification_selfie_url: verificationForm.documentUrl.trim(),
          issued_at: new Date().toISOString(),
        });
      if (error) throw error;
      setReactionNotice('Couple selfie submitted');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push(`/app/certificates/${relationship.id}`);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminDocumentStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    const patch = {
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? 'Rejected by admin' : null,
    };
    try {
      const { data: updatedDocument, error } = await supabase
        .from('verification_documents')
        .update(patch)
        .eq('id', id)
        .select('id,user_id,status,reviewed_by,reviewed_at,rejection_reason')
        .maybeSingle();
      if (error) throw error;
      if (!updatedDocument) throw new Error('Document was not updated. Admin verification permission may be missing.');
      if (status === 'approved' && updatedDocument.user_id) {
        const { error: userError } = await supabase
          .from('users')
          .update({ id_verified: true, verified: true })
          .eq('id', updatedDocument.user_id);
        if (userError) throw userError;
        setAdminUsers((prev) => prev.map((member) => member.id === updatedDocument.user_id ? { ...member, id_verified: true, verified: true } : member));
        if (user?.id === updatedDocument.user_id) {
          setUser((prev) => prev ? { ...prev, id_verified: true, verified: true } : prev);
        }
      }
      setRouteRows((prev) => prev.map((item) => item.id === id ? { ...item, ...patch, ...(status === 'approved' ? { user: item.user ? { ...item.user, id_verified: true, verified: true } : item.user } : {}) } : item));
      setReactionNotice(status === 'approved' ? 'ID approved and user verified' : 'Document rejected');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update document');
      window.setTimeout(() => setReactionNotice(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  const updateModeration = async (table: 'posts' | 'reels', id: string, status: 'approved' | 'rejected') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    const patch = {
      moderation_status: status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: status === 'rejected' ? 'Rejected by admin' : null,
    };
    try {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`${table === 'posts' ? 'Post' : 'Reel'} was not updated. Admin moderation permission may be missing.`);
      if (table === 'posts') setAdminPosts((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
      if (table === 'reels') setAdminReels((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
      setReactionNotice(status === 'approved' ? 'Approved' : 'Rejected');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update moderation status');
      window.setTimeout(() => setReactionNotice(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  const updateProfessionalApplication = async (id: string, status: 'approved' | 'rejected') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const application = professionalApplications.find((item) => item.id === id);
      const now = new Date().toISOString();
      if (status === 'approved' && application) {
        const userId = application.user_id;
        const roleId = application.role_id;
        const applicationData = application.application_data || {};
        if (!userId || !roleId) throw new Error('Application is missing user or role information');

        const { data: existingProfile, error: existingProfileError } = await supabase
          .from('professional_profiles')
          .select('id,full_name,bio,credentials,credential_documents,location')
          .eq('user_id', userId)
          .maybeSingle();
        if (existingProfileError) throw existingProfileError;

        const { data: profile, error: profileError } = await supabase
          .from('professional_profiles')
          .upsert({
            user_id: userId,
            role_id: roleId,
            full_name: application.user?.full_name || existingProfile?.full_name || 'Professional',
            bio: applicationData.bio ?? existingProfile?.bio ?? null,
            credentials: applicationData.credentials ?? existingProfile?.credentials ?? [],
            credential_documents: applicationData.credential_documents ?? applicationData.credentialDocuments ?? existingProfile?.credential_documents ?? [],
            location: applicationData.location ?? existingProfile?.location ?? null,
            approval_status: 'approved',
            rejection_reason: null,
            approved_by: user.id,
            approved_at: now,
            updated_at: now,
          }, { onConflict: 'user_id' })
          .select('id')
          .single();
        if (profileError) throw profileError;

        if (profile?.id) {
          await supabase
            .from('professional_status')
            .upsert({ professional_id: profile.id, status: 'offline', updated_at: now }, { onConflict: 'professional_id', ignoreDuplicates: true });
        }

        const { data: updatedRows, error: updateError } = await supabase
          .from('professional_applications')
          .update({
            status: 'approved',
            reviewed_by: user.id,
            reviewed_at: now,
            review_notes: 'Approved on web',
            rejection_reason: null,
          })
          .eq('user_id', userId)
          .in('status', ['pending', 'under_review'])
          .select('id');
        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length === 0) throw new Error('Profile was approved, but the application status could not be updated.');
        setProfessionalApplications((prev) => prev.map((item) => item.user_id === userId ? { ...item, status: 'approved', reviewed_by: user.id, reviewed_at: now } : item));
      } else {
        const patch = {
          status,
          reviewed_by: user.id,
          reviewed_at: now,
          review_notes: null,
          rejection_reason: 'Rejected by admin',
        };
        const { error } = await supabase.from('professional_applications').update(patch).eq('id', id);
        if (error) throw error;
        setProfessionalApplications((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
      }
      setReactionNotice(status === 'approved' ? 'Application approved' : 'Application rejected');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const updatePaymentSubmission = async (payment: any, status: 'approved' | 'rejected') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const rejectionReason = 'Payment verification failed';
      const patch: any = {
        status,
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      };
      if (status === 'rejected') patch.rejection_reason = rejectionReason;
      const { data: updatedPayment, error } = await supabase
        .from('payment_submissions')
        .update(patch)
        .eq('id', payment.id)
        .select('id,user_id,advertisement_id,subscription_plan_id,amount,currency,status,verified_by,verified_at,rejection_reason')
        .maybeSingle();
      if (error) throw error;
      if (!updatedPayment) {
        throw new Error('Payment could not be updated. Please check admin payment permissions.');
      }

      if (updatedPayment.advertisement_id) {
        const { data: updatedAd, error: adError } = await supabase
          .from('advertisements')
          .update(status === 'approved'
            ? { billing_status: 'paid', status: 'approved', active: true }
            : { billing_status: 'failed', status: 'rejected', active: false })
          .eq('id', updatedPayment.advertisement_id)
          .select('id,status,billing_status,active')
          .maybeSingle();
        if (adError) throw adError;
        if (!updatedAd) {
          throw new Error('Payment was updated, but the advertisement was not updated.');
        }
      }

      if (status === 'approved' && updatedPayment.advertisement_id && updatedPayment.user_id) {
        const { data: existingReceipt, error: existingReceiptError } = await supabase
          .from('ad_payment_receipts')
          .select('id,receipt_number')
          .eq('payment_submission_id', updatedPayment.id)
          .limit(1)
          .maybeSingle();
        if (existingReceiptError) throw existingReceiptError;

        let receiptNumber = existingReceipt?.receipt_number;
        if (!existingReceipt) {
          receiptNumber = `AD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase()}`;

          const { error: receiptError } = await supabase.from('ad_payment_receipts').insert({
            advertisement_id: updatedPayment.advertisement_id,
            payment_submission_id: updatedPayment.id,
            user_id: updatedPayment.user_id,
            amount: updatedPayment.amount,
            currency: updatedPayment.currency || 'USD',
            receipt_number: receiptNumber,
            issued_at: new Date().toISOString(),
          });
          if (receiptError) throw receiptError;
        }

        await supabase.rpc('create_notification', {
          p_user_id: updatedPayment.user_id,
          p_type: 'payment_approved',
          p_title: 'Ad payment approved',
          p_message: 'Your ad payment was approved. A receipt is now available.',
          p_data: { advertisementId: updatedPayment.advertisement_id, receiptNumber },
        });
      }

      if (status === 'rejected' && updatedPayment.user_id) {
        await supabase.rpc('create_notification', {
          p_user_id: updatedPayment.user_id,
          p_type: 'payment_rejected',
          p_title: updatedPayment.advertisement_id ? 'Ad payment rejected' : 'Payment rejected',
          p_message: updatedPayment.advertisement_id
            ? 'Your ad payment was rejected. Please check the rejection reason.'
            : 'Your subscription payment was rejected. Please check the rejection reason.',
          p_data: {
            advertisementId: updatedPayment.advertisement_id,
            subscriptionPlanId: updatedPayment.subscription_plan_id,
            rejectionReason,
          },
        });
      }

      if (status === 'approved' && !updatedPayment.advertisement_id && updatedPayment.user_id) {
        await supabase.rpc('create_notification', {
          p_user_id: updatedPayment.user_id,
          p_type: 'payment_approved',
          p_title: 'Payment approved',
          p_message: 'Your subscription payment was approved and your plan is active.',
          p_data: { subscriptionPlanId: updatedPayment.subscription_plan_id },
        });
      }

      setPaymentSubmissions((prev) => prev.map((item) => item.id === payment.id ? { ...item, ...patch, status } : item));
      setReactionNotice(status === 'approved' ? 'Payment approved' : 'Payment rejected');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminUserVerification = async (memberId: string, verificationType: 'phone' | 'email' | 'id') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const field = verificationType === 'phone' ? 'phone_verified' : verificationType === 'email' ? 'email_verified' : 'id_verified';
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ [field]: true, ...(verificationType === 'id' ? { verified: true } : {}) })
        .eq('id', memberId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('User verification flag was not updated. Admin user permission may be missing.');
      setAdminUsers((prev) => prev.map((member) => member.id === memberId ? { ...member, [field]: true } : member));
      if (user.id === memberId) setUser((prev) => prev ? { ...prev, [field]: true } : prev);
      setReactionNotice(`${verificationType.toUpperCase()} verified`);
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update user verification');
      window.setTimeout(() => setReactionNotice(null), 2400);
    } finally {
      setSaving(false);
    }
  };

  const toggleAdminUserBan = async (member: WebUser) => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const isBanned = !!member.banned_at;
    const patch = isBanned
      ? { banned_at: null, banned_by: null, ban_reason: null }
      : { banned_at: new Date().toISOString(), banned_by: user.id, ban_reason: 'Banned by admin' };
    setSaving(true);
    try {
      const { error } = await supabase.from('users').update(patch).eq('id', member.id);
      if (error) throw error;
      if (isBanned) {
        await supabase.from('user_restrictions').update({ is_active: false }).eq('user_id', member.id).eq('is_active', true);
      } else {
        await supabase.from('user_restrictions').insert({
          user_id: member.id,
          restricted_feature: 'all',
          reason: 'Banned by admin',
          restricted_by: user.id,
          is_active: true,
        });
      }
      setAdminUsers((prev) => prev.map((item) => item.id === member.id ? { ...item, ...patch } : item));
      setReactionNotice(isBanned ? 'User unbanned' : 'User banned');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminUserRole = async (memberId: string, role: string) => {
    if (!supabase || !user || normalizeRole(user.role) !== 'super_admin') return;
    const { error } = await supabase.from('users').update({ role }).eq('id', memberId);
    if (!error) {
      setAdminUsers((prev) => prev.map((member) => member.id === memberId ? { ...member, role } : member));
      setReactionNotice('Role updated');
      window.setTimeout(() => setReactionNotice(null), 1800);
    }
  };

  const updateFalseReport = async (report: any, status: 'reviewing' | 'dismissed' | 'resolved') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const basePatch: any = {
        status,
        resolution: status === 'reviewing'
          ? 'Admin is reviewing this report. Relationship remains visible until a final decision is made.'
          : status === 'dismissed'
            ? 'Admin reviewed the report and kept the relationship active.'
            : 'Admin confirmed this relationship is false and ended it.',
        resolved_by: user.id,
        updated_at: now,
      };
      if (status !== 'reviewing') basePatch.resolved_at = now;

      if (status === 'resolved') {
        const relationship = report.relationship;
        if (!relationship?.id) throw new Error('Relationship details are missing. Refresh and try again.');
        const relationshipIds = [relationship.id];
        if (relationship.user_id && relationship.partner_user_id) {
          const { data: reciprocalRows, error: reciprocalError } = await supabase
            .from('relationships')
            .select('id')
            .eq('user_id', relationship.partner_user_id)
            .eq('partner_user_id', relationship.user_id)
            .in('status', ['pending', 'verified']);
          if (reciprocalError) throw reciprocalError;
          reciprocalRows?.forEach((row: any) => {
            if (row.id && !relationshipIds.includes(row.id)) relationshipIds.push(row.id);
          });
        }

        const { data: endedRows, error: relationshipError } = await supabase
          .from('relationships')
          .update({ status: 'ended', end_date: now })
          .in('id', relationshipIds)
          .select('id,status,end_date');
        if (relationshipError) throw relationshipError;
        if (!endedRows?.length) throw new Error('Relationship was not ended. Admin relationship permission may be missing.');

        const { data: resolvedReports, error: reportError } = await supabase
          .from('false_relationship_reports')
          .update(basePatch)
          .eq('relationship_id', report.relationship_id)
          .in('status', ['pending', 'reviewing'])
          .select('id,status,resolution,resolved_by,resolved_at,updated_at');
        if (reportError) throw reportError;
        if (!resolvedReports?.length) throw new Error('Relationship ended, but the report was not resolved.');

        const partnerIds = [relationship.user_id, relationship.partner_user_id].filter(Boolean);
        await Promise.all(partnerIds.map((partnerId: string) => supabase.from('notifications').insert({
          user_id: partnerId,
          type: 'false_relationship_resolved',
          title: 'Relationship Removed',
          message: 'An admin reviewed a false relationship report and removed this relationship.',
          data: { relationshipId: relationship.id, affectedRelationshipIds: endedRows.map((row: any) => row.id) },
          read: false,
        })));
        if (report.reported_by) {
          await supabase.from('notifications').insert({
            user_id: report.reported_by,
            type: 'false_relationship_resolved',
            title: 'Report Resolved',
            message: 'An admin confirmed your report and removed the false relationship.',
            data: { reportId: report.id, relationshipId: relationship.id },
            read: false,
          });
        }
        setFalseRelationshipReports((prev) => prev.map((item) => (
          item.relationship_id === report.relationship_id && ['pending', 'reviewing'].includes(item.status)
            ? { ...item, ...basePatch, relationship: item.relationship ? { ...item.relationship, status: 'ended' } : item.relationship }
            : item
        )));
        setAdminRelationships((prev) => prev.map((item) => relationshipIds.includes(item.id) ? { ...item, status: 'ended', end_date: now } : item));
        setReactionNotice('False relationship ended');
      } else {
        const { data, error } = await supabase
          .from('false_relationship_reports')
          .update(basePatch)
          .eq('id', report.id)
          .select('id,status,resolution,resolved_by,resolved_at,updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Report was not updated. Admin report permission may be missing.');
        if (report.reported_by) {
          await supabase.from('notifications').insert({
            user_id: report.reported_by,
            type: 'false_relationship_resolved',
            title: status === 'reviewing' ? 'Report Under Review' : 'Report Dismissed',
            message: status === 'reviewing'
              ? 'Your false relationship report is under admin review. The relationship remains visible until a final decision is made.'
              : 'An admin reviewed your report and kept the relationship active.',
            data: { reportId: report.id, relationshipId: report.relationship_id },
            read: false,
          });
        }
        setFalseRelationshipReports((prev) => prev.map((item) => item.id === report.id ? { ...item, ...basePatch } : item));
        setReactionNotice(status === 'reviewing' ? 'Report under review' : 'Report dismissed');
      }
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update report');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateBanAppeal = async (appeal: any, action: 'approve' | 'reject') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const patch = {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_response: action === 'approve'
          ? 'Appeal approved. The related restriction has been lifted.'
          : 'Appeal rejected after admin review.',
      };
      const { data, error } = await supabase
        .from('ban_appeals')
        .update(patch)
        .eq('id', appeal.id)
        .select('id,status,reviewed_by,reviewed_at,admin_response')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Appeal was not updated. Admin appeal permission may be missing.');

      if (action === 'approve') {
        if (appeal.restriction_id) {
          const { error: restrictionError } = await supabase
            .from('user_restrictions')
            .update({ is_active: false })
            .eq('id', appeal.restriction_id);
          if (restrictionError) throw restrictionError;
        } else if (appeal.appeal_type === 'full_ban') {
          const { error: userError } = await supabase
            .from('users')
            .update({ banned_at: null, banned_by: null, ban_reason: null })
            .eq('id', appeal.user_id);
          if (userError) throw userError;

          const { error: restrictionError } = await supabase
            .from('user_restrictions')
            .update({ is_active: false })
            .eq('user_id', appeal.user_id)
            .eq('restricted_feature', 'all');
          if (restrictionError) throw restrictionError;
        } else if (appeal.restricted_feature) {
          const { error: restrictionError } = await supabase
            .from('user_restrictions')
            .update({ is_active: false })
            .eq('user_id', appeal.user_id)
            .eq('restricted_feature', appeal.restricted_feature)
            .eq('is_active', true);
          if (restrictionError) throw restrictionError;
        }
      }

      if (appeal.user_id) {
        await supabase.from('notifications').insert({
          user_id: appeal.user_id,
          type: 'ban_appeal_reviewed',
          title: action === 'approve' ? 'Appeal approved' : 'Appeal rejected',
          message: patch.admin_response,
          data: { appealId: appeal.id, action },
          read: false,
        });
      }

      setRouteRows((prev) => prev.map((item) => item.id === appeal.id ? { ...item, ...patch } : item));
      setReactionNotice(action === 'approve' ? 'Appeal approved' : 'Appeal rejected');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update appeal');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateAdminDatingProfile = async (
    profile: any,
    action: 'suspend' | 'unsuspend' | 'limit' | 'unlimit' | 'premium' | 'badge_verified' | 'badge_premium' | 'delete'
  ) => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (action === 'delete' && !window.confirm('Delete this dating profile? This cannot be undone.')) return;
    setSaving(true);
    try {
      if (action === 'suspend' || action === 'unsuspend' || action === 'limit' || action === 'unlimit') {
        const now = new Date().toISOString();
        const patch = action === 'suspend'
          ? {
              admin_suspended: true,
              admin_suspended_at: now,
              admin_suspended_by: user.id,
              admin_suspended_reason: 'Suspended by admin',
              is_active: false,
            }
          : action === 'unsuspend'
            ? {
                admin_suspended: false,
                admin_suspended_at: null,
                admin_suspended_by: null,
                admin_suspended_reason: null,
                is_active: true,
              }
            : action === 'limit'
              ? {
                  admin_limited: true,
                  admin_limited_at: now,
                  admin_limited_by: user.id,
                  admin_limited_reason: 'Limited by admin',
                }
              : {
                  admin_limited: false,
                  admin_limited_at: null,
                  admin_limited_by: null,
                  admin_limited_reason: null,
                };
        const { data, error } = await supabase
          .from('dating_profiles')
          .update(patch)
          .eq('id', profile.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Dating profile was not updated. Admin dating permission may be missing.');
        setRouteRows((prev) => prev.map((item) => item.id === profile.id ? { ...item, ...patch } : item));
        setReactionNotice(action === 'suspend' ? 'Profile suspended' : action === 'unsuspend' ? 'Profile unsuspended' : action === 'limit' ? 'Profile limited' : 'Profile limit removed');
      }

      if (action === 'premium') {
        const { error } = await supabase.rpc('grant_trial_premium', {
          p_user_id: profile.user_id,
          p_granted_by: user.id,
          p_days: 7,
        });
        if (error) throw error;
        setRouteRows((prev) => prev.map((item) => item.id === profile.id ? { ...item, premium_trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } : item));
        setReactionNotice('7-day premium trial granted');
      }

      if (action === 'badge_verified' || action === 'badge_premium') {
        const badgeType = action === 'badge_verified' ? 'verified' : 'premium';
        const { error } = await supabase
          .from('user_dating_badges')
          .upsert({
            user_id: profile.user_id,
            badge_type: badgeType,
            earned_at: new Date().toISOString(),
          }, { onConflict: 'user_id,badge_type' });
        if (error) throw error;
        setReactionNotice(`${badgeType} badge granted`);
      }

      if (action === 'delete') {
        const { data, error } = await supabase
          .from('dating_profiles')
          .delete()
          .eq('id', profile.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Dating profile was not deleted. Admin dating permission may be missing.');
        setRouteRows((prev) => prev.filter((item) => item.id !== profile.id));
        setReactionNotice('Dating profile deleted');
      }

      window.setTimeout(() => setReactionNotice(null), 2000);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update dating profile');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateProfessionalReviewModeration = async (review: any, status: 'approved' | 'rejected' | 'flagged') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const patch = {
        moderation_status: status,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        moderation_reason: status === 'approved' ? null : `${status} by admin`,
      };
      const { data, error } = await supabase
        .from('professional_reviews')
        .update(patch)
        .eq('id', review.id)
        .select('id,moderation_status,moderation_reason,moderated_by,moderated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Review was not moderated. Admin review permission may be missing.');
      setAdminProfessionalReviews((prev) => prev.map((item) => item.id === review.id ? { ...item, ...patch } : item));
      setReactionNotice(`Review ${status}`);
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not moderate review');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          full_name: settingsForm.fullName.trim(),
          username: settingsForm.username.trim() || null,
          phone_number: settingsForm.phoneNumber.trim(),
          profile_picture: settingsProfilePictureUrl.trim() || null,
          email: user.email || null,
          role: user.role || null,
        }, { onConflict: 'id' });
      if (error) throw error;
      setUser((prev) => prev ? {
        ...prev,
        full_name: settingsForm.fullName.trim(),
        username: settingsForm.username.trim() || null,
        phone_number: settingsForm.phoneNumber.trim(),
        profile_picture: settingsProfilePictureUrl.trim() || null,
      } : prev);
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
      const { data: savedProfile, error } = await supabase
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
          intention_tag: datingForm.intention,
          is_active: true,
        }, { onConflict: 'user_id' })
        .select('id')
        .single();
      if (error) throw error;
      if (datingPhotoUrl.trim() && savedProfile?.id) {
        await supabase.from('dating_photos').upsert({
          dating_profile_id: savedProfile.id,
          photo_url: datingPhotoUrl.trim(),
          is_primary: true,
        }, { onConflict: 'dating_profile_id,photo_url' });
      }
      setDatingPhotoUrl('');
      setDatingProfileStep(1);
      setReactionNotice('Dating saved');
      window.setTimeout(() => setReactionNotice(null), 1800);
      await loadAppData();
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not save dating preferences');
      window.setTimeout(() => setReactionNotice(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const toggleFilterValue = (key: keyof DatingDiscoveryFilters, value: string) => {
    setDatingFilters((prev) => {
      const current = ((prev[key] as string[] | undefined) || []);
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const applyDatingFilters = async () => {
    const minAge = Number(datingFilters.minAge || 18);
    const maxAge = Number(datingFilters.maxAge || 99);
    const maxDistance = Number(datingFilters.maxDistance || 50);
    if (!Number.isFinite(minAge) || !Number.isFinite(maxAge) || minAge < 18 || maxAge > 99 || minAge > maxAge) {
      setReactionNotice('Check your age range');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    if (!Number.isFinite(maxDistance) || maxDistance < 1 || maxDistance > 500) {
      setReactionNotice('Distance should be between 1 and 500 km');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    try {
      window.localStorage.setItem(DATING_DISCOVERY_FILTERS_KEY, JSON.stringify({
        ...datingFilters,
        minAge,
        maxAge,
        maxDistance,
      }));
    } catch {
      // ignore storage failures and still apply profile-level preferences
    }
    setDatingForm((prev) => ({
      ...prev,
      lookingFor: datingFilters.lookingFor || 'everyone',
      minAge: String(minAge),
      maxAge: String(maxAge),
      distance: String(maxDistance),
      city: datingFilters.locationCity || '',
      country: datingFilters.locationCountry || '',
      intention: datingFilters.intentionTags?.[0] || prev.intention,
    }));
    await saveDatingProfile();
  };

  const resetDatingFilters = () => {
    try {
      window.localStorage.removeItem(DATING_DISCOVERY_FILTERS_KEY);
    } catch {
      // ignore storage failures
    }
    setDatingFilters({
      minAge: 18,
      maxAge: 99,
      maxDistance: 50,
      lookingFor: 'everyone',
      locationCity: '',
      locationCountry: '',
      intentionTags: [],
      religions: [],
      educationLevels: [],
      kids: [],
      drink: [],
      smoke: [],
      exercise: [],
      pets: [],
      interests: [],
      minHeightCm: undefined,
      maxHeightCm: undefined,
      hasPhotos: false,
      verifiedOnly: false,
      activeRecently: false,
    });
    setReactionNotice('Filters reset');
    window.setTimeout(() => setReactionNotice(null), 1800);
  };

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setReactionNotice('Location is not available');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setReactionNotice('Location detected. You can still edit city/country.');
        window.setTimeout(() => setReactionNotice(null), 2200);
      },
      () => {
        setReactionNotice('Allow location or type your city');
        window.setTimeout(() => setReactionNotice(null), 2200);
      }
    );
  };

  const uploadMediaFile = useCallback(async (file: File, folder: string) => {
    if (!supabase || !user) throw new Error('Please sign in again before uploading.');
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const filePath = `${folder}/${user.id}/${fileName}`;
    const { data, error } = await supabase.storage.from('media').upload(filePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from('media').getPublicUrl(data.path);
    return publicData.publicUrl;
  }, [supabase, user]);

  const handleFileUpload = useCallback(async (
    event: any,
    folder: string,
    label: string,
    onUploaded: (url: string) => void
  ) => {
    const file = event?.target?.files?.[0] as File | undefined;
    if (!file) return;
    setUploadingLabel(label);
    try {
      const url = await uploadMediaFile(file, folder);
      onUploaded(url);
      setReactionNotice(`${label} uploaded`);
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch {
      setReactionNotice(`Failed to upload ${label.toLowerCase()}`);
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      setUploadingLabel(null);
      if (event?.target) event.target.value = '';
    }
  }, [uploadMediaFile]);

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
            <Avatar src={user?.profile_picture} name={getUserDisplayName(user)} size="sm" />
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
            {isAdminRole(user?.role) ? (
              <Link href="/app/admin" className="block rounded-xl px-3 py-3 hover:bg-slate-50" onClick={() => setShowHeaderMenu(false)}>Admin</Link>
            ) : null}
          </div>
        ) : null}
      </header>
    );
  };

  const renderStatusStrip = (compact = false) => {
    if (!statusFeed.length) {
      return (
        <div className="flex gap-3 overflow-x-auto px-1 pb-1">
          <Link href="/app/create-status" className="flex min-w-[92px] flex-col items-center rounded-[20px] border border-dashed border-blue-200 bg-blue-50 px-3 py-4 text-center text-blue-700">
            <Plus className="h-6 w-6" />
            <span className="mt-2 text-xs font-black">Add status</span>
          </Link>
        </div>
      );
    }
    return (
      <div className="flex gap-3 overflow-x-auto px-1 pb-1">
        <Link href="/app/create-status" className={`${compact ? 'min-w-[72px]' : 'min-w-[92px]'} flex flex-col items-center rounded-[20px] bg-blue-50 px-3 py-4 text-center text-blue-700 ring-1 ring-blue-100`}>
          <Plus className="h-6 w-6" />
          <span className="mt-2 text-xs font-black">Your story</span>
        </Link>
        {statusFeed.map((item) => (
          <Link key={item.user_id} href={`/app/status/${item.user_id}`} className={`${compact ? 'min-w-[76px]' : 'min-w-[104px]'} relative overflow-hidden rounded-[20px] bg-slate-900 p-2 text-white shadow-sm`}>
            <div className="absolute inset-0 opacity-60" style={{ background: item.latest_status?.background_color || 'linear-gradient(135deg,#2563eb,#ec4899)' }} />
            {item.latest_status?.media_path ? <img src={item.latest_status.media_path} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
            <div className="relative z-10 flex min-h-[96px] flex-col justify-between">
              <Avatar src={item.user_avatar} name={item.user_name} size="sm" />
              <div>
                <p className="line-clamp-2 text-xs font-black">{item.latest_status?.text_content || item.user_name}</p>
                <p className="mt-1 truncate text-[10px] font-semibold text-white/75">{item.user_name}</p>
              </div>
            </div>
            {item.has_unviewed ? <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-pink-500 ring-2 ring-white" /> : null}
          </Link>
        ))}
      </div>
    );
  };

  const renderHome = () => (
    <div className="px-4 py-4">
      <section className="rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-800 px-5 py-6 text-white shadow-xl shadow-blue-700/20">
        <div className="flex items-center gap-3">
          <Avatar src={user?.profile_picture} name={getUserDisplayName(user)} size="lg" />
          <div>
            <p className="text-sm font-semibold text-blue-100">Welcome back</p>
            <h2 className="text-2xl font-black">{getUserDisplayName(user)}</h2>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-blue-50">Verify love, stay accountable, meet meaningful people, and keep every connection in one familiar app experience.</p>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          { href: '/app/relationship/register', label: 'Register', icon: Shield, text: 'Register relationship' },
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
            <Link href="/app/relationship/register" className="mt-4 inline-flex items-center gap-2 rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">
              <Plus className="h-5 w-5" />
              Get Started
            </Link>
          </div>
        )}
      </section>
      {isAdminRole(user?.role) ? (
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
        {renderStatusStrip()}
        <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm">
          <Avatar src={user?.profile_picture} name={getUserDisplayName(user)} />
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
                  <p className="font-black">{getUserDisplayName(reel.users)}</p>
                  <p className="mt-2 text-sm leading-5 text-white/85">{reel.caption || 'Shared a reel'}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button type="button" onClick={() => void toggleReelLike(reel)} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 backdrop-blur">
                    <Heart className={`h-6 w-6 ${user && reel.likes?.includes(user.id) ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
                  </button>
                  <Link href={`/app/reel/${reel.id}#comments`} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 backdrop-blur">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </Link>
                  <button type="button" onClick={() => void shareText('Committed Reel', buildReelWebUrl(reel.id))} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 backdrop-blur">
                    <Share2 className="h-6 w-6" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void toggleReelLike(reel)} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">
                  {user && reel.likes?.includes(user.id) ? 'Liked' : 'Like'}
                </button>
                <Link href={`/app/reel/${reel.id}#comments`} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">
                  Comments
                </Link>
                <button type="button" onClick={() => void shareText('Committed Reel', buildReelWebUrl(reel.id))} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">
                  Share
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderPostDetail = () => {
    const postId = appPath[1];
    const post = posts.find((item) => item.id === postId) || routePost;
    const comments = postId ? (postCommentsByPost[postId] || []) : [];
    const draftKey = `post:${postId}`;
    if (routePostLoading) return <ScreenSkeleton />;
    if (!post) return <EmptyState icon={Heart} title="Post Not Found" text="This post is not loaded or is no longer available." action="Back to Feed" onAction={() => router.push('/app/feed')} />;
    return (
      <div className="space-y-3 px-3 py-3">
        <PostCard post={post} user={user} onLike={togglePostLike} onShare={shareText} />
        <CommentThread
          id="comments"
          title="Comments"
          comments={comments}
          loading={!!commentsLoadingByTarget[`post:${post.id}`]}
          draft={commentDrafts[draftKey] || ''}
          onDraftChange={(value) => setCommentDrafts((prev) => ({ ...prev, [draftKey]: value }))}
          onSubmit={() => void submitPostComment(post.id)}
          replyDrafts={replyDrafts}
          onReplyDraftChange={(key, value) => setReplyDrafts((prev) => ({ ...prev, [key]: value }))}
          onReply={(commentId) => void submitPostComment(post.id, commentId)}
          targetPrefix={`post:${post.id}`}
          submittingKey={commentSubmittingKey}
        />
      </div>
    );
  };

  const renderReelDetail = () => {
    const reelId = appPath[1];
    const reel = reels.find((item) => item.id === reelId) || routeReel;
    const comments = reelId ? (reelCommentsByReel[reelId] || []) : [];
    const draftKey = `reel:${reelId}`;
    if (routeReelLoading) return <ScreenSkeleton />;
    if (!reel) return <EmptyState icon={Film} title="Reel Not Found" text="This reel is not loaded or is no longer available." action="Back to Reels" onAction={() => router.push('/app/reels')} />;
    return (
      <div className="space-y-3 bg-slate-950 pb-3">
        <article className="relative min-h-[calc(100vh-122px)] overflow-hidden bg-slate-900">
          {reel.video_url ? <video src={reel.video_url} poster={reel.thumbnail_url || undefined} controls className="h-full min-h-[calc(100vh-122px)] w-full object-cover" /> : reel.thumbnail_url ? <img src={reel.thumbnail_url} alt="" className="h-full min-h-[calc(100vh-122px)] w-full object-cover" /> : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-white">
            <p className="font-black">{getUserDisplayName(reel.users)}</p>
            <p className="mt-2 text-sm leading-5 text-white/85">{reel.caption || 'Shared a reel'}</p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void toggleReelLike(reel)} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">{user && reel.likes?.includes(user.id) ? 'Liked' : 'Like'}</button>
              <button type="button" onClick={() => void shareText('Committed Reel', buildReelWebUrl(reel.id))} className="rounded-full bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">Share</button>
              <a href="#comments" className="rounded-full bg-white/18 px-4 py-2 text-sm font-black backdrop-blur">Comments</a>
            </div>
          </div>
        </article>
        <div className="px-3">
          <CommentThread
            id="comments"
            title="Reel comments"
            comments={comments}
            loading={!!commentsLoadingByTarget[`reel:${reel.id}`]}
            draft={commentDrafts[draftKey] || ''}
            onDraftChange={(value) => setCommentDrafts((prev) => ({ ...prev, [draftKey]: value }))}
            onSubmit={() => void submitReelComment(reel.id)}
            replyDrafts={replyDrafts}
            onReplyDraftChange={(key, value) => setReplyDrafts((prev) => ({ ...prev, [key]: value }))}
            onReply={(commentId) => void submitReelComment(reel.id, commentId)}
            targetPrefix={`reel:${reel.id}`}
            submittingKey={commentSubmittingKey}
          />
        </div>
      </div>
    );
  };

  const renderStatusViewer = () => {
    const targetId = appPath[1];
    const item = appPath[0] === 'status-item'
      ? statusFeed.find((status) => status.latest_status?.id === targetId)
      : (targetId ? statusFeed.find((status) => status.user_id === targetId) : statusFeed[0]);
    const resolvedItem = item || routeStatusItem;
    if (routeStatusLoading && !resolvedItem) return <ScreenSkeleton />;
    if (!resolvedItem) return <EmptyState icon={Sparkles} title="No Status" text="This status is no longer available." action="Back to Feed" onAction={() => router.push('/app/feed')} />;
    return (
      <div className="grid min-h-[calc(100vh-122px)] place-items-center bg-slate-950 p-4 text-white">
        <section className="relative flex min-h-[70vh] w-full flex-col justify-between overflow-hidden rounded-[28px] p-5 shadow-2xl" style={{ background: resolvedItem.latest_status?.background_color || 'linear-gradient(135deg,#2563eb,#ec4899)' }}>
          {resolvedItem.latest_status?.media_path ? <img src={resolvedItem.latest_status.media_path} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
          <div className="relative z-10 flex items-center gap-3">
            <Avatar src={resolvedItem.user_avatar} name={resolvedItem.user_name} />
            <div>
              <p className="font-black">{resolvedItem.user_name}</p>
              <p className="text-xs font-semibold text-white/75">{timeAgo(resolvedItem.latest_status?.created_at)}</p>
            </div>
          </div>
          <p className="relative z-10 text-4xl font-black leading-tight">{resolvedItem.latest_status?.text_content || 'Status'}</p>
        </section>
      </div>
    );
  };

  const renderCreatePost = () => (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <Avatar src={user?.profile_picture} name={getUserDisplayName(user)} />
        <div>
          <p className="font-black text-slate-950">{getUserDisplayName(user)}</p>
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
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
        <UploadCloud className="h-5 w-5 text-blue-600" />
        {uploadingLabel === 'Post image' ? 'Uploading image...' : (postImageUrl ? 'Change post image' : 'Add post image')}
        <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'posts', 'Post image', setPostImageUrl)} />
      </label>
      {postImageUrl ? <img src={postImageUrl} alt="Post preview" className="max-h-[260px] w-full rounded-[18px] object-cover" /> : null}
      <button type="button" onClick={() => void createPost()} disabled={(!postDraft.trim() && !postImageUrl.trim()) || isCreatingContent} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
        {isCreatingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Post
      </button>
    </div>
  );

  const renderCreateStatus = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[28px] bg-gradient-to-br from-blue-600 to-pink-500 p-5 text-white shadow-xl shadow-blue-600/20">
        <Sparkles className="h-10 w-10" />
        <h2 className="mt-4 text-3xl font-black">Create status</h2>
        <p className="mt-2 text-sm leading-6 text-white/85">Share a 24-hour update with the same status system used in the mobile app.</p>
      </section>
      <textarea
        value={statusDraft}
        onChange={(event) => setStatusDraft(event.target.value)}
        placeholder="What do you want people to know today?"
        rows={7}
        className="w-full resize-none rounded-[24px] border border-slate-200 bg-white p-4 text-lg font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
        <UploadCloud className="h-5 w-5 text-blue-600" />
        {uploadingLabel === 'Status media' ? 'Uploading media...' : (statusMediaUrl ? 'Change status media' : 'Add status media')}
        <input type="file" accept="image/*,video/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'status', 'Status media', setStatusMediaUrl)} />
      </label>
      {statusMediaUrl ? (
        statusMediaUrl.match(/\.(mp4|webm|mov)(\?|$)/i)
          ? <video src={statusMediaUrl} controls className="max-h-[260px] w-full rounded-[18px] bg-black object-contain" />
          : <img src={statusMediaUrl} alt="Status preview" className="max-h-[260px] w-full rounded-[18px] object-cover" />
      ) : null}
      <button type="button" onClick={() => void createStatus()} disabled={(!statusDraft.trim() && !statusMediaUrl.trim()) || isCreatingContent} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
        {isCreatingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Share status
      </button>
    </div>
  );

  const renderCreateReel = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[26px] bg-slate-950 p-5 text-white">
        <Film className="h-9 w-9 text-blue-300" />
        <h2 className="mt-3 text-2xl font-black">Create Reel</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">Upload a video or paste a hosted URL to publish a reel on web.</p>
      </section>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
        <UploadCloud className="h-5 w-5 text-blue-600" />
        {uploadingLabel === 'Reel video' ? 'Uploading video...' : (reelVideoUrl ? 'Change reel video' : 'Upload reel video')}
        <input type="file" accept="video/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'reels', 'Reel video', setReelVideoUrl)} />
      </label>
      {reelVideoUrl ? <video src={reelVideoUrl} controls className="max-h-[260px] w-full rounded-[18px] bg-black object-contain" /> : null}
      <FormField label="Video URL" value={reelDraft.videoUrl} onChange={(videoUrl) => setReelDraft((prev) => ({ ...prev, videoUrl }))} placeholder="https://..." />
      <FormField label="Caption" value={reelDraft.caption} onChange={(caption) => setReelDraft((prev) => ({ ...prev, caption }))} multiline placeholder="Write a caption..." />
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
        <UploadCloud className="h-5 w-5 text-blue-600" />
        {uploadingLabel === 'Reel thumbnail' ? 'Uploading thumbnail...' : (reelThumbnailUploadUrl ? 'Change thumbnail' : 'Upload thumbnail')}
        <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'reels', 'Reel thumbnail', setReelThumbnailUploadUrl)} />
      </label>
      {reelThumbnailUploadUrl ? <img src={reelThumbnailUploadUrl} alt="Reel thumbnail preview" className="max-h-[220px] w-full rounded-[18px] object-cover" /> : null}
      <FormField label="Thumbnail URL" value={reelDraft.thumbnailUrl} onChange={(thumbnailUrl) => setReelDraft((prev) => ({ ...prev, thumbnailUrl }))} placeholder="Optional" />
      <button type="button" onClick={() => void createReel()} disabled={(!reelDraft.videoUrl.trim() && !reelVideoUrl.trim()) || isCreatingContent} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
        {isCreatingContent ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Publish reel
      </button>
    </div>
  );

  const renderDating = () => {
    const profile = datingProfiles[datingIndex];
    if (!profile) {
      return (
        <div>
          <div className="mx-4 mt-4 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            <p>Dating debug: initial {datingDebug.initial}, filtered {datingDebug.afterInitialFilters}, likes excluded {datingDebug.likedExcluded}, passes excluded {datingDebug.passedExcluded}, fallbacks {datingDebug.fallbackRuns}, final {datingDebug.final}</p>
            {datingDebug.lastError ? <p className="mt-1">Query error: {datingDebug.lastError}</p> : null}
          </div>
          <EmptyState
            icon={Sparkles}
            title="No More Profiles"
            text="You have seen everyone for now. Refresh, adjust filters, or load passed profiles again."
            action="See Passed Profiles"
            onAction={() => void resetDatingPasses()}
            secondaryAction="Adjust Filters"
            onSecondaryAction={() => router.push('/app/dating/filters')}
          />
        </div>
      );
    }
    const photo = profile.dating_photos?.find((item) => item.is_primary)?.photo_url || profile.dating_photos?.[0]?.photo_url || profile.users?.profile_picture;
    const name = profile.users?.full_name || 'Committed dater';
    const tags = [...(profile.relationship_goals || []), ...(profile.interests || [])].slice(0, 4);
    const openDatingProfile = () => {
      if (!profile.user_id) return;
      router.push(`/app/dating/user-profile?userId=${encodeURIComponent(profile.user_id)}`);
    };
    return (
      <div className="flex min-h-[calc(100vh-122px)] flex-col px-4 pb-4 pt-3">
        <button
          type="button"
          onClick={openDatingProfile}
          className="relative flex-1 overflow-hidden rounded-[26px] bg-slate-900 text-left shadow-2xl shadow-slate-950/20"
        >
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
        </button>
        <button type="button" onClick={openDatingProfile} className="mt-3 w-full rounded-[16px] bg-white py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200">
          Open full profile
        </button>
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
            <Avatar src={like.user?.profile_picture} name={getUserDisplayName(like.user)} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{getUserDisplayName(like.user) || 'Someone liked you'}</p>
              <p className="text-sm font-semibold text-slate-500">{like.is_super_like ? 'Sent a super like' : 'Liked your profile'} - {timeAgo(like.created_at)}</p>
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
            <Avatar src={match.user?.profile_picture} name={getUserDisplayName(match.user)} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{getUserDisplayName(match.user) || 'Matched member'}</p>
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

  const renderDatingDashboard = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-700 p-5 text-white shadow-xl shadow-pink-500/20">
        <Sparkles className="h-10 w-10" />
        <h2 className="mt-4 text-3xl font-black">Dating</h2>
        <p className="mt-2 text-sm leading-6 text-white/85">Discover, matches, likes, premium, and date planning in one place.</p>
      </section>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Link href="/app/dating/matches" className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-3xl font-black text-blue-600">{datingMatches.length}</p>
          <p className="text-xs font-black text-slate-500">Matches</p>
        </Link>
        <Link href="/app/dating/likes-received" className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-3xl font-black text-pink-600">{datingLikes.length}</p>
          <p className="text-xs font-black text-slate-500">Likes</p>
        </Link>
        <Link href="/app/dating/date-requests" className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-3xl font-black text-amber-500">{dateRequests.filter((item) => item.status === 'pending').length}</p>
          <p className="text-xs font-black text-slate-500">Dates</p>
        </Link>
      </div>
      <div className="space-y-3">
        {[
          ['/app/dating', 'Discover', 'Swipe and meet meaningful people'],
          ['/app/dating/matches', 'My Matches', 'People who liked you back'],
          ['/app/dating/likes-received', 'Who Liked Me', 'Likes and super likes'],
          ['/app/dating/date-requests', 'Date Requests', 'Plan a real date'],
          ['/app/dating/profile-setup', 'Dating Profile', 'Photos, bio, religion, interests, goals'],
          ['/app/dating/filters', 'Preferences', 'Age, location, intention, and trust filters'],
          ['/app/dating/premium', 'Premium', 'Unlock more dating tools'],
        ].map(([href, title, text]) => (
          <Link key={href} href={href} className="block rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const renderDateRequests = () => {
    if (subPath === 'create-date-request' || subPath === 'edit-date-request') {
      const matchedOptions = datingMatches.map((match) => ({
        id: match.user?.id || (match.user1_id === user?.id ? match.user2_id : match.user1_id),
        name: getUserDisplayName(match.user),
      })).filter((item) => item.id);
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-700 p-5 text-white">
            <Calendar className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">Create Date Request</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Plan a date with one of your matches.</p>
          </section>
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">Match</span>
            <select value={dateForm.recipientId} onChange={(event) => setDateForm((prev) => ({ ...prev, recipientId: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none">
              <option value="">Select a match</option>
              {matchedOptions.map((option) => <option key={option.id} value={option.id || ''}>{option.name}</option>)}
            </select>
          </label>
          <FormField label="Date title" value={dateForm.title} onChange={(title) => setDateForm((prev) => ({ ...prev, title }))} placeholder="Coffee and conversation" />
          <FormField label="Description" value={dateForm.description} onChange={(description) => setDateForm((prev) => ({ ...prev, description }))} multiline placeholder="Tell them about the date..." />
          <FormField label="Location" value={dateForm.location} onChange={(location) => setDateForm((prev) => ({ ...prev, location }))} placeholder="Place or area" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date" value={dateForm.proposedDate} onChange={(proposedDate) => setDateForm((prev) => ({ ...prev, proposedDate }))} placeholder="YYYY-MM-DD" />
            <FormField label="Time" value={dateForm.proposedTime} onChange={(proposedTime) => setDateForm((prev) => ({ ...prev, proposedTime }))} placeholder="18:00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Duration hours" value={dateForm.durationHours} onChange={(durationHours) => setDateForm((prev) => ({ ...prev, durationHours }))} inputMode="numeric" />
            <FormField label="Dress code" value={dateForm.dressCode} onChange={(dressCode) => setDateForm((prev) => ({ ...prev, dressCode }))} placeholder="casual" />
          </div>
          <FormField label="Special requests" value={dateForm.specialRequests} onChange={(specialRequests) => setDateForm((prev) => ({ ...prev, specialRequests }))} multiline placeholder="Anything they should know?" />
          <button type="button" onClick={() => void createDateRequest()} disabled={saving || !dateForm.recipientId || !dateForm.title.trim() || !dateForm.location.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Send date request
          </button>
        </div>
      );
    }
    if (!dateRequests.length) {
      return <EmptyState icon={Calendar} title="No Date Requests" text="Create a date request with one of your matches to plan your first date." action="Go to Matches" onAction={() => router.push('/app/dating/matches')} />;
    }
    const filteredRequests = dateRequests.filter((request) => dateRequestTab === 'sent' ? request.from_user_id === user?.id : request.to_user_id === user?.id);
    return (
      <div className="space-y-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-white p-2 ring-1 ring-slate-200">
          {(['received', 'sent'] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setDateRequestTab(tab)} className={`rounded-[16px] py-3 text-sm font-black capitalize ${dateRequestTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>
        {!filteredRequests.length ? (
          <EmptyState
            icon={Calendar}
            title={dateRequestTab === 'received' ? 'No Received Requests' : 'No Sent Requests'}
            text={dateRequestTab === 'received' ? 'Date invitations sent to you will appear here.' : 'Date requests you send to matches will appear here.'}
            action={dateRequestTab === 'sent' ? 'Create Date Request' : 'Go to Matches'}
            onAction={() => router.push(dateRequestTab === 'sent' ? '/app/dating/create-date-request' : '/app/dating/matches')}
          />
        ) : null}
        {filteredRequests.map((request) => {
          const incoming = request.to_user_id === user?.id;
          const other = incoming ? request.from_user : request.to_user;
          return (
            <article key={request.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <Avatar src={other?.profile_picture} name={getUserDisplayName(other)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-slate-950">{request.date_title || 'Date request'}</p>
                  <p className="truncate text-sm text-slate-500">{incoming ? 'From' : 'To'} {getUserDisplayName(other)}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{request.location_name || 'Location not set'}</p>
                  <p className="text-xs font-semibold text-slate-400">{[request.proposed_date, request.proposed_time].filter(Boolean).join(' ')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${request.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : request.status === 'declined' || request.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{request.status || 'pending'}</span>
              </div>
              {request.date_description ? <p className="mt-3 text-sm leading-6 text-slate-600">{request.date_description}</p> : null}
              {request.status === 'pending' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {incoming ? (
                    <>
                      <button type="button" onClick={() => void respondToDateRequest(request.id, 'accepted')} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white">Accept</button>
                      <button type="button" onClick={() => void respondToDateRequest(request.id, 'declined')} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white">Decline</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void respondToDateRequest(request.id, 'cancelled')} className="col-span-2 rounded-[16px] bg-red-50 py-3 text-sm font-black text-red-600">Cancel request</button>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    );
  };

  const renderDatingPremium = () => {
    const premiumFeatures = [
      ['See Who Liked You', 'View all profiles that liked you'],
      ['Unlimited Super Likes', 'Stand out with stronger signals'],
      ['Unlimited Rewinds', 'Go back and swipe again'],
      ['Boost Your Profile', 'Get more profile views'],
      ['Priority Likes', 'Your likes appear first'],
      ['Advanced Filters', 'Filter with more detail'],
    ];
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-600 p-6 text-center text-white shadow-xl shadow-pink-500/20">
          <Star className="mx-auto h-14 w-14 fill-white" />
          <h2 className="mt-4 text-3xl font-black">Unlock Premium</h2>
          <p className="mt-2 text-sm leading-6 text-white/85">Get more matches and unlock the dating tools from the mobile app.</p>
        </section>
        <section className="space-y-2 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-black text-slate-950">Premium Features</h3>
          {premiumFeatures.map(([title, text]) => (
            <div key={title} className="flex gap-3 border-t border-slate-100 py-3 first:border-t-0">
              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-black text-slate-950">{title}</p>
                <p className="text-sm text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="space-y-3">
          {subscriptionPlans.map((plan) => (
            <article key={plan.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{plan.display_name || plan.name || 'Premium'}</p>
                  <p className="mt-1 text-sm text-slate-500">{plan.description || 'Premium dating access'}</p>
                </div>
                <p className="font-black text-blue-600">${Number(plan.price_monthly || plan.price_yearly || 0).toFixed(2)}</p>
              </div>
              <Link href={`/app/dating/payment-submit?planId=${plan.id}`} className="mt-4 flex justify-center rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">Subscribe</Link>
            </article>
          ))}
          {!subscriptionPlans.length ? <EmptyState icon={Star} title="No Paid Plans" text="Free dating access is active by default. Premium plans will appear here when configured." /> : null}
        </section>
      </div>
    );
  };

  const renderDatingPaymentSubmit = () => {
    const planId = searchParams?.get('planId') || paymentForm.planId || subscriptionPlans[0]?.id || '';
    const plan = subscriptionPlans.find((item) => item.id === planId) || subscriptionPlans[0];
    const selectedMethod = paymentMethods.find((item) => item.id === paymentForm.methodId) || paymentMethods[0];
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-blue-600 p-5 text-white shadow-xl shadow-blue-600/20">
          <CreditCard className="h-10 w-10" />
          <h2 className="mt-4 text-3xl font-black">Submit Payment</h2>
          <p className="mt-2 text-sm leading-6 text-blue-50">Send proof for admin verification. Premium activates only after approval.</p>
        </section>
        {plan ? (
          <article className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">{plan.display_name || plan.name}</p>
            <p className="mt-1 text-sm text-slate-500">{plan.description || 'Dating premium plan'}</p>
            <p className="mt-3 text-xl font-black text-blue-600">${Number(plan.price_monthly || plan.price_yearly || 0).toFixed(2)}</p>
          </article>
        ) : <EmptyState icon={CreditCard} title="Plan Not Found" text="Choose a premium plan first." action="Premium" onAction={() => router.push('/app/dating/premium')} />}
        <label className="block text-sm font-black text-slate-700">
          Payment method
          <select value={paymentForm.methodId || selectedMethod?.id || ''} onChange={(event) => setPaymentForm((prev) => ({ ...prev, methodId: event.target.value, planId }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500">
            <option value="">Select method</option>
            {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
          </select>
        </label>
        {selectedMethod ? (
          <div className="rounded-[22px] bg-blue-50 p-4 text-sm leading-6 text-blue-950 ring-1 ring-blue-100">
            <p className="font-black">{selectedMethod.name}</p>
            <p className="mt-1">{selectedMethod.instructions || selectedMethod.description || 'Use this method, then paste your proof URL below.'}</p>
          </div>
        ) : null}
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
          <UploadCloud className="h-5 w-5 text-blue-600" />
          {uploadingLabel === 'Payment proof' ? 'Uploading proof...' : 'Upload payment proof'}
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => void handleFileUpload(event, 'payments', 'Payment proof', (url) => setPaymentForm((prev) => ({ ...prev, proofUrl: url, planId })))} />
        </label>
        <FormField label="Payment proof URL" value={paymentForm.proofUrl} onChange={(proofUrl) => setPaymentForm((prev) => ({ ...prev, proofUrl, planId }))} placeholder="https://..." />
        <FormField label="Transaction reference" value={paymentForm.reference} onChange={(reference) => setPaymentForm((prev) => ({ ...prev, reference, planId }))} placeholder="Optional" />
        <FormField label="Notes" value={paymentForm.notes} onChange={(notes) => setPaymentForm((prev) => ({ ...prev, notes, planId }))} multiline placeholder="Optional" />
        <button type="button" onClick={() => void submitDatingPayment()} disabled={saving || !planId || !(paymentForm.methodId || selectedMethod?.id) || !paymentForm.proofUrl.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          Submit for verification
        </button>
      </div>
    );
  };

  const renderDatingProfileForm = () => {
    const stepTitles = [
      'Tell people about you',
      'Set profile basics',
      'Choose discovery preferences',
      'Upload your primary photo',
      'Review and save',
    ];
    const nextStep = () => {
      if (datingProfileStep === 1 && !datingForm.bio.trim()) {
        setReactionNotice('Add your bio to continue');
        window.setTimeout(() => setReactionNotice(null), 1600);
        return;
      }
      if (datingProfileStep === 2 && (!datingForm.age.trim() || !datingForm.city.trim())) {
        setReactionNotice('Add age and city to continue');
        window.setTimeout(() => setReactionNotice(null), 1600);
        return;
      }
      if (datingProfileStep < 5) setDatingProfileStep((prev) => prev + 1);
    };
    const prevStep = () => {
      if (datingProfileStep > 1) setDatingProfileStep((prev) => prev - 1);
      else router.back();
    };
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[26px] bg-blue-50 p-5 text-blue-950 ring-1 ring-blue-100">
          <div className="h-2 rounded-full bg-blue-100">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: `${(datingProfileStep / 5) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs font-black uppercase tracking-wide text-blue-600">Step {datingProfileStep} of 5</p>
          <Sparkles className="mt-2 h-9 w-9 text-blue-600" />
          <h2 className="mt-3 text-2xl font-black">{myDatingProfile ? 'Edit Dating Profile' : 'Create Dating Profile'}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-800">{stepTitles[datingProfileStep - 1]}</p>
        </section>

        <div
          style={{
            opacity: datingStepAnim.opacity,
            transform: `translateY(${datingStepAnim.y}px)`,
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          {datingProfileStep === 1 ? (
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 rounded-[16px] bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-100">
                Tip: Keep your bio authentic and specific. Mention what kind of connection you want.
              </div>
              <FormField label="Bio" value={datingForm.bio} onChange={(bio) => setDatingForm((prev) => ({ ...prev, bio }))} multiline placeholder="Tell people about yourself..." />
            </section>
          ) : null}

          {datingProfileStep === 2 ? (
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="rounded-[16px] bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-100">
                Tip: Accurate basics improve match quality and trust.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Age" value={datingForm.age} onChange={(age) => setDatingForm((prev) => ({ ...prev, age }))} placeholder="31" inputMode="numeric" />
                <FormField label="Religion" value={datingForm.religion} onChange={(religion) => setDatingForm((prev) => ({ ...prev, religion }))} placeholder="Optional" />
              </div>
              <FormField label="City" value={datingForm.city} onChange={(city) => setDatingForm((prev) => ({ ...prev, city }))} placeholder="Kwekwe" />
              <FormField label="Country" value={datingForm.country} onChange={(country) => setDatingForm((prev) => ({ ...prev, country }))} placeholder="Zimbabwe" />
            </section>
          ) : null}

          {datingProfileStep === 3 ? (
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="rounded-[16px] bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-100">
                Tip: Broader ranges increase visibility; tighter ranges improve precision.
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-slate-50 p-2 ring-1 ring-slate-200">
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
              <FormField label="Maximum distance (km)" value={datingForm.distance} onChange={(distance) => setDatingForm((prev) => ({ ...prev, distance }))} inputMode="numeric" />
            </section>
          ) : null}

          {datingProfileStep === 4 ? (
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 rounded-[16px] bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-100">
                Tip: Use a clear primary photo with good lighting for better responses.
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                <UploadCloud className="h-5 w-5 text-blue-600" />
                {uploadingLabel === 'Dating photo' ? 'Uploading photo...' : (datingPhotoUrl ? 'Change primary photo' : 'Upload primary photo')}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'dating', 'Dating photo', setDatingPhotoUrl)} />
              </label>
              {datingPhotoUrl ? <img src={datingPhotoUrl} alt="Dating profile preview" className="mt-3 max-h-[260px] w-full rounded-[18px] object-cover" /> : null}
            </section>
          ) : null}

          {datingProfileStep === 5 ? (
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-lg font-black text-slate-950">Review profile</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p><span className="font-black">Bio:</span> {datingForm.bio || 'Not set'}</p>
                <p><span className="font-black">Age:</span> {datingForm.age || 'Not set'}</p>
                <p><span className="font-black">Location:</span> {[datingForm.city, datingForm.country].filter(Boolean).join(', ') || 'Not set'}</p>
                <p><span className="font-black">Looking for:</span> {datingForm.lookingFor}</p>
                <p><span className="font-black">Distance:</span> {datingForm.distance} km</p>
              </div>
              {datingPhotoUrl ? <img src={datingPhotoUrl} alt="Dating review" className="mt-3 max-h-[220px] w-full rounded-[18px] object-cover" /> : null}
              <button type="button" onClick={() => setShowDatingReviewModal(true)} className="mt-4 w-full rounded-[16px] bg-slate-900 py-3 text-sm font-black text-white">
                Open full review
              </button>
            </section>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={prevStep} className="rounded-[18px] bg-slate-100 py-3 text-sm font-black text-slate-700">
            {datingProfileStep === 1 ? 'Back' : 'Previous'}
          </button>
          {datingProfileStep < 5 ? (
            <button type="button" onClick={nextStep} className="rounded-[18px] bg-blue-600 py-3 text-sm font-black text-white">
              Continue
            </button>
          ) : (
            <button type="button" onClick={() => setShowDatingReviewModal(true)} disabled={saving} className="rounded-[18px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Review & save'}
            </button>
          )}
        </div>

        {showDatingReviewModal ? (
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6">
            <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-950">Review Dating Profile</h3>
                <button type="button" onClick={() => setShowDatingReviewModal(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600">✕</button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p><span className="font-black">Bio:</span> {datingForm.bio || 'Not set'}</p>
                <p><span className="font-black">Age:</span> {datingForm.age || 'Not set'}</p>
                <p><span className="font-black">Religion:</span> {datingForm.religion || 'Not set'}</p>
                <p><span className="font-black">Location:</span> {[datingForm.city, datingForm.country].filter(Boolean).join(', ') || 'Not set'}</p>
                <p><span className="font-black">Looking for:</span> {datingForm.lookingFor}</p>
                <p><span className="font-black">Age range:</span> {datingForm.minAge} - {datingForm.maxAge}</p>
                <p><span className="font-black">Distance:</span> {datingForm.distance} km</p>
                <p><span className="font-black">Intention:</span> {datingForm.intention}</p>
              </div>
              {datingPhotoUrl ? <img src={datingPhotoUrl} alt="Dating modal review" className="mt-4 max-h-[260px] w-full rounded-[18px] object-cover" /> : null}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowDatingReviewModal(false)} className="rounded-[16px] bg-slate-100 py-3 text-sm font-black text-slate-700">Edit</button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowDatingReviewModal(false);
                    await saveDatingProfile();
                  }}
                  disabled={saving}
                  className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Confirm save'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  };

  const renderDatingFilters = () => (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[26px] bg-blue-50 p-5 text-blue-950 ring-1 ring-blue-100">
        <Settings className="h-9 w-9 text-blue-600" />
        <h2 className="mt-3 text-2xl font-black">Find a better fit</h2>
        <p className="mt-2 text-sm leading-6 text-blue-800">These preferences save to your dating profile and guide Discover.</p>
      </section>
      <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-white p-2 ring-1 ring-slate-200">
        {['men', 'women', 'everyone'].map((option) => (
          <button key={option} type="button" onClick={() => setDatingFilters((prev) => ({ ...prev, lookingFor: option as 'men' | 'women' | 'everyone' }))} className={`rounded-[16px] py-3 text-sm font-black capitalize ${datingFilters.lookingFor === option ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
            {option}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Min age" value={String(datingFilters.minAge || 18)} onChange={(minAge) => setDatingFilters((prev) => ({ ...prev, minAge: Number(minAge || 18) }))} inputMode="numeric" />
        <FormField label="Max age" value={String(datingFilters.maxAge || 99)} onChange={(maxAge) => setDatingFilters((prev) => ({ ...prev, maxAge: Number(maxAge || 99) }))} inputMode="numeric" />
      </div>
      <button type="button" onClick={useBrowserLocation} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-50 py-4 text-base font-black text-blue-700 ring-1 ring-blue-200">
        <MapPin className="h-5 w-5" />
        Use current location
      </button>
      <FormField label="City" value={datingFilters.locationCity || ''} onChange={(city) => setDatingFilters((prev) => ({ ...prev, locationCity: city }))} />
      <FormField label="Country" value={datingFilters.locationCountry || ''} onChange={(country) => setDatingFilters((prev) => ({ ...prev, locationCountry: country }))} />
      <FormField label="Maximum distance (km)" value={String(datingFilters.maxDistance || 50)} onChange={(distance) => setDatingFilters((prev) => ({ ...prev, maxDistance: Number(distance || 50) }))} inputMode="numeric" />
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Min height (cm)" value={datingFilters.minHeightCm ? String(datingFilters.minHeightCm) : ''} onChange={(value) => setDatingFilters((prev) => ({ ...prev, minHeightCm: value ? Number(value) : undefined }))} inputMode="numeric" />
        <FormField label="Max height (cm)" value={datingFilters.maxHeightCm ? String(datingFilters.maxHeightCm) : ''} onChange={(value) => setDatingFilters((prev) => ({ ...prev, maxHeightCm: value ? Number(value) : undefined }))} inputMode="numeric" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {['friendship', 'dating', 'serious', 'marriage'].map((option) => (
          <button key={option} type="button" onClick={() => toggleFilterValue('intentionTags', option)} className={`rounded-[18px] px-4 py-3 text-sm font-black capitalize ${(datingFilters.intentionTags || []).includes(option) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {option}
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-sm font-black text-slate-700">Faith</p>
        <div className="flex flex-wrap gap-2">
          {RELIGION_OPTIONS.map((item) => (
            <button key={item} type="button" onClick={() => toggleFilterValue('religions', item)} className={`rounded-full px-3 py-2 text-xs font-black ${(datingFilters.religions || []).includes(item) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{item}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-black text-slate-700">Education</p>
        <div className="flex flex-wrap gap-2">
          {EDUCATION_OPTIONS.map((item) => (
            <button key={item} type="button" onClick={() => toggleFilterValue('educationLevels', item)} className={`rounded-full px-3 py-2 text-xs font-black ${(datingFilters.educationLevels || []).includes(item) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{item}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-black text-slate-700">Kids</p>
        <div className="flex flex-wrap gap-2">
          {KIDS_OPTIONS.map((item) => (
            <button key={item} type="button" onClick={() => toggleFilterValue('kids', item)} className={`rounded-full px-3 py-2 text-xs font-black ${(datingFilters.kids || []).includes(item) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{item.replaceAll('_', ' ')}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-black text-slate-700">Lifestyle</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LIFESTYLE_OPTIONS).map(([key, values]) => values.map((value) => (
            <button key={`${key}-${value}`} type="button" onClick={() => toggleFilterValue(key as keyof DatingDiscoveryFilters, value)} className={`rounded-full px-3 py-2 text-xs font-black ${((datingFilters[key as keyof DatingDiscoveryFilters] as string[] | undefined) || []).includes(value) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{`${key} ${value}`}</button>
          )))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-black text-slate-700">Interests</p>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((item) => (
            <button key={item} type="button" onClick={() => toggleFilterValue('interests', item)} className={`rounded-full px-3 py-2 text-xs font-black ${(datingFilters.interests || []).includes(item) ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{item}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 rounded-[16px] bg-white p-3 ring-1 ring-slate-200">
        <button type="button" onClick={() => setDatingFilters((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))} className={`rounded-[12px] px-3 py-2 text-sm font-black ${datingFilters.verifiedOnly ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Verified profiles only</button>
        <button type="button" onClick={() => setDatingFilters((prev) => ({ ...prev, hasPhotos: !prev.hasPhotos }))} className={`rounded-[12px] px-3 py-2 text-sm font-black ${datingFilters.hasPhotos ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Has photos</button>
        <button type="button" onClick={() => setDatingFilters((prev) => ({ ...prev, activeRecently: !prev.activeRecently }))} className={`rounded-[12px] px-3 py-2 text-sm font-black ${datingFilters.activeRecently ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Recently active</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={resetDatingFilters} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-slate-100 py-4 text-base font-black text-slate-700">
          Reset
        </button>
        <button type="button" onClick={() => void applyDatingFilters()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-60">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Apply preferences
        </button>
      </div>
    </div>
  );

  const renderDatingUserProfile = () => {
    const targetUserId = appPath[2] || searchParams?.get('userId') || searchParams?.get('id') || '';
    const profile = routeDatingProfile || datingProfiles.find((item) => item.user_id === targetUserId) || (!targetUserId ? myDatingProfile : null);
    if (routeDatingProfileLoading) {
      return (
        <div className="space-y-4 px-4 py-4">
          <div className="h-[520px] animate-pulse rounded-[28px] bg-slate-200" />
          <div className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
        </div>
      );
    }
    if (!profile) return <EmptyState icon={User} title="Profile Not Found" text="This dating profile is not available." action="Back to Dating" onAction={() => router.push('/app/dating')} />;
    const photos = profile.dating_photos || profile.photos || [];
    const videos = profile.dating_videos || profile.videos || [];
    const profileUser = profile.users || profile.user || null;
    const photo = photos.find((item: any) => item.is_primary)?.photo_url || photos[0]?.photo_url || profileUser?.profile_picture;
    const name = profileUser?.full_name || profileUser?.username || 'Committed dater';
    const isOwnProfile = profile.user_id === user?.id;
    const details = [
      ['Faith', profile.religion],
      ['Education', profile.education],
      ['Height', profile.height_cm ? `${profile.height_cm} cm` : null],
      ['Kids', profile.kids],
      ['Drinks', profile.drink],
      ['Smokes', profile.smoke],
      ['Exercise', profile.exercise],
      ['Pets', profile.pets],
      ['Work', profile.work],
    ].filter(([, value]) => !!value);
    const canMessage = isOwnProfile || routeDatingReaction.matched;
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-xl">
          {photo ? <img src={photo} alt="" className="h-[360px] w-full object-cover" /> : <div className="grid h-[360px] place-items-center bg-gradient-to-br from-pink-500 to-blue-700 text-[120px] font-black">{initials(name)}</div>}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-3xl font-black">{name} {profile.age ? profile.age : ''}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-white/75"><MapPin className="h-4 w-4" />{[profile.location_city, profile.location_country].filter(Boolean).join(', ') || 'Location not set'}</p>
              </div>
              {(profileUser?.verified || profileUser?.id_verified || profileUser?.email_verified || profileUser?.phone_verified) ? (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white">Verified</span>
              ) : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/85">{profile.bio || 'Looking for meaningful connections.'}</p>
            {profile.headline ? <p className="mt-3 rounded-[18px] bg-white/10 p-3 text-sm font-bold text-white">{profile.headline}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {[profile.intention_tag, profile.religion, ...(profile.relationship_goals || []), ...(profile.interests || [])].filter(Boolean).slice(0, 8).map((tag) => (
                <span key={String(tag)} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-black">{tag}</span>
              ))}
            </div>
            {!isOwnProfile ? (
              <div className="mt-5 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void reactToRouteDatingProfile(profile.user_id, 'pass')} className="rounded-[18px] bg-white/15 py-3 font-black">Pass</button>
                <button type="button" onClick={() => void reactToRouteDatingProfile(profile.user_id, 'super')} disabled={routeDatingReaction.superLiked} className="rounded-[18px] bg-blue-600 py-3 font-black disabled:opacity-55">{routeDatingReaction.superLiked ? 'Super liked' : 'Super'}</button>
                <button type="button" onClick={() => void reactToRouteDatingProfile(profile.user_id, 'like')} disabled={routeDatingReaction.liked} className="rounded-[18px] bg-green-500 py-3 font-black disabled:opacity-55">{routeDatingReaction.liked ? 'Liked' : 'Like'}</button>
              </div>
            ) : null}
          </div>
        </section>
        {routeDatingReaction.matched ? (
          <section className="rounded-[24px] bg-gradient-to-br from-pink-500 to-blue-600 p-5 text-white shadow-xl shadow-pink-500/20">
            <Sparkles className="h-9 w-9" />
            <h3 className="mt-3 text-2xl font-black">It's a match</h3>
            <p className="mt-2 text-sm leading-6 text-white/85">You both liked each other. Start the conversation while the spark is fresh.</p>
            <button type="button" onClick={() => void openConversationWithUser(profile.user_id)} className="mt-4 w-full rounded-[18px] bg-white py-3 font-black text-pink-600">
              Message {name.split(' ')[0] || 'match'}
            </button>
          </section>
        ) : null}
        {!isOwnProfile && routeConversationStarters.length ? (
          <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">Conversation Starters</p>
            <p className="mt-1 text-sm text-slate-500">Send one opener to start naturally.</p>
            <div className="mt-3 space-y-2">
              {routeConversationStarters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void openConversationWithUser(profile.user_id, starter)}
                  className="w-full rounded-[18px] bg-pink-50 px-4 py-3 text-left text-sm font-black text-pink-700 ring-1 ring-pink-100"
                >
                  {starter}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {details.length ? (
          <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">More About {name.split(' ')[0] || 'Them'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {details.map(([label, value]) => (
                <div key={label} className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{String(value).replaceAll('_', ' ')}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {routeDatingBadges.length ? (
          <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">Badges</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {routeDatingBadges.map((badge) => (
                <span key={badge.id || badge.badge_type || badge.name} className="rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                  {badge.badge_name || badge.badge_type || badge.name || 'Badge'}
                </span>
              ))}
            </div>
          </section>
        ) : null}
        {photos.length > 1 || videos.length ? (
          <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">Photos and Videos</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photos.slice(0, 6).map((item: any, index: number) => (
                <img key={item.id || item.photo_url || index} src={item.photo_url} alt="" className="aspect-square rounded-[18px] object-cover" />
              ))}
              {videos.slice(0, 2).map((item: any, index: number) => (
                <video key={item.id || item.video_url || index} src={item.video_url} className="aspect-square rounded-[18px] bg-black object-cover" controls />
              ))}
            </div>
          </section>
        ) : null}
        {!isOwnProfile && !canMessage && routeDatingReaction.liked ? (
          <section className="rounded-[22px] bg-amber-50 p-4 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
            You liked this profile. Messaging opens when you match or send an allowed conversation starter.
          </section>
        ) : null}
      </div>
    );
  };

  const renderDatingProfilePreview = () => {
    if (!myDatingProfile) {
      return <EmptyState icon={User} title="No Profile Yet" text="Create your dating profile to see how it looks to others." action="Create Profile" onAction={() => router.push('/app/dating/profile-setup')} />;
    }
    const profile = {
      ...myDatingProfile,
      users: { full_name: user?.full_name, profile_picture: user?.profile_picture },
    } as DatingProfile;
    const photo = profile.dating_photos?.find((item) => item.is_primary)?.photo_url || profile.dating_photos?.[0]?.photo_url || user?.profile_picture;
    const name = user?.full_name || 'Committed dater';
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[22px] bg-blue-50 p-4 text-blue-800 ring-1 ring-blue-100">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <p className="font-black">This is how others see your dating profile</p>
          </div>
        </section>
        <section className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-xl">
          {photo ? <img src={photo} alt="" className="h-[420px] w-full object-cover" /> : <div className="grid h-[420px] place-items-center bg-gradient-to-br from-pink-500 to-blue-700 text-[120px] font-black">{initials(name)}</div>}
          <div className="p-5">
            <h2 className="text-3xl font-black">{name} {profile.age ? profile.age : ''}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-white/75"><MapPin className="h-4 w-4" />{[profile.location_city, profile.location_country].filter(Boolean).join(', ') || 'Location not set'}</p>
            <p className="mt-4 text-sm leading-6 text-white/85">{profile.bio || 'Looking for meaningful connections.'}</p>
          </div>
        </section>
      </div>
    );
  };

  const renderDatingVideoPlayer = () => {
    const videoUrl = searchParams?.get('videoUrl') || '';
    return (
      <div className="relative grid min-h-[calc(100vh-122px)] place-items-center bg-black">
        <button type="button" onClick={() => router.push('/app/dating')} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
          <X className="h-6 w-6" />
        </button>
        {videoUrl ? (
          <video src={videoUrl} controls autoPlay loop className="max-h-[calc(100vh-122px)] w-full object-contain" />
        ) : (
          <EmptyState icon={Film} title="No Video" text="This dating profile video is not available." action="Back to Dating" onAction={() => router.push('/app/dating')} />
        )}
      </div>
    );
  };

  const renderDatingPhotoGallery = () => {
    let photos: any[] = [];
    try {
      const rawPhotos = searchParams?.get('photos') || '';
      photos = rawPhotos ? JSON.parse(rawPhotos) : [];
    } catch {
      photos = [];
    }
    if (!photos.length && myDatingProfile?.dating_photos?.length) photos = myDatingProfile.dating_photos;
    const userName = searchParams?.get('userName') || user?.full_name || 'Dating photos';
    return (
      <div className="relative min-h-[calc(100vh-122px)] bg-black text-white">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur">
          <button type="button" onClick={() => router.push('/app/dating')} className="grid h-10 w-10 place-items-center rounded-full bg-white/15">
            <X className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="font-black">{userName}</p>
            <p className="text-xs text-white/65">{photos.length} photos</p>
          </div>
          <span className="h-10 w-10" />
        </div>
        {!photos.length ? <EmptyState icon={Camera} title="No Photos" text="Photos will appear here when added to the profile." /> : null}
        <div className="snap-y snap-mandatory">
          {photos.map((photo, index) => {
            const url = photo.photo_url || photo.photoUrl || photo.url;
            return (
              <section key={photo.id || `${url}-${index}`} className="grid min-h-[calc(100vh-170px)] snap-start place-items-center p-3">
                {url ? <img src={url} alt="" className="max-h-[calc(100vh-190px)] w-full rounded-[18px] object-contain" /> : null}
                <p className="text-xs font-bold text-white/50">{index + 1} / {photos.length}</p>
              </section>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRelationshipRegister = () => {
    const stepTitles = [
      "Let's start with your partner's information",
      'How can we reach your partner?',
      'Upload a clear face photo of your partner',
      'Add relationship details and privacy',
      'Review and confirm your relationship registration',
    ];

    const nextRelationshipStep = () => {
      if (relationshipStep === 1 && !relationshipForm.partnerName.trim()) {
        setReactionNotice('Add partner name to continue');
        window.setTimeout(() => setReactionNotice(null), 1800);
        return;
      }
      if (relationshipStep === 2 && !relationshipForm.partnerPhone.trim()) {
        setReactionNotice('Add partner phone to continue');
        window.setTimeout(() => setReactionNotice(null), 1800);
        return;
      }
      if (relationshipStep === 3 && !relationshipPhotoUrl.trim()) {
        setReactionNotice('Upload partner photo to continue');
        window.setTimeout(() => setReactionNotice(null), 1800);
        return;
      }
      if (relationshipStep < 5) setRelationshipStep((prev) => prev + 1);
    };

    const previousRelationshipStep = () => {
      if (relationshipStep > 1) setRelationshipStep((prev) => prev - 1);
      else router.back();
    };

    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-700 p-5 text-white shadow-xl shadow-pink-500/20">
          <div className="mb-4">
            <div className="h-2 rounded-full bg-white/25">
              <div className="h-2 rounded-full bg-white" style={{ width: `${(relationshipStep / 5) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs font-black uppercase tracking-wide text-white/80">Step {relationshipStep} of 5</p>
          </div>
          <Shield className="h-10 w-10" />
          <h2 className="mt-4 text-3xl font-black">Register relationship</h2>
          <p className="mt-2 text-sm leading-6 text-white/85">{stepTitles[relationshipStep - 1]}</p>
        </section>

        <div
          style={{
            opacity: relationshipStepAnim.opacity,
            transform: `translateY(${relationshipStepAnim.y}px)`,
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
        {relationshipStep === 1 ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Partner details</h3>
            <p className="mt-1 text-sm text-slate-500">Add your partner name and optional identity details.</p>
            <div className="mt-4 space-y-4">
              <FormField label="Partner name" value={relationshipForm.partnerName} onChange={(partnerName) => setRelationshipForm((prev) => ({ ...prev, partnerName }))} placeholder="Enter their full name" />
              <FormField label="City or location" value={relationshipForm.city} onChange={(city) => setRelationshipForm((prev) => ({ ...prev, city }))} placeholder="Optional" />
              <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Date of birth (optional)</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <FormField label="Day" value={relationshipForm.partnerBirthDay} onChange={(partnerBirthDay) => setRelationshipForm((prev) => ({ ...prev, partnerBirthDay: partnerBirthDay.replace(/[^\d]/g, '').slice(0, 2) }))} placeholder="DD" inputMode="numeric" />
                  <FormField label="Month" value={relationshipForm.partnerBirthMonth} onChange={(partnerBirthMonth) => setRelationshipForm((prev) => ({ ...prev, partnerBirthMonth: partnerBirthMonth.replace(/[^\d]/g, '').slice(0, 2) }))} placeholder="MM" inputMode="numeric" />
                  <FormField label="Year" value={relationshipForm.partnerBirthYear} onChange={(partnerBirthYear) => setRelationshipForm((prev) => ({ ...prev, partnerBirthYear: partnerBirthYear.replace(/[^\d]/g, '').slice(0, 4) }))} placeholder="YYYY" inputMode="numeric" />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {relationshipStep === 2 ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Partner contact</h3>
            <p className="mt-1 text-sm text-slate-500">We use this phone to notify your partner for confirmation.</p>
            <div className="mt-4 space-y-4">
              <FormField label="Partner phone" value={relationshipForm.partnerPhone} onChange={(partnerPhone) => setRelationshipForm((prev) => ({ ...prev, partnerPhone }))} placeholder="+263..." />
            </div>
          </section>
        ) : null}

        {relationshipStep === 3 ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Partner photo</h3>
            <p className="mt-1 text-sm text-slate-500">Upload a clear face photo for verification review.</p>
            <div className="mt-4 space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                <UploadCloud className="h-5 w-5 text-blue-600" />
                {uploadingLabel === 'Partner photo' ? 'Uploading partner photo...' : (relationshipPhotoUrl ? 'Change partner photo' : 'Upload partner photo')}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'relationships', 'Partner photo', setRelationshipPhotoUrl)} />
              </label>
              {relationshipPhotoUrl ? <img src={relationshipPhotoUrl} alt="Partner photo preview" className="max-h-[260px] w-full rounded-[18px] object-cover" /> : null}
            </div>
          </section>
        ) : null}

        {relationshipStep === 4 ? (
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Relationship details</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {['married', 'engaged', 'serious', 'dating'].map((type) => (
                <button key={type} type="button" onClick={() => setRelationshipForm((prev) => ({ ...prev, type }))} className={`rounded-[18px] px-3 py-3 text-sm font-black capitalize ${relationshipForm.type === type ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}>
                  {type}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <FormField label="Start date" value={relationshipForm.startDate} onChange={(startDate) => setRelationshipForm((prev) => ({ ...prev, startDate }))} placeholder="YYYY-MM-DD" />
            </div>
            <div className="mt-4 rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Or enter start date by parts</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <FormField label="Day" value={relationshipForm.startDay} onChange={(startDay) => setRelationshipForm((prev) => ({ ...prev, startDay: startDay.replace(/[^\d]/g, '').slice(0, 2) }))} placeholder="DD" inputMode="numeric" />
                <FormField label="Month" value={relationshipForm.startMonth} onChange={(startMonth) => setRelationshipForm((prev) => ({ ...prev, startMonth: startMonth.replace(/[^\d]/g, '').slice(0, 2) }))} placeholder="MM" inputMode="numeric" />
                <FormField label="Year" value={relationshipForm.startYear} onChange={(startYear) => setRelationshipForm((prev) => ({ ...prev, startYear: startYear.replace(/[^\d]/g, '').slice(0, 4) }))} placeholder="YYYY" inputMode="numeric" />
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {[
                { key: 'private', label: 'Private', text: 'Only you, partner, and reviewers can see it.' },
                { key: 'verified_people', label: 'Verified people', text: 'Visible to verified Committed members.' },
                { key: 'public', label: 'Public', text: 'Can appear in public relationship search.' },
              ].map((option) => (
                <button key={option.key} type="button" onClick={() => setRelationshipForm((prev) => ({ ...prev, privacy: option.key }))} className={`rounded-[18px] p-4 text-left ring-1 ${relationshipForm.privacy === option.key ? 'bg-blue-50 text-blue-900 ring-blue-300' : 'bg-white text-slate-700 ring-slate-200'}`}>
                  <span className="block font-black">{option.label}</span>
                  <span className="mt-1 block text-xs font-semibold opacity-70">{option.text}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {relationshipStep === 5 ? (
          <>
            <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-black text-slate-950">Review</h3>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p><span className="font-black">Partner:</span> {relationshipForm.partnerName || 'Not set'}</p>
                <p><span className="font-black">Phone:</span> {relationshipForm.partnerPhone || 'Not set'}</p>
                <p><span className="font-black">Type:</span> {relationshipForm.type}</p>
                <p><span className="font-black">Visibility:</span> {relationshipForm.privacy}</p>
                <p><span className="font-black">City:</span> {relationshipForm.city || 'Not set'}</p>
              </div>
              {relationshipPhotoUrl ? <img src={relationshipPhotoUrl} alt="Partner review" className="mt-4 max-h-[220px] w-full rounded-[18px] object-cover" /> : null}
              <button type="button" onClick={() => setShowRelationshipReviewModal(true)} className="mt-4 w-full rounded-[16px] bg-slate-900 py-3 text-sm font-black text-white">
                Open full review
              </button>
            </section>
            <label className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 text-sm font-semibold leading-5 text-slate-600 shadow-sm">
              <input
                type="checkbox"
                checked={relationshipForm.consent}
                onChange={(event) => setRelationshipForm((prev) => ({ ...prev, consent: event.target.checked }))}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600"
              />
              <span>I confirm my partner consent, verification terms, and privacy implications.</span>
            </label>
            <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-black text-slate-900">Consent checklist</p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>- I have my partner's consent to register this relationship.</p>
                <p>- My partner receives a request to confirm.</p>
                <p>- False registrations can lead to restrictions.</p>
                <p>- Privacy follows the visibility level chosen above.</p>
              </div>
            </section>
          </>
        ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={previousRelationshipStep} className="rounded-[18px] bg-slate-100 py-3 text-sm font-black text-slate-700">
            {relationshipStep === 1 ? 'Back' : 'Previous'}
          </button>
          {relationshipStep < 5 ? (
            <button type="button" onClick={nextRelationshipStep} className="rounded-[18px] bg-blue-600 py-3 text-sm font-black text-white">
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRelationshipReviewModal(true)}
              disabled={saving || !relationshipForm.partnerName.trim() || !relationshipForm.partnerPhone.trim() || !relationshipPhotoUrl.trim() || !relationshipForm.consent}
              className="rounded-[18px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Review & register'}
            </button>
          )}
        </div>

        {showRelationshipReviewModal ? (
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/50 p-0 sm:place-items-center sm:p-6">
            <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-950">Review Relationship</h3>
                <button type="button" onClick={() => setShowRelationshipReviewModal(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600">✕</button>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p><span className="font-black">Partner:</span> {relationshipForm.partnerName || 'Not set'}</p>
                <p><span className="font-black">Phone:</span> {relationshipForm.partnerPhone || 'Not set'}</p>
                <p><span className="font-black">City:</span> {relationshipForm.city || 'Not set'}</p>
                <p><span className="font-black">Type:</span> {relationshipForm.type}</p>
                <p><span className="font-black">Visibility:</span> {relationshipForm.privacy}</p>
                <p><span className="font-black">Start:</span> {relationshipForm.startDate || getDateStringFromParts(relationshipForm.startDay, relationshipForm.startMonth, relationshipForm.startYear) || 'Not set'}</p>
              </div>
              {relationshipPhotoUrl ? <img src={relationshipPhotoUrl} alt="Relationship modal review" className="mt-4 max-h-[260px] w-full rounded-[18px] object-cover" /> : null}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowRelationshipReviewModal(false)} className="rounded-[16px] bg-slate-100 py-3 text-sm font-black text-slate-700">Edit</button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowRelationshipReviewModal(false);
                    await submitRelationship();
                  }}
                  disabled={saving || !relationshipForm.consent}
                  className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {saving ? 'Submitting...' : 'Confirm register'}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  };

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
          const href = notificationHref(notification);
          return (
          <Link key={notification.id} href={href} onClick={() => void markNotificationRead(notification)} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50">
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
    const selectedConversation = subPath ? conversations.find((conversation) => conversation.id === subPath) : null;
    if (subPath && routeConversationLoading && !selectedConversation) {
      return <ScreenSkeleton />;
    }
    if (subPath && !routeConversationLoading && !selectedConversation) {
      return <EmptyState icon={MessageCircle} title="Conversation Not Found" text="This conversation is unavailable or you do not have access to it." action="Back to Messages" onAction={() => router.push('/app/messages')} />;
    }
    if (selectedConversation) {
      const messages = messagesByConversation[selectedConversation.id] || [];
      const title = selectedConversation.participantNames?.join(', ') || 'Conversation';
      const isAiConversation =
        selectedConversation.id === 'committed-ai-local' ||
        (selectedConversation.participantNames || []).some((name) => name.toLowerCase().includes('committed ai'));
      const firstParticipantId = (selectedConversation.participant_ids || []).find((id) => id !== user?.id);
      const avatar = firstParticipantId ? selectedConversation.participantAvatars?.[firstParticipantId] : null;
      return (
        <div className="flex min-h-[calc(100vh-122px)] flex-col">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <Avatar src={avatar} name={title} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{title}</p>
              <p className="text-xs font-semibold text-slate-500">Messages sync from the same mobile conversations.</p>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {!messages.length ? <EmptyState icon={MessageCircle} title="No Messages Yet" text="Start the conversation here." /> : null}
            {messages.map((message) => {
              const own = message.sender_id === user?.id;
              return (
                <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-[20px] px-4 py-3 text-sm font-semibold leading-5 ${own ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200'}`}>
                    {message.media_url ? <img src={message.media_url} alt="" className="mb-2 max-h-64 rounded-[14px] object-cover" /> : null}
                    {message.document_url ? (
                      <a href={message.document_url} target="_blank" rel="noreferrer" className={`mb-2 flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs font-black ${own ? 'bg-white/15 text-white' : 'bg-slate-50 text-blue-700'}`}>
                        <FileText className="h-4 w-4" />
                        Open document
                      </a>
                    ) : null}
                    {message.content || (message.media_url ? 'Photo' : message.document_url ? 'Document' : 'Message')}
                    <p className={`mt-1 text-[10px] ${own ? 'text-blue-100' : 'text-slate-400'}`}>{timeAgo(message.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {isAiConversation ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
              <button type="button" onClick={() => void sendQuickAiPrompt(selectedConversation, 'Help me fix dating discovery and no profiles issue')} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Dating Help</button>
              <button type="button" onClick={() => router.push('/app/dating/filters')} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Open Dating Filters</button>
              <button type="button" onClick={() => router.push('/app/verification')} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Open Verification</button>
              <button type="button" onClick={() => router.push('/app/settings')} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Open Settings</button>
              <button type="button" onClick={() => router.push('/app/admin')} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">Open Admin</button>
            </div>
          ) : null}
          <div className="sticky bottom-[64px] border-t border-slate-200 bg-white p-3">
            {chatMediaUrl || chatDocumentUrl ? (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-[16px] bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                <span className="truncate">{chatDocumentUrl ? 'Document attached' : 'Image attached'}</span>
                <button type="button" onClick={() => { setChatMediaUrl(''); setChatDocumentUrl(''); }} className="text-red-500">Remove</button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <label className="grid h-12 w-12 cursor-pointer place-items-center rounded-full bg-slate-100 text-slate-600">
                <Camera className="h-5 w-5" />
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'messages', 'Message image', setChatMediaUrl)} />
              </label>
              <label className="grid h-12 w-12 cursor-pointer place-items-center rounded-full bg-slate-100 text-slate-600">
                <FileText className="h-5 w-5" />
                <input type="file" accept="image/*,application/pdf,.doc,.docx,.txt" className="hidden" onChange={(event) => void handleFileUpload(event, 'messages', 'Message document', setChatDocumentUrl)} />
              </label>
              <input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Type a message..." className="h-12 min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-sm font-semibold outline-none focus:ring-4 focus:ring-blue-100" />
              <button type="button" onClick={() => void sendChatMessage(selectedConversation)} disabled={!chatDraft.trim() && !chatMediaUrl.trim() && !chatDocumentUrl.trim()} className="grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white disabled:opacity-50">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 px-3 py-3">
        {renderStatusStrip(true)}
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
          <Link key={conversation.id} href={`/app/messages/${conversation.id}`} className="flex items-center gap-3 rounded-[20px] bg-white p-3 active:bg-slate-50">
            <Avatar src={Object.values(conversation.participantAvatars || {})[0]} name={conversation.participantNames?.[0] || 'Committed member'} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-slate-950">{conversation.participantNames?.join(', ') || 'Conversation'}</p>
              <p className="truncate text-sm text-slate-500">{conversation.last_message || 'Open chat'}</p>
            </div>
            <span className="text-xs font-semibold text-slate-400">{timeAgo(conversation.last_message_at || conversation.created_at)}</span>
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
          <Avatar src={user?.profile_picture} name={getUserDisplayName(user)} size="lg" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-950">{getUserDisplayName(user)}</h2>
        <p className="text-sm text-slate-500">{user?.username ? `@${user.username}` : user?.email}</p>
        <div className="mt-4 flex justify-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{user?.role || 'user'}</span>
          {user?.verified ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Verified</span> : null}
        </div>
      </section>
      <div className="mt-4 space-y-3">
        {[
          { href: '/app/settings', title: 'Settings', text: 'Account, privacy, and app preferences' },
          { href: '/app/verification', title: 'Verification', text: 'Phone, email, ID, and couple selfie checks' },
          { href: '/app/dating/profile-setup', title: 'Dating profile', text: 'Photos, bio, goals, and discovery details' },
          { href: '/app/ads', title: 'Ads and boosts', text: 'Campaigns, invoices, and promoted content' },
          { href: '/app/bookings', title: 'Bookings', text: 'Professional sessions and reschedules' },
          { href: '/app/professionals', title: 'Professionals', text: 'Bookings, profile, and approvals' },
          ...(isAdminRole(user?.role)
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
          <Avatar src={settingsProfilePictureUrl || user?.profile_picture} name={getUserDisplayName(user)} size="lg" />
          <div>
            <h2 className="text-2xl font-black text-slate-950">Settings</h2>
            <p className="text-sm text-slate-500">{user?.username ? `@${user.username}` : 'Account and profile details'}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
          <span className={`rounded-full px-2 py-2 ${user?.email_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>Email</span>
          <span className={`rounded-full px-2 py-2 ${user?.phone_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>Phone</span>
          <span className={`rounded-full px-2 py-2 ${user?.id_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>ID</span>
        </div>
      </section>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
        <UploadCloud className="h-5 w-5 text-blue-600" />
        {uploadingLabel === 'Profile photo' ? 'Uploading profile photo...' : 'Upload profile photo'}
        <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'avatars', 'Profile photo', setSettingsProfilePictureUrl)} />
      </label>
      {settingsProfilePictureUrl ? <img src={settingsProfilePictureUrl} alt="Profile photo preview" className="max-h-[220px] w-full rounded-[18px] object-cover" /> : null}
      <FormField label="Full name" value={settingsForm.fullName} onChange={(fullName) => setSettingsForm((prev) => ({ ...prev, fullName }))} />
      <FormField label="Username" value={settingsForm.username} onChange={(username) => setSettingsForm((prev) => ({ ...prev, username }))} placeholder="Optional" />
      <FormField label="Phone number" value={settingsForm.phoneNumber} onChange={(phoneNumber) => setSettingsForm((prev) => ({ ...prev, phoneNumber }))} />
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">Verification Status</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href="/app/verification/phone" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Phone: {user?.phone_verified ? 'Verified' : 'Not verified'}</Link>
          <Link href="/app/verification/email" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Email: {user?.email_verified ? 'Verified' : 'Not verified'}</Link>
          <Link href="/app/verification/id" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">ID: {user?.id_verified ? 'Verified' : 'Not verified'}</Link>
          <Link href="/app/verification/couple-selfie" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Couple selfie</Link>
        </div>
      </section>
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">Privacy & Security</p>
        <div className="mt-3 grid gap-2">
          <Link href="/app/settings/2fa" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Two-factor authentication</Link>
          <Link href="/app/settings/sessions" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Sessions</Link>
          <Link href="/app/settings/blocked-users" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Blocked users</Link>
          <Link href="/app/verification" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Status & privacy controls</Link>
        </div>
      </section>
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

  const renderRouteHub = (
    title: string,
    text: string,
    basePath: string,
    items: readonly (readonly [string, string, string])[],
    icon: typeof Settings = Settings
  ) => {
    const Icon = icon;
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20">
          <Icon className="h-10 w-10 text-blue-300" />
          <h2 className="mt-4 text-3xl font-black">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
        </section>
        <div className="space-y-3">
          {items.map(([slug, label, description]) => (
            <Link key={slug} href={`${basePath}/${slug}`} className="block rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.99]">
              <p className="text-lg font-black text-slate-950">{label}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const renderSettingsRoute = () => {
    if (subPath === 'blocked-users') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <Ban className="h-9 w-9 text-red-500" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Blocked Users</h2>
            <p className="mt-2 text-sm text-slate-500">Manage people you have blocked.</p>
          </section>
          {!blockedUsers.length ? <EmptyState icon={Ban} title="No Blocked Users" text="People you block will appear here." /> : null}
          {blockedUsers.map((row) => (
            <article key={row.id} className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <Avatar src={row.users?.profile_picture} name={row.users?.full_name || row.users?.email} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-950">{row.users?.full_name || 'Blocked member'}</p>
                <p className="truncate text-sm text-slate-500">{row.users?.email}</p>
              </div>
              <button type="button" onClick={() => void unblockUser(row.blocked_id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-600">
                Unblock
              </button>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === '2fa') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-blue-600 p-5 text-white shadow-xl shadow-blue-600/20">
            <Shield className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">Two-Factor Authentication</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">Set up the same account protection flow available in the mobile app.</p>
          </section>
          <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-950">{twoFactorRecord?.enabled ? '2FA is enabled' : '2FA is off'}</p>
                <p className="mt-1 text-sm text-slate-500">{twoFactorRecord?.enabled ? 'Your account has an extra sign-in check.' : 'Generate a secret and backup codes to enable it.'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${twoFactorRecord?.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {twoFactorRecord?.enabled ? 'Enabled' : 'Off'}
              </span>
            </div>
            {!twoFactorRecord?.enabled ? (
              <button type="button" onClick={() => void setupTwoFactor()} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                {twoFactorRecord?.id ? 'Regenerate setup' : 'Start setup'}
              </button>
            ) : (
              <button type="button" onClick={() => void disableTwoFactor()} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[18px] bg-red-50 py-4 font-black text-red-600 ring-1 ring-red-100 disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
                Disable 2FA
              </button>
            )}
          </div>
          {(twoFactorSecret || twoFactorBackupCodes.length) && !twoFactorRecord?.enabled ? (
            <div className="space-y-4 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              {twoFactorSecret ? (
                <div>
                  <p className="text-sm font-black text-slate-700">Authenticator secret</p>
                  <p className="mt-2 break-all rounded-[16px] bg-slate-50 p-4 font-mono text-sm font-bold text-slate-700 ring-1 ring-slate-200">{twoFactorSecret}</p>
                </div>
              ) : null}
              {twoFactorBackupCodes.length ? (
                <div>
                  <p className="text-sm font-black text-slate-700">Backup codes</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {twoFactorBackupCodes.map((code) => (
                      <span key={code} className="rounded-[14px] bg-slate-50 px-3 py-2 text-center font-mono text-sm font-bold text-slate-700 ring-1 ring-slate-200">{code}</span>
                    ))}
                  </div>
                </div>
              ) : null}
              <FormField label="6 digit verification code" value={twoFactorCode} onChange={setTwoFactorCode} inputMode="numeric" placeholder="123456" />
              <button type="button" onClick={() => void verifyAndEnableTwoFactor()} disabled={saving || twoFactorCode.trim().length !== 6} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Enable 2FA
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/app/verification/email" className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <Mail className="h-7 w-7 text-blue-600" />
              <p className="mt-3 font-black text-slate-950">Email</p>
              <p className="text-sm text-slate-500">{user?.email_verified ? 'Verified' : 'Needs verification'}</p>
            </Link>
            <Link href="/app/verification/phone" className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <Phone className="h-7 w-7 text-blue-600" />
              <p className="mt-3 font-black text-slate-950">Phone</p>
              <p className="text-sm text-slate-500">{user?.phone_verified ? 'Verified' : 'Needs verification'}</p>
            </Link>
          </div>
        </div>
      );
    }
    if (subPath === 'become-professional') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
            <Briefcase className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Become a Professional</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Apply to support members with relationship guidance, mentoring, or coaching.</p>
          </section>
          <label className="block text-sm font-black text-slate-700">
            Role
            <select value={professionalApplicationForm.roleId} onChange={(event) => setProfessionalApplicationForm((prev) => ({ ...prev, roleId: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500">
              <option value="">Select a role</option>
              {professionalRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
          <FormField label="Specialty" value={professionalApplicationForm.specialty} onChange={(specialty) => setProfessionalApplicationForm((prev) => ({ ...prev, specialty }))} placeholder="Relationship therapy, mentoring..." />
          <FormField label="Experience" value={professionalApplicationForm.experience} onChange={(experience) => setProfessionalApplicationForm((prev) => ({ ...prev, experience }))} placeholder="Years and background" />
          <FormField label="Bio" value={professionalApplicationForm.bio} onChange={(bio) => setProfessionalApplicationForm((prev) => ({ ...prev, bio }))} multiline placeholder="Tell users how you help." />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            {uploadingLabel === 'Credentials document' ? 'Uploading credentials...' : 'Upload credentials document'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => void handleFileUpload(event, 'professional', 'Credentials document', (url) => setProfessionalApplicationForm((prev) => ({ ...prev, credentialsUrl: url })))} />
          </label>
          <FormField label="Credentials URL" value={professionalApplicationForm.credentialsUrl} onChange={(credentialsUrl) => setProfessionalApplicationForm((prev) => ({ ...prev, credentialsUrl }))} placeholder="https://..." />
          <FormField label="Hourly rate" value={professionalApplicationForm.rate} onChange={(rate) => setProfessionalApplicationForm((prev) => ({ ...prev, rate }))} inputMode="decimal" placeholder="Optional" />
          <button type="button" onClick={() => void submitProfessionalApplication()} disabled={saving || !professionalApplicationForm.roleId} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Submit application
          </button>
        </div>
      );
    }
    if (subPath === 'professional-availability') {
      const statusOptions = [
        ['online', 'Online', 'Use app activity to show availability'],
        ['busy', 'Busy', 'Pause new session requests'],
        ['away', 'Away', 'Available later'],
        ['offline', 'Offline', 'Do not show as available'],
      ] as const;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <Calendar className="h-9 w-9 text-blue-600" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Professional Availability</h2>
            <p className="mt-2 text-sm text-slate-500">{professionalProfile ? 'Control when members can book you, just like the mobile app.' : 'Apply first so members can book you.'}</p>
          </section>
          {professionalProfile ? (
            <>
              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{professionalProfile.full_name || user?.full_name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Profile: {professionalProfile.approval_status || 'pending'} - {professionalProfile.is_active ? 'Active' : 'Inactive'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Current sessions: {professionalStatus?.current_session_count || 0} / {professionalAvailabilityForm.maxConcurrentSessions || 3}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{professionalAvailabilityForm.status}</span>
                </div>
                {professionalStatus?.status_override ? (
                  <div className="mt-4 rounded-[18px] bg-amber-50 p-4 text-sm font-bold text-amber-800 ring-1 ring-amber-100">
                    Admin override is active{professionalStatus.status_override_until ? ` until ${new Date(professionalStatus.status_override_until).toLocaleString()}` : ''}.
                  </div>
                ) : null}
              </div>

              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-lg font-black text-slate-950">Status Preference</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {statusOptions.map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProfessionalAvailabilityForm((prev) => ({ ...prev, status: value }))}
                      className={`rounded-[18px] p-4 text-left ring-1 ${professionalAvailabilityForm.status === value ? 'bg-blue-600 text-white ring-blue-600' : 'bg-slate-50 text-slate-700 ring-slate-200'}`}
                    >
                      <span className="block font-black">{label}</span>
                      <span className={`mt-1 block text-xs font-semibold ${professionalAvailabilityForm.status === value ? 'text-blue-50' : 'text-slate-500'}`}>{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-lg font-black text-slate-950">Session Capacity</p>
                <FormField label="Maximum concurrent sessions" value={professionalAvailabilityForm.maxConcurrentSessions} onChange={(maxConcurrentSessions) => setProfessionalAvailabilityForm((prev) => ({ ...prev, maxConcurrentSessions }))} inputMode="numeric" />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProfessionalAvailabilityForm((prev) => ({ ...prev, onlineAvailability: !prev.onlineAvailability }))}
                    className={`rounded-[18px] px-4 py-3 text-sm font-black ring-1 ${professionalAvailabilityForm.onlineAvailability ? 'bg-blue-600 text-white ring-blue-600' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}
                  >
                    Online sessions {professionalAvailabilityForm.onlineAvailability ? 'on' : 'off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfessionalAvailabilityForm((prev) => ({ ...prev, inPersonAvailability: !prev.inPersonAvailability }))}
                    className={`rounded-[18px] px-4 py-3 text-sm font-black ring-1 ${professionalAvailabilityForm.inPersonAvailability ? 'bg-blue-600 text-white ring-blue-600' : 'bg-slate-50 text-slate-600 ring-slate-200'}`}
                  >
                    In person {professionalAvailabilityForm.inPersonAvailability ? 'on' : 'off'}
                  </button>
                </div>
              </div>

              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">Quiet Hours</p>
                    <p className="text-sm text-slate-500">Hide booking availability during your rest hours.</p>
                  </div>
                  <button type="button" onClick={() => setProfessionalAvailabilityForm((prev) => ({ ...prev, quietHoursEnabled: !prev.quietHoursEnabled }))} className={`rounded-full px-4 py-2 text-xs font-black ${professionalAvailabilityForm.quietHoursEnabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {professionalAvailabilityForm.quietHoursEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {professionalAvailabilityForm.quietHoursEnabled ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <FormField label="Start" value={professionalAvailabilityForm.quietHoursStart} onChange={(quietHoursStart) => setProfessionalAvailabilityForm((prev) => ({ ...prev, quietHoursStart }))} placeholder="22:00" />
                    <FormField label="End" value={professionalAvailabilityForm.quietHoursEnd} onChange={(quietHoursEnd) => setProfessionalAvailabilityForm((prev) => ({ ...prev, quietHoursEnd }))} placeholder="08:00" />
                    <div className="col-span-2">
                      <FormField label="Timezone" value={professionalAvailabilityForm.quietHoursTimezone} onChange={(quietHoursTimezone) => setProfessionalAvailabilityForm((prev) => ({ ...prev, quietHoursTimezone }))} placeholder="UTC" />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">Pricing</p>
                    <p className="text-sm text-slate-500">Set the same booking price shown to members.</p>
                  </div>
                  <button type="button" onClick={() => setProfessionalAvailabilityForm((prev) => ({ ...prev, pricingEnabled: !prev.pricingEnabled }))} className={`rounded-full px-4 py-2 text-xs font-black ${professionalAvailabilityForm.pricingEnabled ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {professionalAvailabilityForm.pricingEnabled ? 'On' : 'Off'}
                  </button>
                </div>
                {professionalAvailabilityForm.pricingEnabled ? (
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <FormField label="Currency" value={professionalAvailabilityForm.pricingCurrency} onChange={(pricingCurrency) => setProfessionalAvailabilityForm((prev) => ({ ...prev, pricingCurrency }))} placeholder="USD" />
                    <FormField label="Rate" value={professionalAvailabilityForm.pricingRate} onChange={(pricingRate) => setProfessionalAvailabilityForm((prev) => ({ ...prev, pricingRate }))} inputMode="decimal" placeholder="25" />
                    <label className="block text-sm font-black text-slate-700">
                      Unit
                      <select value={professionalAvailabilityForm.pricingUnit} onChange={(event) => setProfessionalAvailabilityForm((prev) => ({ ...prev, pricingUnit: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-3 py-4 font-semibold outline-none focus:border-blue-500">
                        <option value="session">Session</option>
                        <option value="hour">Hour</option>
                        <option value="minute">Minute</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>

              <button type="button" onClick={() => void saveProfessionalAvailability()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white shadow-xl shadow-blue-600/20 disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Save availability
              </button>
              <Link href="/app/professional/bookings" className="flex w-full items-center justify-center rounded-[20px] bg-white py-4 font-black text-blue-700 ring-1 ring-blue-100">View bookings</Link>
            </>
          ) : (
            <EmptyState icon={Briefcase} title="No Professional Profile" text="Submit a professional application before managing availability." action="Apply Now" onAction={() => router.push('/app/settings/become-professional')} />
          )}
        </div>
      );
    }
    if (subPath === 'sessions') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <Shield className="h-9 w-9 text-blue-600" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Active Sessions</h2>
            <p className="mt-2 text-sm text-slate-500">Manage devices signed in to {user?.email || user?.phone_number || 'this account'}.</p>
          </section>
          {!activeSessions.length ? <EmptyState icon={Shield} title="No Active Sessions" text="Your current browser session will appear here after auth refresh." /> : null}
          {activeSessions.map((session) => (
            <article key={session.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-blue-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-950">{session.device_info || 'Unknown device'}</p>
                  <p className="mt-1 text-sm text-slate-500">Last active: {session.last_active ? new Date(session.last_active).toLocaleString() : 'Unknown'}</p>
                  <p className="text-xs font-bold text-slate-400">Created: {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'Unknown'}</p>
                </div>
                {session.isCurrent ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Current</span> : null}
              </div>
              {!session.isCurrent ? (
                <button type="button" onClick={() => void endStoredSession(session.id)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-red-50 py-3 text-sm font-black text-red-600 ring-1 ring-red-100">
                  <Trash2 className="h-4 w-4" />
                  End session
                </button>
              ) : null}
            </article>
          ))}
          <button type="button" onClick={() => void supabase?.auth.signOut().then(() => router.replace('/auth'))} className="w-full rounded-[20px] bg-red-50 py-4 font-black text-red-600 ring-1 ring-red-100">Sign out of this device</button>
        </div>
      );
    }
    if (subPath && subPath !== '') {
      const found = settingsRouteCards.find(([slug]) => slug === subPath);
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-blue-50 p-5 text-blue-950 ring-1 ring-blue-100">
            <Settings className="h-9 w-9 text-blue-600" />
            <h2 className="mt-3 text-2xl font-black">{found?.[1] || 'Settings'}</h2>
            <p className="mt-2 text-sm leading-6 text-blue-800">{found?.[2] || 'This settings flow is available on mobile and is now routed on web.'}</p>
          </section>
          {renderSettings()}
        </div>
      );
    }
    return (
      <>
        {renderSettings()}
        {renderRouteHub('More settings', 'The same settings areas from the mobile app are available here.', '/app/settings', settingsRouteCards)}
      </>
    );
  };

  const renderVerificationRoute = () => {
    const method = subPath || '';
    if (!method) {
      return renderRouteHub('Verification', 'Choose the same verification path available in the mobile app.', '/app/verification', verificationRouteCards, Shield);
    }
    const found = verificationRouteCards.find(([slug]) => slug === method);
    if (method === 'email' || method === 'phone') {
      const isEmail = method === 'email';
      const Icon = isEmail ? Mail : Phone;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-blue-600 p-5 text-white shadow-xl shadow-blue-600/20">
            <Icon className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">{isEmail ? 'Email Verification' : 'Phone Verification'}</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">Generate a verification code and enter it below.</p>
          </section>
          <FormField label={isEmail ? 'Email address' : 'Phone number'} value={isEmail ? verificationForm.email : verificationForm.phone} onChange={(value) => setVerificationForm((prev) => ({ ...prev, [isEmail ? 'email' : 'phone']: value }))} />
          <button type="button" onClick={() => void sendVerificationCode(method)} className="w-full rounded-[20px] bg-blue-50 py-4 font-black text-blue-700 ring-1 ring-blue-200">Send code</button>
          <FormField label="Verification code" value={verificationForm.code} onChange={(code) => setVerificationForm((prev) => ({ ...prev, code }))} inputMode="numeric" />
          <button type="button" onClick={() => void verifyCode(method)} disabled={!verificationForm.code.trim()} className="w-full rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">Verify</button>
        </div>
      );
    }
    if (method === 'id') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-blue-600 p-5 text-white shadow-xl shadow-blue-600/20">
            <Shield className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">ID Verification</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">Upload your document or paste a hosted URL for admin review.</p>
          </section>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            {uploadingLabel === 'ID document' ? 'Uploading document...' : 'Upload ID document'}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => void handleFileUpload(event, 'verification', 'ID document', (documentUrl) => setVerificationForm((prev) => ({ ...prev, documentUrl })))} />
          </label>
          <FormField label="Document URL" value={verificationForm.documentUrl} onChange={(documentUrl) => setVerificationForm((prev) => ({ ...prev, documentUrl }))} placeholder="https://..." />
          <button type="button" onClick={() => void submitIdVerification()} disabled={saving || !verificationForm.documentUrl.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
            Submit for review
          </button>
        </div>
      );
    }
    if (method === 'couple-selfie') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-600 p-5 text-white shadow-xl shadow-pink-500/20">
            <Camera className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">Couple Selfie</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Upload a couple selfie or paste a hosted URL for the same certificate verification flow used on mobile.</p>
          </section>
          {relationship?.id ? (
            <>
              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-black text-slate-950">{relationship.partner_name || 'Your relationship'}</p>
                <p className="mt-1 text-sm text-slate-500">Status: {relationship.status || 'pending'}</p>
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                <UploadCloud className="h-5 w-5 text-blue-600" />
                {uploadingLabel === 'Couple selfie' ? 'Uploading selfie...' : 'Upload couple selfie'}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'verification', 'Couple selfie', (documentUrl) => setVerificationForm((prev) => ({ ...prev, documentUrl })))} />
              </label>
              <FormField label="Couple selfie URL" value={verificationForm.documentUrl} onChange={(documentUrl) => setVerificationForm((prev) => ({ ...prev, documentUrl }))} placeholder="https://..." />
              <button type="button" onClick={() => void submitCoupleSelfieVerification()} disabled={saving || !verificationForm.documentUrl.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                Submit couple selfie
              </button>
            </>
          ) : (
            <EmptyState icon={Heart} title="No Relationship Found" text="Register or verify a relationship before submitting a couple selfie." action="Register Relationship" onAction={() => router.push('/app/relationship/register')} />
          )}
        </div>
      );
    }
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-blue-600 p-5 text-white shadow-xl shadow-blue-600/20">
          <Shield className="h-10 w-10" />
          <h2 className="mt-4 text-3xl font-black">{found?.[1] || 'Verification'}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-50">{found?.[2] || 'Complete this verification method.'}</p>
        </section>
        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase tracking-wide text-slate-500">Suggested order</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href="/app/verification/phone" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Step 1: Phone</Link>
            <Link href="/app/verification/email" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Step 2: Email</Link>
            <Link href="/app/verification/id" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Step 3: ID</Link>
            <Link href="/app/verification/couple-selfie" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Step 4: Couple Selfie</Link>
          </div>
        </section>
        <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Your current status is shown below. Continue from the matching mobile flow if this method needs document upload, camera capture, or code delivery.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
            <span className={`rounded-full px-2 py-3 ${user?.email_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>Email</span>
            <span className={`rounded-full px-2 py-3 ${user?.phone_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>Phone</span>
            <span className={`rounded-full px-2 py-3 ${user?.id_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>ID</span>
          </div>
        </div>
      </div>
    );
  };

  const renderLegalRoute = () => {
    const slug = subPath || '';
    const document = legalDocuments.find((item) => item.slug === slug);
    if (!slug) {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <FileText className="h-9 w-9 text-blue-600" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Legal Documents</h2>
            <p className="mt-2 text-sm text-slate-500">Active policies and consent documents.</p>
          </section>
          {legalDocuments.map((item) => (
            <Link key={item.id} href={`/app/legal/${item.slug}`} className="block rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-500">Version {item.version || '1.0'} {item.is_required ? '- Required' : ''}</p>
            </Link>
          ))}
        </div>
      );
    }
    if (!document) return <EmptyState icon={FileText} title="Document Not Found" text="This legal document is not available." action="All Documents" onAction={() => router.push('/app/legal')} />;
    return (
      <article className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <FileText className="h-9 w-9 text-blue-600" />
          <h1 className="mt-3 text-3xl font-black text-slate-950">{document.title}</h1>
          <p className="mt-2 text-sm text-slate-500">Version {document.version || '1.0'} - Updated {document.updated_at ? new Date(document.updated_at).toLocaleDateString() : 'recently'}</p>
        </section>
        <section className="rounded-[22px] bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm ring-1 ring-slate-200">
          {(document.content || '').split('\n').map((line: string, index: number) => (
            <p key={`${index}-${line.slice(0, 12)}`} className="mb-3">{line}</p>
          ))}
        </section>
      </article>
    );
  };

  const renderAdsRoute = () => {
    if (subPath === 'invoices') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <CreditCard className="h-9 w-9 text-blue-600" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Ad Invoices</h2>
            <p className="mt-2 text-sm text-slate-500">Receipts and proof for boosted ads.</p>
          </section>
          {!adReceipts.length ? <EmptyState icon={CreditCard} title="No Invoices Yet" text="Approved ad payments and receipts will appear here." /> : null}
          {adReceipts.map((receipt) => (
            <Link key={receipt.id} href={`/app/ads/receipt?receiptId=${receipt.id}`} className="block rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-950">{receipt.receipt_number || 'Receipt'}</p>
              <p className="mt-1 text-sm text-slate-500">{receipt.advertisements?.title || 'Advertisement'} - {receipt.currency || 'USD'} {receipt.amount || 0}</p>
              <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{receipt.status || 'issued'}</span>
            </Link>
          ))}
        </div>
      );
    }
    if (subPath === 'receipt') {
      const receiptId = searchParams?.get('receiptId') || '';
      const receipt = adReceipts.find((item) => item.id === receiptId) || adReceipts[0];
      if (!receipt) return <EmptyState icon={CreditCard} title="Receipt Not Found" text="This receipt is not available." action="Invoices" onAction={() => router.push('/app/ads/invoices')} />;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
            <Shield className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-4 text-3xl font-black text-slate-950">Committed</h2>
            <p className="text-sm text-slate-500">Advertisement Receipt</p>
          </section>
          <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Receipt</span><span className="font-black">{receipt.receipt_number || receipt.id}</span></div>
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Amount</span><span className="font-black">{receipt.currency || 'USD'} {receipt.amount || 0}</span></div>
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Campaign</span><span className="font-black">{receipt.advertisements?.title || 'Advertisement'}</span></div>
            <div className="flex justify-between py-3"><span className="font-bold text-slate-500">Status</span><span className="font-black uppercase">{receipt.status || 'issued'}</span></div>
          </section>
        </div>
      );
    }
    if (subPath === 'promote') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-gradient-to-br from-pink-600 to-blue-700 p-5 text-white">
            <Sparkles className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">Create Ad</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Promote a post, reel, or standalone campaign.</p>
          </section>
          <FormField label="Title" value={adForm.title} onChange={(title) => setAdForm((prev) => ({ ...prev, title }))} placeholder="Campaign title" />
          <FormField label="Description" value={adForm.description} onChange={(description) => setAdForm((prev) => ({ ...prev, description }))} multiline placeholder="What should people know?" />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            {uploadingLabel === 'Ad media' ? 'Uploading media...' : 'Upload ad image/video'}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={(event) => void handleFileUpload(event, 'ads', 'Ad media', (imageUrl) => setAdForm((prev) => ({ ...prev, imageUrl })))} />
          </label>
          <FormField label="Image / video URL" value={adForm.imageUrl} onChange={(imageUrl) => setAdForm((prev) => ({ ...prev, imageUrl }))} placeholder="https://..." />
          <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="mb-3 text-sm font-black text-slate-700">Call to action</p>
            <div className="grid grid-cols-3 gap-2">
              {['website', 'whatsapp', 'messenger'].map((type) => (
                <button key={type} type="button" onClick={() => setAdForm((prev) => ({ ...prev, ctaType: type }))} className={`rounded-[16px] py-3 text-sm font-black capitalize ${adForm.ctaType === type ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
          <FormField label="Destination URL" value={adForm.ctaUrl} onChange={(ctaUrl) => setAdForm((prev) => ({ ...prev, ctaUrl }))} placeholder="https://..." />
          <FormField label="WhatsApp / phone" value={adForm.ctaPhone} onChange={(ctaPhone) => setAdForm((prev) => ({ ...prev, ctaPhone }))} placeholder="Optional" />
          <FormField label="Template message" value={adForm.ctaMessage} onChange={(ctaMessage) => setAdForm((prev) => ({ ...prev, ctaMessage }))} multiline placeholder="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Daily budget" value={adForm.dailyBudget} onChange={(dailyBudget) => setAdForm((prev) => ({ ...prev, dailyBudget }))} inputMode="decimal" />
            <FormField label="Total budget" value={adForm.totalBudget} onChange={(totalBudget) => setAdForm((prev) => ({ ...prev, totalBudget }))} inputMode="decimal" />
          </div>
          <FormField label="Target locations" value={adForm.locations} onChange={(locations) => setAdForm((prev) => ({ ...prev, locations }))} placeholder="Cities or countries" />
          <button type="button" onClick={() => void createAdvertisement()} disabled={saving || !adForm.title.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Submit ad
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <CreditCard className="h-9 w-9 text-blue-600" />
          <h2 className="mt-3 text-2xl font-black text-slate-950">My Ads</h2>
          <p className="mt-2 text-sm text-slate-500">Campaigns and boosted content.</p>
          <div className="mt-4 flex gap-2">
            <Link href="/app/ads/promote" className="inline-flex rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">Create Ad</Link>
            <Link href="/app/ads/invoices" className="inline-flex rounded-[18px] bg-slate-100 px-5 py-3 font-black text-slate-700">Invoices</Link>
          </div>
        </section>
        {!ads.length ? <EmptyState icon={CreditCard} title="No Ads Yet" text="Boost a post, reel, or create a standalone ad." /> : null}
        {ads.map((ad) => (
          <article key={ad.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">{ad.title || 'Advertisement'}</p>
            <p className="mt-1 text-sm text-slate-500">{ad.description}</p>
            <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{ad.status || 'draft'}</span>
          </article>
        ))}
      </div>
    );
  };

  const renderBookingForm = (mode: 'create' | 'reschedule') => {
    const bookingId = searchParams?.get('sessionId') || appPath[2] || '';
    const selectedBooking = bookings.find((item) => item.id === bookingId);
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-blue-600 p-5 text-white shadow-xl shadow-blue-600/20">
          <Calendar className="h-10 w-10" />
          <h2 className="mt-4 text-3xl font-black">{mode === 'create' ? 'Create Booking' : 'Reschedule Booking'}</h2>
          <p className="mt-2 text-sm leading-6 text-blue-50">Book the same professional sessions available from the mobile flow.</p>
        </section>
        {mode === 'create' ? (
          <>
            <label className="block text-sm font-black text-slate-700">
              Professional role
              <select value={bookingForm.roleId} onChange={(event) => setBookingForm((prev) => ({ ...prev, roleId: event.target.value, professionalId: '' }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500">
                <option value="">Select a role</option>
                {professionalRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </label>
            <label className="block text-sm font-black text-slate-700">
              Professional
              <select
                value={bookingForm.professionalId}
                onChange={(event) => {
                  const selected = professionalDirectory.find((item) => item.id === event.target.value);
                  setBookingForm((prev) => ({ ...prev, professionalId: event.target.value, roleId: selected?.role_id || prev.roleId }));
                }}
                className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500"
              >
                <option value="">Select a professional</option>
                {professionalDirectory
                  .filter((profile) => !bookingForm.roleId || profile.role_id === bookingForm.roleId)
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name || 'Professional'}{profile.role?.name ? ` - ${profile.role.name}` : ''}{profile.rating_average ? ` - ${Number(profile.rating_average).toFixed(1)} stars` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <FormField label="Conversation ID" value={bookingForm.conversationId} onChange={(conversationId) => setBookingForm((prev) => ({ ...prev, conversationId }))} placeholder="Optional" />
          </>
        ) : selectedBooking ? (
          <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">{selectedBooking.professional?.full_name || 'Professional session'}</p>
            <p className="mt-1 text-sm text-slate-500">Current time: {selectedBooking.scheduled_date ? new Date(selectedBooking.scheduled_date).toLocaleString() : 'Not scheduled'}</p>
          </div>
        ) : (
          <EmptyState icon={Calendar} title="Booking Not Found" text="Open reschedule from a booking card." action="Bookings" onAction={() => router.push('/app/bookings')} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Date" value={bookingForm.date} onChange={(date) => setBookingForm((prev) => ({ ...prev, date }))} type="date" />
          <FormField label="Time" value={bookingForm.time} onChange={(time) => setBookingForm((prev) => ({ ...prev, time }))} type="time" />
        </div>
        <FormField label="Duration minutes" value={bookingForm.durationMinutes} onChange={(durationMinutes) => setBookingForm((prev) => ({ ...prev, durationMinutes }))} inputMode="numeric" />
        <label className="block text-sm font-black text-slate-700">
          Location type
          <select value={bookingForm.locationType} onChange={(event) => setBookingForm((prev) => ({ ...prev, locationType: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500">
            <option value="online">Online</option>
            <option value="in_person">In person</option>
            <option value="phone">Phone</option>
            <option value="video">Video</option>
          </select>
        </label>
        <FormField label="Address" value={bookingForm.locationAddress} onChange={(locationAddress) => setBookingForm((prev) => ({ ...prev, locationAddress }))} placeholder="Optional" />
        <FormField label="Notes" value={bookingForm.bookingNotes} onChange={(bookingNotes) => setBookingForm((prev) => ({ ...prev, bookingNotes }))} multiline placeholder={mode === 'create' ? 'What do you need help with?' : 'Reason for reschedule'} />
        <button type="button" onClick={() => mode === 'create' ? void submitBooking() : void rescheduleBooking(bookingId)} disabled={saving || !bookingForm.date || !bookingForm.time || (mode === 'create' && (!bookingForm.professionalId || !bookingForm.roleId))} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Calendar className="h-5 w-5" />}
          {mode === 'create' ? 'Create booking' : 'Save new time'}
        </button>
      </div>
    );
  };

  const renderBookingsRoute = () => {
    if (subPath === 'create') return renderBookingForm('create');
    if (subPath === 'reschedule') return renderBookingForm('reschedule');
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Calendar className="h-9 w-9 text-blue-600" />
          <h2 className="mt-3 text-2xl font-black text-slate-950">Bookings</h2>
          <p className="mt-2 text-sm text-slate-500">Professional sessions, requests, and reschedules.</p>
          <Link href="/app/bookings/create" className="mt-4 inline-flex rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">Create Booking</Link>
        </section>
        {!bookings.length ? <EmptyState icon={Calendar} title="No Bookings Yet" text="Your professional sessions will appear here." /> : null}
        {bookings.map((booking) => (
          <article key={booking.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-black text-slate-950">{booking.professional?.full_name || booking.topic || booking.session_type || 'Professional session'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{booking.scheduled_date ? new Date(booking.scheduled_date).toLocaleString() : 'Time not scheduled'}</p>
            <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{booking.status || 'pending'}</span>
            <Link href={`/app/bookings/reschedule?sessionId=${booking.id}`} className="mt-3 inline-flex rounded-[14px] bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">Reschedule</Link>
          </article>
        ))}
      </div>
    );
  };

  const renderProfessionalRoute = () => {
    if (subPath === 'reviews') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <Star className="h-9 w-9 fill-amber-400 text-amber-400" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Professional Reviews</h2>
            <p className="mt-2 text-sm text-slate-500">{professionalProfile ? `${professionalProfile.rating_average || 0} average - ${professionalProfile.review_count || professionalReviews.length} reviews` : 'Reviews for your professional profile.'}</p>
          </section>
          {!professionalReviews.length ? <EmptyState icon={Star} title="No Reviews Yet" text="Reviews from completed sessions will appear here." /> : null}
          {professionalReviews.map((review) => (
            <article key={review.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <Avatar src={review.is_anonymous ? null : review.client?.profile_picture} name={review.is_anonymous ? 'Anonymous' : review.client?.full_name} />
                <div>
                  <p className="font-black text-slate-950">{review.is_anonymous ? 'Anonymous client' : review.client?.full_name || 'Client'}</p>
                  <p className="text-sm font-semibold text-amber-500">{`${Math.max(1, Number(review.rating || 0))}/5 stars`}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{review.review_text || 'No written review.'}</p>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'session-requests' || subPath === 'bookings') {
      return renderBookingsRoute();
    }
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
          <Briefcase className="h-10 w-10 text-blue-300" />
          <h2 className="mt-4 text-3xl font-black">Professional</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Bookings, session requests, availability, and reviews.</p>
        </section>
        {[
          ['/app/professional/bookings', 'Bookings', 'Upcoming and past professional sessions'],
          ['/app/professional/session-requests', 'Session Requests', 'Accept, reject, and message clients'],
          ['/app/professional/reviews', 'Reviews', 'Ratings and client feedback'],
          ['/app/settings/professional-availability', 'Availability', 'Manage your calendar'],
        ].map(([href, title, text]) => (
          <Link key={href} href={href} className="block rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </Link>
        ))}
      </div>
    );
  };

  const renderRelationshipMemoryRoute = () => {
    const relationshipId = appPath[1];
    const rel = relationship?.id === relationshipId || !relationshipId ? relationship : null;
    const isAnniversary = appPath[0] === 'anniversary';
    if (!rel) return <EmptyState icon={Heart} title="Relationship Not Found" text="This relationship record is not available." action="Home" onAction={() => router.push('/app')} />;
    return (
      <div className="space-y-4 px-4 py-4">
        <section className={`rounded-[28px] p-6 text-center text-white shadow-xl ${isAnniversary ? 'bg-gradient-to-br from-pink-500 to-red-500' : 'bg-gradient-to-br from-blue-600 to-slate-950'}`}>
          {isAnniversary ? <Heart className="mx-auto h-14 w-14 fill-white" /> : <Shield className="mx-auto h-14 w-14" />}
          <h2 className="mt-4 text-3xl font-black">{isAnniversary ? 'Anniversary' : 'Relationship Certificate'}</h2>
          <p className="mt-2 text-sm text-white/85">{rel.status === 'verified' ? 'Verified on Committed' : 'Pending verification'}</p>
        </section>
        <section className="rounded-[24px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-black uppercase text-slate-400">Relationship with</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{rel.partner_name || 'Partner'}</h1>
          <p className="mt-2 text-sm font-semibold capitalize text-slate-500">{rel.type || 'relationship'} - {rel.privacy_level || 'private'}</p>
          <p className="mt-4 text-sm text-slate-500">Started {rel.start_date ? new Date(rel.start_date).toLocaleDateString() : 'recently'}</p>
        </section>
      </div>
    );
  };

  const renderUserProfileRoute = () => {
    const userId = appPath[1];
    if (!userId) return renderProfile();
    if (routeProfileLoading) return <ScreenSkeleton />;
    const related = userId === user?.id
      ? user
      : routeProfileUser || datingLikes.find((item) => item.user?.id === userId)?.user || datingMatches.find((item) => item.user?.id === userId)?.user || null;
    if (!related) return <EmptyState icon={User} title="Profile Not Found" text="This profile is not loaded yet." action="Back" onAction={() => router.back()} />;
    const relatedPosts = userId === user?.id ? posts.filter((post) => post.user_id === user.id).slice(0, 12) : routeProfilePosts;
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <Avatar src={related.profile_picture} name={getUserDisplayName(related)} size="lg" />
          <h2 className="mt-4 text-3xl font-black text-slate-950">{getUserDisplayName(related)}</h2>
          <p className="text-sm text-slate-500">{related.username ? `@${related.username}` : related.email}</p>
          <div className="mt-4 flex justify-center gap-2">
            {related.verified ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Verified</span> : null}
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{related.role || 'user'}</span>
          </div>
        </section>
        <Link href="/app/messages" className="block rounded-[20px] bg-blue-600 py-4 text-center font-black text-white">Message</Link>
        <section className="space-y-3">
          <h3 className="px-1 text-lg font-black text-slate-950">Posts</h3>
          {!relatedPosts.length ? (
            <div className="rounded-[22px] bg-white p-5 text-center text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">No visible posts yet.</div>
          ) : (
            relatedPosts.map((post) => (
              <PostCard key={post.id} post={post} user={user} onLike={togglePostLike} onShare={shareText} />
            ))
          )}
        </section>
      </div>
    );
  };

  const renderAdminRoute = () => {
    if (!user || !isAdminRole(user.role)) {
      return <EmptyState icon={Shield} title="Admin Only" text="This area is only visible to admins and moderators." />;
    }
    if (subPath === 'relationships') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Heart className="h-10 w-10 fill-pink-500 text-pink-500" />
            <h2 className="mt-4 text-3xl font-black">Manage Relationships</h2>
            <p className="mt-2 text-sm text-slate-300">Verify, end, or remove records. User reports do not hide relationships automatically.</p>
          </section>
          {adminRelationships.map((rel) => (
            <article key={rel.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{rel.users?.full_name || 'Member'}</p>
                  <p className="text-sm text-slate-500">with {rel.partner_name || rel.partner_phone || 'Partner'}</p>
                  <p className="mt-2 text-sm font-semibold capitalize text-slate-600">{rel.type || 'relationship'} - {rel.privacy_level || 'private'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${rel.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : rel.status === 'ended' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{rel.status || 'pending'}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateAdminRelationship(rel.id, 'verify')} disabled={saving || rel.status !== 'pending'} className="rounded-[16px] bg-cyan-500 py-3 text-sm font-black text-white disabled:opacity-40">Verify</button>
                <button type="button" onClick={() => void updateAdminRelationship(rel.id, 'end')} disabled={saving || rel.status !== 'verified'} className="rounded-[16px] bg-amber-500 py-3 text-sm font-black text-white disabled:opacity-40">End Review</button>
                <button type="button" onClick={() => void updateAdminRelationship(rel.id, 'reject')} disabled={saving || rel.status !== 'pending'} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-40">Reject</button>
                <button type="button" onClick={() => void updateAdminRelationship(rel.id, 'delete')} disabled={saving} className="rounded-[16px] bg-red-800 py-3 text-sm font-black text-white disabled:opacity-40">Delete</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'users') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <User className="h-10 w-10 text-pink-400" />
            <h2 className="mt-4 text-3xl font-black">Manage Users</h2>
            <p className="mt-2 text-sm text-slate-300">{adminUsers.length} users loaded</p>
          </section>
          {adminUsers.map((member) => (
            <article key={member.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex gap-3">
                <Avatar src={member.profile_picture} name={member.full_name || member.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{member.full_name || 'Member'}</p>
                  <p className="truncate text-sm text-slate-500">{member.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-pink-50 px-2 py-1 text-xs font-black text-pink-700">{member.role || 'user'}</span>
                    {member.banned_at ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-700">banned</span> : null}
                    {member.verified ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">verified</span> : null}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(['phone', 'email', 'id'] as const).map((type) => {
                  const verified = type === 'phone' ? member.phone_verified : type === 'email' ? member.email_verified : member.id_verified;
                  return (
                    <button key={type} type="button" onClick={() => void updateAdminUserVerification(member.id, type)} disabled={saving || !!verified} className={`rounded-[14px] py-2 text-xs font-black uppercase disabled:opacity-50 ${verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                      {type} {verified ? 'yes' : 'no'}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void toggleAdminUserBan(member)} disabled={saving || member.id === user.id} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-40 ${member.banned_at ? 'bg-emerald-600' : 'bg-red-500'}`}>
                  {member.banned_at ? 'Unban' : 'Ban'}
                </button>
                {normalizeRole(user.role) === 'super_admin' ? (
                  <select value={member.role || 'user'} onChange={(event) => void updateAdminUserRole(member.id, event.target.value)} className="rounded-[16px] border border-slate-200 bg-white px-3 text-sm font-black text-slate-700">
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                ) : (
                  <Link href={`/app/profile/${member.id}`} className="rounded-[16px] bg-blue-50 py-3 text-center text-sm font-black text-blue-700">View</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'posts-review' || subPath === 'reels-review') {
      const isPosts = subPath === 'posts-review';
      const rows = isPosts ? adminPosts : adminReels;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            {isPosts ? <Heart className="h-10 w-10 text-pink-400" /> : <Film className="h-10 w-10 text-blue-300" />}
            <h2 className="mt-4 text-3xl font-black">{isPosts ? 'Posts Review' : 'Reels Review'}</h2>
            <p className="mt-2 text-sm text-slate-300">Approve or reject content moderation items.</p>
          </section>
          {rows.map((row) => (
            <article key={row.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <Avatar src={row.users?.profile_picture} name={row.users?.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{row.users?.full_name || 'Member'}</p>
                  <p className="truncate text-sm text-slate-600">{isPosts ? row.content : row.caption}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">{row.moderation_status || 'pending'}</span>
              </div>
              {row.thumbnail_url ? <img src={row.thumbnail_url} alt="" className="mt-3 max-h-56 w-full rounded-[18px] object-cover" /> : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateModeration(isPosts ? 'posts' : 'reels', row.id, 'approved')} disabled={saving || row.moderation_status === 'approved'} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Approve</button>
                <button type="button" onClick={() => void updateModeration(isPosts ? 'posts' : 'reels', row.id, 'rejected')} disabled={saving || row.moderation_status === 'rejected'} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Reject</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'professional-profiles') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Briefcase className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Applications</h2>
            <p className="mt-2 text-sm text-slate-300">Approve or reject professional requests.</p>
          </section>
          {professionalApplications.map((app) => (
            <article key={app.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <Avatar src={app.user?.profile_picture} name={app.user?.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-slate-950">{app.user?.full_name || 'Applicant'}</p>
                  <p className="truncate text-sm text-slate-500">{app.user?.email}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{app.role?.name || app.application_data?.role || 'Professional'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">{app.status || 'pending'}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateProfessionalApplication(app.id, 'approved')} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white">Approve</button>
                <button type="button" onClick={() => void updateProfessionalApplication(app.id, 'rejected')} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white">Reject</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'false-relationship-reports') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-pink-400" />
            <h2 className="mt-4 text-3xl font-black">False Relationship Reports</h2>
            <p className="mt-2 text-sm text-slate-300">Reports do not hide relationships automatically. Admin decides the final action.</p>
          </section>
          {falseRelationshipReports.map((report) => (
            <article key={report.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{report.relationship?.partner_name || 'Relationship report'}</p>
                  <p className="text-sm text-slate-500">Reported by {report.reporter?.full_name || report.reporter?.email || 'member'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">{report.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{report.details || report.reason || 'No details supplied.'}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void updateFalseReport(report, 'reviewing')} disabled={saving || report.status === 'reviewing' || report.status === 'resolved' || report.status === 'dismissed'} className="rounded-[16px] bg-blue-600 py-3 text-xs font-black text-white disabled:opacity-50">Review</button>
                <button type="button" onClick={() => void updateFalseReport(report, 'dismissed')} disabled={saving || report.status === 'resolved' || report.status === 'dismissed'} className="rounded-[16px] bg-slate-700 py-3 text-xs font-black text-white disabled:opacity-50">Dismiss</button>
                <button type="button" onClick={() => void updateFalseReport(report, 'resolved')} disabled={saving || report.status === 'resolved'} className="rounded-[16px] bg-red-600 py-3 text-xs font-black text-white disabled:opacity-50">End</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'payment-verifications') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <CreditCard className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Payment Verifications</h2>
            <p className="mt-2 text-sm text-slate-300">Payment proof queue.</p>
          </section>
          {paymentSubmissions.map((payment) => (
            <article key={payment.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="text-lg font-black text-slate-950">{payment.user?.full_name || payment.user?.email || 'Payment'}</p>
              <p className="mt-1 text-sm text-slate-500">{payment.transaction_reference || payment.reference || payment.method || 'No reference'} - {payment.amount || ''}</p>
              {payment.proof_url || payment.payment_proof_url ? <Link href={`/app/admin/payment-proof-viewer?imageUrl=${encodeURIComponent(payment.proof_url || payment.payment_proof_url)}`} className="mt-3 inline-flex rounded-[14px] bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">View proof</Link> : null}
              <span className="mt-3 block rounded-full bg-amber-50 px-3 py-1 text-center text-xs font-black uppercase text-amber-700">{payment.status || 'pending'}</span>
              {payment.status === 'pending' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void updatePaymentSubmission(payment, 'approved')} disabled={saving} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => void updatePaymentSubmission(payment, 'rejected')} disabled={saving} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Reject</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'payment-proof-viewer') {
      const imageUrl = searchParams?.get('imageUrl') || '';
      return (
        <div className="relative grid min-h-[calc(100vh-122px)] place-items-center bg-black p-4">
          <button type="button" onClick={() => router.back()} className="absolute right-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
            <X className="h-6 w-6" />
          </button>
          {imageUrl ? <img src={imageUrl} alt="Payment proof" className="max-h-[calc(100vh-160px)] w-full object-contain" /> : <EmptyState icon={CreditCard} title="No Proof Image" text="This payment submission has no proof image." />}
        </div>
      );
    }
    if (subPath === 'ban-appeals') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-amber-300" />
            <h2 className="mt-4 text-3xl font-black">Ban Appeals</h2>
            <p className="mt-2 text-sm text-slate-300">Approve appeals by lifting the matching restriction, or reject with the restriction still active.</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Shield} title="No Appeals" text={routeRowsError || 'No ban appeals are waiting.'} /> : null}
          {routeRows.map((appeal) => (
            <article key={appeal.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">{appeal.appeal_type || appeal.restricted_feature || 'Appeal'}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">{appeal.user_id || 'Member'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${appeal.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : appeal.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{appeal.status || 'pending'}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{appeal.reason || 'No appeal reason supplied.'}</p>
              {appeal.admin_response ? <p className="mt-2 rounded-[16px] bg-slate-50 p-3 text-xs font-semibold text-slate-500">{appeal.admin_response}</p> : null}
              {appeal.status === 'pending' || appeal.status === 'under_review' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void updateBanAppeal(appeal, 'approve')} disabled={saving} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => void updateBanAppeal(appeal, 'reject')} disabled={saving} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Reject</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'dating') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Heart className="h-10 w-10 fill-pink-500 text-pink-500" />
            <h2 className="mt-4 text-3xl font-black">Dating Admin</h2>
            <p className="mt-2 text-sm text-slate-300">Manage profile safety, visibility, premium trials, and trust badges.</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Heart} title="No Dating Profiles" text={routeRowsError || 'No dating profiles are available.'} /> : null}
          {routeRows.map((profile) => (
            <article key={profile.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex gap-3">
                <Avatar src={profile.users?.profile_picture} name={profile.users?.full_name || profile.users?.email || 'Member'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{profile.users?.full_name || profile.users?.email || 'Dating member'}</p>
                  <p className="truncate text-sm text-slate-500">{[profile.age, profile.location_city, profile.location_country].filter(Boolean).join(' - ') || profile.user_id}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${profile.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{profile.is_active ? 'active' : 'inactive'}</span>
                    {profile.admin_suspended ? <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-700">suspended</span> : null}
                    {profile.admin_limited ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">limited</span> : null}
                    {profile.premium_trial_ends_at ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">premium trial</span> : null}
                  </div>
                </div>
              </div>
              {profile.bio ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{profile.bio}</p> : null}
              {profile.admin_suspended_reason || profile.admin_limited_reason ? (
                <p className="mt-3 rounded-[16px] bg-slate-50 p-3 text-xs font-semibold text-slate-500">{profile.admin_suspended_reason || profile.admin_limited_reason}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateAdminDatingProfile(profile, profile.admin_suspended ? 'unsuspend' : 'suspend')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${profile.admin_suspended ? 'bg-emerald-600' : 'bg-red-500'}`}>{profile.admin_suspended ? 'Unsuspend' : 'Suspend'}</button>
                <button type="button" onClick={() => void updateAdminDatingProfile(profile, profile.admin_limited ? 'unlimit' : 'limit')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${profile.admin_limited ? 'bg-emerald-600' : 'bg-amber-500'}`}>{profile.admin_limited ? 'Unlimit' : 'Limit'}</button>
                <button type="button" onClick={() => void updateAdminDatingProfile(profile, 'premium')} disabled={saving} className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">7-day Premium</button>
                <button type="button" onClick={() => void updateAdminDatingProfile(profile, 'badge_verified')} disabled={saving} className="rounded-[16px] bg-pink-600 py-3 text-sm font-black text-white disabled:opacity-50">Verified Badge</button>
                <button type="button" onClick={() => void updateAdminDatingProfile(profile, 'badge_premium')} disabled={saving} className="rounded-[16px] bg-violet-600 py-3 text-sm font-black text-white disabled:opacity-50">Premium Badge</button>
                <button type="button" onClick={() => void updateAdminDatingProfile(profile, 'delete')} disabled={saving} className="rounded-[16px] bg-red-800 py-3 text-sm font-black text-white disabled:opacity-50">Delete</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'id-verifications') {
      const rows = routeRows;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">ID Verifications</h2>
            <p className="mt-2 text-sm text-slate-300">Review identity documents and keep verification decisions explicit.</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !rows.length ? <EmptyState icon={Shield} title="No Documents" text={routeRowsError || 'No ID verification documents are waiting.'} /> : null}
          {rows.map((doc) => (
            <article key={doc.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{doc.document_type || 'Document'}</p>
                  <p className="mt-1 text-sm text-slate-500">{doc.user?.full_name || doc.user?.email || doc.user_id || 'Member'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">{doc.status || 'pending'}</span>
              </div>
              {doc.document_url ? <a href={doc.document_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-[14px] bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">View document</a> : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateAdminDocumentStatus(doc.id, 'approved')} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white">Approve</button>
                <button type="button" onClick={() => void updateAdminDocumentStatus(doc.id, 'rejected')} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white">Reject</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'professional-sessions') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Calendar className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Sessions</h2>
            <p className="mt-2 text-sm text-slate-300">Full booking/session queue from the mobile admin area.</p>
          </section>
          {!adminProfessionalSessions.length ? <EmptyState icon={Calendar} title="No Sessions Loaded" text="No professional sessions are available in the admin queue." /> : null}
          {adminProfessionalSessions.map((session) => (
            <article key={session.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                <Avatar src={session.user?.profile_picture} name={session.user?.full_name || session.user?.email || 'Client'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{session.user?.full_name || session.user?.email || 'Client'}</p>
                  <p className="mt-1 text-sm text-slate-500">with {session.professional?.full_name || 'professional'}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{session.status || 'pending'}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{session.scheduled_date ? new Date(session.scheduled_date).toLocaleString() : 'No schedule'} - {session.location_type || 'online'}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>{session.session_type || 'session'} - {session.scheduled_duration_minutes || 60} min - payment {session.payment_status || 'not set'}</p>
                {session.location_address ? <p>{session.location_address}</p> : null}
                {session.booking_notes ? <p className="rounded-[14px] bg-slate-50 p-3">{session.booking_notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'professional-reviews') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Star className="h-10 w-10 fill-amber-300 text-amber-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Reviews</h2>
            <p className="mt-2 text-sm text-slate-300">Ratings and feedback moderation.</p>
          </section>
          {!adminProfessionalReviews.length ? <EmptyState icon={Star} title="No Reviews Loaded" text="No professional reviews are available in the admin queue." /> : null}
          {adminProfessionalReviews.map((review) => (
            <article key={review.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{review.client?.full_name || review.client?.email || 'Client'}</p>
              <p className="mt-1 text-sm text-slate-500">for {review.professional?.full_name || 'professional'}</p>
              <p className="mt-1 text-sm font-semibold text-amber-500">{`${Math.max(1, Number(review.rating || 0))}/5 stars`}</p>
              <p className="mt-2 text-sm text-slate-600">{review.review_text || 'No written review.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {review.is_anonymous ? <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">Anonymous</span> : null}
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${review.moderation_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : review.moderation_status === 'rejected' ? 'bg-red-50 text-red-700' : review.moderation_status === 'flagged' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{review.moderation_status || 'pending'}</span>
                {review.reported_count ? <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">{review.reported_count} reports</span> : null}
              </div>
              {review.moderation_reason ? <p className="mt-3 rounded-[16px] bg-slate-50 p-3 text-xs font-semibold text-slate-500">{review.moderation_reason}</p> : null}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void updateProfessionalReviewModeration(review, 'approved')} disabled={saving || review.moderation_status === 'approved'} className="rounded-[16px] bg-emerald-500 py-3 text-xs font-black text-white disabled:opacity-50">Approve</button>
                <button type="button" onClick={() => void updateProfessionalReviewModeration(review, 'flagged')} disabled={saving || review.moderation_status === 'flagged'} className="rounded-[16px] bg-amber-500 py-3 text-xs font-black text-white disabled:opacity-50">Flag</button>
                <button type="button" onClick={() => void updateProfessionalReviewModeration(review, 'rejected')} disabled={saving || review.moderation_status === 'rejected'} className="rounded-[16px] bg-red-500 py-3 text-xs font-black text-white disabled:opacity-50">Reject</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'advertisements') {
      return renderAdsRoute();
    }
    if (subPath === 'legal-policies') {
      return renderLegalRoute();
    }
    if (subPath === 'pricing') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <CreditCard className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Pricing</h2>
            <p className="mt-2 text-sm text-slate-300">Free is the default plan. Paid plans are upgrades, not something basic users must subscribe to.</p>
          </section>
          {['Free', 'Premium', 'Professional'].map((plan) => (
            <article key={plan} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{plan}</p>
              <p className="mt-1 text-sm text-slate-500">{plan === 'Free' ? 'Default access for every member.' : 'Upgrade plan managed through payment verification.'}</p>
            </article>
          ))}
        </div>
      );
    }
    if (subPath && adminGenericRoutes[subPath]) {
      const route = adminGenericRoutes[subPath];
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">{route.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{route.description}</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Shield} title="No Records" text={routeRowsError || 'There are no records for this admin area yet.'} /> : null}
          {routeRows.map((row) => (
            <article key={row.id || JSON.stringify(row)} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{row.title || row.name || row.event_name || row.action || row.word || row.id}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{row.reason || row.status || row.category || row.type || row.key || 'Record loaded'}</p>
              {row.created_at || row.updated_at ? <p className="mt-3 text-xs font-bold text-slate-400">{new Date(row.created_at || row.updated_at).toLocaleString()}</p> : null}
            </article>
          ))}
        </div>
      );
    }
    return renderRouteHub('Admin', 'Every admin section from mobile is routed here for web.', '/app/admin', adminRouteCards, Shield);
  };

  const renderContent = () => {
    if (loading) return <ScreenSkeleton />;
    if (appPath[0] === 'create-post') return renderCreatePost();
    if (appPath[0] === 'create-status') return renderCreateStatus();
    if (appPath[0] === 'create-reel') return renderCreateReel();
    if (appPath[0] === 'post' && appPath[1] === 'create') return renderCreatePost();
    if (appPath[0] === 'status' && appPath[1] === 'create') return renderCreateStatus();
    if (appPath[0] === 'reel' && appPath[1] === 'create') return renderCreateReel();
    if (appPath[0] === 'post') return renderPostDetail();
    if (appPath[0] === 'reel') return renderReelDetail();
    if (appPath[0] === 'status' || appPath[0] === 'status-item') return renderStatusViewer();
    if (appPath[0] === 'profile' && appPath[1]) return renderUserProfileRoute();
    if (appPath[0] === 'certificates' || appPath[0] === 'anniversary') return renderRelationshipMemoryRoute();
    if (appPath[0] === 'relationship') return renderRelationshipRegister();
    if (appPath[0] === 'settings') return renderSettingsRoute();
    if (appPath[0] === 'verification') return renderVerificationRoute();
    if (appPath[0] === 'legal') return renderLegalRoute();
    if (appPath[0] === 'ads') return renderAdsRoute();
    if (appPath[0] === 'bookings') return renderBookingsRoute();
    if (appPath[0] === 'professional' || appPath[0] === 'professionals') return renderProfessionalRoute();
    if (appPath[0] === 'admin') return renderAdminRoute();
    if (appPath[0] === 'dating-likes') return renderDatingLikes();
    if (appPath[0] === 'dating-preferences') return renderDatingFilters();
    if (appPath[0] === 'dating-profile') return renderDatingProfileForm();
    if (activeTab === 'dating' && subPath === 'dashboard') return renderDatingDashboard();
    if (activeTab === 'dating' && subPath === 'likes-received') return renderDatingLikes();
    if (activeTab === 'dating' && subPath === 'matches') return renderDatingMatches();
    if (activeTab === 'dating' && subPath === 'date-requests') return renderDateRequests();
    if (activeTab === 'dating' && subPath === 'premium') return renderDatingPremium();
    if (activeTab === 'dating' && subPath === 'payment-submit') return renderDatingPaymentSubmit();
    if (activeTab === 'dating' && ['create-date-request', 'edit-date-request'].includes(subPath)) return renderDateRequests();
    if (activeTab === 'dating' && subPath === 'user-profile') return renderDatingUserProfile();
    if (activeTab === 'dating' && subPath === 'video-player') return renderDatingVideoPlayer();
    if (activeTab === 'dating' && subPath === 'filters') return renderDatingFilters();
    if (activeTab === 'dating' && subPath === 'profile-preview') return renderDatingProfilePreview();
    if (activeTab === 'dating' && subPath === 'photo-gallery') return renderDatingPhotoGallery();
    if (activeTab === 'dating' && subPath === 'profile-setup') return renderDatingProfileForm();
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
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: string;
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
          type={type}
          className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      )}
    </label>
  );
}

function CommentThread({
  id,
  title,
  comments,
  loading,
  draft,
  onDraftChange,
  onSubmit,
  replyDrafts,
  onReplyDraftChange,
  onReply,
  targetPrefix,
  submittingKey,
}: {
  id?: string;
  title: string;
  comments: SocialComment[];
  loading: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  replyDrafts: Record<string, string>;
  onReplyDraftChange: (key: string, value: string) => void;
  onReply: (commentId: string) => void;
  targetPrefix: string;
  submittingKey: string | null;
}) {
  return (
    <section id={id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{comments.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-[18px] bg-slate-50 p-4 text-sm font-semibold text-slate-500">Loading comments...</div>
        ) : !comments.length ? (
          <div className="rounded-[22px] bg-gradient-to-br from-blue-50 to-pink-50 p-5 text-center ring-1 ring-blue-100">
            <MessageCircle className="mx-auto h-10 w-10 text-blue-500" />
            <p className="mt-3 text-lg font-black text-slate-950">No comments yet</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">Start the conversation with something kind.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replyDrafts={replyDrafts}
              onReplyDraftChange={onReplyDraftChange}
              onReply={onReply}
              targetPrefix={targetPrefix}
              submittingKey={submittingKey}
            />
          ))
        )}
      </div>
      <div className="sticky bottom-[76px] mt-4 rounded-[20px] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Write a comment..."
            rows={1}
            className="min-h-11 flex-1 resize-none rounded-[16px] bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!draft.trim() || submittingKey === targetPrefix}
            className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white disabled:bg-slate-300"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}

function CommentItem({
  comment,
  replyDrafts,
  onReplyDraftChange,
  onReply,
  targetPrefix,
  submittingKey,
}: {
  comment: SocialComment;
  replyDrafts: Record<string, string>;
  onReplyDraftChange: (key: string, value: string) => void;
  onReply: (commentId: string) => void;
  targetPrefix: string;
  submittingKey: string | null;
}) {
  const replyKey = `${targetPrefix}:reply:${comment.id}`;
  const replyDraft = replyDrafts[replyKey] || '';
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Avatar src={comment.userAvatar} name={comment.userName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="rounded-[18px] bg-slate-100 px-4 py-3">
            <p className="font-black text-slate-950">{comment.userName}</p>
            {comment.stickerImageUrl ? <img src={comment.stickerImageUrl} alt="" className="mt-2 h-20 w-20 rounded-xl object-contain" /> : null}
            {comment.content ? <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-700">{comment.content}</p> : null}
          </div>
          <div className="mt-1 flex items-center gap-3 px-2 text-xs font-bold text-slate-400">
            <span>{timeAgo(comment.createdAt)}</span>
            <span>{comment.likes.length} likes</span>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <input
              value={replyDraft}
              onChange={(event) => onReplyDraftChange(replyKey, event.target.value)}
              placeholder="Reply..."
              className="h-10 flex-1 rounded-full bg-slate-50 px-4 text-sm font-semibold outline-none ring-1 ring-slate-200 focus:ring-blue-200"
            />
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              disabled={!replyDraft.trim() || submittingKey === replyKey}
              className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {comment.replies?.length ? (
        <div className="ml-12 space-y-2 border-l border-slate-200 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <Avatar src={reply.userAvatar} name={reply.userName} size="sm" />
              <div className="flex-1 rounded-[16px] bg-slate-50 px-3 py-2">
                <p className="text-sm font-black text-slate-950">{reply.userName}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{reply.content}</p>
              </div>
            </div>
          ))}
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
        <Avatar src={post.users?.profile_picture} name={getUserDisplayName(post.users)} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-slate-950">{getUserDisplayName(post.users)}</p>
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
        <Link href={`/app/post/${post.id}#comments`} className="flex items-center justify-center gap-2 py-3 text-sm font-black text-slate-600">
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
