'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { HTMLAttributes } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Bell,
  Ban,
  Briefcase,
  Calendar,
  Camera,
  Church,
  Coffee,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Film,
  Flag,
  Grid3X3 as Grid,
  Heart,
  Home,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  BookOpen,
  Dumbbell,
  Mountain,
  PawPrint,
  Ruler,
  Smile,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  UploadCloud,
  Sparkles,
  Star,
  SlidersHorizontal,
  Crown,
  Zap,
  RotateCcw,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase-client';
import { getDisplayName as getUserDisplayName } from '@/lib/identity';
import {
  profilePictureStorageKeyToBucketAndPath,
  resolveProfilePictureUrl,
  resolveProfilePictureUrlWithSupabase,
  resolveReelThumbnailUrl,
  resolveReelVideoUrl,
} from '@/lib/profile-media-url';
import { mergeUsersProfileForWebShell, usersRowBootstrapFromAuth } from '@/lib/web-user-profile';
import { countRowsByColumn } from '@/lib/supabase-count';
import { profileBrowseHref, webAppProfileHref } from '@/lib/web-app-profile-href';
import ReportUserModal from '@/components/ReportUserModal';
import { buildPostWebUrl, buildReelWebUrl } from '@/lib/appLinks';
import { getPostVisibilityOrFilter, getReelVisibilityOrFilter } from '@/lib/content-visibility';
import { filterVisibleMessagesForUser } from '@/lib/parity-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DatingDiscoverSwipeDeck, DatingDiscoveryCardFace } from '@/components/DatingDiscoverSwipeDeck';

type TabKey = 'home' | 'feed' | 'reels' | 'dating' | 'search' | 'notifications' | 'messages' | 'profile';

/** Lets Avatar use `storage.getPublicUrl` for path-only `users.profile_picture` values (same as mobile). */
const WebShellSupabaseContext = createContext<SupabaseClient | null>(null);

/** Verbose avatar pipeline logs + Settings/Profile debug panel (set NEXT_PUBLIC_DEBUG_AVATAR=1 on staging/prod builds). */
function isAvatarHardDebugEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_AVATAR === '1')
  );
}

type WebUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
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

function formatDatingProfileValue(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type RouteProfileRelationshipRow = {
  id: string;
  type?: string | null;
  status?: string | null;
  partner_name?: string | null;
  start_date?: string | null;
  verified_date?: string | null;
};

type FeedPost = {
  id: string;
  user_id: string;
  content?: string | null;
  media_urls?: string[] | null;
  media_type?: string | null;
  comment_count?: number | null;
  created_at?: string | null;
  users?: { full_name?: string | null; username?: string | null; profile_picture?: string | null } | null;
  likes?: string[];
};

type Reel = {
  id: string;
  user_id: string;
  caption?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  created_at?: string | null;
  users?: { full_name?: string | null; username?: string | null; profile_picture?: string | null } | null;
  likes?: string[];
};

type SocialComment = {
  id: string;
  targetId: string;
  userId: string;
  userName: string;
  /** For public `/profile/{username}` links when the viewer is not signed in. */
  userUsername?: string | null;
  userAvatar?: string | null;
  content: string;
  stickerImageUrl?: string | null;
  messageType?: 'text' | 'sticker';
  likes: string[];
  createdAt?: string | null;
  parentCommentId?: string | null;
  replies?: SocialComment[];
};

type DatingDiscoveryUser = {
  id?: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  profile_picture?: string | null;
  /** Aggregate trust flag from `users` row (native `profile.user?.verified`). */
  verified?: boolean | null;
  id_verified?: boolean | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
};

type DatingProfile = {
  id: string;
  user_id: string;
  bio?: string | null;
  age?: number | null;
  location_city?: string | null;
  location_country?: string | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
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
  is_active?: boolean | null;
  admin_limited?: boolean | null;
  admin_suspended?: boolean | null;
  /** Discovery gender filter (mutual compatibility with `looking_for`) — parity with `lib/dating-service`. */
  gender?: string | null;
  intention_tag?: string | null;
  /** Set when viewer + profile both have coordinates (parity with mobile `distance_km`). */
  distance_km?: number;
  users?: DatingDiscoveryUser | null;
  dating_photos?: { photo_url: string; is_primary?: boolean | null }[] | null;
  /** Alternate shape from loaders mirroring native `profile.photos`. */
  photos?: { photo_url?: string | null; photoUrl?: string | null; is_primary?: boolean | null }[] | null;
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

/** Haversine distance in km — same formula as `lib/dating-service` discovery filtering. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Same rules as `getDatingDiscovery` in `lib/dating-service.ts` when `lookingFor` is not `everyone`. */
function passesDatingMutualGenderFilter(
  lookingFor: string,
  ownGenderRaw: string | null | undefined,
  profile: { gender?: string | null; looking_for?: string | null }
): boolean {
  const lf = String(lookingFor || 'everyone').toLowerCase();
  if (lf === 'everyone') return true;
  const cg = String(ownGenderRaw || '').trim().toLowerCase();
  const currentGender = cg === 'prefer_not_to_say' ? '' : cg;
  const profileGender = String(profile.gender || '').trim().toLowerCase();
  const profileLookingFor = String(profile.looking_for || 'everyone').toLowerCase();

  // Profiles with no gender on file cannot be checked for "men/women" preference; include them so
  // discovery does not go empty when legacy rows omit `gender` (user can pass).
  if (!profileGender || profileGender === 'prefer_not_to_say') return true;

  if (lf === 'men') {
    if (profileGender !== 'male') return false;
    if (profileLookingFor === 'everyone') return true;
    if (!currentGender) return true;
    if (profileLookingFor === 'men' && (currentGender === 'male' || currentGender === 'non_binary')) return true;
    if (profileLookingFor === 'women' && (currentGender === 'female' || currentGender === 'non_binary')) return true;
    return false;
  }
  if (lf === 'women') {
    if (profileGender !== 'female') return false;
    if (profileLookingFor === 'everyone') return true;
    if (!currentGender) return true;
    if (profileLookingFor === 'women' && (currentGender === 'female' || currentGender === 'non_binary')) return true;
    if (profileLookingFor === 'men' && (currentGender === 'male' || currentGender === 'non_binary')) return true;
    return false;
  }
  return true;
}

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

type VerificationDocument = {
  id: string;
  user_id: string;
  document_type: string;
  document_url?: string | null;
  status?: 'pending' | 'approved' | 'rejected' | string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  submitted_at?: string | null;
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
  relationshipId?: string | null;
  relationshipType?: string | null;
  relationshipStatus?: string | null;
  relationshipPrivacy?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  facePhotoUrl?: string | null;
  similarityScore?: number | null;
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

const USERS_SELECT_WITH_OPTIONAL_COLUMNS =
  'id, full_name, username, email, phone_number, profile_picture, role, verified, email_verified, phone_verified, id_verified, banned_at, banned_by, ban_reason' as const;
const USERS_SELECT_BASE =
  'id, full_name, email, phone_number, profile_picture, role, email_verified, phone_verified, id_verified' as const;
const POST_SELECT_WITH_OPTIONAL_USER_COLUMNS =
  'id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,username,profile_picture)' as const;
const POST_SELECT_BASE =
  'id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,profile_picture)' as const;
const REEL_SELECT_WITH_OPTIONAL_USER_COLUMNS =
  'id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,username,profile_picture)' as const;
const REEL_SELECT_BASE =
  'id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,profile_picture)' as const;

function isMissingColumnError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || message.includes('column') || message.includes('schema cache');
}

/** Admin `users` list: try rich select + order, then fall back so one missing column never yields an empty Manage Users screen. */
async function fetchAdminUsersList(supabase: any, limit: number): Promise<any[]> {
  const attempts: Array<{ select: string; order: 'created_at' | 'id' }> = [
    {
      select:
        'id,full_name,username,email,phone_number,profile_picture,role,verified,email_verified,phone_verified,id_verified,banned_at,banned_by,ban_reason,created_at',
      order: 'created_at',
    },
    {
      select:
        'id,full_name,username,email,phone_number,profile_picture,role,verified,email_verified,phone_verified,id_verified,banned_at,banned_by,ban_reason',
      order: 'id',
    },
    { select: String(USERS_SELECT_WITH_OPTIONAL_COLUMNS).replace(/\s+/g, ' ').trim(), order: 'id' },
    { select: String(USERS_SELECT_BASE).replace(/\s+/g, ' ').trim(), order: 'id' },
  ];
  for (const { select, order } of attempts) {
    const res = await (supabase as any)
      .from('users')
      .select(select)
      .order(order, { ascending: false })
      .limit(limit);
    if (!res.error && Array.isArray(res.data)) return res.data;
    if (process.env.NODE_ENV !== 'production' && res.error) {
      console.warn('[WebAppShell admin users]', res.error.message);
    }
  }
  return [];
}

async function fetchAdminRelationshipsList(supabase: any, limit: number): Promise<any[]> {
  const attempts = [
    'id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level,verified_date,end_date,created_at,updated_at,partner_face_photo,partner_date_of_birth_month,partner_date_of_birth_year,partner_city,users!relationships_user_id_fkey(id,full_name,email,phone_number)',
    'id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level,verified_date,end_date,created_at,users!relationships_user_id_fkey(id,full_name,email,phone_number)',
    'id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level,verified_date,end_date,created_at,users!relationships_user_id_fkey(full_name,email,phone_number)',
  ];
  for (const sel of attempts) {
    const res = await supabase.from('relationships').select(sel).order('created_at', { ascending: false }).limit(limit);
    if (!res.error && Array.isArray(res.data)) return res.data;
    if (process.env.NODE_ENV !== 'production' && res.error) {
      console.warn('[WebAppShell admin relationships]', res.error.message);
    }
  }
  return [];
}

type AdminContentModerationFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'resubmit';

async function fetchAdminPostsModerationList(
  supabase: any,
  limit: number,
  moderationStatus?: AdminContentModerationFilter | null
): Promise<any[]> {
  const attempts = [
    'id,user_id,content,media_urls,media_type,comment_count,moderation_status,moderation_reason,moderated_by,moderated_at,rejection_reason,reviewed_by,reviewed_at,created_at,users!posts_user_id_fkey(full_name,username,profile_picture)',
    'id,user_id,content,media_urls,media_type,moderation_status,rejection_reason,reviewed_by,reviewed_at,created_at,users!posts_user_id_fkey(full_name,username,profile_picture)',
    'id,user_id,content,media_urls,media_type,moderation_status,rejection_reason,created_at,users!posts_user_id_fkey(full_name,username,profile_picture)',
    'id,user_id,content,media_urls,media_type,created_at,users!posts_user_id_fkey(full_name,profile_picture)',
  ];
  for (const sel of attempts) {
    let q = supabase.from('posts').select(sel).order('created_at', { ascending: false }).limit(limit);
    if (moderationStatus && moderationStatus !== 'all') q = q.eq('moderation_status', moderationStatus);
    const res = await q;
    if (!res.error && Array.isArray(res.data)) return res.data;
    if (process.env.NODE_ENV !== 'production' && res.error) {
      console.warn('[WebAppShell admin posts]', res.error.message);
    }
  }
  return [];
}

async function fetchAdminReelsModerationList(
  supabase: any,
  limit: number,
  moderationStatus?: AdminContentModerationFilter | null
): Promise<any[]> {
  const attempts = [
    'id,user_id,caption,video_url,thumbnail_url,moderation_status,moderation_reason,moderated_by,moderated_at,rejection_reason,reviewed_by,reviewed_at,created_at,users!reels_user_id_fkey(full_name,username,profile_picture)',
    'id,user_id,caption,video_url,thumbnail_url,moderation_status,rejection_reason,reviewed_by,reviewed_at,created_at,users!reels_user_id_fkey(full_name,username,profile_picture)',
    'id,user_id,caption,video_url,thumbnail_url,moderation_status,rejection_reason,created_at,users!reels_user_id_fkey(full_name,username,profile_picture)',
    'id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,profile_picture)',
  ];
  for (const sel of attempts) {
    let q = supabase.from('reels').select(sel).order('created_at', { ascending: false }).limit(limit);
    if (moderationStatus && moderationStatus !== 'all') q = q.eq('moderation_status', moderationStatus);
    const res = await q;
    if (!res.error && Array.isArray(res.data)) return res.data;
    if (process.env.NODE_ENV !== 'production' && res.error) {
      console.warn('[WebAppShell admin reels]', res.error.message);
    }
  }
  return [];
}

type AdminFalseReportStatusFilter = 'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed';

async function fetchAdminFalseRelationshipReportsList(
  supabase: any,
  limit: number,
  status?: AdminFalseReportStatusFilter | null
): Promise<any[]> {
  const attempts = [
    'id,relationship_id,reported_by,reason,evidence_urls,status,resolution,resolved_by,resolved_at,created_at,updated_at,relationship:relationships(id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,verified_date,privacy_level,end_date),reporter:users!false_relationship_reports_reported_by_fkey(id,full_name,email,phone_number),resolver:users!false_relationship_reports_resolved_by_fkey(id,full_name)',
    'id,relationship_id,reported_by,reason,evidence_urls,status,resolution,resolved_by,resolved_at,created_at,updated_at,relationship:relationships(id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,verified_date,privacy_level,end_date),reporter:users!false_relationship_reports_reported_by_fkey(id,full_name,email)',
    'id,relationship_id,reported_by,reason,evidence_urls,status,resolution,created_at,relationship:relationships(id,user_id,partner_user_id,partner_name,partner_phone,type,status),reporter:users!false_relationship_reports_reported_by_fkey(full_name,email)',
    'id,relationship_id,reported_by,reason,status,resolution,created_at,relationship:relationships(id,user_id,partner_name,type,status),reporter:users!false_relationship_reports_reported_by_fkey(full_name,email)',
  ];
  for (const sel of attempts) {
    let q = supabase.from('false_relationship_reports').select(sel).order('created_at', { ascending: false }).limit(limit);
    if (status && status !== 'all') q = q.eq('status', status);
    const res = await q;
    if (!res.error && Array.isArray(res.data)) return res.data;
    if (process.env.NODE_ENV !== 'production' && res.error) {
      console.warn('[WebAppShell admin false reports]', res.error.message);
    }
  }
  return [];
}

type AdminPaymentSubmissionType = 'subscriptions' | 'ads' | 'mixed';
type AdminPaymentStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

async function fetchAdminPaymentSubmissionsList(
  supabase: any,
  limit: number,
  opts?: { submissionType?: AdminPaymentSubmissionType; status?: AdminPaymentStatusFilter }
): Promise<any[]> {
  const submissionType = opts?.submissionType ?? 'mixed';
  const status = opts?.status;
  const attempts = [
    'id,user_id,advertisement_id,subscription_plan_id,amount,currency,payment_method_id,payment_proof_url,transaction_reference,payment_date,notes,status,verified_by,verified_at,rejection_reason,created_at,updated_at,user:users!payment_submissions_user_id_fkey(full_name,email,profile_picture)',
    'id,user_id,advertisement_id,subscription_plan_id,amount,currency,payment_proof_url,transaction_reference,status,verified_by,verified_at,rejection_reason,created_at,user:users!payment_submissions_user_id_fkey(full_name,email,profile_picture)',
    'id,user_id,amount,status,created_at,user:users!payment_submissions_user_id_fkey(full_name,email,profile_picture)',
  ];
  for (const sel of attempts) {
    let q = supabase.from('payment_submissions').select(sel).order('created_at', { ascending: false }).limit(limit);
    if (submissionType === 'subscriptions') q = q.is('advertisement_id', null);
    if (submissionType === 'ads') q = q.not('advertisement_id', 'is', null);
    if (status && status !== 'all') q = q.eq('status', status);
    const res = await q;
    if (!res.error && Array.isArray(res.data)) return res.data;
    if (process.env.NODE_ENV !== 'production' && res.error) {
      console.warn('[WebAppShell admin payments]', res.error.message);
    }
  }
  return [];
}

async function fetchUsersRowById(supabase: SupabaseClient, userId: string) {
  const full = await (supabase as any).from('users').select(USERS_SELECT_WITH_OPTIONAL_COLUMNS).eq('id', userId).maybeSingle();
  if (!full.error || !isMissingColumnError(full.error)) return full;
  const base = await (supabase as any).from('users').select(USERS_SELECT_BASE).eq('id', userId).maybeSingle();
  return base.error ? base : { ...base, data: base.data ? { ...base.data, username: null, verified: null } : base.data };
}

async function fetchUsersRowsByIds(supabase: SupabaseClient, userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return { data: [] as any[], error: null };
  const full = await (supabase as any).from('users').select(USERS_SELECT_WITH_OPTIONAL_COLUMNS).in('id', ids);
  if (!full.error || !isMissingColumnError(full.error)) return full;
  const base = await (supabase as any).from('users').select(USERS_SELECT_BASE).in('id', ids);
  return base.error
    ? base
    : {
        ...base,
        data: Array.isArray(base.data)
          ? base.data.map((row: any) => ({ ...row, username: null, verified: null }))
          : base.data,
      };
}

async function fetchUsersRowByIdentifier(supabase: SupabaseClient, identifier: string) {
  const clean = identifier.replace(/^@/, '').trim();
  if (looksLikeUuid(identifier)) return fetchUsersRowById(supabase, identifier);

  const full = await (supabase as any)
    .from('users')
    .select(USERS_SELECT_WITH_OPTIONAL_COLUMNS)
    .eq('username', clean)
    .maybeSingle();
  if (!full.error || !isMissingColumnError(full.error)) return full;

  const base = await (supabase as any).from('users').select(USERS_SELECT_BASE).eq('email', clean).maybeSingle();
  return base.error ? base : { ...base, data: base.data ? { ...base.data, username: null, verified: null } : base.data };
}

function applyPostVisibility(query: any, userId: string) {
  return query.or(getPostVisibilityOrFilter(userId)).order('created_at', { ascending: false });
}

function applyReelVisibility(query: any, userId: string) {
  return query.or(getReelVisibilityOrFilter(userId)).order('created_at', { ascending: false });
}

async function fetchVisiblePosts(supabase: SupabaseClient, userId: string, limit: number) {
  const full = await applyPostVisibility(
    (supabase as any).from('posts').select(POST_SELECT_WITH_OPTIONAL_USER_COLUMNS),
    userId
  ).limit(limit);
  if (!full.error || !isMissingColumnError(full.error)) return full;
  return applyPostVisibility((supabase as any).from('posts').select(POST_SELECT_BASE), userId).limit(limit);
}

async function fetchVisibleReels(supabase: SupabaseClient, userId: string, limit: number) {
  const full = await applyReelVisibility(
    (supabase as any).from('reels').select(REEL_SELECT_WITH_OPTIONAL_USER_COLUMNS),
    userId
  ).limit(limit);
  if (!full.error || !isMissingColumnError(full.error)) return full;
  return applyReelVisibility((supabase as any).from('reels').select(REEL_SELECT_BASE), userId).limit(limit);
}

async function fetchProfilePosts(supabase: SupabaseClient, userId: string, limit: number) {
  const full = await (supabase as any)
    .from('posts')
    .select(POST_SELECT_WITH_OPTIONAL_USER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!full.error || !isMissingColumnError(full.error)) return full;
  return (supabase as any)
    .from('posts')
    .select(POST_SELECT_BASE)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

async function fetchProfileReels(supabase: SupabaseClient, userId: string, limit: number) {
  const full = await (supabase as any)
    .from('reels')
    .select(REEL_SELECT_WITH_OPTIONAL_USER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!full.error || !isMissingColumnError(full.error)) return full;
  return (supabase as any)
    .from('reels')
    .select(REEL_SELECT_BASE)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}

type AdminGenericRouteConfig = {
  title: string;
  table: string;
  select: string;
  order?: string;
  description: string;
  /** Optional PostgREST filter so generic admin lists match mobile (e.g. roles = staff only). */
  restrictWhere?: { column: string; op: 'in'; values: string[] };
};

const adminGenericRoutes: Record<string, AdminGenericRouteConfig> = {
  analytics: { title: 'Analytics', table: 'analytics_events', select: 'id,event_name,user_id,created_at', order: 'created_at', description: 'Recent product and safety analytics events.' },
  'ban-appeals': { title: 'Ban Appeals', table: 'ban_appeals', select: 'id,user_id,restriction_id,appeal_type,restricted_feature,reason,status,admin_response,reviewed_by,reviewed_at,created_at', order: 'created_at', description: 'Member appeal queue.' },
  dating: { title: 'Dating Admin', table: 'dating_profiles', select: 'id,user_id,bio,age,location_city,location_country,is_active,show_me,admin_suspended,admin_suspended_reason,admin_limited,admin_limited_reason,premium_trial_ends_at,created_at,users!dating_profiles_user_id_fkey(full_name,email,profile_picture)', order: 'created_at', description: 'Dating profile overview.' },
  'dating-date-options': { title: 'Date Options', table: 'dating_date_options', select: 'id,option_type,option_value,display_label,display_order,is_active,created_at,updated_at', order: 'display_order', description: 'Date suggestion options.' },
  'dating-interests': { title: 'Dating Interests', table: 'dating_interests', select: 'id,name,icon_emoji,category,display_order,is_active,created_at,updated_at', order: 'display_order', description: 'Interest chips available in dating.' },
  disputes: { title: 'Disputes', table: 'disputes', select: 'id,relationship_id,initiated_by,dispute_type,description,status,resolution,auto_resolve_at,resolved_at,resolved_by,created_at', order: 'created_at', description: 'Open disputes and resolution state.' },
  'escalation-rules': { title: 'Escalation Rules', table: 'escalation_rules', select: 'id,name,description,role_id,trigger_type,timeout_seconds,max_escalation_attempts,escalation_strategy,fallback_rules,require_user_confirmation,is_active,priority,created_at,updated_at', order: 'priority', description: 'Professional escalation automation.' },
  'escalation-rules-fixed': { title: 'Escalation Rules', table: 'escalation_rules', select: 'id,name,description,role_id,trigger_type,timeout_seconds,max_escalation_attempts,escalation_strategy,fallback_rules,require_user_confirmation,is_active,priority,created_at,updated_at', order: 'priority', description: 'Professional escalation automation.' },
  'face-matching': { title: 'Face Matching', table: 'face_matching_providers', select: 'id,name,provider_type,similarity_threshold,max_results,enabled,is_active,created_at,updated_at', order: 'created_at', description: 'Face matching provider configuration.' },
  'id-verifications': { title: 'ID Verifications', table: 'verification_documents', select: 'id,user_id,document_type,document_url,status,submitted_at,user:users!verification_documents_user_id_fkey(full_name,email)', order: 'submitted_at', description: 'Identity documents waiting for admin review.' },
  logs: { title: 'Admin Logs', table: 'activity_logs', select: 'id,user_id,action,resource_type,resource_id,entity_type,entity_id,details,created_at,users!activity_logs_user_id_fkey(full_name,email)', order: 'created_at', description: 'Recent admin and safety activity.' },
  'payment-methods': { title: 'Payment Methods', table: 'payment_methods', select: 'id,name,description,payment_type,account_details,instructions,is_active,display_order,icon_emoji,created_at,updated_at', order: 'display_order', description: 'Manual payment options.' },
  'professional-roles': { title: 'Professional Roles', table: 'professional_roles', select: 'id,name,category,description,requires_credentials,requires_verification,eligible_for_live_chat,approval_required,disclaimer_text,is_active,display_order,created_at,updated_at', order: 'display_order', description: 'Roles professionals can apply for.' },
  'professional-analytics': { title: 'Professional Analytics', table: 'professional_sessions', select: 'id,user_id,professional_id,status,scheduled_date,booking_fee_amount,payment_status,created_at', order: 'created_at', description: 'Professional sessions used for analytics.' },
  reports: { title: 'Reports', table: 'reported_content', select: 'id,reporter_id,reported_user_id,content_type,content_id,reason,description,status,reviewed_by,reviewed_at,action_taken,created_at', order: 'created_at', description: 'User and content reports.' },
  roles: {
    title: 'Roles',
    table: 'users',
    select: 'id,full_name,email,profile_picture,role,created_at',
    order: 'created_at',
    description: 'Moderators, admins, and super admins (same cohort as mobile Roles).',
    restrictWhere: { column: 'role', op: 'in', values: ['moderator', 'admin', 'super_admin'] },
  },
  settings: { title: 'Admin Settings', table: 'app_settings', select: 'id,key,value,updated_at', order: 'updated_at', description: 'Operational settings.' },
  stickers: { title: 'Stickers', table: 'sticker_packs', select: 'id,name,description,icon_url,is_active,is_featured,display_order,created_at,updated_at', order: 'display_order', description: 'Sticker packs and chat assets.' },
  'trigger-words': { title: 'Trigger Words', table: 'trigger_words', select: 'id,word_phrase,severity,category,active,created_by,created_at,updated_at', order: 'word_phrase', description: 'Safety trigger words.' },
  'verification-services': { title: 'Verification Services', table: 'verification_service_configs', select: 'id,service_type,provider,enabled,config,created_at,updated_at', order: 'service_type', description: 'Verification service configuration.' },
  'warning-templates': { title: 'Warning Templates', table: 'warning_templates', select: 'id,severity,title_template,message_template,in_chat_warning_template,description,active,created_at,updated_at', order: 'severity', description: 'Reusable moderation warnings.' },
};

/** Web admin batch: mirror Expo admin list sizes (posts/reels 100; users/relationships unbounded on native — cap for browser). */
const ADMIN_WEB_LIMIT_USERS = 400;
const ADMIN_WEB_LIMIT_RELATIONSHIPS = 400;
const ADMIN_WEB_LIMIT_CONTENT = 100;
const ADMIN_WEB_LIMIT_MISC = 150;
const ADMIN_WEB_GENERIC_TABLE_LIMIT = 250;
const ADMIN_WEB_ADS_LIMIT = 60;

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

/** Same staleness rules as native `getUserStatus` in `AppContext.tsx` (profile presence). */
type ProfilePresenceKind = 'online' | 'away' | 'busy' | 'offline';

function getEffectiveProfilePresence(
  statusType: string | null | undefined,
  lastActiveAt: string | null | undefined,
): ProfilePresenceKind {
  const st = (statusType || 'offline').toLowerCase();
  if (st === 'busy') return 'busy';
  if (st === 'offline') return 'offline';

  const lastMs = lastActiveAt ? new Date(lastActiveAt).getTime() : NaN;
  const diffMins = Number.isFinite(lastMs) ? Math.floor((Date.now() - lastMs) / 60000) : Number.POSITIVE_INFINITY;

  if (st === 'online') {
    if (diffMins > 5) {
      if (diffMins < 15) return 'away';
      return 'offline';
    }
    return 'online';
  }
  if (st === 'away') {
    if (diffMins > 20) return 'offline';
    return 'away';
  }
  return 'offline';
}

const WEB_USER_STATUS_HEARTBEAT_MS = 2 * 60 * 1000;

/** Mirrors native foreground heartbeat / background `away` (see `AppContext` `startStatusTracking`). */
async function upsertWebUserPresence(supabase: any, userId: string, mode: 'active' | 'away'): Promise<void> {
  const now = new Date().toISOString();
  const { data: row, error: fetchErr } = await supabase
    .from('user_status')
    .select('status_type,custom_status_text,status_visibility,last_seen_visibility')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr && fetchErr.code !== 'PGRST116') return;

  const vis = row?.status_visibility || 'everyone';
  const lastVis = row?.last_seen_visibility || 'everyone';
  const custom = row?.custom_status_text ?? null;
  const currentType = String(row?.status_type || '').toLowerCase();

  if (mode === 'away') {
    await supabase
      .from('user_status')
      .upsert(
        {
          user_id: userId,
          status_type: 'away',
          last_active_at: now,
          updated_at: now,
          custom_status_text: custom,
          status_visibility: vis,
          last_seen_visibility: lastVis,
        },
        { onConflict: 'user_id' },
      );
    return;
  }

  if (currentType === 'busy') {
    await supabase
      .from('user_status')
      .upsert(
        {
          user_id: userId,
          status_type: 'busy',
          custom_status_text: custom,
          last_active_at: now,
          updated_at: now,
          status_visibility: vis,
          last_seen_visibility: lastVis,
        },
        { onConflict: 'user_id' },
      );
    return;
  }

  if (!row) {
    await supabase.from('user_status').insert({
      user_id: userId,
      status_type: 'online',
      last_active_at: now,
      updated_at: now,
      status_visibility: 'everyone',
      last_seen_visibility: 'everyone',
    });
    return;
  }

  const payload: Record<string, unknown> = {
    user_id: userId,
    last_active_at: now,
    updated_at: now,
    custom_status_text: custom,
    status_visibility: vis,
    last_seen_visibility: lastVis,
  };
  if (currentType !== 'online') payload.status_type = 'online';
  await supabase.from('user_status').upsert(payload, { onConflict: 'user_id' });
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
    userUsername: (comment.users?.username && String(comment.users.username).trim()) || null,
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

function updateSocialCommentTree(
  comments: SocialComment[],
  commentId: string,
  updater: (comment: SocialComment) => SocialComment
): SocialComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) return updater(comment);
    if (comment.replies?.length) {
      return { ...comment, replies: updateSocialCommentTree(comment.replies, commentId, updater) };
    }
    return comment;
  });
}

function removeSocialCommentFromTree(comments: SocialComment[], commentId: string): SocialComment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: comment.replies?.length ? removeSocialCommentFromTree(comment.replies, commentId) : comment.replies,
    }));
}

function countCommentTree(comments: SocialComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countCommentTree(comment.replies || []), 0);
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

function withClientTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out. Please try again.`)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function debugWebShell(label: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.debug(label, payload);
  }
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
  const shellSupabase = useContext(WebShellSupabaseContext);
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-lg' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => {
    if (!src) return null;
    return shellSupabase ? resolveProfilePictureUrlWithSupabase(shellSupabase, src) : resolveProfilePictureUrl(src);
  }, [src, shellSupabase]);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  useEffect(() => {
    if (!isAvatarHardDebugEnabled() || !src) return;
    console.log('[HARD DEBUG Avatar]', {
      incomingSrc: src,
      resolvedSrc,
      hasShellSupabaseClient: Boolean(shellSupabase),
      staticResolve: resolveProfilePictureUrl(src),
    });
  }, [src, resolvedSrc, shellSupabase]);
  if (resolvedSrc && !failed) {
    return (
      <img
        src={resolvedSrc}
        alt=""
        onError={() => {
          if (isAvatarHardDebugEnabled()) {
            console.warn('[HARD DEBUG Avatar] <img> onError (check Network tab for status):', resolvedSrc);
          }
          setFailed(true);
        }}
        onLoad={() => {
          if (isAvatarHardDebugEnabled()) {
            console.log('[HARD DEBUG Avatar] <img> onLoad OK:', resolvedSrc);
          }
        }}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }
  return (
    <div className={`${sizeClass} grid place-items-center rounded-full bg-gradient-to-br from-pink-500 to-blue-600 font-black text-white`}>
      {initials(name)}
    </div>
  );
}

function ProfileUserLink({
  viewerUserId,
  subjectUserId,
  subjectUsername,
  className,
  children,
}: {
  viewerUserId: string | null | undefined;
  subjectUserId: string | null | undefined;
  /** When the viewer is not signed in, public `/profile/{username}` links are preferred when set. */
  subjectUsername?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const href = profileBrowseHref(viewerUserId, subjectUserId, subjectUsername);
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
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

  /** Joined `users` on own posts/reels can expose name/photo when the direct `users` row merge missed them (RLS/timing). */
  const shellAvatarFromFeed = useMemo(() => {
    const id = user?.id;
    if (!id) return { picture: undefined as string | undefined, fullName: undefined as string | undefined };
    let picture: string | undefined;
    let fullName: string | undefined;
    for (const p of posts) {
      if (p.user_id !== id || !p.users) continue;
      if (!picture && p.users.profile_picture?.trim()) picture = p.users.profile_picture.trim();
      if (!fullName && p.users.full_name?.trim()) fullName = p.users.full_name.trim();
      if (picture && fullName) break;
    }
    if (!picture || !fullName) {
      for (const r of reels) {
        if (r.user_id !== id || !r.users) continue;
        if (!picture && r.users.profile_picture?.trim()) picture = r.users.profile_picture.trim();
        if (!fullName && r.users.full_name?.trim()) fullName = r.users.full_name.trim();
        if (picture && fullName) break;
      }
    }
    return { picture, fullName };
  }, [user?.id, posts, reels]);

  const shellAvatarSrc = useMemo(
    () => (user?.profile_picture && user.profile_picture.trim()) || shellAvatarFromFeed.picture || undefined,
    [user?.profile_picture, shellAvatarFromFeed.picture]
  );

  /** Prefer joined `users.full_name` when shell state wrongly used username as display name (see mergeUsersProfileForWebShell). */
  const shellAvatarNameUser = useMemo(() => {
    if (!user) return null;
    const fn = (user.full_name || '').trim();
    const un = (user.username || '').trim();
    const feedFn = (shellAvatarFromFeed.fullName || '').trim();
    if (feedFn && (!fn || fn === un)) {
      return { ...user, full_name: feedFn };
    }
    return { ...user, full_name: fn || feedFn || user.full_name };
  }, [user, shellAvatarFromFeed.fullName]);

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
  const [routeRelationship, setRouteRelationship] = useState<RelationshipRow | null>(null);
  const [routeCertificate, setRouteCertificate] = useState<any>(null);
  const [routeRelationshipLoading, setRouteRelationshipLoading] = useState(false);
  const [datingProfiles, setDatingProfiles] = useState<DatingProfile[]>([]);
  const [myDatingProfile, setMyDatingProfile] = useState<DatingProfile | null>(null);
  const [routeDatingProfile, setRouteDatingProfile] = useState<any>(null);
  const [routeDatingProfileLoading, setRouteDatingProfileLoading] = useState(false);
  const [routeDatingReaction, setRouteDatingReaction] = useState({ liked: false, superLiked: false, matched: false });
  const [routeDatingBadges, setRouteDatingBadges] = useState<any[]>([]);
  const [routeConversationStarters, setRouteConversationStarters] = useState<string[]>([]);
  const [datingUserProfileMediaTab, setDatingUserProfileMediaTab] = useState<'photos' | 'videos'>('photos');
  const [datingLikes, setDatingLikes] = useState<DatingLike[]>([]);
  const [datingMatches, setDatingMatches] = useState<DatingMatch[]>([]);
  /** Web discover flow: full-screen celebration when a swipe like creates a mutual match (parity with native dating match modal). */
  const [datingDiscoveryMatchModal, setDatingDiscoveryMatchModal] = useState<{
    name: string;
    photoUrl: string | null;
    otherUserId: string;
  } | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, MessageRow[]>>({});
  const [routeConversationLoading, setRouteConversationLoading] = useState(false);
  const [statusFeed, setStatusFeed] = useState<StatusFeedItem[]>([]);
  const [adminRelationships, setAdminRelationships] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<WebUser[]>([]);
  /** Client-side filter on Manage Users (web parity with mobile admin users search). */
  const [adminUsersSearchQuery, setAdminUsersSearchQuery] = useState('');
  const [adminPostsReviewFilter, setAdminPostsReviewFilter] = useState<AdminContentModerationFilter>('pending');
  const [adminReelsReviewFilter, setAdminReelsReviewFilter] = useState<AdminContentModerationFilter>('pending');
  const [adminPostsReviewSearch, setAdminPostsReviewSearch] = useState('');
  const [adminReelsReviewSearch, setAdminReelsReviewSearch] = useState('');
  const [adminPostsReviewLoading, setAdminPostsReviewLoading] = useState(false);
  const [adminReelsReviewLoading, setAdminReelsReviewLoading] = useState(false);
  const [adminRelationshipsSearch, setAdminRelationshipsSearch] = useState('');
  const [adminFalseReportsFilter, setAdminFalseReportsFilter] = useState<AdminFalseReportStatusFilter>('all');
  const [adminFalseReportsSearch, setAdminFalseReportsSearch] = useState('');
  const [adminFalseReportsLoading, setAdminFalseReportsLoading] = useState(false);
  const [adminPaymentVerificationType, setAdminPaymentVerificationType] = useState<AdminPaymentSubmissionType>('subscriptions');
  const [adminPaymentVerificationStatus, setAdminPaymentVerificationStatus] = useState<AdminPaymentStatusFilter>('pending');
  const [adminPaymentVerificationSearch, setAdminPaymentVerificationSearch] = useState('');
  const [adminPaymentQueueLoading, setAdminPaymentQueueLoading] = useState(false);
  const [adminProfessionalReviewsFilter, setAdminProfessionalReviewsFilter] = useState<
    'all' | 'pending' | 'approved' | 'rejected' | 'flagged'
  >('all');
  const [adminProfessionalReviewsSearch, setAdminProfessionalReviewsSearch] = useState('');
  const [adminRolesSearchQuery, setAdminRolesSearchQuery] = useState('');
  const [adminReportsStatusFilter, setAdminReportsStatusFilter] = useState<'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed'>('all');
  const [adminReportsSearch, setAdminReportsSearch] = useState('');
  const [adminBanAppealSearch, setAdminBanAppealSearch] = useState('');
  const [adminDatingProfileSearch, setAdminDatingProfileSearch] = useState('');
  const [adminProfessionalApplicationsSearch, setAdminProfessionalApplicationsSearch] = useState('');
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
  const [professionalSessionRequests, setProfessionalSessionRequests] = useState<any[]>([]);
  const [professionalBookings, setProfessionalBookings] = useState<any[]>([]);
  const [bookingFilter, setBookingFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [adminProfessionalSessions, setAdminProfessionalSessions] = useState<any[]>([]);
  const [adminProfessionalReviews, setAdminProfessionalReviews] = useState<any[]>([]);
  const [adminProfessionalSessionStatusFilter, setAdminProfessionalSessionStatusFilter] = useState('all');
  const [adminProfessionalSessionTypeFilter, setAdminProfessionalSessionTypeFilter] = useState('all');
  const [adminBanAppealFilter, setAdminBanAppealFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'under_review'>('all');
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
  /** Total posts for profile subject (RLS-scoped count), not capped by grid fetch limit. */
  const [routeProfilePostsTotal, setRouteProfilePostsTotal] = useState(0);
  const [routeProfileReels, setRouteProfileReels] = useState<Reel[]>([]);
  const [routeProfileFollowers, setRouteProfileFollowers] = useState(0);
  const [routeProfileFollowingCount, setRouteProfileFollowingCount] = useState(0);
  const [routeProfileIsFollowing, setRouteProfileIsFollowing] = useState(false);
  const [routeProfileIsBlocked, setRouteProfileIsBlocked] = useState(false);
  const [routeProfileFollowBusy, setRouteProfileFollowBusy] = useState(false);
  const [routeProfileTab, setRouteProfileTab] = useState<'posts' | 'reels'>('posts');
  const [reportProfileTarget, setReportProfileTarget] = useState<{ id: string; name: string } | null>(null);
  const [routeProfileRelationship, setRouteProfileRelationship] = useState<RouteProfileRelationshipRow | null>(null);
  const [routeProfileStatusType, setRouteProfileStatusType] = useState<string | null>(null);
  const [routeProfileLastActiveAt, setRouteProfileLastActiveAt] = useState<string | null>(null);
  /** Re-render profile presence dot as `getEffectiveProfilePresence` ages out stale `online` rows without navigation. */
  const [profilePresenceTick, setProfilePresenceTick] = useState(0);
  const webPresenceHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [routeStatusItem, setRouteStatusItem] = useState<StatusFeedItem | null>(null);
  const [routeStatusLoading, setRouteStatusLoading] = useState(false);
  const [routeRows, setRouteRows] = useState<any[]>([]);
  const [routeRowsLoading, setRouteRowsLoading] = useState(false);
  const [routeRowsError, setRouteRowsError] = useState<string | null>(null);
  const [datingInterestForm, setDatingInterestForm] = useState({ name: '', icon: '', category: 'hobbies' });
  const [dateOptionType, setDateOptionType] = useState('dress_code');
  const [dateOptionForm, setDateOptionForm] = useState({ value: '', label: '', order: '0', description: '', icon: '' });
  const [professionalRoleForm, setProfessionalRoleForm] = useState({
    id: '',
    name: '',
    category: '',
    description: '',
    disclaimerText: '',
    displayOrder: '0',
    requiresCredentials: true,
    requiresVerification: true,
    eligibleForLiveChat: true,
    approvalRequired: true,
    isActive: true,
  });
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    id: '',
    name: '',
    description: '',
    paymentType: 'bank_transfer',
    accountDetails: '',
    instructions: '',
    displayOrder: '0',
    iconEmoji: '',
    isActive: true,
  });
  const [triggerWordForm, setTriggerWordForm] = useState({
    id: '',
    wordPhrase: '',
    severity: 'low',
    category: 'general',
    active: true,
  });
  const [warningTemplateForm, setWarningTemplateForm] = useState({
    id: '',
    titleTemplate: '',
    messageTemplate: '',
    inChatWarningTemplate: '',
    description: '',
    active: true,
  });
  const [adminSettingDrafts, setAdminSettingDrafts] = useState<Record<string, string>>({});
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
  const [searchMode, setSearchMode] = useState<'text' | 'face'>('text');
  const [searchPhoto, setSearchPhoto] = useState('');
  const [searchResultFilter, setSearchResultFilter] = useState<'all' | 'verified' | 'pending' | 'single' | 'registered'>('all');
  const [postDraft, setPostDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [statusPrivacyLevel, setStatusPrivacyLevel] = useState<'public' | 'friends' | 'followers' | 'only_me'>('friends');
  const [statusBackgroundColor, setStatusBackgroundColor] = useState('#1A73E8');
  const [reelDraft, setReelDraft] = useState({ caption: '', videoUrl: '', thumbnailUrl: '' });
  const [postImageUrl, setPostImageUrl] = useState('');
  const [reelVideoUrl, setReelVideoUrl] = useState('');
  const [reelThumbnailUploadUrl, setReelThumbnailUploadUrl] = useState('');
  const [datingPhotoUrl, setDatingPhotoUrl] = useState('');
  const [relationshipPhotoUrl, setRelationshipPhotoUrl] = useState('');
  const [statusMediaUrl, setStatusMediaUrl] = useState('');
  const [settingsProfilePictureUrl, setSettingsProfilePictureUrl] = useState('');
  /** Last `users.profile_picture` returned from Supabase (before merge); for hard-debug panel only. */
  const [debugUsersRowProfilePicture, setDebugUsersRowProfilePicture] = useState<string | null>(null);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [adForm, setAdForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    ctaType: 'website',
    ctaUrl: '',
    ctaPhone: '',
    ctaMessage: '',
    ctaMessengerId: '',
    placement: 'feed',
    dailyBudget: '5',
    totalBudget: '20',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    locations: '',
    interests: '',
    gender: 'any',
    ageMin: '18',
    ageMax: '65',
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatMediaUrl, setChatMediaUrl] = useState('');
  const [chatDocumentUrl, setChatDocumentUrl] = useState('');
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    fullName: '',
    username: '',
    phoneNumber: '',
    email: '',
    gender: '',
    dateOfBirth: '',
  });
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    searchVisibility: true,
    allowSearchByPhone: true,
  });
  const [notificationSettings, setNotificationSettings] = useState({
    relationshipUpdates: true,
    cheatingAlerts: true,
    verificationAttempts: true,
    anniversaryReminders: true,
    marketingPromotions: false,
    soundEnabled: true,
  });
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
  const [idVerificationDocument, setIdVerificationDocument] = useState<VerificationDocument | null>(null);
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
    numberOfPeople: '2',
    genderPreference: 'everyone',
    suggestedActivities: '',
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
  const [deletingAccount, setDeletingAccount] = useState(false);

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
    setDebugUsersRowProfilePicture(null);
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
    setRouteRelationship(null);
    setRouteCertificate(null);
    setRouteRelationshipLoading(false);
    setDatingProfiles([]);
    setMyDatingProfile(null);
    setRouteDatingProfile(null);
    setRouteDatingProfileLoading(false);
    setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
    setRouteDatingBadges([]);
    setRouteConversationStarters([]);
    setDatingUserProfileMediaTab('photos');
    setDatingLikes([]);
    setDatingMatches([]);
    setDatingDiscoveryMatchModal(null);
    setNotifications([]);
    setConversations([]);
    setMessagesByConversation({});
    setRouteConversationLoading(false);
    setStatusFeed([]);
    setAdminRelationships([]);
    setAdminUsers([]);
    setAdminUsersSearchQuery('');
    setAdminPostsReviewFilter('pending');
    setAdminReelsReviewFilter('pending');
    setAdminPostsReviewSearch('');
    setAdminReelsReviewSearch('');
    setAdminRelationshipsSearch('');
    setAdminFalseReportsFilter('all');
    setAdminFalseReportsSearch('');
    setAdminPaymentVerificationType('subscriptions');
    setAdminPaymentVerificationStatus('pending');
    setAdminPaymentVerificationSearch('');
    setAdminProfessionalReviewsFilter('all');
    setAdminProfessionalReviewsSearch('');
    setAdminRolesSearchQuery('');
    setAdminReportsStatusFilter('all');
    setAdminReportsSearch('');
    setAdminBanAppealSearch('');
    setAdminDatingProfileSearch('');
    setAdminProfessionalApplicationsSearch('');
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
    setProfessionalSessionRequests([]);
    setProfessionalBookings([]);
    setBookingFilter('upcoming');
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
    setAdminProfessionalSessionStatusFilter('all');
    setAdminProfessionalSessionTypeFilter('all');
    setAdminBanAppealFilter('all');
    setProfessionalDirectory([]);
    setTwoFactorRecord(null);
    setTwoFactorSecret('');
    setTwoFactorBackupCodes([]);
    setTwoFactorCode('');
    setActiveSessions([]);
    setRouteProfileUser(null);
    setRouteProfileLoading(false);
    setRouteProfilePosts([]);
    setRouteProfilePostsTotal(0);
    setRouteProfileReels([]);
    setRouteProfileFollowers(0);
    setRouteProfileFollowingCount(0);
    setRouteProfileIsFollowing(false);
    setRouteProfileIsBlocked(false);
    setRouteProfileFollowBusy(false);
    setRouteProfileTab('posts');
    setReportProfileTarget(null);
    setRouteProfileRelationship(null);
    setRouteProfileStatusType(null);
    setRouteProfileLastActiveAt(null);
    setRouteStatusItem(null);
    setRouteStatusLoading(false);
    setRouteRows([]);
    setIdVerificationDocument(null);
    setDatingInterestForm({ name: '', icon: '', category: 'hobbies' });
    setDateOptionType('dress_code');
    setDateOptionForm({ value: '', label: '', order: '0', description: '', icon: '' });
    setProfessionalRoleForm({
      id: '',
      name: '',
      category: '',
      description: '',
      disclaimerText: '',
      displayOrder: '0',
      requiresCredentials: true,
      requiresVerification: true,
      eligibleForLiveChat: true,
      approvalRequired: true,
      isActive: true,
    });
    setPaymentMethodForm({ id: '', name: '', description: '', paymentType: 'bank_transfer', accountDetails: '', instructions: '', displayOrder: '0', iconEmoji: '', isActive: true });
    setTriggerWordForm({ id: '', wordPhrase: '', severity: 'low', category: 'general', active: true });
    setWarningTemplateForm({ id: '', titleTemplate: '', messageTemplate: '', inChatWarningTemplate: '', description: '', active: true });
    setSearchQuery('');
    setSearchResults([]);
    setSearchMode('text');
    setSearchPhoto('');
    setSearchResultFilter('all');
    setSettingsForm({ fullName: '', username: '', phoneNumber: '', email: '', gender: '', dateOfBirth: '' });
    setPrivacySettings({ profileVisibility: 'public', searchVisibility: true, allowSearchByPhone: true });
    setNotificationSettings({
      relationshipUpdates: true,
      cheatingAlerts: true,
      verificationAttempts: true,
      anniversaryReminders: true,
      marketingPromotions: false,
      soundEnabled: true,
    });
    setSettingsProfilePictureUrl('');
    setChatDraft('');
    setChatMediaUrl('');
    setChatDocumentUrl('');
    setStatusDraft('');
    setStatusPrivacyLevel('friends');
    setStatusBackgroundColor('#1A73E8');
    setStatusMediaUrl('');
  }, []);

  const signOutWebUser = useCallback(async () => {
    const uid = user?.id;
    if (uid && supabase) {
      const now = new Date().toISOString();
      await supabase
        .from('user_status')
        .upsert(
          {
            user_id: uid,
            status_type: 'offline',
            last_active_at: now,
            updated_at: now,
            status_visibility: 'everyone',
            last_seen_visibility: 'everyone',
          },
          { onConflict: 'user_id' },
        )
        .catch(() => {});
    }
    resetUserScopedState();
    try {
      await supabase?.auth.signOut();
    } finally {
      router.replace('/auth');
    }
  }, [user?.id, resetUserScopedState, router, supabase]);

  /** If `user.phone_number` arrives after hydrate (e.g. verification) or was missing from initial form sync, fill empty Settings field. */
  useEffect(() => {
    const fromUser = (user?.phone_number || '').trim();
    if (!fromUser) return;
    setSettingsForm((prev) => {
      if ((prev.phoneNumber || '').trim()) return prev;
      return { ...prev, phoneNumber: fromUser };
    });
  }, [user?.id, user?.phone_number]);

  useEffect(() => {
    if (activeTab !== 'dating' || subPath !== 'edit-date-request') return;
    const requestId = searchParams.get('dateRequestId') || searchParams.get('id') || '';
    const request = dateRequests.find((item) => item.id === requestId);
    if (!request) return;
    const dateTime = request.date_time ? new Date(request.date_time) : null;
    const hasDateTime = !!dateTime && !Number.isNaN(dateTime.getTime());
    setDateForm({
      recipientId: request.to_user_id || '',
      title: request.date_title || '',
      description: request.date_description || '',
      location: request.date_location || request.location_name || '',
      proposedDate: hasDateTime ? dateTime.toISOString().slice(0, 10) : request.proposed_date || '',
      proposedTime: hasDateTime ? dateTime.toTimeString().slice(0, 5) : request.proposed_time || '',
      durationHours: String(request.date_duration_hours || Math.ceil((request.duration_minutes || 120) / 60) || 2),
      dressCode: request.dress_code || '',
      budgetRange: request.budget_range || '',
      expenseHandling: request.expense_handling || 'split',
      numberOfPeople: String(request.number_of_people || 2),
      genderPreference: request.gender_preference || 'everyone',
      suggestedActivities: Array.isArray(request.suggested_activities) ? request.suggested_activities.join(', ') : '',
      specialRequests: request.special_requests || '',
    });
  }, [activeTab, dateRequests, searchParams, subPath]);

  /** Pre-fill recipient when opening create flow with `?matchId=<dating_matches.id>` (parity with Expo matches screen). */
  useEffect(() => {
    if (activeTab !== 'dating' || subPath !== 'create-date-request') return;
    const matchId = searchParams.get('matchId') || '';
    if (!matchId || !datingMatches.length) return;
    const m = datingMatches.find((row) => row.id === matchId);
    if (!m) return;
    const peerId = m.user?.id || (m.user1_id === user?.id ? m.user2_id : m.user1_id) || '';
    if (!peerId) return;
    setDateForm((prev) => (prev.recipientId === peerId ? prev : { ...prev, recipientId: peerId }));
  }, [activeTab, subPath, searchParams, datingMatches, user?.id]);

  useEffect(() => {
    if (activeTab !== 'dating' || subPath !== 'photo-gallery') return;
    const raw = searchParams?.get('initialIndex') || '0';
    const idx = Math.max(0, parseInt(raw, 10) || 0);
    const timer = window.setTimeout(() => {
      document.getElementById(`dating-gallery-photo-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(timer);
  }, [activeTab, subPath, searchParams]);

  useEffect(() => {
    if (activeTab !== 'dating' || subPath !== 'date-requests') return;
    const tab = searchParams.get('tab');
    if (tab === 'sent' || tab === 'received') setDateRequestTab(tab);
  }, [activeTab, subPath, searchParams]);

  useEffect(() => {
    if (activeTab !== 'dating' || subPath !== 'date-requests') return;
    const focus = (searchParams.get('focus') || '').trim();
    if (!focus) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`date-request-card-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab, subPath, searchParams, dateRequestTab, dateRequests]);

  useEffect(() => {
    if (appPath[0] !== 'ads' || subPath !== 'promote') return;
    const adId = searchParams.get('adId') || '';
    if (!adId) return;
    const ad = ads.find((item) => item.id === adId);
    if (!ad) return;
    setAdForm({
      title: ad.title || '',
      description: ad.description || '',
      imageUrl: ad.image_url || ad.link_url || '',
      ctaType: ad.cta_type || 'website',
      ctaUrl: ad.cta_url || '',
      ctaPhone: ad.cta_phone || '',
      ctaMessage: ad.cta_message || '',
      ctaMessengerId: ad.cta_messenger_id || '',
      placement: ad.placement || 'feed',
      dailyBudget: String(ad.daily_budget || '5'),
      totalBudget: String(ad.total_budget || ad.budget || '20'),
      startDate: ad.start_date ? new Date(ad.start_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      endDate: ad.end_date ? new Date(ad.end_date).toISOString().slice(0, 10) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      locations: ad.targeting?.locations || '',
      interests: ad.targeting?.interests || '',
      gender: ad.targeting?.gender || 'any',
      ageMin: String(ad.targeting?.ageMin || 18),
      ageMax: String(ad.targeting?.ageMax || 65),
    });
  }, [ads, appPath, searchParams, subPath]);

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
      const base = auth.user || session?.user || null;
      if (base) {
        const pickPhone = (...candidates: Array<string | null | undefined>) => {
          for (const c of candidates) {
            if (typeof c === 'string' && c.trim()) return c.trim();
          }
          return '';
        };
        const phone = pickPhone(auth.user?.phone, session?.user?.phone, base.phone);
        const authUser = phone ? { ...base, phone } : base;
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

  const enrichAdsWithMetrics = useCallback(async (rows: any[] = []) => {
    if (!supabase || !rows.length) return rows;
    const adIds = rows.map((ad) => ad.id).filter(Boolean);
    if (!adIds.length) return rows;

    const [impressionsResult, clicksResult, engagementsResult] = await Promise.all([
      supabase.from('advertisement_impressions').select('advertisement_id').in('advertisement_id', adIds),
      supabase.from('advertisement_clicks').select('advertisement_id').in('advertisement_id', adIds),
      supabase.from('ad_engagements').select('advertisement_id,engagement_type').in('advertisement_id', adIds),
    ]);

    const impressions = new Map<string, number>();
    const clicks = new Map<string, number>();
    const engagements = new Map<string, { likes: number; comments: number; shares: number }>();

    (impressionsResult.data || []).forEach((item: any) => {
      impressions.set(item.advertisement_id, (impressions.get(item.advertisement_id) || 0) + 1);
    });
    (clicksResult.data || []).forEach((item: any) => {
      clicks.set(item.advertisement_id, (clicks.get(item.advertisement_id) || 0) + 1);
    });
    (engagementsResult.data || []).forEach((item: any) => {
      const current = engagements.get(item.advertisement_id) || { likes: 0, comments: 0, shares: 0 };
      if (item.engagement_type === 'like') current.likes += 1;
      if (item.engagement_type === 'comment') current.comments += 1;
      if (item.engagement_type === 'share') current.shares += 1;
      engagements.set(item.advertisement_id, current);
    });

    return rows.map((ad) => ({
      ...ad,
      impressions: impressions.get(ad.id) || 0,
      clicks: clicks.get(ad.id) || 0,
      engagementSummary: engagements.get(ad.id) || { likes: 0, comments: 0, shares: 0 },
    }));
  }, [supabase]);

  const loadAppData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const authState = await withClientTimeout(resolveAuthUser(), 10000, 'Loading web auth session');
      const authUser = authState?.authUser || null;
      const authError = authState?.authError || null;
      debugWebShell('[WebAppShell] Authenticated user object', {
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
        debugWebShell('[WebAppShell] Auth user changed; clearing previous user-scoped web state', {
          previousUserId: lastAuthUserIdRef.current,
          nextUserId: authUser.id,
        });
        resetUserScopedState();
      }
      lastAuthUserIdRef.current = authUser.id;

      /** Ensures REST calls use the refreshed JWT (avoids first `users` read returning an incomplete row). */
      await supabase.auth.getSession().catch(() => undefined);

      const fetchUsersRow = async () => fetchUsersRowById(supabase, authUser.id);

      let { data: profile, error: profileError } = await fetchUsersRow();

      if (profileError) {
        debugWebShell('[WebAppShell] Profile fetch error', {
          requestedUserId: authUser.id,
          message: profileError.message,
          code: profileError.code,
        });
      }

      if (!profile && !profileError) {
        await supabase.auth.refreshSession().catch(() => undefined);
        const retry = await fetchUsersRow();
        profile = retry.data;
        profileError = retry.error;
        if (profileError) {
          debugWebShell('[WebAppShell] Profile fetch error (after refresh)', {
            requestedUserId: authUser.id,
            message: profileError.message,
            code: profileError.code,
          });
        }
      }

      if (!profile && !profileError) {
        /** `ignoreDuplicates: true` → on conflict do not merge-update; prevents nulling `phone_number` on an existing row. */
        const { error: upsertError } = await supabase
          .from('users')
          .upsert(usersRowBootstrapFromAuth(authUser), { onConflict: 'id', ignoreDuplicates: true });
        if (upsertError) {
          debugWebShell('[WebAppShell] users bootstrap upsert failed', { message: upsertError.message, code: upsertError.code });
        } else {
          const refetch = await fetchUsersRow();
          profile = refetch.data;
          if (refetch.error) {
            debugWebShell('[WebAppShell] Profile refetch after bootstrap error', { message: refetch.error.message });
          }
        }
      }

      debugWebShell('[WebAppShell] Profile fetch response', {
        requestedUserId: authUser.id,
        profileUserId: profile?.id ?? null,
        email: profile?.email ?? null,
        fullName: profile?.full_name ?? null,
        username: profile?.username ?? null,
        phoneFromUsersRow: profile?.phone_number != null ? String(profile.phone_number).slice(0, 6) + '…' : null,
        hasProfilePicture: !!profile?.profile_picture,
        hadProfileError: !!profileError,
      });

      /** Same extra row as mobile `loadSettings` — some DBs add `gender` / `date_of_birth` on `users` after base schema. */
      if (profile?.id) {
        const { data: genderDobRow, error: genderDobError } = await supabase
          .from('users')
          .select('gender, date_of_birth')
          .eq('id', authUser.id)
          .maybeSingle();
        if (!genderDobError && genderDobRow) {
          profile = { ...(profile as Record<string, unknown>), ...genderDobRow } as typeof profile;
        }
      }

      setDebugUsersRowProfilePicture(
        profile != null &&
          profile.profile_picture != null &&
          String(profile.profile_picture).trim() !== ''
          ? String(profile.profile_picture).trim()
          : null
      );

      let resolvedProfile = mergeUsersProfileForWebShell(profile, authUser);
      if (!(resolvedProfile.phone_number || '').trim()) {
        const { data: phoneOnly, error: phoneOnlyError } = await supabase
          .from('users')
          .select('phone_number')
          .eq('id', authUser.id)
          .maybeSingle();
        if (!phoneOnlyError && phoneOnly?.phone_number != null) {
          const p = String(phoneOnly.phone_number).trim();
          if (p) {
            resolvedProfile = { ...resolvedProfile, phone_number: p };
            if (profile?.id) {
              profile = { ...profile, phone_number: p };
            }
          }
        }
      }

      if (isAvatarHardDebugEnabled()) {
        console.log('[HARD DEBUG] AUTH USER:', {
          id: authUser.id,
          email: authUser.email,
          phone: authUser.phone,
          user_metadata: authUser.user_metadata,
        });
        console.log('[HARD DEBUG] PROFILE OBJECT:', profile);
        console.log('[HARD DEBUG] RAW profile_picture (users table column):', profile?.profile_picture ?? null);
        console.log(
          '[HARD DEBUG] RAW profile.avatar_url:',
          profile != null && 'avatar_url' in profile ? (profile as { avatar_url?: unknown }).avatar_url : '(not in select / schema uses profile_picture)'
        );

        const rawTrim = profile?.profile_picture != null ? String(profile.profile_picture).trim() : '';
        if (rawTrim && supabase && !/^https?:\/\//i.test(rawTrim)) {
          const { bucket, objectPath } = profilePictureStorageKeyToBucketAndPath(rawTrim);
          const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
          console.log('[HARD DEBUG] Path→bucket/objectPath:', { bucket, objectPath });
          console.log('[HARD DEBUG] TRANSFORMED URL (getPublicUrl):', data.publicUrl);
        } else if (rawTrim) {
          console.log('[HARD DEBUG] DB value looks like full URL; rewrite pass only:', rawTrim);
        } else {
          console.log('[HARD DEBUG] No profile_picture on users row (null/empty).');
        }
        console.log('[HARD DEBUG] MERGED profile_picture (what shell state uses):', resolvedProfile.profile_picture);
        console.log('[HARD DEBUG] MERGED full_name (must match public.users when row loaded):', resolvedProfile.full_name);
      }

      const currentUser: WebUser = {
        id: authUser.id,
        full_name: resolvedProfile.full_name?.trim() || null,
        email: resolvedProfile.email || authUser.email,
        phone_number: resolvedProfile.phone_number,
        gender: resolvedProfile.gender ?? null,
        date_of_birth: resolvedProfile.date_of_birth ?? null,
        profile_picture: resolvedProfile.profile_picture,
        username: resolvedProfile.username,
        role: resolvedProfile.role || 'user',
        verified: resolvedProfile.verified,
        email_verified: resolvedProfile.email_verified ?? !!authUser.email_confirmed_at,
        phone_verified: resolvedProfile.phone_verified ?? !!authUser.phone_confirmed_at,
        id_verified: resolvedProfile.id_verified,
        banned_at: resolvedProfile.banned_at,
        banned_by: resolvedProfile.banned_by,
        ban_reason: resolvedProfile.ban_reason,
      };
      setUser(currentUser);
      debugWebShell('[WebAppShell] WEB USER (auth)', {
        id: authUser.id,
        email: authUser.email ?? null,
        user_metadata: authUser.user_metadata ?? null,
      });
      debugWebShell('[WebAppShell] PROFILE (merged for UI)', {
        id: currentUser.id,
        full_name: currentUser.full_name,
        username: currentUser.username,
        email: currentUser.email,
        phone_number: currentUser.phone_number,
        hasProfilePicture: !!currentUser.profile_picture,
      });
      setSettingsForm({
        fullName: currentUser.full_name || '',
        username: currentUser.username || '',
        phoneNumber: currentUser.phone_number || '',
        email: (currentUser.email || '').trim(),
        gender: (currentUser.gender || '').trim(),
        dateOfBirth: (currentUser.date_of_birth || '').trim(),
      });
      setSettingsProfilePictureUrl(currentUser.profile_picture || '');
      setVerificationForm((prev) => ({
        ...prev,
        email: resolvedProfile.email || authUser.email || '',
        phone: resolvedProfile.phone_number || authUser.phone || '',
      }));
      debugWebShell('[WebAppShell] User ID used in queries', {
        userId: authUser.id,
        email: authUser.email ?? null,
      });

      const [postsResult, reelsResult, relationshipResult, myDatingResult, datingResult, notificationsResult, conversationsResult, likesResult, matchesResult] = await withClientTimeout(Promise.all([
        fetchVisiblePosts(supabase, authUser.id, 30),
        fetchVisibleReels(supabase, authUser.id, 20),
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
          .select(
            'id,user_id,bio,age,gender,location_city,location_country,location_latitude,location_longitude,relationship_goals,interests,intention_tag,looking_for,age_range_min,age_range_max,max_distance_km'
          )
          .eq('user_id', authUser.id)
          .maybeSingle(),
        supabase
          .from('dating_profiles')
          .select(
            'id,user_id,bio,age,gender,location_city,location_country,location_latitude,location_longitude,relationship_goals,interests,intention_tag,looking_for,is_active,last_active_at,admin_limited,admin_suspended'
          )
          .eq('is_active', true)
          .eq('admin_limited', false)
          .eq('admin_suspended', false)
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
      ]), 20000, 'Loading core web app data');

      const fetchedPosts = ((postsResult.data || []) as FeedPost[]).filter(Boolean);
      const postIds = fetchedPosts.map((post) => post.id);
      const postLikes = postIds.length
        ? await supabase.from('post_likes').select('post_id,user_id').in('post_id', postIds)
        : { data: [] as Array<{ post_id: string; user_id: string }> };
      const likesByPost = new Map<string, string[]>();
      (postLikes.data || []).forEach((like: any) => {
        likesByPost.set(like.post_id, [...(likesByPost.get(like.post_id) || []), like.user_id]);
      });
      const enrichedPosts = fetchedPosts.map((post) => ({ ...post, likes: likesByPost.get(post.id) || [] }));
      setPosts(enrichedPosts);

      const fetchedReels = ((reelsResult.data || []) as Reel[]).filter(Boolean);
      const reelIds = fetchedReels.map((reel) => reel.id);
      const reelLikes = reelIds.length
        ? await supabase.from('reel_likes').select('reel_id,user_id').in('reel_id', reelIds)
        : { data: [] as Array<{ reel_id: string; user_id: string }> };
      const likesByReel = new Map<string, string[]>();
      (reelLikes.data || []).forEach((like: any) => {
        likesByReel.set(like.reel_id, [...(likesByReel.get(like.reel_id) || []), like.user_id]);
      });
      const enrichedReels = fetchedReels.map((reel) => ({ ...reel, likes: likesByReel.get(reel.id) || [] }));
      setReels(enrichedReels);

      const ownPostUsers = enrichedPosts.find((p) => p.user_id === authUser.id)?.users;
      const ownReelUsers = enrichedReels.find((r) => r.user_id === authUser.id)?.users;
      const fromFeedProfilePicture = ownPostUsers?.profile_picture?.trim() || ownReelUsers?.profile_picture?.trim();
      const fromFeedFullName = ownPostUsers?.full_name?.trim() || ownReelUsers?.full_name?.trim();
      if (fromFeedProfilePicture || fromFeedFullName) {
        setUser((prev) => {
          if (!prev || prev.id !== authUser.id) return prev;
          const next = { ...prev };
          if (fromFeedProfilePicture && !(prev.profile_picture || '').trim()) {
            next.profile_picture = resolveProfilePictureUrl(fromFeedProfilePicture) || fromFeedProfilePicture;
          }
          if (
            fromFeedFullName &&
            (!(prev.full_name || '').trim() ||
              (prev.full_name || '').trim() === (prev.username || '').trim())
          ) {
            next.full_name = fromFeedFullName;
          }
          if (next.profile_picture === prev.profile_picture && next.full_name === prev.full_name) return prev;
          return next;
        });
        if (fromFeedProfilePicture) {
          setSettingsProfilePictureUrl((prev) => ((prev || '').trim() ? prev : fromFeedProfilePicture));
        }
        if (fromFeedFullName) {
          setSettingsForm((prev) => {
            const p = (prev.fullName || '').trim();
            const handle = (currentUser.username || '').trim();
            const useFeed = !p || p === handle;
            return { ...prev, fullName: useFeed ? fromFeedFullName : prev.fullName };
          });
        }
      }

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
          if (item.is_active === false) return false;
          if (item.admin_limited || item.admin_suspended) return false;
          if (typeof item.age === 'number') {
            if (item.age < ownMinAge || item.age > ownMaxAge) return false;
          }
          if (ownCity && item.location_city && !item.location_city.toLowerCase().includes(ownCity.toLowerCase())) return false;
          if (ownCountry && item.location_country && !item.location_country.toLowerCase().includes(ownCountry.toLowerCase())) return false;
          if (!passesDatingMutualGenderFilter(ownLookingFor, ownDating?.gender, item)) return false;
          if (intentionTags.length && item.intention_tag && !intentionTags.includes(item.intention_tag)) return false;
          if (religions.length && item.religion && !religions.includes(item.religion)) return false;
          if (educationLevels.length && item.education && !educationLevels.includes(item.education)) return false;
          if (kidsFilter.length && item.kids && !kidsFilter.includes(item.kids)) return false;
          if (smokeFilter.length && item.smoke && !smokeFilter.includes(item.smoke)) return false;
          if (drinkFilter.length && item.drink && !drinkFilter.includes(item.drink)) return false;
          if (exerciseFilter.length && item.exercise && !exerciseFilter.includes(item.exercise)) return false;
          if (petsFilter.length && item.pets && !petsFilter.includes(item.pets)) return false;
          if (interestsFilter.length) {
            const itemInterests = Array.isArray(item.interests) ? item.interests : [];
            if (itemInterests.length && !interestsFilter.some((interest) => itemInterests.includes(interest))) return false;
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
          .select(
            'id,user_id,bio,age,gender,location_city,location_country,location_latitude,location_longitude,relationship_goals,interests,intention_tag,looking_for,is_active,last_active_at,admin_limited,admin_suspended'
          )
          .eq('is_active', true)
          .eq('admin_limited', false)
          .eq('admin_suspended', false)
          .neq('user_id', authUser.id)
          .limit(80);
        if (!strict.error && strict.data) {
          return applyProfileFilters((strict.data as DatingProfile[]).filter(Boolean));
        }
        if (strict.error) discoveryError = strict.error.message || 'Strict discovery query failed';

        const relaxed = await supabase
          .from('dating_profiles')
          .select(
            'id,user_id,bio,age,gender,location_city,location_country,location_latitude,location_longitude,relationship_goals,interests,intention_tag,looking_for,last_active_at,admin_limited,admin_suspended,is_active'
          )
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
      const discoverProfileIds = discoverProfiles.map((item) => item.id).filter(Boolean);
      const enrichedByProfileId = new Map<
        string,
        { users: DatingDiscoveryUser | null; dating_photos: Array<{ photo_url: string; is_primary?: boolean | null }> }
      >();

      if (discoverProfileIds.length) {
        const { data: embeddedRows, error: embedErr } = await supabase
          .from('dating_profiles')
          .select(
            `id,users!dating_profiles_user_id_fkey(id,full_name,username,email,profile_picture,id_verified,email_verified,phone_verified),dating_photos(photo_url,is_primary,display_order)`
          )
          .in('id', discoverProfileIds);
        if (embedErr && !discoveryError) discoveryError = embedErr.message;
        for (const row of (embeddedRows || []) as Array<{
          id: string;
          users?: DatingDiscoveryUser | DatingDiscoveryUser[] | null;
          dating_photos?: Array<{ photo_url: string; is_primary?: boolean | null; display_order?: number | null }> | null;
        }>) {
          if (!row?.id) continue;
          const rawU = row.users;
          const userObj =
            rawU && typeof rawU === 'object' && !Array.isArray(rawU) ? (rawU as DatingDiscoveryUser) : null;
          const photos = Array.isArray(row.dating_photos) ? [...row.dating_photos] : [];
          photos.sort((a, b) => {
            const pa = a?.is_primary ? 1 : 0;
            const pb = b?.is_primary ? 1 : 0;
            return pb - pa;
          });
          enrichedByProfileId.set(row.id, {
            users: userObj,
            dating_photos: photos.map((p) => ({ photo_url: p.photo_url, is_primary: p.is_primary })),
          });
        }
      }

      discoverProfiles = discoverProfiles.map((item) => {
        const slice = item.id ? enrichedByProfileId.get(item.id) : undefined;
        return {
          ...item,
          users: slice?.users ?? null,
          dating_photos: slice?.dating_photos?.length ? slice.dating_photos : [],
        };
      });

      const profilesMissingUsers = discoverProfiles.filter((p) => !p.users && p.user_id);
      if (profilesMissingUsers.length) {
        const missingUserIds = Array.from(new Set(profilesMissingUsers.map((p) => p.user_id).filter(Boolean) as string[]));
        const { data: userRows } = await fetchUsersRowsByIds(supabase, missingUserIds);
        const userMap = new Map<string, DatingDiscoveryUser>(
          ((userRows || []) as DatingDiscoveryUser[]).filter((r) => r.id).map((row) => [row.id as string, row])
        );
        discoverProfiles = discoverProfiles.map((p) =>
          p.users || !p.user_id ? p : { ...p, users: userMap.get(p.user_id) || null }
        );
      }

      const profilesMissingPhotos = discoverProfiles.filter((p) => !(p.dating_photos?.length) && p.id);
      if (profilesMissingPhotos.length) {
        const missingPhotoProfileIds = Array.from(
          new Set(profilesMissingPhotos.map((p) => p.id).filter(Boolean) as string[])
        );
        const { data: photoRows } = await supabase
          .from('dating_photos')
          .select('dating_profile_id,photo_url,is_primary,display_order')
          .in('dating_profile_id', missingPhotoProfileIds)
          .order('is_primary', { ascending: false })
          .order('display_order', { ascending: true });
        const discoverPhotosByProfile = new Map<string, Array<{ photo_url: string; is_primary?: boolean | null }>>();
        ((photoRows || []) as Array<{ dating_profile_id: string; photo_url: string; is_primary?: boolean | null }>).forEach(
          (photo) => {
            const existing = discoverPhotosByProfile.get(photo.dating_profile_id) || [];
            discoverPhotosByProfile.set(photo.dating_profile_id, [
              ...existing,
              { photo_url: photo.photo_url, is_primary: photo.is_primary },
            ]);
          }
        );
        discoverProfiles = discoverProfiles.map((p) =>
          p.dating_photos?.length || !p.id ? p : { ...p, dating_photos: discoverPhotosByProfile.get(p.id) || [] }
        );
      }
      const viewerLat = typeof ownDating?.location_latitude === 'number' ? ownDating.location_latitude : null;
      const viewerLon = typeof ownDating?.location_longitude === 'number' ? ownDating.location_longitude : null;
      if (viewerLat != null && viewerLon != null) {
        discoverProfiles = discoverProfiles.map((item) => {
          const lat = typeof item.location_latitude === 'number' ? item.location_latitude : null;
          const lon = typeof item.location_longitude === 'number' ? item.location_longitude : null;
          if (lat == null || lon == null) return item;
          return { ...item, distance_km: haversineKm(viewerLat, viewerLon, lat, lon) };
        });
      }
      const maxDistanceKm = Number(savedDiscoveryFilters.maxDistance ?? ownDating?.max_distance_km ?? 50);
      if (Number.isFinite(maxDistanceKm) && maxDistanceKm > 0 && viewerLat != null && viewerLon != null) {
        const beforeDistanceFilter = discoverProfiles;
        discoverProfiles = discoverProfiles.filter((item) => {
          const lat = typeof item.location_latitude === 'number' ? item.location_latitude : null;
          const lon = typeof item.location_longitude === 'number' ? item.location_longitude : null;
          if (lat == null || lon == null) return true;
          return haversineKm(viewerLat, viewerLon, lat, lon) <= maxDistanceKm;
        });
        if (!discoverProfiles.length && beforeDistanceFilter.length) {
          discoverProfiles = beforeDistanceFilter;
        }
      }
      if (hasPhotos) {
        discoverProfiles = discoverProfiles.filter((item) => (item.dating_photos || []).length > 0);
      }
      if (verifiedOnly) {
        discoverProfiles = discoverProfiles.filter(
          (item) =>
            !!(item.users?.id_verified || item.users?.email_verified || item.users?.phone_verified)
        );
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
          adsResult,
          professionalApplicationsResult,
          adminProfessionalSessionsResult,
          adminProfessionalReviewsResult,
          adminRelationshipsData,
          adminUsersData,
          falseReportsData,
          paymentSubmissionsData,
        ] = await Promise.all([
          supabase
            .from('advertisements')
            .select('id,user_id,title,description,image_url,link_url,type,placement,active,cta_type,cta_url,cta_phone,cta_message,cta_messenger_id,sponsor_name,sponsor_verified,status,rejection_reason,budget,daily_budget,total_budget,spend,start_date,end_date,billing_status,billing_provider,billing_txn_id,promoted_post_id,promoted_reel_id,targeting,created_at,updated_at')
            .order('created_at', { ascending: false })
            .limit(ADMIN_WEB_ADS_LIMIT),
          supabase
            .from('professional_applications')
            .select('id,user_id,role_id,application_data,status,review_notes,rejection_reason,created_at,user:users!professional_applications_user_id_fkey(full_name,email,profile_picture),role:professional_roles!professional_applications_role_id_fkey(name)')
            .order('created_at', { ascending: false })
            .limit(ADMIN_WEB_LIMIT_MISC),
          supabase
            .from('professional_sessions')
            .select('id,conversation_id,user_id,professional_id,role_id,status,scheduled_date,scheduled_duration_minutes,session_type,location_type,location_address,booking_notes,booking_fee_amount,payment_status,created_at,user:users!professional_sessions_user_id_fkey(full_name,email,profile_picture),professional:professional_profiles!professional_sessions_professional_id_fkey(id,full_name,user_id,pro_user:users!professional_profiles_user_id_fkey(id,full_name,profile_picture))')
            .order('scheduled_date', { ascending: false })
            .limit(ADMIN_WEB_LIMIT_MISC),
          supabase
            .from('professional_reviews')
            .select('id,professional_id,client_id,rating,review_text,is_anonymous,moderation_status,moderation_reason,moderated_by,moderated_at,reported_count,created_at,client:users!professional_reviews_client_id_fkey(full_name,email,profile_picture),professional:professional_profiles!professional_reviews_professional_id_fkey(full_name,user_id,pro_user:users!professional_profiles_user_id_fkey(id,full_name))')
            .order('created_at', { ascending: false })
            .limit(ADMIN_WEB_LIMIT_MISC),
          fetchAdminRelationshipsList(supabase, ADMIN_WEB_LIMIT_RELATIONSHIPS),
          fetchAdminUsersList(supabase, ADMIN_WEB_LIMIT_USERS),
          fetchAdminFalseRelationshipReportsList(supabase, ADMIN_WEB_LIMIT_MISC),
          fetchAdminPaymentSubmissionsList(supabase, ADMIN_WEB_LIMIT_MISC),
        ]);
        setAdminRelationships(adminRelationshipsData);
        setAdminUsers(adminUsersData);
        setAds(await enrichAdsWithMetrics(adsResult.data || []));
        setProfessionalApplications(professionalApplicationsResult.data || []);
        setFalseRelationshipReports(falseReportsData);
        setPaymentSubmissions(paymentSubmissionsData);
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
        userSettingsResult,
        idVerificationResult,
        currentSessionResult,
      ] = await Promise.all([
        supabase
          .from('blocked_users')
          .select('id,blocked_id,created_at,users!blocked_users_blocked_id_fkey(id,full_name,profile_picture,email)')
          .eq('blocker_id', authUser.id)
          .limit(50),
        supabase
          .from('professional_sessions')
          .select(
            'id,conversation_id,user_id,professional_id,role_id,status,scheduled_date,scheduled_duration_minutes,session_type,location_type,location_address,booking_notes,booking_fee_amount,created_at,professional:professional_profiles!professional_sessions_professional_id_fkey(id,full_name,user_id,pro_user:users!professional_profiles_user_id_fkey(id,full_name,profile_picture))'
          )
          .eq('user_id', authUser.id)
          .order('scheduled_date', { ascending: false })
          .limit(30),
        supabase
          .from('advertisements')
          .select('id,user_id,title,description,image_url,link_url,type,placement,active,cta_type,cta_url,cta_phone,cta_message,cta_messenger_id,sponsor_name,sponsor_verified,status,rejection_reason,budget,daily_budget,total_budget,spend,start_date,end_date,billing_status,billing_provider,billing_txn_id,promoted_post_id,promoted_reel_id,targeting,created_at,updated_at')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('dating_date_requests')
          .select('*,from_user:users!dating_date_requests_from_user_id_fkey(id,full_name,profile_picture,id_verified,phone_verified,email_verified),to_user:users!dating_date_requests_to_user_id_fkey(id,full_name,profile_picture,id_verified,phone_verified,email_verified)')
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
          .select('id,receipt_number,amount,currency,advertisement_id,issued_at,created_at,advertisements(title,placement,billing_status,status,total_budget)')
          .eq('user_id', authUser.id)
          .order('issued_at', { ascending: false })
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
          .select('id,name,payment_type,description,instructions,account_details,icon_emoji,display_order,is_active')
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
        supabase
          .from('user_settings')
          .select('id,user_id,notification_settings,privacy_settings,updated_at')
          .eq('user_id', authUser.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('verification_documents')
          .select('id,user_id,document_type,document_url,status,rejection_reason,reviewed_at,submitted_at')
          .eq('user_id', authUser.id)
          .eq('document_type', 'government_id')
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
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
      setIdVerificationDocument((idVerificationResult.data || null) as VerificationDocument | null);
      setVerificationForm((prev) => ({
        ...prev,
        documentUrl: idVerificationResult.data?.status === 'rejected' ? idVerificationResult.data.document_url || '' : '',
      }));
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
      if (userSettingsResult.data?.privacy_settings) {
        setPrivacySettings((prev) => ({ ...prev, ...userSettingsResult.data.privacy_settings }));
      }
      if (userSettingsResult.data?.notification_settings) {
        setNotificationSettings((prev) => ({ ...prev, ...userSettingsResult.data.notification_settings }));
      }
      if (professionalProfileResult.data?.id) {
        const pricingInfo = professionalProfileResult.data.pricing_info && typeof professionalProfileResult.data.pricing_info === 'object'
          ? professionalProfileResult.data.pricing_info
          : null;
        const [reviewRowsResult, statusRowsResult, sessionRequestsResult, professionalBookingsResult] = await Promise.all([
          supabase
            .from('professional_reviews')
            .select('id,rating,review_text,is_anonymous,moderation_status,created_at,client:users!professional_reviews_client_id_fkey(full_name,profile_picture),session:professional_sessions!professional_reviews_session_id_fkey(id,created_at)')
            .eq('professional_id', professionalProfileResult.data.id)
            .eq('moderation_status', 'approved')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('professional_status')
            .select('id,professional_id,status,current_session_count,last_seen_at,status_override,status_override_by,status_override_until,updated_at')
            .eq('professional_id', professionalProfileResult.data.id)
            .maybeSingle(),
          supabase
            .from('professional_sessions')
            .select('id,conversation_id,user_id,professional_id,role_id,status,ai_summary,user_consent_given,escalation_level,created_at,updated_at,user:users!professional_sessions_user_id_fkey(id,full_name,profile_picture),role:professional_roles(id,name,category)')
            .eq('professional_id', professionalProfileResult.data.id)
            .eq('status', 'pending_acceptance')
            .order('created_at', { ascending: false }),
          supabase
            .from('professional_sessions')
            .select('id,conversation_id,user_id,professional_id,role_id,status,scheduled_date,scheduled_duration_minutes,session_type,location_type,location_address,location_notes,booking_notes,booking_fee_amount,booking_fee_currency,payment_status,created_at,updated_at,user:users!professional_sessions_user_id_fkey(id,full_name,profile_picture),role:professional_roles(id,name,category)')
            .eq('professional_id', professionalProfileResult.data.id)
            .in('session_type', ['offline_booking', 'scheduled'])
            .order('scheduled_date', { ascending: true }),
        ]);
        setProfessionalReviews(reviewRowsResult.data || []);
        setProfessionalStatus(statusRowsResult.data || null);
        setProfessionalSessionRequests(sessionRequestsResult.data || []);
        setProfessionalBookings(professionalBookingsResult.data || []);
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
        setProfessionalSessionRequests([]);
        setProfessionalBookings([]);
      }
      if (!isAdminRole(currentUser.role)) {
        setAds(await enrichAdsWithMetrics(ownAdsResult.data || []));
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
    } catch (error: any) {
      console.error('[WebAppShell] loadAppData error', error);
      setReactionNotice(error?.message || 'Could not load app data. Please try again.');
      window.setTimeout(() => setReactionNotice(null), 3200);
    } finally {
      setLoading(false);
    }
  }, [enrichAdsWithMetrics, resetUserScopedState, resolveAuthUser, router, supabase]);

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
        let query = supabase.from(route.table).select(route.select).limit(ADMIN_WEB_GENERIC_TABLE_LIMIT);
        if (route.restrictWhere?.op === 'in') {
          query = query.in(route.restrictWhere.column, route.restrictWhere.values);
        }
        if (route.order) query = query.order(route.order, { ascending: false });
        const { data, error } = await query;
        if (cancelled) return;
        if (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[WebAppShell admin route ${subPath}]`, error.message);
          }
          let minimalQuery = supabase.from(route.table).select('*').limit(ADMIN_WEB_GENERIC_TABLE_LIMIT);
          if (route.restrictWhere?.op === 'in') {
            minimalQuery = minimalQuery.in(route.restrictWhere.column, route.restrictWhere.values);
          }
          const minimal = await minimalQuery;
          if (cancelled) return;
          if (minimal.error) {
            setRouteRows([]);
            setRouteRowsError(error.message || `${route.title} is not available yet.`);
          } else {
            setRouteRows(minimal.data || []);
            setRouteRowsError(null);
          }
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
    if (subPath !== 'users') setAdminUsersSearchQuery('');
    if (subPath !== 'posts-review') {
      setAdminPostsReviewSearch('');
      setAdminPostsReviewFilter('pending');
    }
    if (subPath !== 'reels-review') {
      setAdminReelsReviewSearch('');
      setAdminReelsReviewFilter('pending');
    }
    if (subPath !== 'relationships') setAdminRelationshipsSearch('');
    if (subPath !== 'false-relationship-reports') {
      setAdminFalseReportsSearch('');
      setAdminFalseReportsFilter('all');
    }
    if (subPath !== 'payment-verifications') {
      setAdminPaymentVerificationSearch('');
      setAdminPaymentVerificationType('subscriptions');
      setAdminPaymentVerificationStatus('pending');
    }
    if (subPath !== 'professional-reviews') {
      setAdminProfessionalReviewsSearch('');
      setAdminProfessionalReviewsFilter('all');
    }
    if (subPath !== 'roles') setAdminRolesSearchQuery('');
    if (subPath !== 'reports') {
      setAdminReportsSearch('');
      setAdminReportsStatusFilter('all');
    }
    if (subPath !== 'ban-appeals') setAdminBanAppealSearch('');
    if (subPath !== 'dating') setAdminDatingProfileSearch('');
    if (subPath !== 'professional-profiles') setAdminProfessionalApplicationsSearch('');
  }, [subPath]);

  /** Broad posts/reels samples for admin hub and non-review routes (review screens use filtered loaders below). */
  useEffect(() => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (appPath[0] !== 'admin') return;
    if (subPath === 'posts-review' || subPath === 'reels-review') return;
    let cancelled = false;
    (async () => {
      const [postsData, reelsData] = await Promise.all([
        fetchAdminPostsModerationList(supabase, ADMIN_WEB_LIMIT_CONTENT, null),
        fetchAdminReelsModerationList(supabase, ADMIN_WEB_LIMIT_CONTENT, null),
      ]);
      if (!cancelled) {
        setAdminPosts(postsData);
        setAdminReels(reelsData);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appPath, subPath, supabase, user]);

  useEffect(() => {
    if (!supabase || !user || !isAdminRole(user.role) || appPath[0] !== 'admin' || subPath !== 'posts-review') return;
    let cancelled = false;
    (async () => {
      setAdminPostsReviewLoading(true);
      try {
        const rows = await fetchAdminPostsModerationList(supabase, ADMIN_WEB_LIMIT_CONTENT, adminPostsReviewFilter);
        if (!cancelled) setAdminPosts(rows);
      } finally {
        if (!cancelled) setAdminPostsReviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appPath, subPath, supabase, user, adminPostsReviewFilter]);

  useEffect(() => {
    if (!supabase || !user || !isAdminRole(user.role) || appPath[0] !== 'admin' || subPath !== 'reels-review') return;
    let cancelled = false;
    (async () => {
      setAdminReelsReviewLoading(true);
      try {
        const rows = await fetchAdminReelsModerationList(supabase, ADMIN_WEB_LIMIT_CONTENT, adminReelsReviewFilter);
        if (!cancelled) setAdminReels(rows);
      } finally {
        if (!cancelled) setAdminReelsReviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appPath, subPath, supabase, user, adminReelsReviewFilter]);

  useEffect(() => {
    if (!supabase || !user || !isAdminRole(user.role) || appPath[0] !== 'admin' || subPath !== 'false-relationship-reports') return;
    let cancelled = false;
    (async () => {
      setAdminFalseReportsLoading(true);
      try {
        const rows = await fetchAdminFalseRelationshipReportsList(supabase, ADMIN_WEB_LIMIT_MISC, adminFalseReportsFilter);
        if (!cancelled) setFalseRelationshipReports(rows);
      } finally {
        if (!cancelled) setAdminFalseReportsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appPath, subPath, supabase, user, adminFalseReportsFilter]);

  useEffect(() => {
    if (!supabase || !user || !isAdminRole(user.role) || appPath[0] !== 'admin' || subPath !== 'payment-verifications') return;
    let cancelled = false;
    (async () => {
      setAdminPaymentQueueLoading(true);
      try {
        const rows = await fetchAdminPaymentSubmissionsList(supabase, ADMIN_WEB_LIMIT_MISC, {
          submissionType: adminPaymentVerificationType,
          status: adminPaymentVerificationStatus,
        });
        if (!cancelled) setPaymentSubmissions(rows);
      } finally {
        if (!cancelled) setAdminPaymentQueueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appPath, subPath, supabase, user, adminPaymentVerificationType, adminPaymentVerificationStatus]);

  useEffect(() => {
    if (appPath[0] !== 'bookings' || subPath !== 'reschedule') return;
    const bookingId = searchParams?.get('sessionId') || appPath[2] || '';
    const selectedBooking = bookings.find((item) => item.id === bookingId);
    if (!selectedBooking?.scheduled_date) return;
    const scheduled = new Date(selectedBooking.scheduled_date);
    if (Number.isNaN(scheduled.getTime())) return;
    const date = scheduled.toISOString().slice(0, 10);
    const time = scheduled.toTimeString().slice(0, 5);
    setBookingForm((prev) => {
      if (prev.date === date && prev.time === time && prev.durationMinutes === String(selectedBooking.scheduled_duration_minutes || 60)) return prev;
      return {
        ...prev,
        date,
        time,
        durationMinutes: String(selectedBooking.scheduled_duration_minutes || 60),
        locationType: selectedBooking.location_type || prev.locationType || 'online',
        locationAddress: selectedBooking.location_address || '',
        locationNotes: selectedBooking.location_notes || '',
        bookingNotes: '',
      };
    });
  }, [appPath, subPath, searchParams, bookings]);

  useEffect(() => {
    if (!supabase || appPath[0] !== 'profile' || !appPath[1]) {
      setRouteProfileUser(null);
      setRouteProfilePosts([]);
      setRouteProfilePostsTotal(0);
      setRouteProfileReels([]);
      setRouteProfileFollowers(0);
      setRouteProfileFollowingCount(0);
      setRouteProfileIsFollowing(false);
      setRouteProfileIsBlocked(false);
      setRouteProfileLoading(false);
      setReportProfileTarget(null);
      setRouteProfileRelationship(null);
      setRouteProfileStatusType(null);
      setRouteProfileLastActiveAt(null);
      return;
    }
    let cancelled = false;
    const loadProfileUser = async () => {
      setRouteProfileLoading(true);
      setRouteProfileTab('posts');
      try {
        const identifier = decodeURIComponent(appPath[1]);
        const { data, error: profileUserError } = await fetchUsersRowByIdentifier(supabase, identifier);
        if (profileUserError && process.env.NODE_ENV !== 'production') {
          console.warn('[Web profile] user query', profileUserError.message);
        }
        const profileUser = (data || null) as WebUser | null;
        if (!cancelled) setRouteProfileUser(profileUser);
        if (!profileUser?.id) {
          if (!cancelled) {
            setRouteProfilePosts([]);
            setRouteProfilePostsTotal(0);
            setRouteProfileReels([]);
            setRouteProfileFollowers(0);
            setRouteProfileFollowingCount(0);
            setRouteProfileIsFollowing(false);
            setRouteProfileIsBlocked(false);
            setRouteProfileRelationship(null);
            setRouteProfileStatusType(null);
            setRouteProfileLastActiveAt(null);
          }
          return;
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const viewerId = ((session?.user?.id || user?.id || '') as string).trim();
        const isOther = !!viewerId && viewerId !== profileUser.id;

        /** Scoped to `profileUser.id` — visibility is enforced by RLS (`status` / own rows). Client `.or(moderation_status…)` breaks on schemas that only have `status`. */
        const baseQueries: Promise<any>[] = [
          fetchProfilePosts(supabase, profileUser.id, 60),
          supabase.from('post_likes').select('post_id,user_id').limit(500),
          fetchProfileReels(supabase, profileUser.id, 60),
          supabase.from('user_status').select('status_type,last_active_at').eq('user_id', profileUser.id).maybeSingle(),
          supabase
            .from('relationships')
            .select('id,type,status,partner_name,start_date,verified_date')
            .or(`user_id.eq.${profileUser.id},partner_user_id.eq.${profileUser.id}`)
            .in('status', ['pending', 'verified'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          countRowsByColumn(supabase, 'follows', 'following_id', profileUser.id),
          countRowsByColumn(supabase, 'follows', 'follower_id', profileUser.id),
          countRowsByColumn(supabase, 'posts', 'user_id', profileUser.id),
        ];

        if (isOther) {
          baseQueries.push(
            supabase.from('follows').select('id').eq('follower_id', viewerId).eq('following_id', profileUser.id).maybeSingle()
          );
          baseQueries.push(
            supabase.from('blocked_users').select('id').eq('blocker_id', viewerId).eq('blocked_id', profileUser.id).maybeSingle()
          );
        }

        const results = await Promise.all(baseQueries);
        if (cancelled) return;

        const profilePostsResult = results[0];
        const profilePostLikesResult = results[1];
        const profileReelsResult = results[2];
        const statusRes = results[3];
        const relRes = results[4];
        const followersCount = Number(results[5] || 0);
        const followingCount = Number(results[6] || 0);
        const postsTotalCount = Number(results[7] || 0);
        const followRowRes = isOther ? results[8] : null;
        const blockRowRes = isOther ? results[9] : null;

        if (profilePostsResult.error && process.env.NODE_ENV !== 'production') {
          console.warn('[Web profile] posts query', profilePostsResult.error.message);
        }
        if (profileReelsResult.error && process.env.NODE_ENV !== 'production') {
          console.warn('[Web profile] reels query', profileReelsResult.error.message);
        }

        const likesByPost = new Map<string, string[]>();
        ((profilePostLikesResult.data || []) as any[]).forEach((like) => {
          likesByPost.set(like.post_id, [...(likesByPost.get(like.post_id) || []), like.user_id].filter(Boolean));
        });
        setRouteProfilePosts(((profilePostsResult.data || []) as FeedPost[]).map((post) => ({ ...post, likes: likesByPost.get(post.id) || [] })));
        {
          const loaded = ((profilePostsResult.data || []) as FeedPost[]).length;
          setRouteProfilePostsTotal(postsTotalCount > 0 ? postsTotalCount : loaded);
        }

        const reelRows = (profileReelsResult.data || []) as Reel[];
        setRouteProfileReels(reelRows.map((r) => ({ ...r, likes: r.likes || [] })));

        setRouteProfileFollowers(followersCount);
        setRouteProfileFollowingCount(followingCount);
        const statusRow = statusRes.data as { status_type?: string; last_active_at?: string } | null;
        setRouteProfileStatusType(statusRow?.status_type ?? null);
        setRouteProfileLastActiveAt(statusRow?.last_active_at ?? null);
        setRouteProfileRelationship((relRes.data as RouteProfileRelationshipRow | null) ?? null);
        if (isOther) {
          setRouteProfileIsFollowing(!!followRowRes?.data?.id);
          setRouteProfileIsBlocked(!!blockRowRes?.data?.id);
        } else {
          setRouteProfileIsFollowing(false);
          setRouteProfileIsBlocked(false);
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
    if (appPath[0] !== 'profile' || !appPath[1]) return;
    const id = setInterval(() => setProfilePresenceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [appPath[0], appPath[1]]);

  useEffect(() => {
    if (!supabase || appPath[0] !== 'profile' || !routeProfileUser?.id) return;
    const uid = routeProfileUser.id;
    let cancelled = false;
    const channel = supabase
      .channel(`web_profile_user_status:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_status', filter: `user_id=eq.${uid}` },
        async () => {
          const { data } = await supabase.from('user_status').select('status_type,last_active_at').eq('user_id', uid).maybeSingle();
          if (cancelled || !data) return;
          setRouteProfileStatusType((data as { status_type?: string }).status_type ?? null);
          setRouteProfileLastActiveAt((data as { last_active_at?: string }).last_active_at ?? null);
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, appPath[0], routeProfileUser?.id]);

  const pingWebUserPresenceActive = useCallback(async () => {
    if (!supabase || !user?.id) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    await upsertWebUserPresence(supabase, user.id, 'active');
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!supabase || !user?.id) {
      if (webPresenceHeartbeatRef.current) {
        clearInterval(webPresenceHeartbeatRef.current);
        webPresenceHeartbeatRef.current = null;
      }
      return;
    }
    void pingWebUserPresenceActive();
    webPresenceHeartbeatRef.current = setInterval(() => void pingWebUserPresenceActive(), WEB_USER_STATUS_HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void pingWebUserPresenceActive();
      else void upsertWebUserPresence(supabase, user.id, 'away');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', pingWebUserPresenceActive);
    return () => {
      if (webPresenceHeartbeatRef.current) {
        clearInterval(webPresenceHeartbeatRef.current);
        webPresenceHeartbeatRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', pingWebUserPresenceActive);
    };
  }, [supabase, user?.id, pingWebUserPresenceActive]);

  useEffect(() => {
    const isDatingProfileRoute = appPath[0] === 'dating' && subPath === 'user-profile';
    const explicitUserId = isDatingProfileRoute ? (searchParams?.get('userId') || searchParams?.get('user_id') || '') : '';
    const explicitProfileId = isDatingProfileRoute ? (searchParams?.get('profileId') || searchParams?.get('profile_id') || '') : '';
    const legacyId = isDatingProfileRoute ? (searchParams?.get('id') || appPath[2] || '') : '';
    const hasRouteIdentifier = !!(explicitUserId || explicitProfileId || legacyId);
    if (!supabase || !hasRouteIdentifier) {
      setRouteDatingProfile(null);
      setRouteDatingProfileLoading(false);
      setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
      setRouteDatingBadges([]);
      setRouteConversationStarters([]);
      setDatingUserProfileMediaTab('photos');
      return;
    }
    setDatingUserProfileMediaTab('photos');
    let cancelled = false;
    const loadRouteDatingProfile = async () => {
      setRouteDatingProfileLoading(true);
      try {
        const fetchProfileByUserId = (userId: string) =>
          supabase.from('dating_profiles').select('*').eq('user_id', userId).maybeSingle();
        const fetchProfileByProfileId = (profileId: string) =>
          supabase.from('dating_profiles').select('*').eq('id', profileId).maybeSingle();

        let profileRow: any = null;
        if (explicitUserId) {
          const { data } = await fetchProfileByUserId(explicitUserId);
          profileRow = data || null;
        }
        if (!profileRow?.id && explicitProfileId) {
          const { data } = await fetchProfileByProfileId(explicitProfileId);
          profileRow = data || null;
        }
        if (!profileRow?.id && legacyId) {
          const { data: byUserId } = await fetchProfileByUserId(legacyId);
          profileRow = byUserId || null;
          if (!profileRow?.id) {
            const { data: byProfileId } = await fetchProfileByProfileId(legacyId);
            profileRow = byProfileId || null;
          }
        }
        if (!profileRow?.id) {
          if (!cancelled) {
            setRouteDatingProfile(null);
            setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
            setRouteDatingBadges([]);
            setRouteConversationStarters([]);
          }
          return;
        }
        const targetUserId = String(profileRow.user_id || explicitUserId || '');
        if (!targetUserId) {
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
          fetchUsersRowById(supabase, targetUserId),
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
      } catch (error: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Web dating profile] load failed', error?.message || error);
        }
        if (!cancelled) {
          setRouteDatingProfile(null);
          setRouteDatingReaction({ liked: false, superLiked: false, matched: false });
          setRouteDatingBadges([]);
          setRouteConversationStarters([]);
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
    const relationshipRouteActive = appPath[0] === 'certificates' || appPath[0] === 'anniversary';
    const verificationRelationshipId = appPath[0] === 'verification' && appPath[1] === 'couple-selfie'
      ? searchParams.get('relationshipId')
      : null;
    const targetRelationshipId = relationshipRouteActive ? appPath[1] : verificationRelationshipId;

    if (!supabase || !user || !targetRelationshipId) {
      setRouteRelationship(null);
      setRouteCertificate(null);
      setRouteRelationshipLoading(false);
      return;
    }

    if (relationship?.id === targetRelationshipId) {
      setRouteRelationship(relationship);
      if (!relationshipRouteActive) setRouteCertificate(null);
      setRouteRelationshipLoading(false);
      return;
    }

    let cancelled = false;
    const loadRouteRelationship = async () => {
      setRouteRelationshipLoading(true);
      try {
        const [relationshipResult, certificateResult] = await Promise.all([
          supabase
            .from('relationships')
            .select('id,user_id,partner_user_id,partner_name,partner_phone,type,status,start_date,privacy_level')
            .eq('id', targetRelationshipId)
            .or(`user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
            .maybeSingle(),
          relationshipRouteActive
            ? supabase
                .from('couple_certificates')
                .select('id,relationship_id,certificate_url,verification_selfie_url,issued_at')
                .eq('relationship_id', targetRelationshipId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (relationshipResult.error) throw relationshipResult.error;
        if (certificateResult.error) throw certificateResult.error;
        if (!cancelled) {
          setRouteRelationship((relationshipResult.data || null) as RelationshipRow | null);
          setRouteCertificate(certificateResult.data || null);
        }
      } catch {
        if (!cancelled) {
          setRouteRelationship(null);
          setRouteCertificate(null);
        }
      } finally {
        if (!cancelled) setRouteRelationshipLoading(false);
      }
    };
    void loadRouteRelationship();

    return () => {
      cancelled = true;
    };
  }, [appPath, relationship, searchParams, supabase, user]);

  useEffect(() => {
    if (appPath[0] !== 'messages') return;
    if (appPath[1]) return;
    const cid = (searchParams?.get('conversationId') || '').trim();
    if (!cid) return;
    router.replace(`/app/messages/${encodeURIComponent(cid)}`);
  }, [appPath, router, searchParams]);

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
        .select('id,post_id,user_id,content,message_type,parent_comment_id,created_at,users!comments_user_id_fkey(full_name,username,email,profile_picture),stickers!comments_sticker_id_fkey(image_url,is_animated)')
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
        .select('id,reel_id,user_id,content,message_type,parent_comment_id,created_at,users!reel_comments_user_id_fkey(full_name,username,email,profile_picture),stickers!reel_comments_sticker_id_fkey(image_url,is_animated)')
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
            .select('id,user_id,content,media_urls,media_type,comment_count,created_at,users!posts_user_id_fkey(full_name,username,profile_picture)')
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
            .select('id,user_id,caption,video_url,thumbnail_url,created_at,users!reels_user_id_fkey(full_name,username,profile_picture)')
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
      userUsername: user.username?.trim() || null,
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
      userUsername: user.username?.trim() || null,
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

  const editSocialComment = async (targetType: 'post' | 'reel', targetId: string, comment: SocialComment, content: string) => {
    if (!supabase || !user || !targetId || !comment.id || comment.userId !== user.id) return;
    const nextContent = content.trim();
    if (!nextContent || comment.messageType === 'sticker') return;
    const table = targetType === 'post' ? 'comments' : 'reel_comments';
    const setComments = targetType === 'post' ? setPostCommentsByPost : setReelCommentsByReel;
    setComments((prev) => ({
      ...prev,
      [targetId]: updateSocialCommentTree(prev[targetId] || [], comment.id, (item) => ({ ...item, content: nextContent })),
    }));
    try {
      const { error } = await supabase
        .from(table)
        .update({ content: nextContent, updated_at: new Date().toISOString() })
        .eq('id', comment.id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch {
      setReactionNotice('Could not edit comment');
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      await (targetType === 'post' ? loadPostComments(targetId) : loadReelComments(targetId));
    }
  };

  const deleteSocialComment = async (targetType: 'post' | 'reel', targetId: string, comment: SocialComment) => {
    if (!supabase || !user || !targetId || !comment.id || comment.userId !== user.id) return;
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) return;
    const table = targetType === 'post' ? 'comments' : 'reel_comments';
    const setComments = targetType === 'post' ? setPostCommentsByPost : setReelCommentsByReel;
    const before = targetType === 'post' ? postCommentsByPost[targetId] || [] : reelCommentsByReel[targetId] || [];
    const beforeCount = countCommentTree(before);
    const nextComments = removeSocialCommentFromTree(before, comment.id);
    const removedCount = Math.max(1, beforeCount - countCommentTree(nextComments));
    setComments((prev) => ({ ...prev, [targetId]: nextComments }));
    if (targetType === 'post') {
      setPosts((prev) => prev.map((post) => post.id === targetId ? { ...post, comment_count: Math.max(0, (post.comment_count || 0) - removedCount) } : post));
      setRoutePost((prev) => prev?.id === targetId ? { ...prev, comment_count: Math.max(0, (prev.comment_count || 0) - removedCount) } : prev);
    }
    try {
      const { error } = await supabase.from(table).delete().eq('id', comment.id).eq('user_id', user.id);
      if (error) throw error;
    } catch {
      setReactionNotice('Could not delete comment');
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      await (targetType === 'post' ? loadPostComments(targetId) : loadReelComments(targetId));
    }
  };

  const toggleSocialCommentLike = async (targetType: 'post' | 'reel', targetId: string, comment: SocialComment) => {
    if (!supabase || !user || !targetId || !comment.id) return;
    const table = targetType === 'post' ? 'comment_likes' : 'reel_comment_likes';
    const setComments = targetType === 'post' ? setPostCommentsByPost : setReelCommentsByReel;
    const liked = comment.likes.includes(user.id);
    const nextLikes = liked ? comment.likes.filter((id) => id !== user.id) : [...comment.likes, user.id];
    setComments((prev) => ({
      ...prev,
      [targetId]: updateSocialCommentTree(prev[targetId] || [], comment.id, (item) => ({ ...item, likes: nextLikes })),
    }));
    try {
      if (liked) {
        const { error } = await supabase.from(table).delete().eq('comment_id', comment.id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).upsert({ comment_id: comment.id, user_id: user.id }, { onConflict: 'comment_id,user_id' });
        if (error) throw error;
      }
    } catch {
      setReactionNotice('Could not update comment like');
      window.setTimeout(() => setReactionNotice(null), 2200);
      await (targetType === 'post' ? loadPostComments(targetId) : loadReelComments(targetId));
    }
  };

  const reportSocialComment = async (comment: SocialComment) => {
    if (!supabase || !user || !comment.id || !comment.userId || comment.userId === user.id) return;
    const reason = window.prompt('Why are you reporting this comment?', 'Inappropriate or harmful comment');
    if (!reason?.trim()) return;
    try {
      const { error } = await supabase.from('reported_content').insert({
        reporter_id: user.id,
        reported_user_id: comment.userId,
        content_type: 'comment',
        content_id: comment.id,
        reason: reason.trim(),
        description: comment.content || null,
        status: 'pending',
      });
      if (error) throw error;
      setReactionNotice('Report sent for review');
    } catch {
      setReactionNotice('Could not report comment');
    } finally {
      window.setTimeout(() => setReactionNotice(null), 2200);
    }
  };

  const reactToDatingProfile = async (profile: DatingProfile, action: 'like' | 'pass' | 'super') => {
    if (!supabase || !user) return;
    let hideReactionToast = false;
    try {
      if (action === 'pass') {
        setReactionNotice('Passed for now');
        const { error } = await supabase
          .from('dating_passes')
          .upsert({ passer_id: user.id, passed_id: profile.user_id }, { onConflict: 'passer_id,passed_id' });
        if (error) throw error;
      } else {
        const isSuper = action === 'super';
        const { error } = await supabase.from('dating_likes').upsert(
          { liker_id: user.id, liked_id: profile.user_id, is_super_like: isSuper },
          { onConflict: 'liker_id,liked_id' }
        );
        if (error) throw error;
        await supabase.from('dating_passes').delete().eq('passer_id', user.id).eq('passed_id', profile.user_id);

        const { data: mutualLike } = await supabase
          .from('dating_likes')
          .select('id')
          .eq('liker_id', profile.user_id)
          .eq('liked_id', user.id)
          .maybeSingle();

        const uid = user.id;
        const pid = profile.user_id;
        const user1Id = uid < pid ? uid : pid;
        const user2Id = uid > pid ? uid : pid;

        if (mutualLike?.id) {
          const { data: matchRow, error: matchError } = await supabase
            .from('dating_matches')
            .upsert({ user1_id: user1Id, user2_id: user2Id }, { onConflict: 'user1_id,user2_id' })
            .select('id,matched_at,created_at')
            .single();
          if (!matchError && matchRow?.id) {
            hideReactionToast = true;
            const rawPic = (profile.users?.profile_picture || '').trim();
            const picUrl = rawPic
              ? resolveProfilePictureUrlWithSupabase(supabase, rawPic) || resolveProfilePictureUrl(rawPic) || rawPic
              : null;
            const name =
              getUserDisplayName(
                profile.users
                  ? { full_name: profile.users.full_name, username: profile.users.username ?? null, email: null }
                  : null
              ) ||
              profile.users?.full_name?.trim() ||
              'Match';
            const otherUser: WebUser = {
              id: profile.user_id,
              full_name: profile.users?.full_name ?? null,
              username: profile.users?.username ?? null,
              email: null,
              profile_picture: picUrl || rawPic || null,
            };
            setDatingMatches((prev) => {
              const filtered = prev.filter((m) => m.id !== matchRow.id);
              return [
                {
                  id: matchRow.id,
                  user1_id: user1Id,
                  user2_id: user2Id,
                  matched_at: matchRow.matched_at ?? new Date().toISOString(),
                  created_at: matchRow.created_at ?? new Date().toISOString(),
                  user: otherUser,
                },
                ...filtered,
              ];
            });
            setReactionNotice(null);
            setDatingDiscoveryMatchModal({ name, photoUrl: picUrl, otherUserId: profile.user_id });
          } else {
            setReactionNotice(isSuper ? 'Super like sent' : 'Liked');
          }
        } else {
          setReactionNotice(isSuper ? 'Super like sent' : 'Liked');
        }
      }
      setDatingIndex((prev) => Math.min(prev + 1, datingProfiles.length));
    } catch {
      setReactionNotice('Could not save swipe');
      hideReactionToast = false;
    }
    if (!hideReactionToast) {
      window.setTimeout(() => setReactionNotice(null), 1800);
    }
  };

  useEffect(() => {
    if (!datingDiscoveryMatchModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDatingDiscoveryMatchModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [datingDiscoveryMatchModal]);

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

  const shareRouteDatingProfile = useCallback(() => {
    const uid = searchParams?.get('userId') || searchParams?.get('id') || '';
    if (!uid || typeof window === 'undefined') return;
    const url = `${window.location.origin}/app/dating/user-profile?userId=${encodeURIComponent(uid)}`;
    const payload = { title: 'Committed Dating', text: 'Check out this profile on Committed Dating.', url };
    if (typeof navigator !== 'undefined' && navigator.share) {
      void navigator.share(payload).catch(() => {
        void navigator.clipboard.writeText(url).then(() => {
          setReactionNotice('Profile link copied');
          window.setTimeout(() => setReactionNotice(null), 2000);
        });
      });
    } else {
      void navigator.clipboard.writeText(url).then(() => {
        setReactionNotice('Profile link copied');
        window.setTimeout(() => setReactionNotice(null), 2000);
      });
    }
  }, [searchParams]);

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

  const toggleProfileRouteFollow = async (subjectUserId: string) => {
    if (!supabase || !user || !subjectUserId || subjectUserId === user.id || routeProfileFollowBusy) return;
    setRouteProfileFollowBusy(true);
    try {
      if (routeProfileIsFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', subjectUserId);
        if (error) throw error;
        setRouteProfileIsFollowing(false);
        setRouteProfileFollowers((n) => Math.max(0, n - 1));
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: subjectUserId });
        if (error && (error as { code?: string }).code !== '23505') throw error;
        setRouteProfileIsFollowing(true);
        setRouteProfileFollowers((n) => n + 1);
        const display = user.full_name || user.email || 'Someone';
        await supabase.from('notifications').insert({
          user_id: subjectUserId,
          title: 'New Follower',
          message: `${display} started following you`,
          type: 'follow',
          data: { followerId: user.id, follower_id: user.id },
          read: false,
        });
      }
    } catch {
      setReactionNotice('Could not update follow');
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      setRouteProfileFollowBusy(false);
    }
  };

  const toggleProfileRouteBlock = async (subjectUserId: string) => {
    if (!supabase || !user || !subjectUserId || subjectUserId === user.id) return;
    const name = getUserDisplayName(routeProfileUser) || 'this member';
    if (routeProfileIsBlocked) {
      if (!window.confirm(`Unblock ${name}? They can interact with you again.`)) return;
      try {
        const { error: unblockErr } = await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', subjectUserId);
        if (unblockErr) throw unblockErr;
        setBlockedUsers((prev) => prev.filter((item) => item.blocked_id !== subjectUserId));
        setRouteProfileIsBlocked(false);
        setReactionNotice('User unblocked');
        window.setTimeout(() => setReactionNotice(null), 1800);
      } catch {
        setReactionNotice('Could not unblock user');
        window.setTimeout(() => setReactionNotice(null), 2200);
      }
      return;
    }
    if (!window.confirm(`Block ${name}? They cannot message you or see certain activity.`)) return;
    try {
      const { error } = await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: subjectUserId });
      if (error) throw error;
      if (routeProfileIsFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', subjectUserId);
        setRouteProfileIsFollowing(false);
        setRouteProfileFollowers((n) => Math.max(0, n - 1));
      }
      setBlockedUsers((prev) => [...prev, { blocked_id: subjectUserId, users: routeProfileUser }]);
      setRouteProfileIsBlocked(true);
      setReactionNotice('User blocked');
      window.setTimeout(() => setReactionNotice(null), 2200);
    } catch {
      setReactionNotice('Could not block user');
      window.setTimeout(() => setReactionNotice(null), 2200);
    }
  };

  const submitReportProfile = async (reason: string, description: string) => {
    if (!supabase || !user || !reportProfileTarget) throw new Error('Not signed in.');
    const { error } = await supabase.from('reported_content').insert({
      reporter_id: user.id,
      reported_user_id: reportProfileTarget.id,
      content_type: 'profile',
      content_id: null,
      reason,
      description: description || null,
      status: 'pending',
    });
    if (error) throw new Error(error.message || 'Report failed');
    setReactionNotice('Report submitted for review');
    window.setTimeout(() => setReactionNotice(null), 2200);
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
    const safeQuery = query.replace(/[(),]/g, ' ');
    setSearchQuery(value);
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearchMode('text');
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
          .or(`full_name.ilike.%${safeQuery}%,phone_number.ilike.%${safeQuery}%`)
          .limit(20);
        usersData = fallback.data || [];
      }

      const registeredUsers = await Promise.all(usersData.map(async (item: any) => {
        const { data: rel } = await supabase
          .from('relationships')
          .select('id,type,status,privacy_level,partner_name,user_id,partner_user_id')
          .or(`user_id.eq.${item.id},partner_user_id.eq.${item.id}`)
          .in('status', ['pending', 'verified', 'confirmed'])
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

      const relationshipMatches = await supabase
        .from('relationships')
        .select('id,user_id,partner_user_id,partner_name,partner_phone,partner_face_photo,type,status,privacy_level,users!relationships_user_id_fkey(full_name,phone_number,profile_picture)')
        .or(`partner_name.ilike.%${safeQuery}%,partner_phone.ilike.%${safeQuery}%`)
        .in('status', ['pending', 'verified', 'confirmed'])
        .limit(20);

      const partnerResults: SearchResult[] = (relationshipMatches.data || []).map((rel: any) => {
        const owner = Array.isArray(rel.users) ? rel.users[0] : rel.users;
        return ({
          id: rel.partner_user_id || undefined,
          fullName: rel.partner_name || 'Unknown partner',
          phoneNumber: rel.partner_phone || undefined,
          profilePicture: null,
          relationshipId: rel.id,
          relationshipType: rel.type,
          relationshipStatus: rel.status,
          relationshipPrivacy: rel.privacy_level,
          partnerName: owner?.full_name || 'Committed member',
          partnerPhone: owner?.phone_number,
          facePhotoUrl: rel.partner_face_photo,
          isRegisteredUser: Boolean(rel.partner_user_id),
        });
      });

      const byKey = new Map<string, SearchResult>();
      [...registeredUsers, ...partnerResults].forEach((item) => {
        const key = item.id || item.phoneNumber || `${item.fullName}-${item.relationshipId}`;
        if (!key) return;
        const existing = byKey.get(key);
        if (!existing || (item.relationshipStatus === 'verified' && existing.relationshipStatus !== 'verified')) {
          byKey.set(key, item);
        }
      });
      setSearchResults(Array.from(byKey.values()));
    } finally {
      setIsSearching(false);
    }
  };

  const runFaceSearch = async (photoUrl = searchPhoto) => {
    if (!supabase || !photoUrl.trim()) return;
    setSearchMode('face');
    setIsSearching(true);
    try {
      const rpc = await supabase.rpc('get_relationships_for_face_search');
      const relationshipRows = !rpc.error && Array.isArray(rpc.data) && rpc.data.length
        ? rpc.data
        : (await supabase
            .from('relationships')
            .select('id,user_id,partner_user_id,partner_name,partner_phone,partner_face_photo,type,status,privacy_level,users!relationships_user_id_fkey(full_name,phone_number,profile_picture)')
            .not('partner_face_photo', 'is', null)
            .neq('partner_face_photo', '')
            .in('status', ['pending', 'verified', 'confirmed'])
            .limit(30)).data || [];

      const mapped = relationshipRows.map((rel: any) => ({
        constOwner: Array.isArray(rel.users) ? rel.users[0] : rel.users,
        ...rel,
      })).map((rel: any) => ({
        id: rel.partner_user_id || undefined,
        fullName: rel.partner_name || 'Unknown partner',
        phoneNumber: rel.partner_phone || undefined,
        profilePicture: rel.profile_picture || null,
        relationshipId: rel.relationship_id || rel.id,
        relationshipType: rel.relationship_type || rel.type,
        relationshipStatus: rel.relationship_status || rel.status,
        relationshipPrivacy: rel.relationship_privacy || rel.privacy_level,
        partnerName: rel.user_name || rel.constOwner?.full_name || 'Committed member',
        partnerPhone: rel.user_phone || rel.constOwner?.phone_number,
        facePhotoUrl: rel.face_photo_url || rel.partner_face_photo,
        similarityScore: rel.similarity_score || null,
        isRegisteredUser: Boolean(rel.partner_user_id),
      } as SearchResult));

      setSearchResults(mapped);
      if (!mapped.length) {
        setReactionNotice('No face records matched yet');
        window.setTimeout(() => setReactionNotice(null), 1800);
      }
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
        privacy_level: statusPrivacyLevel,
        background_color: statusBackgroundColor,
        expires_at: expiresAt,
        archived: false,
      });
      if (error) throw error;
      setStatusDraft('');
      setStatusMediaUrl('');
      setStatusPrivacyLevel('friends');
      setStatusBackgroundColor('#1A73E8');
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
      const adId = searchParams.get('adId') || '';
      const payload = {
        user_id: user.id,
        title: adForm.title.trim(),
        description: adForm.description.trim() || null,
        image_url: adForm.imageUrl.trim() || null,
        cta_type: adForm.ctaType,
        cta_url: adForm.ctaUrl.trim() || null,
        cta_phone: adForm.ctaPhone.trim() || null,
        cta_message: adForm.ctaMessage.trim() || null,
        cta_messenger_id: adForm.ctaMessengerId.trim() || null,
        placement: adForm.placement,
        daily_budget: Number(adForm.dailyBudget || 0),
        total_budget: Number(adForm.totalBudget || 0),
        start_date: adForm.startDate ? new Date(adForm.startDate).toISOString() : new Date().toISOString(),
        end_date: adForm.endDate ? new Date(adForm.endDate).toISOString() : null,
        targeting: {
          locations: adForm.locations,
          interests: adForm.interests,
          gender: adForm.gender,
          ageMin: Number(adForm.ageMin || 18),
          ageMax: Number(adForm.ageMax || 65),
        },
        billing_provider: 'manual',
        billing_status: 'pending',
        status: 'pending',
        updated_at: new Date().toISOString(),
      };
      const query = adId
        ? supabase.from('advertisements').update(payload).eq('id', adId).eq('user_id', user.id)
        : supabase.from('advertisements').insert(payload);
      const { data, error } = await query
        .select('id,user_id,title,description,image_url,link_url,type,placement,active,cta_type,cta_url,cta_phone,cta_message,cta_messenger_id,sponsor_name,sponsor_verified,status,rejection_reason,budget,daily_budget,total_budget,spend,start_date,end_date,billing_status,billing_provider,billing_txn_id,promoted_post_id,promoted_reel_id,targeting,created_at,updated_at')
        .single();
      if (error) throw error;
      if (adId) {
        setAds((prev) => prev.map((item) => item.id === adId ? { ...item, ...data } : item));
      } else {
        setAds((prev) => [{ ...data, impressions: 0, clicks: 0, engagementSummary: { likes: 0, comments: 0, shares: 0 } }, ...prev]);
      }
      setAdForm({
        title: '',
        description: '',
        imageUrl: '',
        ctaType: 'website',
        ctaUrl: '',
        ctaPhone: '',
        ctaMessage: '',
        ctaMessengerId: '',
        placement: 'feed',
        dailyBudget: '5',
        totalBudget: '20',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        locations: '',
        interests: '',
        gender: 'any',
        ageMin: '18',
        ageMax: '65',
      });
      setReactionNotice(adId ? 'Advertisement updated' : 'Advertisement submitted for review');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push('/app/ads');
    } finally {
      setSaving(false);
    }
  };

  const getAdSuggestion = (ad: any) => {
    const impressions = Number(ad.impressions || 0);
    const clicks = Number(ad.clicks || 0);
    if (impressions > 0 && clicks / impressions < 0.01) return 'Try a stronger creative or call to action.';
    if (impressions < 20) return 'Increase budget or broaden targeting to get more reach.';
    return 'Looking good. Keep watching clicks and engagement.';
  };

  const updateAdvertisementStatus = async (ad: any, status: string) => {
    if (!supabase || !user || !ad?.id) return;
    if (ad.user_id !== user.id && !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('advertisements')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ad.id);
      if (error) throw error;
      setAds((prev) => prev.map((item) => item.id === ad.id ? { ...item, status } : item));
      setReactionNotice(status === 'paused' ? 'Ad paused' : 'Ad resumed');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update ad');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const ensureAdPaymentReceipt = async (ad: any) => {
    if (!supabase || !ad?.id || !ad?.user_id) return;
    const { data: existing } = await supabase
      .from('ad_payment_receipts')
      .select('id')
      .eq('advertisement_id', ad.id)
      .eq('user_id', ad.user_id)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return;
    const receiptNumber = `AD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const { data, error } = await supabase
      .from('ad_payment_receipts')
      .insert({
        advertisement_id: ad.id,
        user_id: ad.user_id,
        amount: Number(ad.total_budget || ad.daily_budget || ad.budget || 0),
        currency: 'USD',
        receipt_number: receiptNumber,
        issued_at: new Date().toISOString(),
      })
      .select('id,receipt_number,amount,currency,advertisement_id,issued_at,created_at,advertisements(title,placement,billing_status,status,total_budget)')
      .single();
    if (error) throw error;
    setAdReceipts((prev) => [data, ...prev.filter((item) => item.id !== data.id)]);
  };

  const updateAdminAdvertisement = async (ad: any, action: 'approve' | 'reject' | 'mark_paid' | 'mark_unpaid') => {
    if (!supabase || !user || !isAdminRole(user.role) || !ad?.id) return;
    const rejectionReason = action === 'reject' ? window.prompt('Why is this ad rejected?', ad.rejection_reason || 'Rejected by admin') : null;
    if (action === 'reject' && rejectionReason === null) return;
    setSaving(true);
    try {
      const patch: Record<string, any> = { updated_at: new Date().toISOString() };
      if (action === 'approve') {
        patch.status = 'approved';
        patch.rejection_reason = null;
        patch.active = ad.billing_status === 'paid';
      }
      if (action === 'reject') {
        patch.status = 'rejected';
        patch.rejection_reason = rejectionReason || 'Rejected by admin';
        patch.active = false;
      }
      if (action === 'mark_paid') {
        patch.billing_status = 'paid';
        patch.billing_provider = ad.billing_provider || 'manual';
        patch.active = ad.status === 'approved';
      }
      if (action === 'mark_unpaid') {
        patch.billing_status = 'unpaid';
        patch.active = false;
      }
      const { error } = await supabase.from('advertisements').update(patch).eq('id', ad.id);
      if (error) throw error;
      if (action === 'mark_paid') await ensureAdPaymentReceipt({ ...ad, ...patch });
      setAds((prev) => prev.map((item) => item.id === ad.id ? { ...item, ...patch } : item));
      setReactionNotice(action === 'approve' ? 'Creative approved' : action === 'reject' ? 'Ad rejected' : action === 'mark_paid' ? 'Payment marked paid' : 'Payment marked unpaid');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update advertisement');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const deleteAdvertisement = async (ad: any) => {
    if (!supabase || !user || !ad?.id) return;
    if (ad.user_id !== user.id && !isAdminRole(user.role)) return;
    if (!window.confirm('Delete this ad? This cannot be undone.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('advertisements').delete().eq('id', ad.id);
      if (error) throw error;
      setAds((prev) => prev.filter((item) => item.id !== ad.id));
      setReactionNotice('Advertisement deleted');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not delete ad');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const openAdvertisementCta = async (ad: any) => {
    if (!supabase || !ad?.id) return;
    const rawUrl =
      ad.cta_type === 'whatsapp' && ad.cta_phone
        ? `https://wa.me/${ad.cta_phone}${ad.cta_message ? `?text=${encodeURIComponent(ad.cta_message)}` : ''}`
        : ad.cta_type === 'messenger' && ad.cta_messenger_id
          ? `https://m.me/${ad.cta_messenger_id}`
          : ad.cta_url || ad.link_url;
    if (!rawUrl) {
      setReactionNotice('No destination has been set for this ad');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    try {
      await supabase.from('advertisement_clicks').insert({
        advertisement_id: ad.id,
        user_id: user?.id || null,
        clicked_at: new Date().toISOString(),
      });
      setAds((prev) => prev.map((item) => item.id === ad.id ? { ...item, clicks: Number(item.clicks || 0) + 1 } : item));
    } catch {
      // The CTA should still open even if analytics cannot be recorded.
    }
    window.open(rawUrl, '_blank', 'noopener,noreferrer');
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
    const request = dateRequests.find((item) => item.id === requestId);
    if (!request) return;
    if (response === 'cancelled' && request.from_user_id !== user.id) {
      setReactionNotice('Only the sender can cancel this date request');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    if (response !== 'cancelled' && request.to_user_id !== user.id) {
      setReactionNotice('Only the recipient can respond to this date request');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    if (request.status !== 'pending') {
      setReactionNotice('This date request is no longer pending');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    const patch = response === 'cancelled'
      ? { status: 'cancelled' }
      : { status: response, responded_at: new Date().toISOString() };
    const { error } = await supabase.from('dating_date_requests').update(patch).eq('id', requestId);
    if (!error) {
      setDateRequests((prev) => prev.map((item) => (item.id === requestId ? { ...item, ...patch } : item)));
      if (response !== 'cancelled') {
        await supabase.from('notifications').insert({
          user_id: request.from_user_id,
          type: response === 'accepted' ? 'dating_date_accepted' : 'dating_date_declined',
          title: response === 'accepted' ? 'Date Request Accepted!' : 'Date Request Declined',
          message: `${getUserDisplayName(user)} ${response === 'accepted' ? 'accepted' : 'declined'} your date request.`,
          data: { date_request_id: requestId },
        });
      }
      setReactionNotice(response === 'accepted' ? 'Date accepted' : response === 'declined' ? 'Date declined' : 'Date cancelled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } else {
      setReactionNotice(error.message || 'Could not update date request');
      window.setTimeout(() => setReactionNotice(null), 2200);
    }
  };

  const createDateRequest = async () => {
    if (!supabase || !user || !dateForm.recipientId || !dateForm.title.trim() || !dateForm.location.trim()) return;
    setSaving(true);
    try {
      if (!dateForm.proposedDate || !dateForm.proposedTime) throw new Error('Please choose a date and time');
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
          date_location: dateForm.location.trim(),
          date_time: new Date(`${dateForm.proposedDate}T${dateForm.proposedTime}`).toISOString(),
          date_duration_hours: Math.max(1, Math.ceil(Number(dateForm.durationHours || 2))),
          dress_code: dateForm.dressCode || null,
          budget_range: dateForm.budgetRange || null,
          expense_handling: ['split', 'initiator_pays', 'acceptor_pays'].includes(dateForm.expenseHandling) ? dateForm.expenseHandling : 'split',
          number_of_people: Math.max(2, Number(dateForm.numberOfPeople || 2)),
          gender_preference: ['men', 'women', 'everyone'].includes(dateForm.genderPreference) ? dateForm.genderPreference : 'everyone',
          suggested_activities: dateForm.suggestedActivities.split(',').map((activity) => activity.trim()).filter(Boolean).slice(0, 5),
          special_requests: dateForm.specialRequests.trim() || null,
          status: 'pending',
        })
        .select('*,from_user:users!dating_date_requests_from_user_id_fkey(id,full_name,profile_picture),to_user:users!dating_date_requests_to_user_id_fkey(id,full_name,profile_picture)')
        .single();
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: dateForm.recipientId,
        type: 'dating_date_request',
        title: 'New Date Request',
        message: `${getUserDisplayName(user)} sent you a date request!`,
        data: { date_request_id: data.id, from_user_id: user.id },
      });
      setDateRequests((prev) => [data, ...prev]);
      setDateForm({ recipientId: '', title: '', description: '', location: '', proposedDate: '', proposedTime: '', durationHours: '2', dressCode: '', budgetRange: '', expenseHandling: 'split', numberOfPeople: '2', genderPreference: 'everyone', suggestedActivities: '', specialRequests: '' });
      setReactionNotice('Date request sent');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/dating/date-requests');
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not send date request');
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  const updateDateRequest = async (requestId: string) => {
    if (!supabase || !user || !requestId || !dateForm.title.trim() || !dateForm.location.trim()) return;
    if (!dateForm.proposedDate || !dateForm.proposedTime) {
      setReactionNotice('Please choose a date and time');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    const existing = dateRequests.find((item) => item.id === requestId);
    if (!existing || existing.from_user_id !== user.id || existing.status !== 'pending') {
      setReactionNotice('Only pending date requests you sent can be edited');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    setSaving(true);
    try {
      const patch = {
        date_title: dateForm.title.trim(),
        date_description: dateForm.description.trim() || null,
        date_location: dateForm.location.trim(),
        date_time: new Date(`${dateForm.proposedDate}T${dateForm.proposedTime}`).toISOString(),
        date_duration_hours: Math.max(1, Math.ceil(Number(dateForm.durationHours || 2))),
        dress_code: dateForm.dressCode || null,
        budget_range: dateForm.budgetRange || null,
        expense_handling: ['split', 'initiator_pays', 'acceptor_pays'].includes(dateForm.expenseHandling) ? dateForm.expenseHandling : 'split',
        number_of_people: Math.max(2, Number(dateForm.numberOfPeople || 2)),
        gender_preference: ['men', 'women', 'everyone'].includes(dateForm.genderPreference) ? dateForm.genderPreference : 'everyone',
        suggested_activities: dateForm.suggestedActivities.split(',').map((activity) => activity.trim()).filter(Boolean).slice(0, 5),
        special_requests: dateForm.specialRequests.trim() || null,
      };
      const { data, error } = await supabase
        .from('dating_date_requests')
        .update(patch)
        .eq('id', requestId)
        .eq('from_user_id', user.id)
        .eq('status', 'pending')
        .select('*,from_user:users!dating_date_requests_from_user_id_fkey(id,full_name,profile_picture),to_user:users!dating_date_requests_to_user_id_fkey(id,full_name,profile_picture)')
        .single();
      if (error) throw error;
      setDateRequests((prev) => prev.map((item) => item.id === requestId ? data : item));
      setReactionNotice('Date request updated');
      window.setTimeout(() => setReactionNotice(null), 1800);
      router.push('/app/dating/date-requests');
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update date request');
      window.setTimeout(() => setReactionNotice(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  const submitBooking = async () => {
    if (!supabase || !user || !bookingForm.professionalId || !bookingForm.roleId || !bookingForm.date || !bookingForm.time) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${bookingForm.date}T${bookingForm.time}`);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        setReactionNotice('Please choose a future date and time');
        window.setTimeout(() => setReactionNotice(null), 2400);
        return;
      }
      const scheduledDate = scheduledAt.toISOString();
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

  const deleteNotificationRow = async (notificationId: string) => {
    if (!supabase || !user) return;
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId).eq('user_id', user.id);
    if (error) {
      await loadAppData();
      setReactionNotice('Could not delete notification');
      window.setTimeout(() => setReactionNotice(null), 2200);
    }
  };

  const clearAllNotificationRows = async () => {
    if (!supabase || !user || !notifications.length) return;
    const previous = notifications;
    setNotifications([]);
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
    if (error) {
      setNotifications(previous);
      setReactionNotice('Could not clear notifications');
      window.setTimeout(() => setReactionNotice(null), 2200);
    }
  };

  const notificationHref = (notification: NotificationRow) => {
    const shellProfile = (subjectId: string | null | undefined) => {
      const sid = String(subjectId ?? '').trim();
      if (!sid) return '/app/notifications';
      return webAppProfileHref(user?.id, sid) ?? `/app/profile/${encodeURIComponent(sid)}`;
    };
    const data = notification.data || {};
    const postId = data.postId || data.post_id || data.postID;
    const reelId = data.reelId || data.reel_id || data.reelID;
    const conversationId = data.conversationId || data.conversation_id;
    const statusOwnerId = data.statusOwnerId || data.status_owner_id || data.ownerId || data.owner_id;
    const statusId = data.statusId || data.status_id;
    const relationshipId = data.relationshipId || data.relationship_id;
    const disputeId = data.disputeId || data.dispute_id;
    const likerId = data.likerId || data.liker_id || data.likedByUserId || data.liked_by_user_id;
    const matchedUserId = data.matched_user_id || data.matchedUserId || data.userId || data.user_id;
    const followerId = data.followerId || data.follower_id;
    if (data.conversationId || data.conversation_id) return `/app/messages/${data.conversationId || data.conversation_id}`;
    if (postId) return `/app/post/${postId}`;
    if (reelId) return `/app/reel/${reelId}`;
    if (statusOwnerId) return `/app/status/${statusOwnerId}`;
    if (statusId) return `/app/status-item/${statusId}`;
    const dateReqIdRaw = data.dateRequestId || data.date_request_id;
    const dateReqFocus =
      dateReqIdRaw != null && String(dateReqIdRaw).trim() !== ''
        ? `&focus=${encodeURIComponent(String(dateReqIdRaw).trim())}`
        : '';
    if (notification.type === 'dating_date_request') {
      return `/app/dating/date-requests?tab=received${dateReqFocus}`;
    }
    if (notification.type === 'dating_date_accepted' || notification.type === 'dating_date_declined') {
      return `/app/dating/date-requests?tab=sent${dateReqFocus}`;
    }
    if (dateReqIdRaw != null && String(dateReqIdRaw).trim() !== '') {
      return `/app/dating/date-requests?tab=received&focus=${encodeURIComponent(String(dateReqIdRaw).trim())}`;
    }
    if (data.matchId || data.match_id) return '/app/dating/matches';
    if (
      likerId &&
      (notification.type === 'dating_like' || notification.type === 'dating_super_like')
    ) {
      return `/app/dating/user-profile?userId=${encodeURIComponent(String(likerId))}`;
    }
    if (likerId) return shellProfile(likerId);
    if (data.bookingId || data.booking_id || data.sessionId || data.session_id || data.professionalSessionId || data.professional_session_id) return '/app/bookings';
    if (data.paymentSubmissionId || data.payment_submission_id || data.paymentId || data.payment_id) {
      const targetType = data.advertisementId || data.advertisement_id ? 'ads' : 'subscriptions';
      return isAdminRole(user?.role) ? `/app/admin/payment-verifications?type=${targetType}` : '/app/dating/premium';
    }
    if (relationshipId) {
      if (notification.type === 'relationship_request' || notification.type === 'relationship_end_request' || disputeId) return '/app/notifications?tab=requests';
      return `/app/certificates/${relationshipId}`;
    }
    if (data.datingUserId || data.dating_user_id) {
      const du = String(data.datingUserId || data.dating_user_id || '').trim();
      return du ? `/app/dating/user-profile?userId=${encodeURIComponent(du)}` : '/app/dating';
    }
    if (followerId) return shellProfile(followerId);
    if (matchedUserId && notification.type === 'dating_match') {
      return `/app/dating/user-profile?userId=${encodeURIComponent(String(matchedUserId))}`;
    }
    if (data.userId || data.user_id) return shellProfile(data.userId || data.user_id);
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
    if (!supabase || !user || !bookingId || !bookingForm.date || !bookingForm.time) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${bookingForm.date}T${bookingForm.time}`);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        setReactionNotice('Please choose a future date and time');
        window.setTimeout(() => setReactionNotice(null), 2400);
        return;
      }
      const scheduledDate = scheduledAt.toISOString();
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

  const updateBookingStatus = async (
    booking: any,
    action: 'confirm' | 'complete' | 'cancel',
    actor: 'user' | 'professional' = 'user'
  ) => {
    if (!supabase || !user || !booking?.id) return;
    if (actor === 'professional' && booking.professional_id !== professionalProfile?.id) {
      setReactionNotice('This booking is not assigned to your professional profile');
      window.setTimeout(() => setReactionNotice(null), 2400);
      return;
    }
    const confirmed = action === 'cancel'
      ? window.confirm('Cancel this booking?')
      : action === 'complete'
        ? window.confirm('Mark this booking as completed?')
        : true;
    if (!confirmed) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const patch = action === 'confirm'
        ? { status: 'confirmed', updated_at: now }
        : action === 'complete'
          ? { status: 'completed', professional_ended_at: now, updated_at: now }
          : {
              status: 'cancelled',
              cancellation_reason: `Cancelled by ${actor}`,
              cancellation_requested_by: actor,
              cancellation_requested_at: now,
              updated_at: now,
            };
      const { error } = await supabase.from('professional_sessions').update(patch).eq('id', booking.id);
      if (error) throw error;
      setBookings((prev) => prev.map((item) => item.id === booking.id ? { ...item, ...patch } : item));
      setProfessionalBookings((prev) => prev.map((item) => item.id === booking.id ? { ...item, ...patch } : item));
      setReactionNotice(action === 'confirm' ? 'Booking confirmed' : action === 'complete' ? 'Booking completed' : 'Booking cancelled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update booking');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateProfessionalSessionRequest = async (session: any, action: 'accept' | 'decline') => {
    if (!supabase || !professionalProfile?.id || !session?.id) return;
    setSaving(true);
    try {
      if (session.professional_id !== professionalProfile.id) throw new Error('This session is not assigned to your professional profile.');
      if (session.status !== 'pending_acceptance') throw new Error('Session already processed.');
      const patch = action === 'accept'
        ? {
            status: 'active',
            professional_joined_at: new Date().toISOString(),
            ai_observer_mode: true,
            updated_at: new Date().toISOString(),
          }
        : {
            status: 'declined',
            updated_at: new Date().toISOString(),
          };
      const { data, error } = await supabase
        .from('professional_sessions')
        .update(patch)
        .eq('id', session.id)
        .eq('professional_id', professionalProfile.id)
        .eq('status', 'pending_acceptance')
        .select('id,status,conversation_id,user_id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Session request was not updated. It may already be processed.');
      if (action === 'accept') {
        await supabase.rpc('increment_professional_session_count', { prof_id: professionalProfile.id });
        if (session.conversation_id && session.user_id) {
          await supabase.rpc('send_ai_message', {
            p_conversation_id: session.conversation_id,
            p_receiver_id: session.user_id,
            p_content: `${professionalProfile.full_name || 'Your professional'} accepted the session request and joined the conversation.`,
            p_message_type: 'text',
            p_media_url: null,
            p_document_url: null,
            p_document_name: null,
            p_sticker_id: null,
            p_status_id: null,
            p_status_preview_url: null,
          });
        }
      }
      setProfessionalSessionRequests((prev) => prev.filter((item) => item.id !== session.id));
      setReactionNotice(action === 'accept' ? 'Session accepted' : 'Session declined');
      window.setTimeout(() => setReactionNotice(null), 1800);
      if (action === 'accept' && session.conversation_id) router.push(`/app/messages/${session.conversation_id}`);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update session request');
      window.setTimeout(() => setReactionNotice(null), 2600);
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
    if (type === 'phone') {
      setSettingsForm((prev) => ({ ...prev, phoneNumber: target }));
    }
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
    if (idVerificationDocument?.status && idVerificationDocument.status !== 'rejected') {
      setReactionNotice(idVerificationDocument.status === 'approved' ? 'Your ID is already verified' : 'Your ID is already under review');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('verification_documents')
        .select('id,status')
        .eq('user_id', user.id)
        .eq('document_type', 'government_id')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let savedDocument: VerificationDocument | null = null;
      if (existing?.id && existing.status === 'rejected') {
        const { data, error } = await supabase.from('verification_documents').update({
          document_url: verificationForm.documentUrl.trim(),
          status: 'pending',
          rejection_reason: null,
          reviewed_at: null,
          submitted_at: new Date().toISOString(),
        })
          .eq('id', existing.id)
          .select('id,user_id,document_type,document_url,status,rejection_reason,reviewed_at,submitted_at')
          .maybeSingle();
        if (error) throw error;
        savedDocument = data as VerificationDocument | null;
      } else if (!existing?.id) {
        const { data, error } = await supabase.from('verification_documents').insert({
          user_id: user.id,
          document_url: verificationForm.documentUrl.trim(),
          document_type: 'government_id',
          status: 'pending',
          submitted_at: new Date().toISOString(),
        })
          .select('id,user_id,document_type,document_url,status,rejection_reason,reviewed_at,submitted_at')
          .maybeSingle();
        if (error) throw error;
        savedDocument = data as VerificationDocument | null;
      } else {
        setReactionNotice(existing.status === 'approved' ? 'Your ID is already verified' : 'Your ID is already under review');
        window.setTimeout(() => setReactionNotice(null), 2200);
        return;
      }
      if (savedDocument) setIdVerificationDocument(savedDocument);
      setVerificationForm((prev) => ({ ...prev, documentUrl: '' }));
      setReactionNotice('ID submitted for review');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not submit ID for review');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const submitCoupleSelfieVerification = async () => {
    const selectedRelationship = routeRelationship || relationship;
    if (!supabase || !user || !selectedRelationship?.id || !verificationForm.documentUrl.trim()) return;
    setSaving(true);
    try {
      if (selectedRelationship.status !== 'verified') {
        throw new Error('Your relationship must be verified before you can create a couple certificate.');
      }
      if (selectedRelationship.user_id !== user.id && selectedRelationship.partner_user_id !== user.id) {
        throw new Error('You can only submit a selfie for your own relationship.');
      }
      const certificateUrl = `https://committed.dreambig.org.za/certificates/${selectedRelationship.id}`;
      const { error } = await supabase
        .from('couple_certificates')
        .insert({
          relationship_id: selectedRelationship.id,
          certificate_url: certificateUrl,
          verification_selfie_url: verificationForm.documentUrl.trim(),
          issued_at: new Date().toISOString(),
        });
      if (error) throw error;
      setReactionNotice('Couple selfie submitted');
      window.setTimeout(() => setReactionNotice(null), 2200);
      router.push(`/app/certificates/${selectedRelationship.id}`);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not submit couple selfie');
      window.setTimeout(() => setReactionNotice(null), 2600);
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
    const now = new Date().toISOString();
    /** Match Expo `posts-review` / `reels-review` (`moderated_*`, `moderation_reason`). */
    const patch = {
      moderation_status: status,
      moderated_by: user.id,
      moderated_at: now,
      moderation_reason: status === 'rejected' ? 'Rejected by admin' : null,
      reviewed_by: user.id,
      reviewed_at: now,
      rejection_reason: status === 'rejected' ? 'Rejected by admin' : null,
    };
    try {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`${table === 'posts' ? 'Post' : 'Reel'} was not updated. Admin moderation permission may be missing.`);
      if (table === 'posts') setAdminPosts((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
      if (table === 'reels') setAdminReels((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
      if (appPath[0] === 'admin' && subPath === 'posts-review' && table === 'posts') {
        const rows = await fetchAdminPostsModerationList(supabase, ADMIN_WEB_LIMIT_CONTENT, adminPostsReviewFilter);
        setAdminPosts(rows);
      }
      if (appPath[0] === 'admin' && subPath === 'reels-review' && table === 'reels') {
        const rows = await fetchAdminReelsModerationList(supabase, ADMIN_WEB_LIMIT_CONTENT, adminReelsReviewFilter);
        setAdminReels(rows);
      }
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
      if (appPath[0] === 'admin' && subPath === 'payment-verifications') {
        const rows = await fetchAdminPaymentSubmissionsList(supabase, ADMIN_WEB_LIMIT_MISC, {
          submissionType: adminPaymentVerificationType,
          status: adminPaymentVerificationStatus,
        });
        setPaymentSubmissions(rows);
      }
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
      setRouteRows((prev) => prev.map((member) => member.id === memberId ? { ...member, role } : member));
      setReactionNotice('Role updated');
      window.setTimeout(() => setReactionNotice(null), 1800);
    }
  };

  const updateReportedContentStatus = async (report: any, status: 'resolved' | 'dismissed', actionTaken: string) => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const patch = {
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        action_taken: actionTaken,
      };
      const { data, error } = await supabase
        .from('reported_content')
        .update(patch)
        .eq('id', report.id)
        .select('id,status,reviewed_by,reviewed_at,action_taken')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Report was not updated. Admin report permission may be missing.');
      setRouteRows((prev) => prev.map((item) => item.id === report.id ? { ...item, ...patch } : item));
      setReactionNotice(status === 'resolved' ? 'Report resolved' : 'Report dismissed');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update report');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const deleteReportedContent = async (report: any) => {
    if (!supabase || !user || !isAdminRole(user.role) || !report.content_id) return;
    const tableName = report.content_type === 'post'
      ? 'posts'
      : report.content_type === 'reel'
        ? 'reels'
        : report.content_type === 'comment'
          ? 'comments'
          : report.content_type === 'message'
            ? 'messages'
            : null;
    if (!tableName) {
      setReactionNotice('This content type cannot be deleted from web admin yet');
      window.setTimeout(() => setReactionNotice(null), 2200);
      return;
    }
    if (!window.confirm(`Delete this ${report.content_type}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from(tableName).delete().eq('id', report.content_id);
      if (deleteError) throw deleteError;
      await updateReportedContentStatus(report, 'resolved', 'Content deleted');
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not delete content');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const toggleVerificationService = async (row: any) => {
    if (!supabase || !user || normalizeRole(user.role) !== 'super_admin') return;
    const enabled = !row.enabled;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('verification_service_configs')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .select('id,enabled,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Verification service was not updated.');
      setRouteRows((prev) => prev.map((item) => item.id === row.id ? { ...item, ...data } : item));
      setReactionNotice(enabled ? 'Service enabled' : 'Service disabled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update service');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const toggleStickerPack = async (pack: any, field: 'is_active' | 'is_featured') => {
    if (!supabase || !user || !['admin', 'super_admin'].includes(normalizeRole(user.role))) return;
    const patch = { [field]: !pack[field], updated_at: new Date().toISOString() };
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('sticker_packs')
        .update(patch)
        .eq('id', pack.id)
        .select('id,is_active,is_featured,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Sticker pack was not updated.');
      setRouteRows((prev) => prev.map((item) => item.id === pack.id ? { ...item, ...data } : item));
      setReactionNotice(field === 'is_active' ? 'Sticker pack status updated' : 'Featured sticker updated');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update sticker pack');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const saveAdminSetting = async (row: any) => {
    if (!supabase || !user || normalizeRole(user.role) !== 'super_admin') return;
    const key = String(row.key || '');
    const value = adminSettingDrafts[row.id || key] ?? String(row.value ?? '');
    if (!key) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .select('id,key,value,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Setting was not saved.');
      setRouteRows((prev) => prev.map((item) => (item.id === row.id || item.key === key) ? { ...item, ...data } : item));
      setReactionNotice('Setting saved');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not save setting');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const resolveAdminDispute = async (dispute: any, resolution: 'confirmed_by_admin' | 'rejected_by_admin') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      if (dispute.dispute_type === 'end_relationship' && resolution === 'confirmed_by_admin') {
        const { data: relationship, error: relationshipError } = await supabase
          .from('relationships')
          .select('id,user_id,partner_user_id')
          .eq('id', dispute.relationship_id)
          .maybeSingle();
        if (relationshipError) throw relationshipError;
        if (!relationship) throw new Error('Relationship not found for this dispute.');

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

        const endDate = new Date().toISOString();
        const { data: endedRows, error: endError } = await supabase
          .from('relationships')
          .update({ status: 'ended', end_date: endDate })
          .in('id', relationshipIds)
          .select('id,status,end_date');
        if (endError) throw endError;
        if (!endedRows?.length) throw new Error('No relationship rows were ended.');
        setAdminRelationships((prev) => prev.map((item) => relationshipIds.includes(item.id) ? { ...item, status: 'ended', end_date: endDate } : item));
      }

      const patch = {
        status: 'resolved',
        resolution,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('disputes')
        .update(patch)
        .eq('id', dispute.id)
        .eq('status', 'pending')
        .select('id,status,resolution,resolved_by,resolved_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Dispute was not updated. It may already be resolved.');
      setRouteRows((prev) => prev.map((item) => item.id === dispute.id ? { ...item, ...patch } : item));
      setReactionNotice(resolution === 'confirmed_by_admin' ? 'Dispute confirmed' : 'Dispute rejected');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not resolve dispute');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const toggleEscalationRule = async (rule: any) => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const isActive = !(rule.is_active ?? rule.enabled);
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('escalation_rules')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', rule.id)
        .select('id,is_active,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Escalation rule was not updated.');
      setRouteRows((prev) => prev.map((item) => item.id === rule.id ? { ...item, ...data } : item));
      setReactionNotice(isActive ? 'Rule enabled' : 'Rule disabled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update rule');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const toggleFaceProvider = async (provider: any) => {
    if (!supabase || !user || normalizeRole(user.role) !== 'super_admin') return;
    const enabled = !(provider.enabled ?? provider.is_active);
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('face_matching_providers')
        .update({ enabled, is_active: enabled, updated_at: new Date().toISOString() })
        .eq('id', provider.id)
        .select('id,enabled,is_active,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Face matching provider was not updated.');
      setRouteRows((prev) => prev.map((item) => item.id === provider.id ? { ...item, ...data } : item));
      setReactionNotice(enabled ? 'Provider enabled' : 'Provider disabled');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update provider');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
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

  const updateBanAppeal = async (appeal: any, action: 'approve' | 'reject', response?: string) => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    setSaving(true);
    try {
      const patch = {
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_response: response?.trim() || (action === 'approve'
          ? 'Appeal approved. The related restriction has been lifted.'
          : 'Appeal rejected after admin review.'),
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

  const createDatingInterest = async () => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const name = datingInterestForm.name.trim();
    if (!name) {
      setReactionNotice('Enter an interest name');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        icon_emoji: datingInterestForm.icon.trim() || null,
        category: datingInterestForm.category.trim() || 'hobbies',
        display_order: routeRows.length + 1,
        created_by: user.id,
        is_active: true,
      };
      const { data, error } = await supabase
        .from('dating_interests')
        .insert(payload)
        .select('id,name,icon_emoji,category,display_order,is_active,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Interest was not created.');
      setRouteRows((prev) => [...prev, data].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      setDatingInterestForm({ name: '', icon: '', category: 'hobbies' });
      setReactionNotice('Interest added');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not add interest');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateDatingInterest = async (interest: any, action: 'toggle' | 'delete') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (action === 'delete' && !window.confirm(`Delete "${interest.name}"?`)) return;
    setSaving(true);
    try {
      if (action === 'toggle') {
        const patch = { is_active: !interest.is_active, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from('dating_interests')
          .update(patch)
          .eq('id', interest.id)
          .select('id,is_active,updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Interest was not updated.');
        setRouteRows((prev) => prev.map((row) => row.id === interest.id ? { ...row, ...patch } : row));
        setReactionNotice(patch.is_active ? 'Interest activated' : 'Interest deactivated');
      } else {
        const { data, error } = await supabase
          .from('dating_interests')
          .delete()
          .eq('id', interest.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Interest was not deleted.');
        setRouteRows((prev) => prev.filter((row) => row.id !== interest.id));
        setReactionNotice('Interest deleted');
      }
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update interest');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const createDateOption = async () => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const optionValue = dateOptionForm.value.trim();
    const displayLabel = dateOptionForm.label.trim();
    if (!optionValue || !displayLabel) {
      setReactionNotice('Enter option value and label');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        option_type: dateOptionType,
        option_value: optionValue,
        display_label: displayLabel,
        display_order: Number.parseInt(dateOptionForm.order, 10) || 0,
        description: dateOptionForm.description.trim() || null,
        icon_emoji: dateOptionForm.icon.trim() || null,
        created_by: user.id,
        is_active: true,
      };
      const { data, error } = await supabase
        .from('dating_date_options')
        .insert(payload)
        .select('id,option_type,option_value,display_label,display_order,is_active,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Date option was not created.');
      setRouteRows((prev) => [...prev, data].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      setDateOptionForm({ value: '', label: '', order: '0', description: '', icon: '' });
      setReactionNotice('Date option added');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not add date option');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateDateOption = async (option: any, action: 'toggle' | 'delete') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (action === 'delete' && !window.confirm(`Delete "${option.display_label}"?`)) return;
    setSaving(true);
    try {
      if (action === 'toggle') {
        const patch = { is_active: !option.is_active, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from('dating_date_options')
          .update(patch)
          .eq('id', option.id)
          .select('id,is_active,updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Date option was not updated.');
        setRouteRows((prev) => prev.map((row) => row.id === option.id ? { ...row, ...patch } : row));
        setReactionNotice(patch.is_active ? 'Option activated' : 'Option deactivated');
      } else {
        const { data, error } = await supabase
          .from('dating_date_options')
          .delete()
          .eq('id', option.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Date option was not deleted.');
        setRouteRows((prev) => prev.filter((row) => row.id !== option.id));
        setReactionNotice('Date option deleted');
      }
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update date option');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const editProfessionalRole = (role: any) => {
    setProfessionalRoleForm({
      id: role.id || '',
      name: role.name || '',
      category: role.category || '',
      description: role.description || '',
      disclaimerText: role.disclaimer_text || '',
      displayOrder: `${role.display_order ?? 0}`,
      requiresCredentials: Boolean(role.requires_credentials),
      requiresVerification: Boolean(role.requires_verification),
      eligibleForLiveChat: Boolean(role.eligible_for_live_chat),
      approvalRequired: Boolean(role.approval_required),
      isActive: role.is_active !== false,
    });
  };

  const saveProfessionalRole = async () => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const name = professionalRoleForm.name.trim();
    const category = professionalRoleForm.category.trim();
    if (!name || !category) {
      setReactionNotice('Name and category are required');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    setSaving(true);
    try {
      const roleData = {
        name,
        category,
        description: professionalRoleForm.description.trim() || null,
        requires_credentials: professionalRoleForm.requiresCredentials,
        requires_verification: professionalRoleForm.requiresVerification,
        eligible_for_live_chat: professionalRoleForm.eligibleForLiveChat,
        approval_required: professionalRoleForm.approvalRequired,
        disclaimer_text: professionalRoleForm.disclaimerText.trim() || null,
        is_active: professionalRoleForm.isActive,
        display_order: Number.parseInt(professionalRoleForm.displayOrder, 10) || 0,
        ai_matching_rules: {},
        updated_at: new Date().toISOString(),
      };
      const query = professionalRoleForm.id
        ? supabase.from('professional_roles').update(roleData).eq('id', professionalRoleForm.id)
        : supabase.from('professional_roles').insert({ ...roleData, created_by: user.id, created_at: new Date().toISOString() });
      const { data, error } = await query
        .select('id,name,category,description,requires_credentials,requires_verification,eligible_for_live_chat,approval_required,disclaimer_text,is_active,display_order,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Professional role was not saved.');
      setRouteRows((prev) => {
        const next = professionalRoleForm.id ? prev.map((row) => row.id === data.id ? data : row) : [...prev, data];
        return next.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      });
      setProfessionalRoleForm({
        id: '',
        name: '',
        category: '',
        description: '',
        disclaimerText: '',
        displayOrder: '0',
        requiresCredentials: true,
        requiresVerification: true,
        eligibleForLiveChat: true,
        approvalRequired: true,
        isActive: true,
      });
      setReactionNotice(professionalRoleForm.id ? 'Role updated' : 'Role created');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not save professional role');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateProfessionalRole = async (role: any, action: 'toggle' | 'delete') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (action === 'delete' && !window.confirm(`Delete "${role.name}"? This may fail if professionals use it.`)) return;
    setSaving(true);
    try {
      if (action === 'toggle') {
        const patch = { is_active: !role.is_active, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from('professional_roles')
          .update(patch)
          .eq('id', role.id)
          .select('id,is_active,updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Role was not updated.');
        setRouteRows((prev) => prev.map((row) => row.id === role.id ? { ...row, ...patch } : row));
        setReactionNotice(patch.is_active ? 'Role activated' : 'Role deactivated');
      } else {
        const { data, error } = await supabase
          .from('professional_roles')
          .delete()
          .eq('id', role.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Role was not deleted.');
        setRouteRows((prev) => prev.filter((row) => row.id !== role.id));
        setReactionNotice('Role deleted');
      }
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update professional role');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const editPaymentMethod = (method: any) => {
    setPaymentMethodForm({
      id: method.id || '',
      name: method.name || '',
      description: method.description || '',
      paymentType: method.payment_type || 'bank_transfer',
      accountDetails: method.account_details ? JSON.stringify(method.account_details, null, 2) : '',
      instructions: method.instructions || '',
      displayOrder: `${method.display_order ?? 0}`,
      iconEmoji: method.icon_emoji || '',
      isActive: method.is_active !== false,
    });
  };

  const savePaymentMethod = async () => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const name = paymentMethodForm.name.trim();
    if (!name) {
      setReactionNotice('Enter a payment method name');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    let accountDetails: any = null;
    if (paymentMethodForm.accountDetails.trim()) {
      try {
        accountDetails = JSON.parse(paymentMethodForm.accountDetails);
      } catch {
        setReactionNotice('Account details must be valid JSON');
        window.setTimeout(() => setReactionNotice(null), 2600);
        return;
      }
    }
    setSaving(true);
    try {
      const methodData = {
        name,
        description: paymentMethodForm.description.trim() || null,
        payment_type: paymentMethodForm.paymentType,
        account_details: accountDetails,
        instructions: paymentMethodForm.instructions.trim() || null,
        display_order: Number.parseInt(paymentMethodForm.displayOrder, 10) || 0,
        icon_emoji: paymentMethodForm.iconEmoji.trim() || null,
        is_active: paymentMethodForm.isActive,
        updated_at: new Date().toISOString(),
      };
      const query = paymentMethodForm.id
        ? supabase.from('payment_methods').update(methodData).eq('id', paymentMethodForm.id)
        : supabase.from('payment_methods').insert({ ...methodData, created_by: user.id, created_at: new Date().toISOString() });
      const { data, error } = await query
        .select('id,name,description,payment_type,account_details,instructions,is_active,display_order,icon_emoji,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Payment method was not saved.');
      setRouteRows((prev) => {
        const next = paymentMethodForm.id ? prev.map((row) => row.id === data.id ? data : row) : [...prev, data];
        return next.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      });
      setPaymentMethodForm({ id: '', name: '', description: '', paymentType: 'bank_transfer', accountDetails: '', instructions: '', displayOrder: '0', iconEmoji: '', isActive: true });
      setReactionNotice(paymentMethodForm.id ? 'Payment method updated' : 'Payment method created');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not save payment method');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updatePaymentMethodConfig = async (method: any, action: 'toggle' | 'delete') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (action === 'delete' && !window.confirm(`Delete "${method.name}"?`)) return;
    setSaving(true);
    try {
      if (action === 'toggle') {
        const patch = { is_active: !method.is_active, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from('payment_methods')
          .update(patch)
          .eq('id', method.id)
          .select('id,is_active,updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Payment method was not updated.');
        setRouteRows((prev) => prev.map((row) => row.id === method.id ? { ...row, ...patch } : row));
        setReactionNotice(patch.is_active ? 'Payment method activated' : 'Payment method deactivated');
      } else {
        const { data, error } = await supabase
          .from('payment_methods')
          .delete()
          .eq('id', method.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Payment method was not deleted.');
        setRouteRows((prev) => prev.filter((row) => row.id !== method.id));
        setReactionNotice('Payment method deleted');
      }
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update payment method');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const editTriggerWord = (word: any) => {
    setTriggerWordForm({
      id: word.id || '',
      wordPhrase: word.word_phrase || '',
      severity: word.severity || 'low',
      category: word.category || 'general',
      active: word.active !== false,
    });
  };

  const saveTriggerWord = async () => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    const wordPhrase = triggerWordForm.wordPhrase.toLowerCase().trim();
    if (!wordPhrase) {
      setReactionNotice('Enter a word or phrase');
      window.setTimeout(() => setReactionNotice(null), 1800);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        word_phrase: wordPhrase,
        severity: triggerWordForm.severity,
        category: triggerWordForm.category,
        active: triggerWordForm.active,
        updated_at: new Date().toISOString(),
      };
      const query = triggerWordForm.id
        ? supabase.from('trigger_words').update(payload).eq('id', triggerWordForm.id)
        : supabase.from('trigger_words').insert({ ...payload, created_by: user.id, created_at: new Date().toISOString() });
      const { data, error } = await query
        .select('id,word_phrase,severity,category,active,created_by,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Trigger word was not saved.');
      setRouteRows((prev) => {
        const next = triggerWordForm.id ? prev.map((row) => row.id === data.id ? data : row) : [...prev, data];
        return next.sort((a, b) => String(a.word_phrase || '').localeCompare(String(b.word_phrase || '')));
      });
      setTriggerWordForm({ id: '', wordPhrase: '', severity: 'low', category: 'general', active: true });
      setReactionNotice(triggerWordForm.id ? 'Trigger word updated' : 'Trigger word added');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not save trigger word');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const updateTriggerWordConfig = async (word: any, action: 'toggle' | 'delete') => {
    if (!supabase || !user || !isAdminRole(user.role)) return;
    if (action === 'delete' && !window.confirm(`Delete "${word.word_phrase}"?`)) return;
    setSaving(true);
    try {
      if (action === 'toggle') {
        const patch = { active: !word.active, updated_at: new Date().toISOString() };
        const { data, error } = await supabase
          .from('trigger_words')
          .update(patch)
          .eq('id', word.id)
          .select('id,active,updated_at')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Trigger word was not updated.');
        setRouteRows((prev) => prev.map((row) => row.id === word.id ? { ...row, ...patch } : row));
        setReactionNotice(patch.active ? 'Trigger word activated' : 'Trigger word deactivated');
      } else {
        const { data, error } = await supabase
          .from('trigger_words')
          .delete()
          .eq('id', word.id)
          .select('id')
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Trigger word was not deleted.');
        setRouteRows((prev) => prev.filter((row) => row.id !== word.id));
        setReactionNotice('Trigger word deleted');
      }
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update trigger word');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const editWarningTemplate = (template: any) => {
    setWarningTemplateForm({
      id: template.id || '',
      titleTemplate: template.title_template || '',
      messageTemplate: template.message_template || '',
      inChatWarningTemplate: template.in_chat_warning_template || '',
      description: template.description || '',
      active: template.active !== false,
    });
  };

  const saveWarningTemplate = async () => {
    if (!supabase || !user || !isAdminRole(user.role) || !warningTemplateForm.id) return;
    if (!warningTemplateForm.titleTemplate.trim() || !warningTemplateForm.messageTemplate.trim() || !warningTemplateForm.inChatWarningTemplate.trim()) {
      setReactionNotice('All template fields are required');
      window.setTimeout(() => setReactionNotice(null), 2000);
      return;
    }
    setSaving(true);
    try {
      const patch = {
        title_template: warningTemplateForm.titleTemplate,
        message_template: warningTemplateForm.messageTemplate,
        in_chat_warning_template: warningTemplateForm.inChatWarningTemplate,
        description: warningTemplateForm.description.trim() || null,
        active: warningTemplateForm.active,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('warning_templates')
        .update(patch)
        .eq('id', warningTemplateForm.id)
        .select('id,severity,title_template,message_template,in_chat_warning_template,description,active,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Warning template was not updated.');
      setRouteRows((prev) => prev.map((row) => row.id === data.id ? data : row));
      setWarningTemplateForm({ id: '', titleTemplate: '', messageTemplate: '', inChatWarningTemplate: '', description: '', active: true });
      setReactionNotice('Warning template updated');
      window.setTimeout(() => setReactionNotice(null), 1800);
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not update warning template');
      window.setTimeout(() => setReactionNotice(null), 2600);
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const staged = settingsProfilePictureUrl.trim();
      const existing = typeof user.profile_picture === 'string' ? user.profile_picture.trim() : '';
      const nextPicture = staged || existing || null;

      const userPatch: Record<string, unknown> = {
        full_name: settingsForm.fullName.trim(),
        username: settingsForm.username.trim() || null,
        phone_number: settingsForm.phoneNumber.trim(),
        profile_picture: nextPicture,
        email: user.email || null,
        role: user.role || null,
      };
      if (settingsForm.gender.trim()) userPatch.gender = settingsForm.gender.trim();
      if (settingsForm.dateOfBirth.trim()) userPatch.date_of_birth = settingsForm.dateOfBirth.trim();

      const { error: userError } = await supabase.from('users').update(userPatch).eq('id', user.id);
      if (userError) throw userError;

      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            notification_settings: notificationSettings,
            privacy_settings: privacySettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      if (settingsError) {
        console.warn('[Web settings] user_settings upsert failed:', settingsError);
        setReactionNotice(`Profile saved. Preferences not synced: ${settingsError.message}`);
      } else {
        setReactionNotice('Settings saved');
      }
      setUser((prev) => {
        if (!prev) return prev;
        const next: WebUser = {
          ...prev,
          full_name: settingsForm.fullName.trim(),
          username: settingsForm.username.trim() || null,
          phone_number: settingsForm.phoneNumber.trim(),
          profile_picture: nextPicture,
        };
        if (settingsForm.gender.trim()) next.gender = settingsForm.gender.trim();
        if (settingsForm.dateOfBirth.trim()) next.date_of_birth = settingsForm.dateOfBirth.trim();
        return next;
      });
      window.setTimeout(() => setReactionNotice(null), 3200);
    } catch (err: any) {
      setReactionNotice(err?.message || 'Could not save settings');
      window.setTimeout(() => setReactionNotice(null), 3200);
    } finally {
      setSaving(false);
    }
  };

  const deleteWebAccount = async () => {
    if (!supabase || !user || deletingAccount) return;
    const confirmed = window.confirm(
      'Permanently delete your account and all associated data? This cannot be undone.'
    );
    if (!confirmed) return;
    const doubleConfirmed = window.confirm(
      'Final confirmation: delete your Committed account now?'
    );
    if (!doubleConfirmed) return;

    setDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
      await signOutWebUser();
    } catch (error: any) {
      setReactionNotice(error?.message || 'Could not delete account');
      window.setTimeout(() => setReactionNotice(null), 3200);
    } finally {
      setDeletingAccount(false);
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

  /** Same bucket/path as `app/settings.tsx` so public URLs and RLS match the native app. */
  const uploadProfilePictureToAvatars = useCallback(async (file: File) => {
    if (!supabase || !user) throw new Error('Please sign in again before uploading.');
    const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const filePath = `profile-pictures/${fileName}`;
    const { data, error } = await supabase.storage.from('avatars').upload(filePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(data.path);
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

  /** Upload then persist `users.profile_picture` immediately so refresh keeps the photo (matches mobile Settings). */
  const handleProfilePhotoUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !supabase || !user) return;
      setUploadingLabel('Profile photo');
      try {
        const url = await uploadProfilePictureToAvatars(file);
        setSettingsProfilePictureUrl(url);
        const { error } = await supabase.from('users').update({ profile_picture: url }).eq('id', user.id);
        if (error) throw error;
        setUser((prev) => (prev ? { ...prev, profile_picture: url } : prev));
        setReactionNotice('Profile photo saved');
        window.setTimeout(() => setReactionNotice(null), 2200);
      } catch (err: any) {
        setReactionNotice(err?.message || 'Could not save profile photo');
        window.setTimeout(() => setReactionNotice(null), 3200);
      } finally {
        setUploadingLabel('');
        if (event.target) event.target.value = '';
      }
    },
    [supabase, user, uploadProfilePictureToAvatars]
  );

  const renderHeader = () => {
    const current = tabs.find((tab) => tab.key === activeTab) || tabs[0];
    const isRoot = activeTab === 'home';
    return (
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-[58px] items-center gap-3 px-4">
          {!isRoot ? (
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'dating' && subPath === 'user-profile') {
                  router.push('/app/dating');
                } else {
                  router.back();
                }
              }}
              className="grid h-10 w-10 place-items-center rounded-full active:bg-slate-100"
            >
              <span className="text-3xl leading-none">‹</span>
            </button>
          ) : (
            <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
              <Avatar src={shellAvatarSrc} name={getUserDisplayName(shellAvatarNameUser)} size="sm" />
            </ProfileUserLink>
          )}
          <h1 className="flex-1 text-xl font-black text-slate-950">{current.label === 'Notify' ? 'Notifications' : current.label}</h1>
          {activeTab === 'dating' && appPath[0] === 'dating' && appPath.length === 1 ? (
            <>
              <Link href="/app/dating/matches" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900" aria-label="Matches" title="Matches">
                <Users className="h-5 w-5" />
              </Link>
              <Link href="/app/dating/likes-received" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-red-500" aria-label="Likes" title="Likes">
                <Heart className="h-5 w-5" />
              </Link>
              <Link href="/app/dating/filters" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900" aria-label="Filters" title="Filters">
                <SlidersHorizontal className="h-5 w-5" />
              </Link>
              <Link href="/app/dating/profile-setup" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900" aria-label="Dating profile settings" title="Profile">
                <Settings className="h-5 w-5" />
              </Link>
            </>
          ) : activeTab === 'dating' && subPath === 'user-profile' ? (
            <>
              <button type="button" onClick={() => shareRouteDatingProfile()} className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900" aria-label="Share profile" title="Share">
                <Share2 className="h-5 w-5" />
              </button>
              {(() => {
                const uid = searchParams?.get('userId') || searchParams?.get('id') || '';
                if (!uid || uid === user?.id) return null;
                const reportedName =
                  routeDatingProfile?.users?.full_name ||
                  routeDatingProfile?.user?.full_name ||
                  'Member';
                return (
                  <button
                    type="button"
                    onClick={() => setReportProfileTarget({ id: uid, name: reportedName })}
                    className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900"
                    aria-label="Report profile"
                    title="Report"
                  >
                    <Flag className="h-5 w-5 text-rose-600" />
                  </button>
                );
              })()}
            </>
          ) : activeTab === 'dating' ? (
            <>
              <Link href="/app/dating/likes-received" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-red-500">
                <Heart className="h-5 w-5" />
              </Link>
              <Link href="/app/dating/filters" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 text-slate-900">
                <SlidersHorizontal className="h-5 w-5" />
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
          <div
            key={item.user_id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/app/status/${encodeURIComponent(item.user_id)}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                router.push(`/app/status/${encodeURIComponent(item.user_id)}`);
              }
            }}
            className={`${compact ? 'min-w-[76px]' : 'min-w-[104px]'} relative cursor-pointer overflow-hidden rounded-[20px] bg-slate-900 p-2 text-left text-white shadow-sm`}
          >
            <div className="absolute inset-0 opacity-60" style={{ background: item.latest_status?.background_color || 'linear-gradient(135deg,#2563eb,#ec4899)' }} />
            {item.latest_status?.media_path ? <img src={item.latest_status.media_path} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
            <div className="relative z-10 flex min-h-[96px] flex-col justify-between">
              <span className="inline-block self-start" onClick={(event) => event.stopPropagation()}>
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={item.user_id} className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-white">
                  <Avatar src={item.user_avatar} name={item.user_name} size="sm" />
                </ProfileUserLink>
              </span>
              <div>
                <p className="line-clamp-2 text-xs font-black">{item.latest_status?.text_content || item.user_name}</p>
                <p className="mt-1 truncate text-[10px] font-semibold text-white/75">{item.user_name}</p>
              </div>
            </div>
            {item.has_unviewed ? <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-pink-500 ring-2 ring-white" /> : null}
          </div>
        ))}
      </div>
    );
  };

  const renderHome = () => (
    <div className="px-4 py-4">
      <section className="rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-800 px-5 py-6 text-white shadow-xl shadow-blue-700/20">
        <div className="flex items-center gap-3">
          <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="shrink-0 rounded-full outline-none ring-offset-2 ring-blue-200 focus-visible:ring-2 focus-visible:ring-white">
            <Avatar src={shellAvatarSrc} name={getUserDisplayName(shellAvatarNameUser)} size="lg" />
          </ProfileUserLink>
          <div>
            <p className="text-sm font-semibold text-blue-100">Welcome back</p>
            <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="inline-block">
              <h2 className="text-2xl font-black hover:underline">{getUserDisplayName(shellAvatarNameUser)}</h2>
            </ProfileUserLink>
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
            {relationship.partner_user_id ? (
              <ProfileUserLink viewerUserId={user?.id} subjectUserId={relationship.partner_user_id} className="mt-3 block min-w-0">
                <p className="truncate text-2xl font-black text-slate-950 hover:underline">{relationship.partner_name || 'Partner'}</p>
              </ProfileUserLink>
            ) : (
              <p className="mt-3 text-2xl font-black text-slate-950">{relationship.partner_name || 'Partner'}</p>
            )}
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
          <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
            <Avatar src={shellAvatarSrc} name={getUserDisplayName(shellAvatarNameUser)} />
          </ProfileUserLink>
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
        {reels.map((reel) => {
          const thumb = resolveReelThumbnailUrl(reel.thumbnail_url);
          const stream = resolveReelVideoUrl(reel.video_url);
          return (
          <article key={reel.id} className="relative min-h-[calc(100vh-122px)] snap-start overflow-hidden bg-slate-900">
            {stream ? (
              <video src={stream} poster={thumb || undefined} controls className="h-full min-h-[calc(100vh-122px)] w-full object-cover" />
            ) : thumb ? (
              <img src={thumb} alt="" className="h-full min-h-[calc(100vh-122px)] w-full object-cover" />
            ) : (
              <div className="grid min-h-[calc(100vh-122px)] place-items-center bg-gradient-to-br from-slate-900 to-blue-950 text-white">
                <Film className="h-20 w-20" />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-white">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={reel.user_id} subjectUsername={reel.users?.username} className="inline-block">
                    <p className="font-black hover:underline">{getUserDisplayName(reel.users)}</p>
                  </ProfileUserLink>
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
        );
        })}
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
          currentUserId={user?.id || null}
          onToggleLike={(comment) => void toggleSocialCommentLike('post', post.id, comment)}
          onEdit={(comment, content) => void editSocialComment('post', post.id, comment, content)}
          onDelete={(comment) => void deleteSocialComment('post', post.id, comment)}
          onReport={(comment) => void reportSocialComment(comment)}
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
    const reelPoster = resolveReelThumbnailUrl(reel.thumbnail_url);
    const reelStream = resolveReelVideoUrl(reel.video_url);
    return (
      <div className="space-y-3 bg-slate-950 pb-3">
        <article className="relative min-h-[calc(100vh-122px)] overflow-hidden bg-slate-900">
          {reelStream ? (
            <video src={reelStream} poster={reelPoster || undefined} controls className="h-full min-h-[calc(100vh-122px)] w-full object-cover" />
          ) : reelPoster ? (
            <img src={reelPoster} alt="" className="h-full min-h-[calc(100vh-122px)] w-full object-cover" />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 text-white">
            <div className="flex items-center gap-3">
              <ProfileUserLink viewerUserId={user?.id} subjectUserId={reel.user_id} subjectUsername={reel.users?.username} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-white">
                <Avatar src={reel.users?.profile_picture} name={getUserDisplayName(reel.users)} />
              </ProfileUserLink>
              <div className="min-w-0 flex-1">
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={reel.user_id} subjectUsername={reel.users?.username} className="inline-block min-w-0">
                  <p className="truncate font-black hover:underline">{getUserDisplayName(reel.users)}</p>
                </ProfileUserLink>
              </div>
            </div>
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
            currentUserId={user?.id || null}
            onToggleLike={(comment) => void toggleSocialCommentLike('reel', reel.id, comment)}
            onEdit={(comment, content) => void editSocialComment('reel', reel.id, comment, content)}
            onDelete={(comment) => void deleteSocialComment('reel', reel.id, comment)}
            onReport={(comment) => void reportSocialComment(comment)}
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
            <ProfileUserLink
              viewerUserId={user?.id}
              subjectUserId={resolvedItem.user_id}
              className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-white"
            >
              <Avatar src={resolvedItem.user_avatar} name={resolvedItem.user_name} />
            </ProfileUserLink>
            <div>
              <ProfileUserLink viewerUserId={user?.id} subjectUserId={resolvedItem.user_id} className="inline-block">
                <p className="font-black hover:underline">{resolvedItem.user_name}</p>
              </ProfileUserLink>
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
        <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
          <Avatar src={shellAvatarSrc} name={getUserDisplayName(shellAvatarNameUser)} />
        </ProfileUserLink>
        <div>
          <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="inline-block">
            <p className="font-black text-slate-950 hover:underline">{getUserDisplayName(shellAvatarNameUser)}</p>
          </ProfileUserLink>
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
        className="w-full resize-none rounded-[24px] border border-slate-200 p-4 text-lg font-semibold text-white outline-none placeholder:text-white/70 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        style={{ background: statusBackgroundColor }}
      />
      <section className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-black text-slate-700">Background</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['#1A73E8', '#EC4899', '#111827', '#F97316', '#10B981', '#7C3AED'].map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setStatusBackgroundColor(color)}
              className={`h-10 w-10 rounded-full ring-2 ${statusBackgroundColor === color ? 'ring-slate-950 ring-offset-2' : 'ring-transparent'}`}
              style={{ background: color }}
              aria-label={`Use ${color} background`}
            />
          ))}
        </div>
      </section>
      <label className="block text-sm font-black text-slate-700">
        Privacy
        <select value={statusPrivacyLevel} onChange={(event) => setStatusPrivacyLevel(event.target.value as typeof statusPrivacyLevel)} className="mt-2 h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none">
          <option value="friends">Friends</option>
          <option value="followers">Followers</option>
          <option value="public">Public</option>
          <option value="only_me">Only me</option>
        </select>
      </label>
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
      const showDatingDebug =
        typeof window !== 'undefined' &&
        (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG_DATING === '1');
      return (
        <div>
          {showDatingDebug ? (
            <div className="mx-4 mt-4 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
              <p>
                Dating debug: initial {datingDebug.initial}, filtered {datingDebug.afterInitialFilters}, likes excluded{' '}
                {datingDebug.likedExcluded}, passes excluded {datingDebug.passedExcluded}, fallbacks {datingDebug.fallbackRuns}, final{' '}
                {datingDebug.final}
              </p>
              {datingDebug.lastError ? <p className="mt-1">Query error: {datingDebug.lastError}</p> : null}
            </div>
          ) : null}
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

    const nextProfile = datingProfiles[datingIndex + 1] ?? null;

    const openDatingProfile = () => {
      if (!profile.user_id) return;
      // Same route family as Expo `dating/user-profile` — loads `dating_profiles`, photos, badges, starters (not generic `/app/profile`).
      const profileIdParam = profile.id ? `&profileId=${encodeURIComponent(profile.id)}` : '';
      router.push(`/app/dating/user-profile?userId=${encodeURIComponent(profile.user_id)}${profileIdParam}`);
    };

    const rewindLastDatingSwipe = () => {
      if (datingIndex <= 0) return;
      setDatingIndex((i) => Math.max(0, i - 1));
    };

    return (
      <div className="flex min-h-[calc(100vh-122px)] flex-col px-4 pb-10 pt-3">
        <div className="relative flex min-h-[470px] flex-1 flex-col">
          <DatingDiscoverSwipeDeck
            profileKey={profile.user_id}
            front={<DatingDiscoveryCardFace profile={profile} supabase={supabase} />}
            back={nextProfile ? <DatingDiscoveryCardFace profile={nextProfile} supabase={supabase} /> : null}
            onSwipeLeft={() => reactToDatingProfile(profile, 'pass')}
            onSwipeRight={() => reactToDatingProfile(profile, 'like')}
            onCardTap={openDatingProfile}
          />
        </div>
        <button
          type="button"
          data-swipe-ignore
          onClick={openDatingProfile}
          className="mt-3 w-full rounded-[16px] bg-white py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200"
        >
          Open full profile
        </button>
        <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3" data-swipe-ignore>
          <button
            type="button"
            onClick={rewindLastDatingSwipe}
            disabled={datingIndex === 0}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-800 shadow-sm ring-1 ring-slate-300 disabled:opacity-40 sm:h-14 sm:w-14"
            aria-label="Rewind last profile"
            title="Rewind"
          >
            <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <button type="button" onClick={() => void reactToDatingProfile(profile, 'pass')} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-red-500 text-white shadow-xl shadow-red-500/25 active:scale-95 sm:h-16 sm:w-16">
            <X className="h-7 w-7 sm:h-8 sm:w-8" />
          </button>
          <button type="button" onClick={() => void reactToDatingProfile(profile, 'super')} className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-600/25 active:scale-95 sm:h-[72px] sm:w-[72px]">
            <Star className="h-8 w-8 fill-white sm:h-9 sm:w-9" />
          </button>
          <button type="button" onClick={() => void reactToDatingProfile(profile, 'like')} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-green-500 text-white shadow-xl shadow-green-500/25 active:scale-95 sm:h-16 sm:w-16">
            <Heart className="h-7 w-7 fill-white sm:h-8 sm:w-8" />
          </button>
          <button
            type="button"
            onClick={() => router.push('/app/dating/premium')}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-200 sm:h-14 sm:w-14"
            aria-label="Boost profile (Premium)"
            title="Boost (Premium)"
          >
            <Zap className="h-5 w-5 fill-current sm:h-6 sm:w-6" />
          </button>
        </div>
        <Link
          href="/app/dating/premium"
          data-swipe-ignore
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-black text-white shadow-md shadow-amber-500/30"
        >
          <Crown className="h-4 w-4 fill-current" />
          Go Premium
        </Link>
        <div className="mt-3 overflow-hidden rounded-[18px] bg-white ring-1 ring-slate-200" data-swipe-ignore>
          <Link
            href="/app/dating/date-requests"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 bg-white px-3 py-3 text-xs font-black text-blue-700 active:bg-slate-50"
            aria-label="Open date plans and requests"
          >
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            <span>Date plans</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-blue-500/80" aria-hidden />
          </Link>
          <p className="border-t border-slate-100 px-3 pb-1 pt-2 text-center text-[11px] font-semibold leading-relaxed text-slate-500">
            When you and someone else match, you can propose a time from{' '}
            <Link href="/app/dating/matches" className="font-black text-blue-600 underline decoration-blue-200 underline-offset-2">
              Matches
            </Link>{' '}
            or open{' '}
            <Link href="/app/dating/date-requests" className="font-black text-blue-600 underline decoration-blue-200 underline-offset-2">
              Date requests
            </Link>{' '}
            to accept or decline invites.
          </p>
          <div className="flex flex-wrap justify-center gap-2 px-3 pb-3 pt-1">
            <Link
              href="/app/dating/matches"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-800 ring-1 ring-slate-200"
            >
              Matches
            </Link>
            <Link
              href="/app/dating/create-date-request"
              className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white shadow-sm"
            >
              Plan a date
            </Link>
            <Link
              href="/app/dating/date-requests"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-800 ring-1 ring-slate-200"
            >
              Inbox
            </Link>
          </div>
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
          <Link
            key={like.id}
            href={
              like.liker_id
                ? `/app/dating/user-profile?userId=${encodeURIComponent(like.liker_id)}`
                : '/app/dating/likes-received'
            }
            className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm active:bg-pink-50"
          >
            <Avatar src={like.user?.profile_picture} name={getUserDisplayName(like.user)} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black text-slate-950">{getUserDisplayName(like.user) || 'Someone liked you'}</p>
              <p className="text-sm font-semibold text-slate-500">{like.is_super_like ? 'Sent a super like' : 'Liked your profile'} - {timeAgo(like.created_at)}</p>
            </div>
            <Heart className="h-6 w-6 fill-pink-500 text-pink-500" />
          </Link>
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
        {datingMatches.map((match) => {
          const matchPeerId = match.user?.id || (match.user1_id === user?.id ? match.user2_id : match.user1_id) || '';
          const profileHref = matchPeerId
            ? `/app/dating/user-profile?userId=${encodeURIComponent(matchPeerId)}`
            : '/app/dating/matches';
          const openMatchChat = () => {
            if (matchPeerId) void openConversationWithUser(matchPeerId);
          };
          return (
            <article
              key={match.id}
              className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                onClick={() => {
                  if (matchPeerId) router.push(profileHref);
                }}
                className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                disabled={!matchPeerId}
                aria-label="View dating profile"
              >
                <Avatar src={match.user?.profile_picture} name={getUserDisplayName(match.user)} size="lg" />
              </button>
              <button
                type="button"
                onClick={openMatchChat}
                disabled={!matchPeerId}
                className="min-w-0 flex-1 rounded-[14px] px-1 py-0.5 text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
              >
                <p className="truncate text-lg font-black text-slate-950">{getUserDisplayName(match.user) || 'Matched member'}</p>
                <p className="text-sm font-semibold text-slate-500">Matched {timeAgo(match.matched_at || match.created_at)}</p>
              </button>
              <Link
                href={`/app/dating/create-date-request?matchId=${encodeURIComponent(match.id)}`}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                aria-label="Plan a date"
                title="Plan a date"
              >
                <Calendar className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={openMatchChat}
                disabled={!matchPeerId}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-600 text-white disabled:opacity-50"
                aria-label="Open chat"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </article>
          );
        })}
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
      const editingRequestId = subPath === 'edit-date-request' ? (searchParams.get('dateRequestId') || searchParams.get('id') || '') : '';
      const editingRequest = editingRequestId ? dateRequests.find((request) => request.id === editingRequestId) : null;
      const matchedOptions = datingMatches.map((match) => ({
        id: match.user?.id || (match.user1_id === user?.id ? match.user2_id : match.user1_id),
        name: getUserDisplayName(match.user),
      })).filter((item) => item.id);
      if (subPath === 'edit-date-request' && !editingRequest) {
        return <EmptyState icon={Calendar} title="Date Request Not Found" text="This request may have been cancelled or is not available to edit." action="Back to Date Requests" onAction={() => router.push('/app/dating/date-requests')} />;
      }
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-700 p-5 text-white">
            <Calendar className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">{subPath === 'edit-date-request' ? 'Edit Date Request' : 'Create Date Request'}</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">{subPath === 'edit-date-request' ? 'Update the plan while it is still pending.' : 'Plan a date with one of your matches.'}</p>
          </section>
          {subPath === 'create-date-request' && !datingMatches.length ? (
            <div className="rounded-[20px] bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
              You need at least one match to send a date request.{' '}
              <Link href="/app/dating" className="font-black text-amber-950 underline">
                Go to Discover
              </Link>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">Match</span>
            <select disabled={subPath === 'edit-date-request'} value={dateForm.recipientId} onChange={(event) => setDateForm((prev) => ({ ...prev, recipientId: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none disabled:bg-slate-100">
              <option value="">Select a match</option>
              {editingRequest?.to_user_id ? <option value={editingRequest.to_user_id}>{getUserDisplayName(editingRequest.to_user)}</option> : null}
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
          <div className="grid grid-cols-2 gap-3">
            <FormField label="People" value={dateForm.numberOfPeople} onChange={(numberOfPeople) => setDateForm((prev) => ({ ...prev, numberOfPeople }))} inputMode="numeric" />
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Group preference</span>
              <select value={dateForm.genderPreference} onChange={(event) => setDateForm((prev) => ({ ...prev, genderPreference: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none">
                <option value="everyone">Everyone</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Budget</span>
              <select value={dateForm.budgetRange} onChange={(event) => setDateForm((prev) => ({ ...prev, budgetRange: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none">
                <option value="">Any</option>
                <option value="low">Low Budget</option>
                <option value="medium">Medium Budget</option>
                <option value="high">High Budget</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Expenses</span>
              <select value={dateForm.expenseHandling} onChange={(event) => setDateForm((prev) => ({ ...prev, expenseHandling: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none">
                <option value="split">Split the Bill</option>
                <option value="initiator_pays">I'll Pay</option>
                <option value="acceptor_pays">You Pay</option>
              </select>
            </label>
          </div>
          <FormField label="Suggested activities" value={dateForm.suggestedActivities} onChange={(suggestedActivities) => setDateForm((prev) => ({ ...prev, suggestedActivities }))} placeholder="Coffee, walk, dinner" />
          <FormField label="Special requests" value={dateForm.specialRequests} onChange={(specialRequests) => setDateForm((prev) => ({ ...prev, specialRequests }))} multiline placeholder="Anything they should know?" />
          <button type="button" onClick={() => void (subPath === 'edit-date-request' ? updateDateRequest(editingRequestId) : createDateRequest())} disabled={saving || !dateForm.recipientId || !dateForm.title.trim() || !dateForm.location.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {subPath === 'edit-date-request' ? 'Save date request' : 'Send date request'}
          </button>
        </div>
      );
    }
    const filteredRequests = dateRequests.filter((request) => (dateRequestTab === 'sent' ? request.from_user_id === user?.id : request.to_user_id === user?.id));
    const receivedCount = dateRequests.filter((r) => r.to_user_id === user?.id).length;
    const sentCount = dateRequests.filter((r) => r.from_user_id === user?.id).length;
    return (
      <div className="space-y-3 px-4 py-4">
        <Link
          href="/app/dating/create-date-request"
          className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-3.5 text-sm font-black text-white shadow-sm active:scale-[0.99]"
        >
          <Calendar className="h-5 w-5" />
          Plan a date
        </Link>
        <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-white p-2 ring-1 ring-slate-200">
          {(['received', 'sent'] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setDateRequestTab(tab)} className={`rounded-[16px] py-3 text-sm font-black capitalize ${dateRequestTab === tab ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
              {tab === 'received' ? `Received (${receivedCount})` : `Sent (${sentCount})`}
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
          const otherId = other?.id || (incoming ? request.from_user_id : request.to_user_id) || '';
          return (
            <article
              key={request.id}
              id={request.id ? `date-request-card-${request.id}` : undefined}
              className="scroll-mt-24 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-start gap-3">
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={otherId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Avatar src={other?.profile_picture} name={getUserDisplayName(other)} />
                </ProfileUserLink>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black text-slate-950">{request.date_title || 'Date request'}</p>
                  <p className="truncate text-sm text-slate-500">
                    {incoming ? 'From' : 'To'}{' '}
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={otherId} className="inline font-semibold text-slate-600 hover:underline">
                      {getUserDisplayName(other)}
                    </ProfileUserLink>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{request.date_location || request.location_name || 'Location not set'}</p>
                  <p className="text-xs font-semibold text-slate-400">{request.date_time ? new Date(request.date_time).toLocaleString() : [request.proposed_date, request.proposed_time].filter(Boolean).join(' ')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${request.status === 'accepted' ? 'bg-emerald-50 text-emerald-700' : request.status === 'declined' || request.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{request.status || 'pending'}</span>
              </div>
              {request.date_description ? <p className="mt-3 text-sm leading-6 text-slate-600">{request.date_description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase">
                {request.date_duration_hours ? <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{request.date_duration_hours}h</span> : null}
                {request.dress_code ? <span className="rounded-full bg-pink-50 px-3 py-1 text-pink-700">{String(request.dress_code).replace(/_/g, ' ')}</span> : null}
                {request.budget_range ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{request.budget_range}</span> : null}
                {request.expense_handling ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{String(request.expense_handling).replace(/_/g, ' ')}</span> : null}
                {request.number_of_people ? <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">{request.number_of_people} people</span> : null}
              </div>
              {Array.isArray(request.suggested_activities) && request.suggested_activities.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {request.suggested_activities.slice(0, 5).map((activity: string) => (
                    <span key={activity} className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{activity}</span>
                  ))}
                </div>
              ) : null}
              {request.status === 'pending' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {incoming ? (
                    <>
                      <button type="button" onClick={() => void respondToDateRequest(request.id, 'accepted')} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white">Accept</button>
                      <button type="button" onClick={() => void respondToDateRequest(request.id, 'declined')} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white">Decline</button>
                    </>
                  ) : (
                    <>
                      <Link href={`/app/dating/edit-date-request?dateRequestId=${encodeURIComponent(request.id)}`} className="rounded-[16px] bg-blue-50 py-3 text-center text-sm font-black text-blue-700">Edit</Link>
                      <button type="button" onClick={() => void respondToDateRequest(request.id, 'cancelled')} className="rounded-[16px] bg-red-50 py-3 text-sm font-black text-red-600">Cancel</button>
                    </>
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
    const targetUserId = searchParams?.get('userId') || searchParams?.get('user_id') || '';
    const targetProfileId = searchParams?.get('profileId') || searchParams?.get('profile_id') || '';
    const legacyId = searchParams?.get('id') || appPath[2] || '';
    const profile =
      routeDatingProfile ||
      datingProfiles.find(
        (item) =>
          (!!targetUserId && item.user_id === targetUserId) ||
          (!!targetProfileId && item.id === targetProfileId) ||
          (!!legacyId && (item.user_id === legacyId || item.id === legacyId))
      ) ||
      (!targetUserId && !targetProfileId && !legacyId ? myDatingProfile : null);
    if (routeDatingProfileLoading) {
      return (
        <div className="space-y-4 px-4 py-4">
          <div className="h-[520px] animate-pulse rounded-[28px] bg-slate-200" />
          <div className="h-24 animate-pulse rounded-[22px] bg-slate-200" />
        </div>
      );
    }
    if (!profile) return <EmptyState icon={User} title="Profile Not Found" text="This dating profile is not available." action="Back to Dating" onAction={() => router.push('/app/dating')} />;
    const resolveDatingMediaUrl = (raw: unknown) => {
      const s = raw == null ? '' : String(raw).trim();
      if (!s) return '';
      if (supabase) {
        return resolveProfilePictureUrlWithSupabase(supabase, s) || resolveProfilePictureUrl(s) || s;
      }
      return resolveProfilePictureUrl(s) || s;
    };
    const photos = profile.dating_photos || profile.photos || [];
    const videos = profile.dating_videos || profile.videos || [];
    const profileUser = profile.users || profile.user || null;
    const rawHeroPhoto = photos.find((item: any) => item.is_primary)?.photo_url || photos[0]?.photo_url || profileUser?.profile_picture;
    const photo =
      rawHeroPhoto && supabase
        ? resolveProfilePictureUrlWithSupabase(supabase, String(rawHeroPhoto)) || resolveProfilePictureUrl(String(rawHeroPhoto)) || rawHeroPhoto
        : rawHeroPhoto
          ? resolveProfilePictureUrl(String(rawHeroPhoto)) || rawHeroPhoto
          : null;
    const name = profileUser?.full_name || profileUser?.username || 'Committed dater';
    const isOwnProfile = profile.user_id === user?.id;
    const parseJsonArray = (raw: unknown): any[] => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try {
          const v = JSON.parse(raw);
          return Array.isArray(v) ? v : [];
        } catch {
          return [];
        }
      }
      return [];
    };
    let rawPrompts = profile.prompts;
    if (typeof rawPrompts === 'string') {
      try {
        rawPrompts = JSON.parse(rawPrompts);
      } catch {
        rawPrompts = [];
      }
    }
    const profilePrompts = Array.isArray(rawPrompts) ? rawPrompts.filter((p: any) => p && (p.question || p.answer)) : [];
    const valuesList = parseJsonArray(profile.values);
    const interestsList = parseJsonArray(profile.interests);
    const relationshipGoals = parseJsonArray(profile.relationship_goals);
    const lifestyleHas =
      !!profile.kids ||
      !!profile.work ||
      !!profile.religion ||
      !!profile.education ||
      !!profile.height_cm ||
      !!profile.exercise ||
      !!profile.pets ||
      !!profile.smoke ||
      !!profile.drink;
    const photosForGallery = photos.map((p: any) => ({
      ...p,
      photo_url: resolveDatingMediaUrl(p.photo_url) || p.photo_url,
    }));
    const openPhotoGallery = (initialIndex: number) => {
      const payload = encodeURIComponent(JSON.stringify(photosForGallery));
      router.push(`/app/dating/photo-gallery?photos=${payload}&initialIndex=${initialIndex}&userName=${encodeURIComponent(name)}`);
    };
    const weekendStyle = profile.weekend_style ? String(profile.weekend_style) : '';
    const badgeLabel = (badge: any) => {
      const raw = badge.badge_name || badge.badge_type || badge.name || 'Badge';
      return String(raw).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    };
    const heroDisplayName = profileUser?.full_name?.trim() || profileUser?.username?.trim() || name;
    const heroAgeLabel =
      profile.age != null && profile.age !== '' && !Number.isNaN(Number(profile.age)) ? String(profile.age) : '?';
    const heroLocationCity = profile.location_city?.trim();
    const showHeroLocation = !!heroLocationCity;
    const datingProfileSection = 'border-t border-slate-200 px-5 py-6';
    const datingProfileSectionTitle = 'mb-4 text-xl font-bold text-slate-950';
    const datingProfileBody = 'text-base leading-6 text-slate-800';
    return (
      <div className="space-y-0 bg-white pb-4">
        {/* Parity with `app/dating/user-profile.tsx` heroSection + heroGradient + heroInfo */}
        <section className="relative -mx-4 aspect-[5/6] w-[calc(100%+2rem)] max-w-none overflow-hidden bg-slate-200 text-white">
          <button
            type="button"
            onClick={() => photosForGallery.length && openPhotoGallery(0)}
            className="relative block h-full w-full min-h-0 border-0 bg-transparent p-0 text-left"
            disabled={!photosForGallery.length}
          >
            {photo ? (
              <img src={photo} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
                <ImageIcon className="h-16 w-16" aria-hidden />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
            {photos.length > 0 ? (
              <div className="pointer-events-none absolute right-5 top-5 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-sm font-semibold">
                <ImageIcon className="h-4 w-4" />
                {photos.length}
              </div>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[28px] font-bold leading-tight sm:text-[32px]">
                  {heroDisplayName}, {heroAgeLabel}
                </h2>
                {profileUser?.verified || profileUser?.id_verified || profileUser?.email_verified || profileUser?.phone_verified ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0 fill-blue-600 text-blue-600" aria-label="Verified" />
                ) : null}
              </div>
              {showHeroLocation ? (
                <p className="mt-2 flex items-center gap-1.5 text-base font-medium text-white/90">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {heroLocationCity}
                </p>
              ) : null}
            </div>
          </button>
        </section>

        {!isOwnProfile ? (
          <div className="flex items-center justify-center gap-5 px-5 py-6">
            <button
              type="button"
              onClick={() => router.push('/app/dating')}
              className="grid h-[60px] w-[60px] place-items-center rounded-full bg-rose-600 text-[32px] font-bold text-white shadow-lg"
              aria-label="Pass"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => void reactToRouteDatingProfile(profile.user_id, 'super')}
              disabled={routeDatingReaction.superLiked || routeDatingReaction.matched}
              className="grid h-14 w-14 place-items-center rounded-full bg-pink-600 text-white shadow-lg disabled:opacity-55"
              aria-label="Super like"
            >
              {routeDatingReaction.superLiked ? <CheckCircle2 className="h-7 w-7" /> : <Star className="h-7 w-7 fill-white" />}
            </button>
            <button
              type="button"
              onClick={() => void reactToRouteDatingProfile(profile.user_id, 'like')}
              disabled={routeDatingReaction.liked || routeDatingReaction.matched}
              className="grid h-[60px] w-[60px] place-items-center rounded-full bg-emerald-500 text-white shadow-lg disabled:opacity-55"
              aria-label="Like"
            >
              {routeDatingReaction.liked ? <CheckCircle2 className="h-7 w-7" /> : <Heart className="h-7 w-7 fill-white" />}
            </button>
          </div>
        ) : null}

        <div className="space-y-0 px-0 pb-2">
        {!isOwnProfile && (routeDatingReaction.liked || routeDatingReaction.matched || routeDatingReaction.superLiked) ? (
          <div className="mx-5 mb-1 mt-1 flex flex-row items-center gap-3 rounded-[20px] border border-blue-200/80 bg-blue-50/90 px-4 py-4">
            <div className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-blue-600 text-white">
              {routeDatingReaction.matched ? (
                <MessageCircle className="h-5 w-5" />
              ) : routeDatingReaction.superLiked ? (
                <Star className="h-5 w-5 fill-white" />
              ) : (
                <Heart className="h-5 w-5 fill-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold text-slate-950">
                {routeDatingReaction.matched
                  ? "It's a match"
                  : routeDatingReaction.superLiked
                    ? 'Super like sent'
                    : 'You liked this profile'}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-slate-600">
                {routeDatingReaction.matched
                  ? 'You can start a conversation whenever you are ready.'
                  : routeDatingReaction.superLiked
                    ? 'They will see that you are extra interested.'
                    : 'If they like you back, you will become a match.'}
              </p>
            </div>
            {routeDatingReaction.matched ? (
              <button
                type="button"
                onClick={() => void openConversationWithUser(profile.user_id)}
                className="shrink-0 rounded-[14px] bg-blue-600 px-3.5 py-2.5 text-[13px] font-extrabold text-white"
              >
                Message
              </button>
            ) : null}
          </div>
        ) : null}

        {!isOwnProfile && routeConversationStarters.length ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Conversation Starters 💬</p>
            <div className="flex flex-col gap-3">
              {routeConversationStarters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void openConversationWithUser(profile.user_id, starter)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-4 text-left text-[15px] font-medium text-slate-900"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-blue-600" />
                  <span>{starter}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {profile.bio ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>About</p>
            <p className={datingProfileBody}>{profile.bio}</p>
          </section>
        ) : null}

        {profile.what_makes_me_different ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>What Makes Me Different 🔥</p>
            <p className={datingProfileBody}>{profile.what_makes_me_different}</p>
          </section>
        ) : null}

        {valuesList.length > 0 ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Values ❤️</p>
            <div className="flex flex-wrap gap-2">
              {valuesList.map((value: string, index: number) => (
                <span
                  key={`${value}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-slate-900"
                >
                  <Heart className="h-3.5 w-3.5 text-blue-600" />
                  {value}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {(profile.mood || weekendStyle) ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Vibe &amp; Lifestyle</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {profile.mood ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Smile className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Mood</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{String(profile.mood).charAt(0).toUpperCase() + String(profile.mood).slice(1)}</p>
                </div>
              ) : null}
              {weekendStyle ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  {weekendStyle === 'homebody' ? <Home className="h-5 w-5 text-blue-600" /> : null}
                  {weekendStyle === 'out_with_friends' ? <Users className="h-5 w-5 text-blue-600" /> : null}
                  {weekendStyle === 'church_faith' ? <Church className="h-5 w-5 text-blue-600" /> : null}
                  {weekendStyle === 'side_hustling' ? <Briefcase className="h-5 w-5 text-blue-600" /> : null}
                  {weekendStyle === 'exploring' ? <Mountain className="h-5 w-5 text-blue-600" /> : null}
                  {!['homebody', 'out_with_friends', 'church_faith', 'side_hustling', 'exploring'].includes(weekendStyle) ? <Sparkles className="h-5 w-5 text-blue-600" /> : null}
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Weekend</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{formatDatingProfileValue(weekendStyle.replace(/_/g, ' '))}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {profile.daily_question_answer ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Daily Question ✍🏽</p>
            <p className={datingProfileBody}>{profile.daily_question_answer}</p>
          </section>
        ) : null}

        {profilePrompts.length > 0 ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Prompts / Short Questions ✍🏽</p>
            <div className="flex flex-col gap-3">
              {profilePrompts.map((prompt: any, index: number) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-100 p-4">
                  {prompt.question ? <p className="text-sm font-bold text-slate-950">{prompt.question}</p> : null}
                  {prompt.answer ? <p className="mt-2 text-sm leading-6 text-slate-700">{prompt.answer}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {profile.what_im_looking_for ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>What I&apos;m Looking For 💬</p>
            <p className={datingProfileBody}>{profile.what_im_looking_for}</p>
          </section>
        ) : null}

        {profile.intention_tag ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Intention 🔒</p>
            <div className="mt-2 inline-block rounded-[14px] border border-blue-200 bg-blue-50 px-4 py-2">
              <p className="text-sm font-black text-blue-800">
                Here for: {String(profile.intention_tag).charAt(0).toUpperCase() + String(profile.intention_tag).slice(1)}
              </p>
            </div>
          </section>
        ) : null}

        {(profile.local_food || profile.local_slang || profile.local_spot) ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Local Flavor 🌍</p>
            <div className="mt-3 space-y-3">
              {profile.local_food ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase text-slate-400">Favorite Food</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.local_food}</p>
                </div>
              ) : null}
              {profile.local_slang ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase text-slate-400">Favorite Slang</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.local_slang}</p>
                </div>
              ) : null}
              {profile.local_spot ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-xs font-black uppercase text-slate-400">Favorite Spot</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.local_spot}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {lifestyleHas ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Lifestyle</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {profile.kids ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Users className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Kids</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{formatDatingProfileValue(String(profile.kids))}</p>
                </div>
              ) : null}
              {profile.work ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Work</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.work}</p>
                </div>
              ) : null}
              {profile.religion ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Church className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Faith</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.religion}</p>
                </div>
              ) : null}
              {profile.education ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Education</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.education}</p>
                </div>
              ) : null}
              {profile.height_cm ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Ruler className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Height</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{profile.height_cm} cm</p>
                </div>
              ) : null}
              {profile.exercise ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Dumbbell className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Exercise</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{formatDatingProfileValue(String(profile.exercise))}</p>
                </div>
              ) : null}
              {profile.pets ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <PawPrint className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Pets</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{formatDatingProfileValue(String(profile.pets))}</p>
                </div>
              ) : null}
              {profile.smoke ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Smoke</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{formatDatingProfileValue(String(profile.smoke))}</p>
                </div>
              ) : null}
              {profile.drink ? (
                <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-100">
                  <Coffee className="h-5 w-5 text-blue-600" />
                  <p className="mt-2 text-xs font-black uppercase text-slate-400">Drink</p>
                  <p className="mt-1 text-sm font-black text-slate-800">{formatDatingProfileValue(String(profile.drink))}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {routeDatingBadges.length ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Badges 🏆</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {routeDatingBadges.map((badge) => (
                <span
                  key={badge.id || badge.badge_type || badge.name}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  {badge.badge_type === 'verified' ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}
                  {badge.badge_type === 'good_conversationalist' ? <MessageCircle className="h-5 w-5 text-blue-600" /> : null}
                  {badge.badge_type === 'replies_fast' ? <Clock className="h-5 w-5 text-blue-600" /> : null}
                  {badge.badge_type === 'respectful_member' ? <Shield className="h-5 w-5 text-blue-600" /> : null}
                  {badge.badge_type === 'premium' ? <Crown className="h-5 w-5 text-amber-500" /> : null}
                  {badgeLabel(badge)}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className={datingProfileSection}>
          <p className={datingProfileSectionTitle}>Basic Info</p>
          <div className="grid grid-cols-2 gap-4">
            {profile.age != null && profile.age !== '' && !Number.isNaN(Number(profile.age)) ? (
              <div className="min-w-0 flex-1 rounded-xl bg-slate-100 p-4">
                <Calendar className="h-5 w-5 text-blue-600" />
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">Age</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{profile.age}</p>
              </div>
            ) : null}
            {profile.location_city ? (
              <div className="min-w-0 flex-1 rounded-xl bg-slate-100 p-4">
                <MapPin className="h-5 w-5 text-blue-600" />
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">Location</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{profile.location_city}</p>
              </div>
            ) : null}
            {relationshipGoals.length > 0 ? (
              <div className="col-span-2 rounded-xl bg-slate-100 p-4">
                <Heart className="h-5 w-5 text-blue-600" />
                <p className="mt-2 text-xs font-bold uppercase text-slate-500">Looking for</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{relationshipGoals.join(', ')}</p>
              </div>
            ) : null}
          </div>
        </section>

        {interestsList.length > 0 ? (
          <section className={datingProfileSection}>
            <p className={datingProfileSectionTitle}>Interests</p>
            <div className="flex flex-wrap gap-2">
              {interestsList.map((interest: string, index: number) => (
                <span key={`${interest}-${index}`} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800">
                  {interest}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {photos.length > 0 || videos.length > 0 ? (
          <section className={datingProfileSection}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDatingUserProfileMediaTab('photos')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3 text-sm font-black ${datingUserProfileMediaTab === 'photos' ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-500' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}
              >
                <ImageIcon className="h-5 w-5" />
                Photos ({photos.length})
              </button>
              <button
                type="button"
                onClick={() => setDatingUserProfileMediaTab('videos')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[14px] py-3 text-sm font-black ${datingUserProfileMediaTab === 'videos' ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-500' : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'}`}
              >
                <Film className="h-5 w-5" />
                Videos ({videos.length})
              </button>
            </div>
            {datingUserProfileMediaTab === 'photos' ? (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {photos.length ? (
                  photos.map((item: any, index: number) => {
                    const src = resolveDatingMediaUrl(item.photo_url) || item.photo_url;
                    return (
                      <button
                        key={item.id || item.photo_url || index}
                        type="button"
                        onClick={() => openPhotoGallery(index)}
                        className="relative aspect-square overflow-hidden rounded-[14px] ring-1 ring-slate-200"
                      >
                        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
                        {item.is_primary ? (
                          <span className="absolute left-2 top-2 rounded-lg bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">Main</span>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="col-span-3 py-8 text-center text-sm font-semibold text-slate-500">No photos yet</p>
                )}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {videos.length ? (
                  videos.map((item: any, index: number) => {
                    const vSrc = resolveDatingMediaUrl(item.video_url) || item.video_url;
                    const thumb = item.thumbnail_url ? resolveDatingMediaUrl(item.thumbnail_url) || item.thumbnail_url : null;
                    return (
                      <button
                        key={item.id || item.video_url || index}
                        type="button"
                        onClick={() => vSrc && router.push(`/app/dating/video-player?videoUrl=${encodeURIComponent(vSrc)}`)}
                        className="relative aspect-square overflow-hidden rounded-[18px] bg-slate-900 ring-1 ring-slate-200"
                      >
                        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover opacity-90" /> : <Film className="absolute inset-0 m-auto h-10 w-10 text-white/50" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-blue-600">▶</span>
                        </span>
                        {item.duration_seconds ? (
                          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-black text-white">
                            {Math.floor(item.duration_seconds / 60)}:{String(item.duration_seconds % 60).padStart(2, '0')}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <p className="col-span-2 py-8 text-center text-sm font-semibold text-slate-500">No videos yet</p>
                )}
              </div>
            )}
          </section>
        ) : null}

        </div>
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
              <section
                key={photo.id || `${url}-${index}`}
                id={`dating-gallery-photo-${index}`}
                className="grid min-h-[calc(100vh-170px)] snap-start place-items-center p-3"
              >
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

  const renderSearch = () => {
    const relationshipTypeLabel = (type?: string | null) => {
      const labels: Record<string, string> = {
        married: 'Married',
        engaged: 'Engaged',
        serious: 'Serious Relationship',
        dating: 'Dating',
      };
      return type ? labels[type] || type.replace(/_/g, ' ') : '';
    };

    const statusLabel = (status?: string | null) => {
      if (status === 'verified' || status === 'confirmed') return 'Verified';
      if (status === 'pending') return 'Pending';
      return 'No record';
    };

    const privacyLabel = (privacy?: string | null) => {
      if (privacy === 'public') return 'Public';
      if (privacy === 'verified-only' || privacy === 'verified_people') return 'Verified people';
      if (privacy === 'private') return 'Private';
      return '';
    };

    const filteredResults = searchResults.filter((item) => {
      if (searchResultFilter === 'all') return true;
      if (searchResultFilter === 'verified') return item.relationshipStatus === 'verified' || item.relationshipStatus === 'confirmed';
      if (searchResultFilter === 'pending') return item.relationshipStatus === 'pending';
      if (searchResultFilter === 'single') return item.isRegisteredUser && !item.relationshipStatus && !item.relationshipType;
      if (searchResultFilter === 'registered') return Boolean(item.isRegisteredUser && item.id);
      return true;
    });

    const filters: Array<{ value: typeof searchResultFilter; label: string; icon: typeof Search }> = [
      { value: 'all', label: 'All', icon: Search },
      { value: 'verified', label: 'Verified', icon: ShieldCheck },
      { value: 'pending', label: 'Pending', icon: Clock },
      { value: 'single', label: 'Single', icon: Heart },
      { value: 'registered', label: 'Members', icon: Users },
    ];

    const clearSearch = () => {
      setSearchQuery('');
      setSearchResults([]);
      setSearchPhoto('');
      setSearchResultFilter('all');
      setSearchMode('text');
    };

    return (
      <div className="space-y-4 px-4 py-4">
        <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 via-blue-500 to-pink-500 text-white shadow-xl shadow-blue-600/20">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="grid h-12 w-12 place-items-center rounded-[20px] bg-white/20">
                <Search className="h-7 w-7" />
              </div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-black">Public registry</span>
            </div>
            <h2 className="mt-5 text-2xl font-black">Search relationships</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">Check a name, phone number, or relationship photo against registered Committed records.</p>
          </div>
          <div className="grid grid-cols-2 border-t border-white/20 bg-white/10 p-2">
            {[
              { key: 'text', label: 'Text search', icon: Search },
              { key: 'face', label: 'Face search', icon: ImageIcon },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSearchMode(key as typeof searchMode);
                  setSearchResultFilter('all');
                }}
                className={`flex items-center justify-center gap-2 rounded-[18px] py-3 text-sm font-black ${searchMode === key ? 'bg-white text-blue-700 shadow-sm' : 'text-white/90'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          {searchMode === 'text' ? (
            <div className="flex gap-2">
              <input value={searchQuery} onChange={(event) => void runSearch(event.target.value)} placeholder="Search by name or phone" className="h-14 min-w-0 flex-1 rounded-[18px] border border-slate-200 bg-slate-50 px-4 font-semibold outline-none focus:border-blue-500 focus:bg-white" />
              <button type="button" onClick={() => void runSearch()} className="grid h-14 w-14 place-items-center rounded-[18px] bg-blue-600 text-white">
                {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-blue-300 bg-blue-50 px-4 text-center text-blue-700">
                {searchPhoto ? (
                  <img src={searchPhoto} alt="Face search preview" className="h-24 w-24 rounded-[24px] object-cover shadow-md" />
                ) : (
                  <div className="grid h-16 w-16 place-items-center rounded-[24px] bg-white shadow-sm">
                    <Camera className="h-8 w-8" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-black">{uploadingLabel === 'Search photo' ? 'Uploading photo...' : searchPhoto ? 'Change search photo' : 'Upload a face photo'}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-500">Use a clear front-facing image for best results.</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleFileUpload(event, 'search', 'Search photo', (url) => {
                    setSearchPhoto(url);
                    void runFaceSearch(url);
                  })}
                />
              </label>
              <button type="button" disabled={!searchPhoto || isSearching} onClick={() => void runFaceSearch()} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">
                {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                Search by photo
              </button>
            </div>
          )}
          {(searchQuery || searchPhoto || searchResults.length) ? (
            <button type="button" onClick={clearSearch} className="mt-3 text-sm font-black text-slate-500">Clear search</button>
          ) : null}
        </section>

        {searchResults.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setSearchResultFilter(value)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black shadow-sm ring-1 ${searchResultFilter === value ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-slate-600 ring-slate-200'}`}>
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {searchResults.length ? (
          <p className="rounded-[18px] bg-slate-100 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
            Search results are verification signals, not proof of current relationship status by themselves. Open verified records and use reports if anything looks incorrect.
          </p>
        ) : null}

        <div className="space-y-3">
          {filteredResults.map((item) => {
            const status = statusLabel(item.relationshipStatus);
            const isVerified = status === 'Verified';
            const isPending = status === 'Pending';
            const cardHref = item.id ? webAppProfileHref(user?.id, item.id) : '';
            const rowKey = item.id || item.relationshipId || item.fullName;
            return (
              <article
                key={rowKey}
                role={cardHref ? 'button' : undefined}
                tabIndex={cardHref ? 0 : undefined}
                onClick={
                  cardHref
                    ? (event) => {
                        if ((event.target as HTMLElement).closest('a')) return;
                        router.push(cardHref);
                      }
                    : undefined
                }
                onKeyDown={
                  cardHref
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        if ((event.target as HTMLElement).closest('a')) return;
                        event.preventDefault();
                        router.push(cardHref);
                      }
                    : undefined
                }
                className={`flex gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 ${cardHref ? 'cursor-pointer' : ''}`}
              >
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={item.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Avatar src={item.profilePicture || item.facePhotoUrl} name={item.fullName} />
                </ProfileUserLink>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <ProfileUserLink viewerUserId={user?.id} subjectUserId={item.id} className="block min-w-0">
                        <p className="truncate text-lg font-black text-slate-950 hover:underline">{item.fullName || 'Unknown'}</p>
                      </ProfileUserLink>
                      <p className="text-sm font-semibold text-slate-500">{item.phoneNumber || (item.isRegisteredUser ? 'Phone hidden' : 'Non-registered partner')}</p>
                    </div>
                    {item.id ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300" /> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${isVerified ? 'bg-emerald-100 text-emerald-700' : isPending ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      {status}
                    </span>
                    {item.relationshipType ? <span className="rounded-full bg-pink-100 px-2.5 py-1 text-xs font-black capitalize text-pink-700">{relationshipTypeLabel(item.relationshipType)}</span> : null}
                    {privacyLabel(item.relationshipPrivacy) ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{privacyLabel(item.relationshipPrivacy)}</span> : null}
                    {!item.isRegisteredUser ? <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-black text-white">Not on app</span> : null}
                    {typeof item.similarityScore === 'number' ? <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-700">{Math.round(item.similarityScore * 100)}% match</span> : null}
                  </div>
                  {item.partnerName ? <p className="mt-3 text-sm font-semibold text-slate-600">In a relationship with {item.partnerName}</p> : null}
                  {item.partnerPhone && !item.id ? <p className="mt-1 text-xs font-semibold text-slate-400">Registered by {item.partnerPhone}</p> : null}
                </div>
              </article>
            );
          })}
          {(searchQuery || searchPhoto) && !isSearching && !filteredResults.length ? <EmptyState icon={Search} title="No Results" text="Try another name, phone number, photo, or filter." /> : null}
        </div>
      </div>
    );
  };

  const renderNotifications = () => {
    if (!notifications.length) return <EmptyState icon={Bell} title="No Notifications" text="Likes, approvals, messages, and relationship updates will appear here." />;
    return (
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div>
            <p className="font-black text-slate-950">Notifications</p>
            <p className="text-sm text-slate-500">{notifications.filter((item) => !item.read).length} unread</p>
          </div>
          <button type="button" onClick={() => void clearAllNotificationRows()} className="rounded-[14px] bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">Clear all</button>
        </div>
        {notifications.map((notification) => {
          const href = notificationHref(notification);
          return (
          <div key={notification.id} className="flex gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
            <Link href={href} onClick={() => void markNotificationRead(notification)} className="flex min-w-0 flex-1 gap-3 active:bg-slate-50">
              <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${notification.read ? 'bg-slate-200' : 'bg-blue-600'}`} />
              <div className="min-w-0">
                <p className="font-black text-slate-950">{notification.title || 'Notification'}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{timeAgo(notification.created_at)}</p>
              </div>
            </Link>
            <button type="button" onClick={() => void deleteNotificationRow(notification.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500" aria-label="Delete notification">
              <X className="h-4 w-4" />
            </button>
          </div>
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
            <ProfileUserLink
              viewerUserId={user?.id}
              subjectUserId={firstParticipantId}
              className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Avatar src={avatar} name={title} />
            </ProfileUserLink>
            <div className="min-w-0 flex-1">
              <ProfileUserLink viewerUserId={user?.id} subjectUserId={firstParticipantId} className="block min-w-0">
                <p className="truncate text-lg font-black text-slate-950 hover:underline">{title}</p>
              </ProfileUserLink>
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
        {conversations.map((conversation) => {
          const otherId = (conversation.participant_ids || []).find((id) => id && id !== user?.id) || '';
          const avatarSrc = otherId
            ? conversation.participantAvatars?.[otherId]
            : Object.values(conversation.participantAvatars || {})[0];
          const displayName = conversation.participantNames?.join(', ') || 'Conversation';
          const chatHref = `/app/messages/${conversation.id}`;
          return (
            <div key={conversation.id} className="flex items-center gap-3 rounded-[20px] bg-white p-3">
              <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                <ProfileUserLink
                  viewerUserId={user?.id}
                  subjectUserId={otherId || undefined}
                  className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Avatar src={avatarSrc} name={conversation.participantNames?.[0] || 'Committed member'} />
                </ProfileUserLink>
              </span>
              <div
                role="button"
                tabIndex={0}
                onClick={() => router.push(chatHref)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  router.push(chatHref);
                }}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[14px] active:opacity-90"
              >
                <div className="min-w-0 flex-1">
                  <span className="block min-w-0" onClick={(event) => event.stopPropagation()}>
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={otherId || undefined} className="block min-w-0">
                      <p className="truncate font-black text-slate-950 hover:underline">{displayName}</p>
                    </ProfileUserLink>
                  </span>
                  <p className="truncate text-sm text-slate-500">{conversation.last_message || 'Open chat'}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-400">{timeAgo(conversation.last_message_at || conversation.created_at)}</span>
              </div>
              <Send className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </div>
          );
        })}
      </div>
    );
  };

  /** Visible + console proof of avatar pipeline (dev or NEXT_PUBLIC_DEBUG_AVATAR=1). */
  const renderAvatarHardDebugPanel = () => {
    if (!isAvatarHardDebugEnabled()) return null;
    const rawDb = debugUsersRowProfilePicture;
    const merged = user?.profile_picture ?? null;
    const staged = settingsProfilePictureUrl.trim() || null;
    const pipelineLabel = staged
      ? 'settings local (staged)'
      : merged
        ? 'merged user.profile_picture'
        : rawDb
          ? 'last users row only'
          : '(none)';
    const pickRaw = (staged || merged || rawDb || '').trim();
    const staticResolved = pickRaw ? resolveProfilePictureUrl(pickRaw) : null;
    const clientResolved = supabase && pickRaw ? resolveProfilePictureUrlWithSupabase(supabase, pickRaw) : null;
    const forcedSrc = (clientResolved || staticResolved || pickRaw || '').trim();

    let getPublicLine = '';
    if (supabase && pickRaw && !/^https?:\/\//i.test(pickRaw)) {
      const { bucket, objectPath } = profilePictureStorageKeyToBucketAndPath(pickRaw);
      const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      getPublicLine = `storage.from("${bucket}").getPublicUrl("${objectPath}") → ${data.publicUrl}`;
    } else {
      getPublicLine = pickRaw
        ? /^https?:\/\//i.test(pickRaw)
          ? 'Skipped getPublicUrl (value already looks like absolute URL)'
          : 'Skipped getPublicUrl (no supabase client)'
        : 'No raw value to transform';
    }

    return (
      <section className="rounded-[22px] border-2 border-amber-400 bg-amber-50 p-4 text-left text-xs text-amber-950">
        <p className="mb-2 font-black uppercase tracking-wide text-amber-900">Avatar hard debug</p>
        <p className="mb-1 break-all">
          <span className="font-black">Pipeline source:</span> {pipelineLabel}
        </p>
        <p className="mb-1 break-all">
          <span className="font-black">1. RAW users.profile_picture (last fetch):</span> {JSON.stringify(rawDb)}
        </p>
        <p className="mb-1 break-all">
          <span className="font-black">2. RAW profile.avatar_url:</span> not selected — DB column is{' '}
          <code className="rounded bg-amber-200 px-1">profile_picture</code> (see PROFILE OBJECT log)
        </p>
        <p className="mb-1 break-all">
          <span className="font-black">3. Merged shell user.profile_picture:</span> {JSON.stringify(merged)}
        </p>
        <p className="mb-1 break-all">
          <span className="font-black">4. resolveProfilePictureUrl (static):</span> {JSON.stringify(staticResolved)}
        </p>
        <p className="mb-1 break-all">
          <span className="font-black">5. resolveProfilePictureUrlWithSupabase:</span> {JSON.stringify(clientResolved)}
        </p>
        <p className="mb-2 break-all font-mono text-[11px]">{getPublicLine}</p>
        <p className="mb-1 font-black">6. Forced plain &lt;img&gt; (100×100, no Avatar / no next/image):</p>
        {forcedSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={forcedSrc}
              alt="hard-debug"
              width={100}
              height={100}
              style={{ width: 100, height: 100 }}
              className="rounded border border-amber-800 object-cover"
              onLoad={() => console.log('[HARD DEBUG] forced img onLoad:', forcedSrc)}
              onError={() =>
                console.warn('[HARD DEBUG] forced img onError — check Network tab for HTTP status:', forcedSrc)
              }
            />
            <p className="mt-2 break-all">
              <span className="font-black">Final URL string:</span> {forcedSrc}
            </p>
            <a href={forcedSrc} target="_blank" rel="noreferrer" className="mt-1 inline-block font-black text-blue-800 underline">
              Open final URL in new tab
            </a>
          </>
        ) : (
          <p className="font-black text-rose-800">No URL to render — DB and merged avatar fields are empty.</p>
        )}
        <p className="mt-3 text-[11px] leading-snug text-amber-900">
          Enable on staging: set <code className="rounded bg-amber-200 px-1">NEXT_PUBLIC_DEBUG_AVATAR=1</code> and redeploy. Compare with
          mobile console for the same user id.
        </p>
      </section>
    );
  };

  const renderProfile = () => (
    <div className="px-4 py-4">
      <section className="rounded-[28px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto w-fit">
          <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="inline-block rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
            <Avatar src={shellAvatarSrc} name={getUserDisplayName(shellAvatarNameUser)} size="lg" />
          </ProfileUserLink>
        </div>
        <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="mt-4 inline-block">
          <h2 className="text-2xl font-black text-slate-950 hover:underline">{getUserDisplayName(user)}</h2>
        </ProfileUserLink>
        <p className="text-sm text-slate-500">{user?.username ? `@${user.username}` : user?.email}</p>
        <div className="mt-4 flex justify-center gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{user?.role || 'user'}</span>
          {user?.verified ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">Verified</span> : null}
        </div>
      </section>
      {renderAvatarHardDebugPanel()}
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
      {renderAvatarHardDebugPanel()}
      <section className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <ProfileUserLink viewerUserId={user?.id} subjectUserId={user?.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
            <Avatar src={settingsProfilePictureUrl || shellAvatarSrc} name={getUserDisplayName(shellAvatarNameUser)} size="lg" />
          </ProfileUserLink>
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
        <input type="file" accept="image/*" className="hidden" onChange={(event) => void handleProfilePhotoUpload(event)} />
      </label>
      {settingsProfilePictureUrl ? (
        <img
          src={
            supabase
              ? resolveProfilePictureUrlWithSupabase(supabase, settingsProfilePictureUrl) ||
                resolveProfilePictureUrl(settingsProfilePictureUrl) ||
                settingsProfilePictureUrl
              : resolveProfilePictureUrl(settingsProfilePictureUrl) || settingsProfilePictureUrl
          }
          alt="Profile photo preview"
          className="max-h-[220px] w-full rounded-[18px] object-cover"
        />
      ) : null}
      <FormField label="Full name" value={settingsForm.fullName} onChange={(fullName) => setSettingsForm((prev) => ({ ...prev, fullName }))} />
      <FormField label="Username" value={settingsForm.username} onChange={(username) => setSettingsForm((prev) => ({ ...prev, username }))} placeholder="Optional" />
      <FormField label="Phone number" value={settingsForm.phoneNumber} onChange={(phoneNumber) => setSettingsForm((prev) => ({ ...prev, phoneNumber }))} />
      <FormField
        label="Email address"
        value={settingsForm.email}
        onChange={() => {}}
        readOnly
        hint="Same as mobile: sign-in email is managed in your account provider; this field is read-only here."
      />
      <FormField
        label="Gender (optional)"
        value={settingsForm.gender}
        onChange={(gender) => setSettingsForm((prev) => ({ ...prev, gender }))}
        placeholder="Male, Female, Other"
      />
      <FormField
        label="Date of birth (optional)"
        value={settingsForm.dateOfBirth}
        onChange={(dateOfBirth) => setSettingsForm((prev) => ({ ...prev, dateOfBirth }))}
        placeholder="YYYY-MM-DD"
      />
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
        <label className="mt-3 block text-sm font-black text-slate-700">
          Profile visibility
          <select value={privacySettings.profileVisibility} onChange={(event) => setPrivacySettings((prev) => ({ ...prev, profileVisibility: event.target.value }))} className="mt-2 w-full rounded-[16px] border border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500">
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="verified-only">Verified only</option>
          </select>
        </label>
        <div className="mt-3 grid gap-2">
          {[
            ['searchVisibility', 'Show me in search'],
            ['allowSearchByPhone', 'Allow search by phone'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean((privacySettings as any)[key])}
                onChange={(event) => setPrivacySettings((prev) => ({ ...prev, [key]: event.target.checked }))}
                className="h-5 w-5 accent-blue-600"
              />
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">Notifications</p>
        <div className="mt-3 grid gap-2">
          {[
            ['relationshipUpdates', 'Relationship updates'],
            ['cheatingAlerts', 'Integrity alerts'],
            ['verificationAttempts', 'Verification updates'],
            ['anniversaryReminders', 'Anniversary reminders'],
            ['marketingPromotions', 'Marketing and promotions'],
            ['soundEnabled', 'Notification sound'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={Boolean((notificationSettings as any)[key])}
                onChange={(event) => setNotificationSettings((prev) => ({ ...prev, [key]: event.target.checked }))}
                className="h-5 w-5 accent-blue-600"
              />
            </label>
          ))}
        </div>
      </section>
      <section className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-900">Security shortcuts</p>
        <div className="mt-3 grid gap-2">
          <Link href="/app/settings/2fa" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Two-factor authentication</Link>
          <Link href="/app/settings/sessions" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Sessions</Link>
          <Link href="/app/settings/blocked-users" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Blocked users</Link>
          <Link href="/app/verification" className="rounded-[14px] bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Status & privacy controls</Link>
        </div>
      </section>
      <button
        type="button"
        onClick={() => void saveSettings()}
        disabled={saving || uploadingLabel === 'Profile photo'}
        className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 text-base font-black text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        Save changes
      </button>
      <button
        type="button"
        onClick={() => void signOutWebUser()}
        className="w-full rounded-[20px] bg-red-50 py-4 text-base font-black text-red-600 ring-1 ring-red-100"
      >
        Sign out
      </button>
      <button
        type="button"
        onClick={() => void deleteWebAccount()}
        disabled={deletingAccount}
        className="w-full rounded-[20px] bg-red-600 py-4 text-base font-black text-white shadow-lg shadow-red-600/20 disabled:opacity-60"
      >
        {deletingAccount ? 'Deleting account...' : 'Delete Account'}
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
              <ProfileUserLink viewerUserId={user?.id} subjectUserId={row.blocked_id || row.users?.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                <Avatar src={row.users?.profile_picture} name={row.users?.full_name || row.users?.email} />
              </ProfileUserLink>
              <div className="min-w-0 flex-1">
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={row.blocked_id || row.users?.id} className="block min-w-0">
                  <p className="truncate font-black text-slate-950 hover:underline">{row.users?.full_name || 'Blocked member'}</p>
                </ProfileUserLink>
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
          <button type="button" onClick={() => void signOutWebUser()} className="w-full rounded-[20px] bg-red-50 py-4 font-black text-red-600 ring-1 ring-red-100">Sign out of this device</button>
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
          {idVerificationDocument ? (
            <section className={`rounded-[22px] p-4 shadow-sm ring-1 ${
              idVerificationDocument.status === 'approved'
                ? 'bg-emerald-50 ring-emerald-100'
                : idVerificationDocument.status === 'rejected'
                  ? 'bg-red-50 ring-red-100'
                  : 'bg-amber-50 ring-amber-100'
            }`}>
              <div className="flex items-start gap-3">
                {idVerificationDocument.status === 'approved'
                  ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
                  : idVerificationDocument.status === 'rejected'
                    ? <X className="h-7 w-7 shrink-0 text-red-600" />
                    : <Clock className="h-7 w-7 shrink-0 text-amber-600" />}
                <div>
                  <p className="font-black text-slate-950">
                    {idVerificationDocument.status === 'approved'
                      ? 'Verification Approved'
                      : idVerificationDocument.status === 'rejected'
                        ? 'Verification Rejected'
                        : 'Verification Pending'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {idVerificationDocument.status === 'approved'
                      ? `Approved: ${idVerificationDocument.reviewed_at ? new Date(idVerificationDocument.reviewed_at).toLocaleDateString() : 'N/A'}`
                      : idVerificationDocument.status === 'rejected'
                        ? `Rejected: ${idVerificationDocument.reviewed_at ? new Date(idVerificationDocument.reviewed_at).toLocaleDateString() : 'N/A'}`
                        : `Submitted: ${idVerificationDocument.submitted_at ? new Date(idVerificationDocument.submitted_at).toLocaleDateString() : 'recently'}`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {idVerificationDocument.status === 'approved'
                      ? 'Your identity has been verified successfully.'
                      : idVerificationDocument.status === 'rejected'
                        ? (idVerificationDocument.rejection_reason || 'Please upload a clearer government-issued ID and submit again.')
                        : "Your ID is under review. We'll notify you once it has been processed."}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
          {idVerificationDocument?.status !== 'pending' && idVerificationDocument?.status !== 'approved' ? (
            <>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm">
                <UploadCloud className="h-5 w-5 text-blue-600" />
                {uploadingLabel === 'ID document' ? 'Uploading document...' : idVerificationDocument?.status === 'rejected' ? 'Upload a new ID document' : 'Upload ID document'}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => void handleFileUpload(event, 'verification', 'ID document', (documentUrl) => setVerificationForm((prev) => ({ ...prev, documentUrl })))} />
              </label>
              <FormField label="Document URL" value={verificationForm.documentUrl} onChange={(documentUrl) => setVerificationForm((prev) => ({ ...prev, documentUrl }))} placeholder="https://..." />
              <button type="button" onClick={() => void submitIdVerification()} disabled={saving || !verificationForm.documentUrl.trim()} className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-blue-600 py-4 font-black text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                {idVerificationDocument?.status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
              </button>
            </>
          ) : null}
        </div>
      );
    }
    if (method === 'couple-selfie') {
      const selectedRelationship = routeRelationship || relationship;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-gradient-to-br from-pink-500 to-blue-600 p-5 text-white shadow-xl shadow-pink-500/20">
            <Camera className="h-10 w-10" />
            <h2 className="mt-4 text-3xl font-black">Couple Selfie</h2>
            <p className="mt-2 text-sm leading-6 text-white/85">Upload a couple selfie or paste a hosted URL for the same certificate verification flow used on mobile.</p>
          </section>
          {routeRelationshipLoading ? <ScreenSkeleton /> : null}
          {!routeRelationshipLoading && selectedRelationship?.id ? (
            <>
              <div className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-black text-slate-950">{selectedRelationship.partner_name || 'Your relationship'}</p>
                <p className="mt-1 text-sm text-slate-500">Status: {selectedRelationship.status || 'pending'}</p>
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
          ) : !routeRelationshipLoading ? (
            <EmptyState icon={Heart} title="No Relationship Found" text="Register or verify a relationship before submitting a couple selfie." action="Register Relationship" onAction={() => router.push('/app/relationship/register')} />
          ) : null}
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
    const isAdminAdsView = appPath[0] === 'admin' && subPath === 'advertisements' && isAdminRole(user?.role);
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
              <p className="mt-1 text-sm text-slate-500">{receipt.advertisements?.title || 'Advertisement'} - {receipt.currency || 'USD'} {Number(receipt.amount || 0).toFixed(2)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{receipt.issued_at ? new Date(receipt.issued_at).toLocaleDateString() : 'Issued receipt'} - {receipt.advertisements?.placement || 'Ad placement'}</p>
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
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Amount</span><span className="font-black">{receipt.currency || 'USD'} {Number(receipt.amount || 0).toFixed(2)}</span></div>
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Campaign</span><span className="font-black">{receipt.advertisements?.title || 'Advertisement'}</span></div>
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Placement</span><span className="font-black">{receipt.advertisements?.placement || 'Ad'}</span></div>
            <div className="flex justify-between border-b border-slate-100 py-3"><span className="font-bold text-slate-500">Issued</span><span className="font-black">{receipt.issued_at ? new Date(receipt.issued_at).toLocaleString() : 'Issued'}</span></div>
            <div className="flex justify-between py-3"><span className="font-bold text-slate-500">Status</span><span className="font-black uppercase">{receipt.advertisements?.billing_status || receipt.status || 'paid'}</span></div>
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
          <FormField label="Messenger Page/User ID" value={adForm.ctaMessengerId} onChange={(ctaMessengerId) => setAdForm((prev) => ({ ...prev, ctaMessengerId }))} placeholder="Optional" />
          <FormField label="Template message" value={adForm.ctaMessage} onChange={(ctaMessage) => setAdForm((prev) => ({ ...prev, ctaMessage }))} multiline placeholder="Optional" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Daily budget" value={adForm.dailyBudget} onChange={(dailyBudget) => setAdForm((prev) => ({ ...prev, dailyBudget }))} inputMode="decimal" />
            <FormField label="Total budget" value={adForm.totalBudget} onChange={(totalBudget) => setAdForm((prev) => ({ ...prev, totalBudget }))} inputMode="decimal" />
          </div>
          <FormField label="Target locations" value={adForm.locations} onChange={(locations) => setAdForm((prev) => ({ ...prev, locations }))} placeholder="Cities or countries" />
          <FormField label="Interests / keywords" value={adForm.interests} onChange={(interests) => setAdForm((prev) => ({ ...prev, interests }))} placeholder="relationship, dating, counselling..." />
          <label className="block text-sm font-black text-slate-700">
            Target gender
            <select value={adForm.gender} onChange={(event) => setAdForm((prev) => ({ ...prev, gender: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500">
              <option value="any">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="block text-sm font-black text-slate-700">
            Placement
            <select value={adForm.placement} onChange={(event) => setAdForm((prev) => ({ ...prev, placement: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-semibold outline-none focus:border-blue-500">
              <option value="feed">Feed</option>
              <option value="reels">Reels</option>
              <option value="messages">Messages</option>
              <option value="all">All</option>
            </select>
          </label>
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
          <h2 className="mt-3 text-2xl font-black text-slate-950">{isAdminAdsView ? 'Manage Advertisements' : 'My Ads'}</h2>
          <p className="mt-2 text-sm text-slate-500">{isAdminAdsView ? 'Review creative, billing, performance, and campaign state.' : 'Campaigns and boosted content.'}</p>
          <div className="mt-4 flex gap-2">
            <Link href="/app/ads/promote" className="inline-flex rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">Create Ad</Link>
            <Link href="/app/ads/invoices" className="inline-flex rounded-[18px] bg-slate-100 px-5 py-3 font-black text-slate-700">Invoices</Link>
          </div>
        </section>
        {!ads.length ? <EmptyState icon={CreditCard} title="No Ads Yet" text="Boost a post, reel, or create a standalone ad." /> : null}
        {ads.map((ad) => {
          const receipt = adReceipts.find((item) => item.advertisement_id === ad.id);
          const impressions = Number(ad.impressions || 0);
          const clicks = Number(ad.clicks || 0);
          const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
          const isPaused = ad.status === 'paused';
          const nextStatus = isPaused ? (ad.billing_status === 'paid' ? 'approved' : 'pending') : 'paused';
          return (
          <article key={ad.id} className="overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-200">
            {ad.image_url ? <img src={ad.image_url} alt={ad.title || 'Advertisement'} className="h-48 w-full object-cover" /> : null}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{ad.title || 'Advertisement'}</p>
                  <p className="mt-1 text-xs font-black uppercase tracking-wide text-slate-400">{ad.placement || 'feed'} - {ad.type || 'card'}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{ad.status || 'draft'}</span>
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">{ad.billing_status || 'unpaid'}</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{ad.description || 'No description set.'}</p>
              {ad.rejection_reason ? <p className="mt-2 rounded-[14px] bg-red-50 px-3 py-2 text-sm font-bold text-red-600">Rejected: {ad.rejection_reason}</p> : null}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-[16px] bg-slate-50 p-3 text-center">
                  <p className="text-lg font-black text-slate-950">{impressions}</p>
                  <p className="text-xs font-semibold text-slate-400">Impressions</p>
                </div>
                <div className="rounded-[16px] bg-slate-50 p-3 text-center">
                  <p className="text-lg font-black text-slate-950">{clicks}</p>
                  <p className="text-xs font-semibold text-slate-400">Clicks</p>
                </div>
                <div className="rounded-[16px] bg-slate-50 p-3 text-center">
                  <p className="text-lg font-black text-slate-950">{ctr}%</p>
                  <p className="text-xs font-semibold text-slate-400">CTR</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                <span>Spend ${Number(ad.spend || 0).toFixed(2)}</span>
                <span>Budget ${Number(ad.daily_budget || 0).toFixed(2)}/day</span>
                {ad.engagementSummary ? <span>{ad.engagementSummary.likes || 0} likes - {ad.engagementSummary.comments || 0} comments - {ad.engagementSummary.shares || 0} shares</span> : null}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-500">{getAdSuggestion(ad)}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void openAdvertisementCta(ad)} className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white">View CTA</button>
                {receipt ? <button type="button" onClick={() => router.push(`/app/ads/receipt?receiptId=${receipt.id}`)} className="rounded-[16px] bg-slate-100 py-3 text-sm font-black text-slate-700">Receipt</button> : null}
                <button type="button" onClick={() => void updateAdvertisementStatus(ad, nextStatus)} disabled={saving} className="rounded-[16px] bg-slate-100 py-3 text-sm font-black text-slate-700 disabled:opacity-50">{isPaused ? 'Resume' : 'Pause'}</button>
                <button type="button" onClick={() => router.push(`/app/ads/promote?adId=${ad.id}`)} className="rounded-[16px] bg-slate-100 py-3 text-sm font-black text-slate-700">Edit</button>
                <button type="button" onClick={() => void deleteAdvertisement(ad)} disabled={saving} className="rounded-[16px] bg-red-50 py-3 text-sm font-black text-red-600 disabled:opacity-50">Delete</button>
              </div>
              {isAdminAdsView ? (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => void updateAdminAdvertisement(ad, 'approve')} disabled={saving || ad.status === 'approved'} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-40">Approve Creative</button>
                  <button type="button" onClick={() => void updateAdminAdvertisement(ad, 'reject')} disabled={saving || ad.status === 'rejected'} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-40">Reject</button>
                  <button type="button" onClick={() => void updateAdminAdvertisement(ad, 'mark_paid')} disabled={saving || ad.billing_status === 'paid'} className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-40">Mark Paid</button>
                  <button type="button" onClick={() => void updateAdminAdvertisement(ad, 'mark_unpaid')} disabled={saving || ad.billing_status === 'unpaid'} className="rounded-[16px] bg-slate-900 py-3 text-sm font-black text-white disabled:opacity-40">Mark Unpaid</button>
                </div>
              ) : null}
            </div>
          </article>
          );
        })}
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
    const isProfessionalView = appPath[0] === 'professional';
    const sourceBookings = isProfessionalView ? professionalBookings : bookings;
    const now = new Date();
    const filteredBookings = sourceBookings.filter((booking) => {
      if (bookingFilter === 'all') return true;
      const scheduled = booking.scheduled_date ? new Date(booking.scheduled_date) : null;
      const isPast = !scheduled || scheduled < now || booking.status === 'completed' || booking.status === 'cancelled';
      return bookingFilter === 'past' ? isPast : !isPast;
    });
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Calendar className="h-9 w-9 text-blue-600" />
          <h2 className="mt-3 text-2xl font-black text-slate-950">{isProfessionalView ? 'My Bookings' : 'Bookings'}</h2>
          <p className="mt-2 text-sm text-slate-500">{isProfessionalView ? 'Confirm, complete, reschedule, cancel, and message your professional sessions.' : 'Professional sessions, requests, and reschedules.'}</p>
          {!isProfessionalView ? <Link href="/app/bookings/create" className="mt-4 inline-flex rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white">Create Booking</Link> : null}
        </section>
        <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-white p-2 ring-1 ring-slate-200">
          {(['upcoming', 'past', 'all'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setBookingFilter(filter)}
              className={`rounded-[16px] py-3 text-sm font-black capitalize ${bookingFilter === filter ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
            >
              {filter}
            </button>
          ))}
        </div>
        {!filteredBookings.length ? <EmptyState icon={Calendar} title="No Bookings Found" text={bookingFilter === 'upcoming' ? "You don't have any upcoming bookings." : bookingFilter === 'past' ? "You don't have any past bookings." : 'Your professional sessions will appear here.'} /> : null}
        {filteredBookings.map((booking) => {
          const scheduled = booking.scheduled_date ? new Date(booking.scheduled_date) : null;
          const isUpcoming = !!scheduled && scheduled >= now;
          const canConfirm = isProfessionalView && booking.status === 'scheduled' && isUpcoming;
          const canComplete = isProfessionalView && booking.status === 'confirmed' && isUpcoming;
          const canReschedule = isUpcoming && booking.status !== 'cancelled' && booking.status !== 'completed';
          const canCancel = isUpcoming && booking.status !== 'cancelled' && booking.status !== 'completed';
          const bookingClientId = booking.user_id || booking.user?.id;
          const professionalUserId = booking.professional?.user_id || booking.professional?.pro_user?.id;
          const professionalPic = booking.professional?.pro_user?.profile_picture;
          const professionalLabel =
            booking.professional?.pro_user?.full_name || booking.professional?.full_name || booking.topic || booking.session_type || 'Professional';
          return (
          <article key={booking.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              {isProfessionalView && bookingClientId ? (
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={bookingClientId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Avatar src={booking.user?.profile_picture} name={booking.user?.full_name || 'Client'} />
                </ProfileUserLink>
              ) : isProfessionalView ? (
                <Avatar src={booking.user?.profile_picture} name={booking.user?.full_name || 'Client'} />
              ) : professionalUserId ? (
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={professionalUserId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Avatar src={professionalPic} name={professionalLabel} />
                </ProfileUserLink>
              ) : !isProfessionalView ? (
                <Avatar src={professionalPic} name={professionalLabel} />
              ) : null}
              <div className="min-w-0 flex-1">
                {isProfessionalView && bookingClientId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={bookingClientId} className="inline-block min-w-0">
                    <p className="truncate text-lg font-black text-slate-950 hover:underline">{booking.user?.full_name || 'Client'}</p>
                  </ProfileUserLink>
                ) : !isProfessionalView && professionalUserId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={professionalUserId} className="inline-block min-w-0">
                    <p className="truncate text-lg font-black text-slate-950 hover:underline">{professionalLabel}</p>
                  </ProfileUserLink>
                ) : (
                  <p className="text-lg font-black text-slate-950">{isProfessionalView ? (booking.user?.full_name || 'Client') : (booking.professional?.full_name || booking.topic || booking.session_type || 'Professional session')}</p>
                )}
                <p className="mt-1 text-sm font-semibold text-slate-500">{booking.role?.name || booking.session_type || 'Professional session'}</p>
              </div>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">{booking.scheduled_date ? new Date(booking.scheduled_date).toLocaleString() : 'Time not scheduled'}</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <p>{booking.scheduled_duration_minutes || 60} minutes - {String(booking.location_type || 'online').replace(/_/g, ' ')}</p>
              {booking.location_address ? <p>{booking.location_address}</p> : null}
              {booking.location_notes ? <p className="rounded-[14px] bg-slate-50 p-3">{booking.location_notes}</p> : null}
              {booking.booking_notes ? <p className="rounded-[14px] bg-slate-50 p-3">{booking.booking_notes}</p> : null}
              {booking.booking_fee_amount ? <p className="font-black text-blue-700">{booking.booking_fee_currency || 'USD'} {Number(booking.booking_fee_amount).toFixed(2)}</p> : null}
            </div>
            <span className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{booking.status || 'pending'}</span>
            <div className="mt-4 flex flex-wrap gap-2">
              {booking.conversation_id ? <button type="button" onClick={() => router.push(`/app/messages/${booking.conversation_id}`)} className="rounded-[14px] bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">Message</button> : null}
              {canConfirm ? <button type="button" onClick={() => void updateBookingStatus(booking, 'confirm', 'professional')} disabled={saving} className="rounded-[14px] bg-emerald-500 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Confirm</button> : null}
              {canComplete ? <button type="button" onClick={() => void updateBookingStatus(booking, 'complete', 'professional')} disabled={saving} className="rounded-[14px] bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Complete</button> : null}
              {canReschedule ? <Link href={`/app/bookings/reschedule?sessionId=${booking.id}`} className="rounded-[14px] bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">Reschedule</Link> : null}
              {canCancel ? <button type="button" onClick={() => void updateBookingStatus(booking, 'cancel', isProfessionalView ? 'professional' : 'user')} disabled={saving} className="rounded-[14px] bg-red-50 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-50">Cancel</button> : null}
            </div>
          </article>
          );
        })}
      </div>
    );
  };

  const renderProfessionalRoute = () => {
    if (subPath === 'reviews') {
      const averageRating = Number(professionalProfile?.rating_average || 0);
      const ratingCount = Number(professionalProfile?.rating_count || 0);
      const reviewCount = Number(professionalProfile?.review_count || professionalReviews.length || 0);
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <Star className="h-9 w-9 fill-amber-400 text-amber-400" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">My Reviews</h2>
            <p className="mt-2 text-sm text-slate-500">Approved client ratings from your completed sessions.</p>
          </section>
          {professionalProfile ? (
            <section className="grid grid-cols-3 gap-2 rounded-[24px] bg-white p-4 text-center shadow-sm ring-1 ring-slate-200">
              <div className="rounded-[18px] bg-amber-50 p-3">
                <p className="text-xs font-black uppercase text-amber-700">Average</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{averageRating ? averageRating.toFixed(1) : '0.0'}</p>
              </div>
              <div className="rounded-[18px] bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">Ratings</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{ratingCount}</p>
              </div>
              <div className="rounded-[18px] bg-slate-50 p-3">
                <p className="text-xs font-black uppercase text-slate-500">Reviews</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{reviewCount}</p>
              </div>
            </section>
          ) : null}
          {!professionalReviews.length ? <EmptyState icon={Star} title="No Reviews Yet" text="Reviews from completed sessions will appear here." /> : null}
          {professionalReviews.map((review) => {
            const clientId = !review.is_anonymous ? review.client_id || review.client?.id : null;
            return (
            <article key={review.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                {clientId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={clientId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={review.client?.profile_picture} name={review.client?.full_name} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={review.is_anonymous ? null : review.client?.profile_picture} name={review.is_anonymous ? 'Anonymous' : review.client?.full_name} />
                )}
                <div>
                  {clientId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={clientId} className="block min-w-0">
                      <p className="truncate font-black text-slate-950 hover:underline">{review.client?.full_name || 'Client'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="font-black text-slate-950">{review.is_anonymous ? 'Anonymous client' : review.client?.full_name || 'Client'}</p>
                  )}
                  <p className="text-xs font-semibold text-slate-400">{review.session?.created_at ? new Date(review.session.created_at).toLocaleDateString() : timeAgo(review.created_at)}</p>
                </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className={`h-4 w-4 ${star <= Number(review.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{review.review_text || 'No written review.'}</p>
            </article>
            );
          })}
        </div>
      );
    }
    if (subPath === 'session-requests') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <MessageCircle className="h-9 w-9 text-blue-600" />
            <h2 className="mt-3 text-2xl font-black text-slate-950">Session Requests</h2>
            <p className="mt-2 text-sm text-slate-500">Accept or decline pending professional requests assigned to you.</p>
          </section>
          {!professionalProfile ? <EmptyState icon={Briefcase} title="Not a Professional" text="You need an approved professional profile to receive session requests." action="Apply" onAction={() => router.push('/app/settings/become-professional')} /> : null}
          {professionalProfile && !professionalSessionRequests.length ? <EmptyState icon={MessageCircle} title="No Pending Requests" text="New session requests will appear here." /> : null}
          {professionalSessionRequests.map((request) => {
            const requesterId = request.user_id || request.user?.id;
            return (
            <article key={request.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                {requesterId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={requesterId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={request.user?.profile_picture} name={request.user?.full_name || 'Member'} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={request.user?.profile_picture} name={request.user?.full_name || 'Member'} />
                )}
                <div className="min-w-0 flex-1">
                  {requesterId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={requesterId} className="block min-w-0">
                      <p className="truncate font-black text-slate-950 hover:underline">{request.user?.full_name || 'New session request'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="truncate font-black text-slate-950">{request.user?.full_name || 'New session request'}</p>
                  )}
                  <p className="text-sm font-semibold text-slate-500">{request.role?.name || 'Professional help'} - {request.created_at ? timeAgo(request.created_at) : 'recent'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">Pending</span>
              </div>
              {request.ai_summary ? <p className="mt-3 rounded-[16px] bg-blue-50 p-3 text-sm leading-6 text-blue-900">{request.ai_summary}</p> : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateProfessionalSessionRequest(request, 'decline')} disabled={saving} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Decline</button>
                <button type="button" onClick={() => void updateProfessionalSessionRequest(request, 'accept')} disabled={saving} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Accept</button>
              </div>
            </article>
            );
          })}
        </div>
      );
    }
    if (subPath === 'bookings') {
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
    const rel = routeRelationship || (relationship?.id === relationshipId || !relationshipId ? relationship : null);
    const isAnniversary = appPath[0] === 'anniversary';
    if (routeRelationshipLoading) return <ScreenSkeleton />;
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
        {!isAnniversary && rel.status === 'verified' ? (
          routeCertificate ? (
            <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                <div>
                  <p className="font-black text-slate-950">Official Couple Certificate</p>
                  <p className="mt-1 text-sm text-slate-500">Issued {routeCertificate.issued_at ? new Date(routeCertificate.issued_at).toLocaleDateString() : 'recently'}</p>
                </div>
              </div>
              {routeCertificate.verification_selfie_url ? <img src={routeCertificate.verification_selfie_url} alt="Couple selfie" className="mt-4 max-h-[360px] w-full rounded-[18px] object-cover" /> : null}
              {routeCertificate.certificate_url ? (
                <a href={routeCertificate.certificate_url} target="_blank" rel="noreferrer" className="mt-4 block rounded-[18px] bg-blue-600 py-3 text-center text-sm font-black text-white">Open certificate</a>
              ) : null}
            </section>
          ) : (
            <section className="rounded-[24px] bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <Shield className="mx-auto h-12 w-12 text-blue-600" />
              <p className="mt-3 text-xl font-black text-slate-950">No Certificate Yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Complete couple selfie verification to generate your official certificate.</p>
              <button type="button" onClick={() => router.push(`/app/verification/couple-selfie?relationshipId=${rel.id}`)} className="mt-4 w-full rounded-[18px] bg-blue-600 py-3 text-sm font-black text-white">Start Verification</button>
            </section>
          )
        ) : null}
      </div>
    );
  };

  const renderUserProfileRoute = () => {
    const rawSegment = appPath[1];
    if (!rawSegment) return renderProfile();
    const routeIdentifier = decodeURIComponent(rawSegment);
    if (routeProfileLoading) return <ScreenSkeleton />;
    /** Prefer `routeProfileUser` whenever it matches the URL — it has full `users` flags (phone/email/id verified). Shell `user` can be incomplete after auth merge. */
    const profileSubjectId = routeProfileUser?.id || routeIdentifier;
    const related =
      (routeProfileUser && (routeProfileUser.id === profileSubjectId || routeProfileUser.username === routeIdentifier.replace(/^@/, '')) ? routeProfileUser : null) ||
      (profileSubjectId === user?.id ? user : null) ||
      datingLikes.find((item) => item.user?.id === profileSubjectId)?.user ||
      datingMatches.find((item) => item.user?.id === profileSubjectId)?.user ||
      null;
    if (!related) return <EmptyState icon={User} title="Profile Not Found" text="This profile is not loaded yet." action="Back" onAction={() => router.back()} />;
    const isSelf = profileSubjectId === user?.id;
    /** Always use profile-route fetch (same as mobile): feed `posts`/`reels` are capped and can omit reel `thumbnail_url` shapes the grid expects. */
    const relatedPosts = routeProfilePosts;
    const relatedReels = routeProfileReels;
    const showSocial = !!user && !isSelf;
    const postsCount = routeProfilePostsTotal;
    void profilePresenceTick;
    /** Own profile while logged in: show online even if `user_status` / last_active is stale (web session is active). */
    const presence = isSelf ? 'online' : getEffectiveProfilePresence(routeProfileStatusType, routeProfileLastActiveAt);
    const presenceDotClass =
      presence === 'online'
        ? 'bg-emerald-500'
        : presence === 'away'
          ? 'bg-amber-400'
          : presence === 'busy'
            ? 'bg-rose-500'
            : 'bg-slate-300';
    const presenceTitle =
      presence === 'online' ? 'Online' : presence === 'away' ? 'Away' : presence === 'busy' ? 'Busy' : 'Offline';
    const rel = routeProfileRelationship;
    const relVerified = rel?.status === 'verified';

    return (
      <div className="space-y-4 px-4 py-4">
        <section className="rounded-[28px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <div className="relative mx-auto w-fit">
            <ProfileUserLink
              viewerUserId={user?.id}
              subjectUserId={profileSubjectId}
              subjectUsername={related.username}
              className="inline-block rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Avatar src={related.profile_picture} name={getUserDisplayName(related)} size="lg" />
            </ProfileUserLink>
            <span
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${presenceDotClass}`}
              title={presenceTitle}
              aria-hidden
            />
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <ProfileUserLink viewerUserId={user?.id} subjectUserId={profileSubjectId} subjectUsername={related.username} className="inline-block">
              <h2 className="text-3xl font-black text-slate-950 hover:underline">{getUserDisplayName(related)}</h2>
            </ProfileUserLink>
            {related.phone_verified ? <CheckCircle2 className="h-6 w-6 shrink-0 text-blue-500" aria-label="Phone verified" /> : null}
          </div>
          {related.username ? <p className="mt-1 text-sm text-slate-500">@{related.username}</p> : null}

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-[18px] bg-slate-50 py-3 ring-1 ring-slate-100">
              <p className="text-xl font-black text-slate-950">{postsCount}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Posts</p>
            </div>
            <div className="rounded-[18px] bg-slate-50 py-3 ring-1 ring-slate-100">
              <p className="text-xl font-black text-slate-950">{routeProfileFollowers}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Followers</p>
            </div>
            <div className="rounded-[18px] bg-slate-50 py-3 ring-1 ring-slate-100">
              <p className="text-xl font-black text-slate-950">{routeProfileFollowingCount}</p>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Following</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {related.phone_verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Phone Verified</span>
            ) : null}
            {related.email_verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">Email Verified</span>
            ) : null}
            {related.id_verified ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">ID Verified</span>
            ) : null}
          </div>
        </section>

        {isSelf ? (
          <Link href="/app/messages" className="block rounded-[20px] bg-blue-600 py-4 text-center font-black text-white">
            Messages
          </Link>
        ) : showSocial ? (
          routeProfileIsBlocked ? (
            <div className="rounded-[20px] bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-700 ring-1 ring-slate-200">You have blocked this user</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={routeProfileFollowBusy}
                onClick={() => void toggleProfileRouteFollow(profileSubjectId)}
                className={`flex items-center justify-center gap-2 rounded-[20px] py-4 text-center text-sm font-black ${
                  routeProfileIsFollowing ? 'bg-slate-200 text-slate-800' : 'bg-blue-600 text-white'
                } disabled:opacity-60`}
              >
                {routeProfileIsFollowing ? <UserMinus className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                {routeProfileIsFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button
                type="button"
                onClick={() => void openConversationWithUser(profileSubjectId)}
                className="flex items-center justify-center gap-2 rounded-[20px] border border-blue-200 bg-white py-4 text-center text-sm font-black text-blue-600"
              >
                <MessageCircle className="h-5 w-5" />
                Message
              </button>
            </div>
          )
        ) : null}

        {showSocial ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void toggleProfileRouteBlock(profileSubjectId)}
              className={`rounded-[18px] py-3 text-sm font-black ${routeProfileIsBlocked ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-100'}`}
            >
              {routeProfileIsBlocked ? 'Unblock' : 'Block'}
            </button>
            <button
              type="button"
              onClick={() => setReportProfileTarget({ id: profileSubjectId, name: getUserDisplayName(related) })}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-slate-200 bg-white py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200"
            >
              <Flag className="h-4 w-4" />
              Report
            </button>
          </div>
        ) : null}

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 fill-rose-500 text-rose-500" />
            <h3 className="text-base font-black text-slate-950">Relationship Status</h3>
          </div>
          {rel ? (
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
                  <span className="font-semibold text-slate-900">In a {relationshipTypeLabel(rel.type)}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="font-bold text-slate-500">Partner</span>
                  <span className="truncate font-semibold text-slate-900">{rel.partner_name || '—'}</span>
                </div>
                <div className="flex justify-between gap-3 border-b border-slate-100 py-2">
                  <span className="font-bold text-slate-500">Since</span>
                  <span className="font-semibold text-slate-900">
                    {rel.start_date ? new Date(rel.start_date).toLocaleDateString() : '—'}
                  </span>
                </div>
                {relVerified && rel.verified_date ? (
                  <div className="flex justify-between gap-3 py-2">
                    <span className="font-bold text-slate-500">Verified On</span>
                    <span className="font-semibold text-slate-900">{new Date(rel.verified_date).toLocaleDateString()}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center py-2 text-slate-400">
              <Heart className="h-12 w-12" strokeWidth={1.25} />
              <p className="mt-3 text-sm font-bold text-slate-500">No registered relationship</p>
              {isSelf ? (
                <>
                  <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-slate-500">
                    Registering your relationship creates a foundation of trust and transparency.
                  </p>
                  <Link
                    href="/app/relationship/register"
                    className="mt-4 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-[18px] bg-blue-600 px-5 py-3 font-black text-white"
                  >
                    <Plus className="h-5 w-5" />
                    Register relationship
                  </Link>
                </>
              ) : null}
            </div>
          )}
        </section>

        {rel && relVerified ? (
          <section className="flex gap-3 rounded-[20px] bg-emerald-50/80 p-4 ring-1 ring-emerald-100">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-xs font-semibold leading-relaxed text-emerald-900">
              This relationship has been verified by both partners. The information shown is accurate as of the verification date.
            </p>
          </section>
        ) : null}

        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setRouteProfileTab('posts')}
            className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-3 text-sm font-black ${
              routeProfileTab === 'posts' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400'
            }`}
          >
            <Grid className="h-5 w-5" />
            Posts
          </button>
          <button
            type="button"
            onClick={() => setRouteProfileTab('reels')}
            className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-3 text-sm font-black ${
              routeProfileTab === 'reels' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400'
            }`}
          >
            <Film className="h-5 w-5" />
            Reels
          </button>
        </div>

        {routeProfileTab === 'posts' ? (
          <section>
            {!relatedPosts.length ? (
              <div className="flex flex-col items-center rounded-[22px] bg-white py-12 text-slate-400 shadow-sm ring-1 ring-slate-200">
                <Grid className="h-12 w-12" strokeWidth={1.25} />
                <p className="mt-3 text-sm font-bold text-slate-500">No posts yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {relatedPosts.map((post) => {
                  const raw = Array.isArray(post.media_urls) && post.media_urls[0] ? String(post.media_urls[0]) : '';
                  const thumb = raw ? resolveProfilePictureUrl(raw) || raw : '';
                  return (
                    <Link
                      key={post.id}
                      href={`/app/post/${post.id}`}
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
            {!relatedReels.length ? (
              <div className="flex flex-col items-center rounded-[22px] bg-white py-12 text-slate-400 shadow-sm ring-1 ring-slate-200">
                <Film className="h-12 w-12" strokeWidth={1.25} />
                <p className="mt-3 text-sm font-bold text-slate-500">No reels yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {relatedReels.map((reel) => {
                  const thumbUrl = resolveReelThumbnailUrl(reel.thumbnail_url);
                  const videoSrc = resolveReelVideoUrl(reel.video_url);
                  return (
                  <Link key={reel.id} href={`/app/reel/${reel.id}`} className="relative aspect-[9/16] overflow-hidden rounded-lg bg-slate-900 ring-1 ring-slate-200">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                    ) : videoSrc ? (
                      <video
                        src={videoSrc}
                        className="pointer-events-none h-full w-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] font-black text-white">Reel</div>
                    )}
                    {reel.caption ? (
                      <p className="absolute inset-x-0 bottom-0 line-clamp-2 bg-black/55 px-1 py-1 text-[9px] font-semibold text-white">{reel.caption}</p>
                    ) : null}
                  </Link>
                );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    );
  };

  const filteredAdminUsers = useMemo(() => {
    const q = adminUsersSearchQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter((member) => {
      const name = (member.full_name || '').toLowerCase();
      const email = (member.email || '').toLowerCase();
      const phone = (member.phone_number || '').toLowerCase();
      const un = (member.username || '').toLowerCase();
      const id = (member.id || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q) || un.includes(q) || id.includes(q);
    });
  }, [adminUsers, adminUsersSearchQuery]);

  const filteredAdminRelationships = useMemo(() => {
    const q = adminRelationshipsSearch.trim().toLowerCase();
    if (!q) return adminRelationships;
    return adminRelationships.filter((rel: any) => {
      const owner = `${rel.users?.full_name || ''} ${rel.users?.email || ''} ${rel.users?.phone_number || ''}`.toLowerCase();
      const partner = `${rel.partner_name || ''} ${rel.partner_phone || ''}`.toLowerCase();
      const ids = `${rel.id || ''} ${rel.user_id || ''} ${rel.partner_user_id || ''}`.toLowerCase();
      return owner.includes(q) || partner.includes(q) || ids.includes(q);
    });
  }, [adminRelationships, adminRelationshipsSearch]);

  const filteredAdminProfessionalReviews = useMemo(() => {
    let rows = adminProfessionalReviews;
    if (adminProfessionalReviewsFilter !== 'all') {
      rows = rows.filter((r: any) => (r.moderation_status || 'pending') === adminProfessionalReviewsFilter);
    }
    const q = adminProfessionalReviewsSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((review: any) => {
      const client = `${review.client?.full_name || ''} ${review.client?.email || ''}`.toLowerCase();
      const pro = `${review.professional?.full_name || ''} ${review.professional?.pro_user?.full_name || ''}`.toLowerCase();
      const text = `${review.review_text || ''} ${review.id || ''}`.toLowerCase();
      return client.includes(q) || pro.includes(q) || text.includes(q);
    });
  }, [adminProfessionalReviews, adminProfessionalReviewsFilter, adminProfessionalReviewsSearch]);

  const renderAdminRoute = () => {
    if (!user || !isAdminRole(user.role)) {
      return <EmptyState icon={Shield} title="Admin Only" text="This area is only visible to admins and moderators." />;
    }
    if (subPath === 'relationships') {
      const relSearchOn = adminRelationshipsSearch.trim().length > 0;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Heart className="h-10 w-10 fill-pink-500 text-pink-500" />
            <h2 className="mt-4 text-3xl font-black">Manage Relationships</h2>
            <p className="mt-2 text-sm text-slate-300">
              {relSearchOn
                ? `${filteredAdminRelationships.length} match${filteredAdminRelationships.length === 1 ? '' : 'es'} · ${adminRelationships.length} loaded (max ${ADMIN_WEB_LIMIT_RELATIONSHIPS})`
                : `${adminRelationships.length} relationship${adminRelationships.length === 1 ? '' : 's'} loaded (max ${ADMIN_WEB_LIMIT_RELATIONSHIPS})`}
            </p>
          </section>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminRelationshipsSearch}
              onChange={(event) => setAdminRelationshipsSearch(event.target.value)}
              placeholder="Search owner, partner, phone, email, or ids…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search relationships"
            />
          </div>
          {relSearchOn && adminRelationships.length > 0 && filteredAdminRelationships.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No relationships match that search.</p>
          ) : null}
          {filteredAdminRelationships.map((rel) => {
            const relOwnerId = rel.user_id || rel.users?.id;
            return (
            <article key={rel.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {relOwnerId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={relOwnerId} className="inline-block min-w-0">
                      <p className="truncate text-lg font-black text-slate-950 hover:underline">{rel.users?.full_name || 'Member'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="text-lg font-black text-slate-950">{rel.users?.full_name || 'Member'}</p>
                  )}
                  <p className="text-sm text-slate-500">
                    with{' '}
                    {rel.partner_user_id ? (
                      <ProfileUserLink viewerUserId={user?.id} subjectUserId={rel.partner_user_id} className="inline font-semibold text-slate-700 hover:underline">
                        {rel.partner_name || rel.partner_phone || 'Partner'}
                      </ProfileUserLink>
                    ) : (
                      <span>{rel.partner_name || rel.partner_phone || 'Partner'}</span>
                    )}
                  </p>
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
            );
          })}
        </div>
      );
    }
    if (subPath === 'users') {
      const searchActive = adminUsersSearchQuery.trim().length > 0;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <User className="h-10 w-10 text-pink-400" />
            <h2 className="mt-4 text-3xl font-black">Manage Users</h2>
            <p className="mt-2 text-sm text-slate-300">
              {searchActive
                ? `${filteredAdminUsers.length} match${filteredAdminUsers.length === 1 ? '' : 'es'} · ${adminUsers.length} loaded (max ${ADMIN_WEB_LIMIT_USERS})`
                : `${adminUsers.length} user${adminUsers.length === 1 ? '' : 's'} loaded (synced batch, max ${ADMIN_WEB_LIMIT_USERS})`}
            </p>
          </section>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminUsersSearchQuery}
              onChange={(event) => setAdminUsersSearchQuery(event.target.value)}
              placeholder="Search name, email, @username, phone, or user id…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search users"
            />
          </div>
          {searchActive && adminUsers.length > 0 && filteredAdminUsers.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No users match that search.</p>
          ) : null}
          {filteredAdminUsers.map((member) => (
            <article key={member.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex gap-3">
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={member.id} subjectUsername={member.username} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Avatar src={member.profile_picture} name={member.full_name || member.email} />
                </ProfileUserLink>
                <div className="min-w-0 flex-1">
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={member.id} subjectUsername={member.username} className="block min-w-0">
                    <p className="truncate font-black text-slate-950 hover:underline">{member.full_name || 'Member'}</p>
                  </ProfileUserLink>
                  <p className="truncate text-sm text-slate-500">{member.email}</p>
                  {member.username ? <p className="truncate text-sm text-slate-500">@{member.username}</p> : null}
                  {member.phone_number ? <p className="truncate text-sm text-slate-500">{member.phone_number}</p> : null}
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
                  <Link
                    href={webAppProfileHref(user?.id, member.id) ?? `/app/profile/${encodeURIComponent(member.id)}`}
                    className="rounded-[16px] bg-blue-50 py-3 text-center text-sm font-black text-blue-700"
                  >
                    View
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'posts-review' || subPath === 'reels-review') {
      const isPosts = subPath === 'posts-review';
      const modFilters: AdminContentModerationFilter[] = ['all', 'pending', 'approved', 'rejected', 'resubmit'];
      const baseRows = isPosts ? adminPosts : adminReels;
      const searchRaw = (isPosts ? adminPostsReviewSearch : adminReelsReviewSearch).trim().toLowerCase();
      const rows = !searchRaw
        ? baseRows
        : baseRows.filter((row: any) => {
            const author = `${row.users?.full_name || ''} ${row.users?.username || ''} ${row.user_id || ''}`.toLowerCase();
            const body = `${row.content || row.caption || ''} ${row.id || ''}`.toLowerCase();
            return author.includes(searchRaw) || body.includes(searchRaw);
          });
      const activeFilter = isPosts ? adminPostsReviewFilter : adminReelsReviewFilter;
      const setFilter = isPosts ? setAdminPostsReviewFilter : setAdminReelsReviewFilter;
      const reviewLoading = isPosts ? adminPostsReviewLoading : adminReelsReviewLoading;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            {isPosts ? <Heart className="h-10 w-10 text-pink-400" /> : <Film className="h-10 w-10 text-blue-300" />}
            <h2 className="mt-4 text-3xl font-black">{isPosts ? 'Posts Review' : 'Reels Review'}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Filter by moderation status (same as mobile). Up to {ADMIN_WEB_LIMIT_CONTENT} newest in the selected status.
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center sm:grid-cols-4">
              {(['pending', 'approved', 'rejected', 'resubmit'] as const).map((key) => (
                <div key={key} className="rounded-[16px] bg-white/10 p-2">
                  <p className="text-lg font-black">{baseRows.filter((r: any) => (r.moderation_status || 'pending') === key).length}</p>
                  <p className="text-[10px] font-black uppercase text-slate-300">{key}</p>
                </div>
              ))}
            </div>
          </section>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {modFilters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black capitalize ring-1 ${activeFilter === f ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={isPosts ? adminPostsReviewSearch : adminReelsReviewSearch}
              onChange={(event) => (isPosts ? setAdminPostsReviewSearch : setAdminReelsReviewSearch)(event.target.value)}
              placeholder="Search author name, @username, user id, or caption…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label={isPosts ? 'Search posts queue' : 'Search reels queue'}
            />
          </div>
          {reviewLoading ? <ScreenSkeleton /> : null}
          {!reviewLoading && searchRaw && baseRows.length > 0 && rows.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No items match that search.</p>
          ) : null}
          {!reviewLoading && !rows.length && !searchRaw ? (
            <EmptyState icon={isPosts ? Heart : Film} title="No Items" text={`No ${isPosts ? 'posts' : 'reels'} in this moderation filter.`} />
          ) : null}
          {rows.map((row) => {
            const authorId = row.user_id || row.users?.id;
            const reviewReelThumb = resolveReelThumbnailUrl(row.thumbnail_url);
            return (
            <article key={row.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                {authorId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={authorId} subjectUsername={row.users?.username} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={row.users?.profile_picture} name={row.users?.full_name} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={row.users?.profile_picture} name={row.users?.full_name} />
                )}
                <div className="min-w-0 flex-1">
                  {authorId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={authorId} subjectUsername={row.users?.username} className="block min-w-0">
                      <p className="truncate font-black text-slate-950 hover:underline">{row.users?.full_name || 'Member'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="truncate font-black text-slate-950">{row.users?.full_name || 'Member'}</p>
                  )}
                  <p className="truncate text-sm text-slate-600">{isPosts ? row.content : row.caption}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">{row.moderation_status || 'pending'}</span>
              </div>
              {isPosts && Array.isArray(row.media_urls) && row.media_urls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveProfilePictureUrl(String(row.media_urls[0])) || String(row.media_urls[0])}
                  alt=""
                  className="mt-3 max-h-56 w-full rounded-[18px] object-cover"
                />
              ) : !isPosts && reviewReelThumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reviewReelThumb} alt="" className="mt-3 max-h-56 w-full rounded-[18px] object-cover" />
              ) : !isPosts && resolveReelVideoUrl(row.video_url) ? (
                <video
                  src={resolveReelVideoUrl(row.video_url)}
                  className="mt-3 max-h-56 w-full rounded-[18px] object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              ) : null}
              {(row.moderation_reason || row.rejection_reason) ? (
                <p className="mt-2 rounded-[14px] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  {row.moderation_reason || row.rejection_reason}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateModeration(isPosts ? 'posts' : 'reels', row.id, 'approved')} disabled={saving || row.moderation_status === 'approved'} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Approve</button>
                <button type="button" onClick={() => void updateModeration(isPosts ? 'posts' : 'reels', row.id, 'rejected')} disabled={saving || row.moderation_status === 'rejected'} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Reject</button>
              </div>
            </article>
            );
          })}
        </div>
      );
    }
    if (subPath === 'professional-profiles') {
      const pq = adminProfessionalApplicationsSearch.trim().toLowerCase();
      const profApps = !pq
        ? professionalApplications
        : professionalApplications.filter((app: any) => {
            const u = `${app.user?.full_name || ''} ${app.user?.email || ''}`.toLowerCase();
            const role = `${app.role?.name || ''} ${app.application_data?.role || ''}`.toLowerCase();
            return u.includes(pq) || role.includes(pq) || String(app.id || '').toLowerCase().includes(pq);
          });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Briefcase className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Applications</h2>
            <p className="mt-2 text-sm text-slate-300">Approve or reject professional requests.</p>
          </section>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminProfessionalApplicationsSearch}
              onChange={(event) => setAdminProfessionalApplicationsSearch(event.target.value)}
              placeholder="Search applicant name, email, or role…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search professional applications"
            />
          </div>
          {pq && professionalApplications.length > 0 && profApps.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No applications match that search.</p>
          ) : null}
          {profApps.map((app) => {
            const applicantId = app.user_id || app.user?.id;
            return (
            <article key={app.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                {applicantId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={applicantId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={app.user?.profile_picture} name={app.user?.full_name} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={app.user?.profile_picture} name={app.user?.full_name} />
                )}
                <div className="min-w-0 flex-1">
                  {applicantId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={applicantId} className="block min-w-0">
                      <p className="truncate text-lg font-black text-slate-950 hover:underline">{app.user?.full_name || 'Applicant'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="truncate text-lg font-black text-slate-950">{app.user?.full_name || 'Applicant'}</p>
                  )}
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
            );
          })}
        </div>
      );
    }
    if (subPath === 'false-relationship-reports') {
      const falseStatuses: AdminFalseReportStatusFilter[] = ['all', 'pending', 'reviewing', 'resolved', 'dismissed'];
      const falseSearch = adminFalseReportsSearch.trim().toLowerCase();
      const falseRows = !falseSearch
        ? falseRelationshipReports
        : falseRelationshipReports.filter((report: any) => {
            const partner = `${report.relationship?.partner_name || ''} ${report.relationship?.partner_phone || ''}`.toLowerCase();
            const reporter = `${report.reporter?.full_name || ''} ${report.reporter?.email || ''}`.toLowerCase();
            const text = `${report.reason || ''} ${report.id || ''}`.toLowerCase();
            return partner.includes(falseSearch) || reporter.includes(falseSearch) || text.includes(falseSearch);
          });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-pink-400" />
            <h2 className="mt-4 text-3xl font-black">False Relationship Reports</h2>
            <p className="mt-2 text-sm text-slate-300">Reports do not hide relationships automatically. Admin decides the final action.</p>
          </section>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {falseStatuses.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setAdminFalseReportsFilter(st)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black capitalize ring-1 ${adminFalseReportsFilter === st ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminFalseReportsSearch}
              onChange={(event) => setAdminFalseReportsSearch(event.target.value)}
              placeholder="Search partner, reporter, reason…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search false relationship reports"
            />
          </div>
          {adminFalseReportsLoading ? <ScreenSkeleton /> : null}
          {!adminFalseReportsLoading && falseSearch && falseRelationshipReports.length > 0 && falseRows.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No reports match that search.</p>
          ) : null}
          {!adminFalseReportsLoading && !falseRows.length && !falseSearch ? (
            <EmptyState icon={Shield} title="No Reports" text="No false relationship reports in this status." />
          ) : null}
          {falseRows.map((report) => (
            <article key={report.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{report.relationship?.partner_name || 'Relationship report'}</p>
                  <p className="text-sm text-slate-500">Reported by {report.reporter?.full_name || report.reporter?.email || 'member'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-700">{report.status}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{report.reason || report.resolution || 'No details supplied.'}</p>
              {Array.isArray(report.evidence_urls) && report.evidence_urls.length ? (
                <p className="mt-2 text-xs font-semibold text-slate-500">{report.evidence_urls.length} evidence file(s)</p>
              ) : null}
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
    if (subPath === 'payment-methods') {
      const paymentTypes = [
        ['bank_transfer', 'Bank Transfer'],
        ['mobile_money', 'Mobile Money'],
        ['cash', 'Cash Payment'],
        ['crypto', 'Cryptocurrency'],
        ['other', 'Other'],
      ];
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <CreditCard className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Payment Methods</h2>
            <p className="mt-2 text-sm text-slate-300">Manage the same manual payment methods shown in mobile subscription and ad payment flows.</p>
          </section>
          <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">{paymentMethodForm.id ? 'Edit payment method' : 'Add payment method'}</p>
            <FormField label="Name" value={paymentMethodForm.name} onChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, name: value }))} placeholder="Bank Transfer" />
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Payment type</span>
              <select value={paymentMethodForm.paymentType} onChange={(event) => setPaymentMethodForm((prev) => ({ ...prev, paymentType: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                {paymentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <FormField label="Description" value={paymentMethodForm.description} onChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, description: value }))} placeholder="Short payment method description" multiline />
            <FormField label="Account details JSON" value={paymentMethodForm.accountDetails} onChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, accountDetails: value }))} placeholder='{"account_number":"123"}' multiline />
            <FormField label="Instructions" value={paymentMethodForm.instructions} onChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, instructions: value }))} placeholder="Step-by-step payment instructions" multiline />
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <FormField label="Order" value={paymentMethodForm.displayOrder} onChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, displayOrder: value }))} inputMode="numeric" />
              <FormField label="Icon" value={paymentMethodForm.iconEmoji} onChange={(value) => setPaymentMethodForm((prev) => ({ ...prev, iconEmoji: value }))} placeholder="*" />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
              <span className="font-black text-slate-700">Active</span>
              <input type="checkbox" checked={paymentMethodForm.isActive} onChange={(event) => setPaymentMethodForm((prev) => ({ ...prev, isActive: event.target.checked }))} className="h-5 w-5 accent-blue-600" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethodForm.id ? (
                <button type="button" onClick={() => setPaymentMethodForm({ id: '', name: '', description: '', paymentType: 'bank_transfer', accountDetails: '', instructions: '', displayOrder: '0', iconEmoji: '', isActive: true })} className="rounded-[18px] bg-slate-100 py-3 font-black text-slate-700">Cancel</button>
              ) : null}
              <button type="button" onClick={() => void savePaymentMethod()} disabled={saving} className={`${paymentMethodForm.id ? '' : 'col-span-2'} flex h-12 items-center justify-center gap-2 rounded-[18px] bg-blue-600 font-black text-white disabled:opacity-50`}>
                <Save className="h-5 w-5" /> {paymentMethodForm.id ? 'Save Method' : 'Create Method'}
              </button>
            </div>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={CreditCard} title="No Payment Methods" text={routeRowsError || 'No payment methods are configured.'} /> : null}
          {routeRows.map((method) => (
            <article key={method.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{method.icon_emoji ? `${method.icon_emoji} ` : ''}{method.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{method.payment_type} - order {method.display_order ?? 0}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${method.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{method.is_active ? 'active' : 'inactive'}</span>
              </div>
              {method.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{method.description}</p> : null}
              {method.account_details && Object.keys(method.account_details).length ? (
                <pre className="mt-3 overflow-x-auto rounded-[16px] bg-slate-50 p-3 text-xs font-semibold text-slate-600">{JSON.stringify(method.account_details, null, 2)}</pre>
              ) : null}
              {method.instructions ? <p className="mt-3 rounded-[16px] bg-blue-50 p-3 text-xs font-semibold text-blue-800">{method.instructions}</p> : null}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => editPaymentMethod(method)} disabled={saving} className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">Edit</button>
                <button type="button" onClick={() => void updatePaymentMethodConfig(method, 'toggle')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${method.is_active ? 'bg-amber-500' : 'bg-emerald-500'}`}>{method.is_active ? 'Off' : 'On'}</button>
                <button type="button" onClick={() => void updatePaymentMethodConfig(method, 'delete')} disabled={saving} className="rounded-[16px] bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">Delete</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'trigger-words') {
      const categories = ['romantic', 'intimate', 'suspicious', 'meetup', 'secret', 'general'];
      const severities = ['low', 'medium', 'high'];
      const activeWords = routeRows.filter((word) => word.active);
      const inactiveWords = routeRows.filter((word) => !word.active);
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-amber-300" />
            <h2 className="mt-4 text-3xl font-black">Trigger Words</h2>
            <p className="mt-2 text-sm text-slate-300">Manage the same phrases mobile uses for relationship safety warnings.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[18px] bg-white/10 p-3"><p className="text-xl font-black">{activeWords.length}</p><p className="text-xs text-slate-300">Active</p></div>
              <div className="rounded-[18px] bg-white/10 p-3"><p className="text-xl font-black">{inactiveWords.length}</p><p className="text-xs text-slate-300">Inactive</p></div>
              <div className="rounded-[18px] bg-white/10 p-3"><p className="text-xl font-black">{routeRows.length}</p><p className="text-xs text-slate-300">Total</p></div>
            </div>
          </section>
          <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">{triggerWordForm.id ? 'Edit trigger word' : 'Add trigger word'}</p>
            <FormField label="Word or phrase" value={triggerWordForm.wordPhrase} onChange={(value) => setTriggerWordForm((prev) => ({ ...prev, wordPhrase: value }))} placeholder="secret meeting" />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Severity</span>
                <select value={triggerWordForm.severity} onChange={(event) => setTriggerWordForm((prev) => ({ ...prev, severity: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  {severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Category</span>
                <select value={triggerWordForm.category} onChange={(event) => setTriggerWordForm((prev) => ({ ...prev, category: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
              <span className="font-black text-slate-700">Active</span>
              <input type="checkbox" checked={triggerWordForm.active} onChange={(event) => setTriggerWordForm((prev) => ({ ...prev, active: event.target.checked }))} className="h-5 w-5 accent-blue-600" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {triggerWordForm.id ? (
                <button type="button" onClick={() => setTriggerWordForm({ id: '', wordPhrase: '', severity: 'low', category: 'general', active: true })} className="rounded-[18px] bg-slate-100 py-3 font-black text-slate-700">Cancel</button>
              ) : null}
              <button type="button" onClick={() => void saveTriggerWord()} disabled={saving} className={`${triggerWordForm.id ? '' : 'col-span-2'} flex h-12 items-center justify-center gap-2 rounded-[18px] bg-blue-600 font-black text-white disabled:opacity-50`}>
                <Save className="h-5 w-5" /> {triggerWordForm.id ? 'Save Word' : 'Add Word'}
              </button>
            </div>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Shield} title="No Trigger Words" text={routeRowsError || 'No trigger words are configured.'} /> : null}
          {categories.map((category) => {
            const words = routeRows.filter((word) => word.category === category);
            if (!words.length) return null;
            return (
              <section key={category} className="space-y-2">
                <p className="px-1 text-sm font-black uppercase text-slate-500">{category}</p>
                {words.map((word) => (
                  <article key={word.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{word.word_phrase}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{word.severity} severity</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${word.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{word.active ? 'active' : 'inactive'}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => editTriggerWord(word)} disabled={saving} className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">Edit</button>
                      <button type="button" onClick={() => void updateTriggerWordConfig(word, 'toggle')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${word.active ? 'bg-amber-500' : 'bg-emerald-500'}`}>{word.active ? 'Off' : 'On'}</button>
                      <button type="button" onClick={() => void updateTriggerWordConfig(word, 'delete')} disabled={saving} className="rounded-[16px] bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">Delete</button>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      );
    }
    if (subPath === 'warning-templates') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <FileText className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Warning Templates</h2>
            <p className="mt-2 text-sm text-slate-300">Edit the same warning copy mobile uses for detected trigger words. Variables: {'{trigger_words}'} and {'{severity}'}.</p>
          </section>
          {warningTemplateForm.id ? (
            <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">Edit {routeRows.find((row) => row.id === warningTemplateForm.id)?.severity || ''} template</p>
              <FormField label="Notification title template" value={warningTemplateForm.titleTemplate} onChange={(value) => setWarningTemplateForm((prev) => ({ ...prev, titleTemplate: value }))} multiline />
              <FormField label="Notification message template" value={warningTemplateForm.messageTemplate} onChange={(value) => setWarningTemplateForm((prev) => ({ ...prev, messageTemplate: value }))} multiline />
              <FormField label="In-chat warning template" value={warningTemplateForm.inChatWarningTemplate} onChange={(value) => setWarningTemplateForm((prev) => ({ ...prev, inChatWarningTemplate: value }))} multiline />
              <FormField label="Description" value={warningTemplateForm.description} onChange={(value) => setWarningTemplateForm((prev) => ({ ...prev, description: value }))} multiline />
              <label className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
                <span className="font-black text-slate-700">Active</span>
                <input type="checkbox" checked={warningTemplateForm.active} onChange={(event) => setWarningTemplateForm((prev) => ({ ...prev, active: event.target.checked }))} className="h-5 w-5 accent-blue-600" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setWarningTemplateForm({ id: '', titleTemplate: '', messageTemplate: '', inChatWarningTemplate: '', description: '', active: true })} className="rounded-[18px] bg-slate-100 py-3 font-black text-slate-700">Cancel</button>
                <button type="button" onClick={() => void saveWarningTemplate()} disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-blue-600 font-black text-white disabled:opacity-50">
                  <Save className="h-5 w-5" /> Save Template
                </button>
              </div>
            </section>
          ) : null}
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={FileText} title="No Templates" text={routeRowsError || 'No warning templates are configured.'} /> : null}
          {routeRows.map((template) => (
            <article key={template.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">{String(template.severity || 'warning').toUpperCase()} Risk</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{template.description || 'Reusable warning template'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${template.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{template.active ? 'active' : 'inactive'}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p><span className="font-black text-slate-800">Title:</span> {template.title_template}</p>
                <p><span className="font-black text-slate-800">Message:</span> {template.message_template}</p>
                <p><span className="font-black text-slate-800">Chat:</span> {template.in_chat_warning_template}</p>
              </div>
              <button type="button" onClick={() => editWarningTemplate(template)} disabled={saving} className="mt-4 w-full rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">Edit Template</button>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'payment-verifications') {
      const payStatuses: AdminPaymentStatusFilter[] = ['all', 'pending', 'approved', 'rejected'];
      const paySearch = adminPaymentVerificationSearch.trim().toLowerCase();
      const payRows = !paySearch
        ? paymentSubmissions
        : paymentSubmissions.filter((payment: any) => {
            const u = `${payment.user?.full_name || ''} ${payment.user?.email || ''}`.toLowerCase();
            const meta = `${payment.transaction_reference || ''} ${payment.amount || ''} ${payment.id || ''}`.toLowerCase();
            return u.includes(paySearch) || meta.includes(paySearch);
          });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <CreditCard className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Payment Verifications</h2>
            <p className="mt-2 text-sm text-slate-300">Subscriptions vs ad payments and status filters match the mobile admin queue.</p>
          </section>
          <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-white p-2 shadow-sm ring-1 ring-slate-200">
            {(['subscriptions', 'ads'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAdminPaymentVerificationType(t)}
                className={`rounded-[16px] py-3 text-xs font-black capitalize ${adminPaymentVerificationType === t ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {t === 'subscriptions' ? 'Subscriptions' : 'Ads'}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {payStatuses.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setAdminPaymentVerificationStatus(st)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black capitalize ring-1 ${adminPaymentVerificationStatus === st ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminPaymentVerificationSearch}
              onChange={(event) => setAdminPaymentVerificationSearch(event.target.value)}
              placeholder="Search payer name, email, reference, or amount…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search payment submissions"
            />
          </div>
          {adminPaymentQueueLoading ? <ScreenSkeleton /> : null}
          {!adminPaymentQueueLoading && paySearch && paymentSubmissions.length > 0 && payRows.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No payments match that search.</p>
          ) : null}
          {!adminPaymentQueueLoading && !payRows.length && !paySearch ? (
            <EmptyState icon={CreditCard} title="No Payments" text="No payment submissions for this type and status." />
          ) : null}
          {payRows.map((payment) => {
            const payerId = payment.user_id || payment.user?.id;
            return (
            <article key={payment.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                {payerId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={payerId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={payment.user?.profile_picture} name={payment.user?.full_name || payment.user?.email || 'Member'} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={payment.user?.profile_picture} name={payment.user?.full_name || payment.user?.email || 'Member'} />
                )}
                <div className="min-w-0 flex-1">
                  {payerId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={payerId} className="block min-w-0">
                      <p className="truncate text-lg font-black text-slate-950 hover:underline">{payment.user?.full_name || payment.user?.email || 'Payment'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="truncate text-lg font-black text-slate-950">{payment.user?.full_name || payment.user?.email || 'Payment'}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    {[payment.transaction_reference, payment.currency ? `${payment.amount} ${payment.currency}` : payment.amount].filter(Boolean).join(' · ') || 'Payment'}
                  </p>
                  <p className="mt-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${payment.advertisement_id ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'}`}>
                      {payment.advertisement_id ? 'Ad payment' : 'Subscription'}
                    </span>
                  </p>
                </div>
              </div>
              {payment.payment_proof_url ? (
                <Link
                  href={`/app/admin/payment-proof-viewer?imageUrl=${encodeURIComponent(payment.payment_proof_url)}`}
                  className="mt-3 inline-flex rounded-[14px] bg-blue-50 px-4 py-2 text-sm font-black text-blue-700"
                >
                  View proof
                </Link>
              ) : null}
              <span className="mt-3 block rounded-full bg-amber-50 px-3 py-1 text-center text-xs font-black uppercase text-amber-700">{payment.status || 'pending'}</span>
              {payment.status === 'pending' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void updatePaymentSubmission(payment, 'approved')} disabled={saving} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => void updatePaymentSubmission(payment, 'rejected')} disabled={saving} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Reject</button>
                </div>
              ) : null}
            </article>
            );
          })}
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
      const appealStatuses: Array<typeof adminBanAppealFilter> = ['all', 'pending', 'approved', 'rejected', 'under_review'];
      const byStatus = routeRows.filter((appeal) => adminBanAppealFilter === 'all' || appeal.status === adminBanAppealFilter);
      const aq = adminBanAppealSearch.trim().toLowerCase();
      const filteredAppeals = !aq
        ? byStatus
        : byStatus.filter((appeal: any) => {
            const blob = `${appeal.reason || ''} ${appeal.appeal_type || ''} ${appeal.user_id || ''} ${appeal.admin_response || ''}`.toLowerCase();
            return blob.includes(aq);
          });
      const appealStats = {
        total: routeRows.length,
        pending: routeRows.filter((appeal) => appeal.status === 'pending').length,
        approved: routeRows.filter((appeal) => appeal.status === 'approved').length,
        rejected: routeRows.filter((appeal) => appeal.status === 'rejected').length,
        underReview: routeRows.filter((appeal) => appeal.status === 'under_review').length,
      };
      const appealFeatureLabel = (feature?: string | null) => {
        if (!feature || feature === 'all') return 'All Features';
        const labels: Record<string, string> = {
          posts: 'Posts',
          comments: 'Comments',
          messages: 'Messages',
          reels: 'Reels',
          reel_comments: 'Reel Comments',
        };
        return labels[feature] || feature.replace(/_/g, ' ');
      };
      const handleAppealAction = (appeal: any, action: 'approve' | 'reject') => {
        const defaultMessage = action === 'approve'
          ? 'Appeal approved. The related restriction has been lifted.'
          : 'Appeal rejected after admin review.';
        const response = window.prompt(
          action === 'approve' ? 'Admin response for approval' : 'Admin response for rejection',
          appeal.admin_response || defaultMessage
        );
        if (response === null) return;
        void updateBanAppeal(appeal, action, response);
      };
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-amber-300" />
            <h2 className="mt-4 text-3xl font-black">Ban Appeals</h2>
            <p className="mt-2 text-sm text-slate-300">Approve appeals by lifting the matching restriction, or reject with the restriction still active.</p>
          </section>
          <section className="grid grid-cols-4 gap-2 rounded-[24px] bg-white p-3 text-center shadow-sm ring-1 ring-slate-200">
            {[
              ['Total', appealStats.total, 'text-blue-600'],
              ['Pending', appealStats.pending, 'text-amber-600'],
              ['Approved', appealStats.approved, 'text-emerald-600'],
              ['Rejected', appealStats.rejected, 'text-red-600'],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-[16px] bg-slate-50 p-2">
                <p className={`text-xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] font-black uppercase text-slate-500">{label}</p>
              </div>
            ))}
          </section>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {appealStatuses.map((status) => (
              <button key={status} type="button" onClick={() => setAdminBanAppealFilter(status)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black capitalize shadow-sm ring-1 ${adminBanAppealFilter === status ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}>
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminBanAppealSearch}
              onChange={(event) => setAdminBanAppealSearch(event.target.value)}
              placeholder="Search reason, type, user id, admin response…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search ban appeals"
            />
          </div>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !filteredAppeals.length ? <EmptyState icon={Shield} title="No Appeals" text={routeRowsError || 'No ban appeals match this filter.'} /> : null}
          {filteredAppeals.map((appeal) => (
            <article key={appeal.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black capitalize text-slate-950">{String(appeal.appeal_type || 'appeal').replace(/_/g, ' ')}</p>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {appeal.user_id ? (
                      <ProfileUserLink viewerUserId={user?.id} subjectUserId={appeal.user_id} className="font-semibold text-blue-700 hover:underline">
                        <span title={String(appeal.user_id)}>User {String(appeal.user_id).slice(0, 8)}…</span>
                      </ProfileUserLink>
                    ) : (
                      <span>User unknown</span>
                    )}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${appeal.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : appeal.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{appeal.status || 'pending'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{appealFeatureLabel(appeal.restricted_feature)}</span>
                {appeal.restriction_id ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Restriction linked</span> : null}
                {appeal.reviewed_at ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Reviewed {new Date(appeal.reviewed_at).toLocaleDateString()}</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{appeal.reason || 'No appeal reason supplied.'}</p>
              {appeal.admin_response ? <p className="mt-2 rounded-[16px] bg-slate-50 p-3 text-xs font-semibold text-slate-500">{appeal.admin_response}</p> : null}
              {appeal.status === 'pending' || appeal.status === 'under_review' ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleAppealAction(appeal, 'approve')} disabled={saving} className="rounded-[16px] bg-emerald-500 py-3 text-sm font-black text-white disabled:opacity-50">Approve</button>
                  <button type="button" onClick={() => handleAppealAction(appeal, 'reject')} disabled={saving} className="rounded-[16px] bg-red-500 py-3 text-sm font-black text-white disabled:opacity-50">Reject</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'dating') {
      const datingAdminSearchQ = adminDatingProfileSearch.trim().toLowerCase();
      const datingAdminFilteredRows = !datingAdminSearchQ
        ? routeRows
        : routeRows.filter((profile: any) => {
            const blob = [
              profile.user_id,
              profile.id,
              profile.users?.full_name,
              profile.users?.email,
              profile.location_city,
              profile.location_country,
              profile.bio,
              profile.users?.id,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return blob.includes(datingAdminSearchQ);
          });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Heart className="h-10 w-10 fill-pink-500 text-pink-500" />
            <h2 className="mt-4 text-3xl font-black">Dating Admin</h2>
            <p className="mt-2 text-sm text-slate-300">Manage profile safety, visibility, premium trials, and trust badges.</p>
          </section>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminDatingProfileSearch}
              onChange={(event) => setAdminDatingProfileSearch(event.target.value)}
              placeholder="Search name, email, user id, city…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search dating profiles"
            />
          </div>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Heart} title="No Dating Profiles" text={routeRowsError || 'No dating profiles are available.'} /> : null}
          {!routeRowsLoading && routeRows.length > 0 && !datingAdminFilteredRows.length ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-600 ring-1 ring-slate-200">No profiles match your search.</p>
          ) : null}
          {datingAdminFilteredRows.map((profile) => {
            const memberId = profile.user_id || profile.users?.id;
            return (
            <article key={profile.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex gap-3">
                {memberId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={memberId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={profile.users?.profile_picture} name={profile.users?.full_name || profile.users?.email || 'Member'} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={profile.users?.profile_picture} name={profile.users?.full_name || profile.users?.email || 'Member'} />
                )}
                <div className="min-w-0 flex-1">
                  {memberId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={memberId} className="block min-w-0">
                      <p className="truncate font-black text-slate-950 hover:underline">{profile.users?.full_name || profile.users?.email || 'Dating member'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="truncate font-black text-slate-950">{profile.users?.full_name || profile.users?.email || 'Dating member'}</p>
                  )}
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
            );
          })}
        </div>
      );
    }
    if (subPath === 'dating-interests') {
      const categories = Array.from(new Set(routeRows.map((row) => row.category).filter(Boolean)));
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Heart className="h-10 w-10 fill-pink-500 text-pink-500" />
            <h2 className="mt-4 text-3xl font-black">Dating Interests</h2>
            <p className="mt-2 text-sm text-slate-300">Manage the same interest chips members choose from in the dating profile setup.</p>
          </section>
          <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">Add interest</p>
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <FormField label="Name" value={datingInterestForm.name} onChange={(value) => setDatingInterestForm((prev) => ({ ...prev, name: value }))} placeholder="Photography" />
              <FormField label="Emoji" value={datingInterestForm.icon} onChange={(value) => setDatingInterestForm((prev) => ({ ...prev, icon: value }))} placeholder="*" />
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Category</span>
              <select value={datingInterestForm.category} onChange={(event) => setDatingInterestForm((prev) => ({ ...prev, category: event.target.value }))} className="h-14 w-full rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                {['hobbies', 'sports', 'music', 'entertainment', 'food', 'travel', 'arts', 'tech', 'lifestyle', 'social', 'other', ...categories.filter((cat) => !['hobbies', 'sports', 'music', 'entertainment', 'food', 'travel', 'arts', 'tech', 'lifestyle', 'social', 'other'].includes(cat))].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void createDatingInterest()} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-blue-600 font-black text-white disabled:opacity-50">
              <Plus className="h-5 w-5" /> Add Interest
            </button>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Heart} title="No Interests" text={routeRowsError || 'No dating interests are configured.'} /> : null}
          {routeRows.map((interest) => (
            <article key={interest.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{interest.icon_emoji ? `${interest.icon_emoji} ` : ''}{interest.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{interest.category || 'uncategorized'} - order {interest.display_order ?? 0}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${interest.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{interest.is_active ? 'active' : 'inactive'}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateDatingInterest(interest, 'toggle')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${interest.is_active ? 'bg-amber-500' : 'bg-emerald-500'}`}>{interest.is_active ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => void updateDatingInterest(interest, 'delete')} disabled={saving} className="rounded-[16px] bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">Delete</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'dating-date-options') {
      const optionTypes = [
        ['dress_code', 'Dress Codes'],
        ['budget_range', 'Budget Ranges'],
        ['expense_handling', 'Expense Handling'],
        ['suggested_activity', 'Suggested Activities'],
        ['date_duration', 'Date Duration'],
        ['group_size', 'Group Size'],
        ['time_of_day', 'Time of Day'],
      ];
      const visibleOptions = routeRows.filter((option) => option.option_type === dateOptionType);
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Calendar className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Date Options</h2>
            <p className="mt-2 text-sm text-slate-300">Manage the exact choices used by the mobile date request flow.</p>
          </section>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {optionTypes.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setDateOptionType(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${dateOptionType === value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">Add option</p>
            <FormField label="Option value" value={dateOptionForm.value} onChange={(value) => setDateOptionForm((prev) => ({ ...prev, value }))} placeholder="casual" />
            <FormField label="Display label" value={dateOptionForm.label} onChange={(value) => setDateOptionForm((prev) => ({ ...prev, label: value }))} placeholder="Casual" />
            <div className="grid grid-cols-[1fr_88px] gap-2">
              <FormField label="Description" value={dateOptionForm.description} onChange={(value) => setDateOptionForm((prev) => ({ ...prev, description: value }))} placeholder="Optional" />
              <FormField label="Order" value={dateOptionForm.order} onChange={(value) => setDateOptionForm((prev) => ({ ...prev, order: value }))} inputMode="numeric" />
            </div>
            <button type="button" onClick={() => void createDateOption()} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-blue-600 font-black text-white disabled:opacity-50">
              <Plus className="h-5 w-5" /> Add Option
            </button>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !visibleOptions.length ? <EmptyState icon={Calendar} title="No Options" text={routeRowsError || 'No options exist for this type.'} /> : null}
          {visibleOptions.map((option) => (
            <article key={option.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{option.display_label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{option.option_value} - order {option.display_order ?? 0}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${option.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{option.is_active ? 'active' : 'inactive'}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void updateDateOption(option, 'toggle')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${option.is_active ? 'bg-amber-500' : 'bg-emerald-500'}`}>{option.is_active ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => void updateDateOption(option, 'delete')} disabled={saving} className="rounded-[16px] bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">Delete</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'professional-roles') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Briefcase className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Roles</h2>
            <p className="mt-2 text-sm text-slate-300">Create and manage the same role rules used by professional onboarding.</p>
          </section>
          <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-black text-slate-950">{professionalRoleForm.id ? 'Edit role' : 'Create role'}</p>
            <FormField label="Name" value={professionalRoleForm.name} onChange={(value) => setProfessionalRoleForm((prev) => ({ ...prev, name: value }))} placeholder="Relationship Therapist" />
            <FormField label="Category" value={professionalRoleForm.category} onChange={(value) => setProfessionalRoleForm((prev) => ({ ...prev, category: value }))} placeholder="Mental Health & Relationships" />
            <FormField label="Description" value={professionalRoleForm.description} onChange={(value) => setProfessionalRoleForm((prev) => ({ ...prev, description: value }))} placeholder="Describe this role" multiline />
            <FormField label="Disclaimer" value={professionalRoleForm.disclaimerText} onChange={(value) => setProfessionalRoleForm((prev) => ({ ...prev, disclaimerText: value }))} placeholder="Role-specific disclaimer" multiline />
            <FormField label="Display order" value={professionalRoleForm.displayOrder} onChange={(value) => setProfessionalRoleForm((prev) => ({ ...prev, displayOrder: value }))} inputMode="numeric" />
            {[
              ['requiresCredentials', 'Requires credentials'],
              ['requiresVerification', 'Requires verification'],
              ['eligibleForLiveChat', 'Eligible for live chat'],
              ['approvalRequired', 'Approval required'],
              ['isActive', 'Active'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-[18px] bg-slate-50 px-4 py-3">
                <span className="font-black text-slate-700">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(professionalRoleForm[key as keyof typeof professionalRoleForm])}
                  onChange={(event) => setProfessionalRoleForm((prev) => ({ ...prev, [key]: event.target.checked }))}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-2">
              {professionalRoleForm.id ? (
                <button type="button" onClick={() => setProfessionalRoleForm({ id: '', name: '', category: '', description: '', disclaimerText: '', displayOrder: '0', requiresCredentials: true, requiresVerification: true, eligibleForLiveChat: true, approvalRequired: true, isActive: true })} className="rounded-[18px] bg-slate-100 py-3 font-black text-slate-700">Cancel</button>
              ) : null}
              <button type="button" onClick={() => void saveProfessionalRole()} disabled={saving} className={`${professionalRoleForm.id ? '' : 'col-span-2'} flex h-12 items-center justify-center gap-2 rounded-[18px] bg-blue-600 font-black text-white disabled:opacity-50`}>
                <Save className="h-5 w-5" /> {professionalRoleForm.id ? 'Save Role' : 'Create Role'}
              </button>
            </div>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Briefcase} title="No Roles" text={routeRowsError || 'No professional roles are configured.'} /> : null}
          {routeRows.map((role) => (
            <article key={role.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">{role.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{role.category} - order {role.display_order ?? 0}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${role.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{role.is_active ? 'active' : 'inactive'}</span>
              </div>
              {role.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{role.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {role.requires_credentials ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Credentials</span> : null}
                {role.requires_verification ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Verification</span> : null}
                {role.eligible_for_live_chat ? <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-700">Live chat</span> : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => editProfessionalRole(role)} disabled={saving} className="rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">Edit</button>
                <button type="button" onClick={() => void updateProfessionalRole(role, 'toggle')} disabled={saving} className={`rounded-[16px] py-3 text-sm font-black text-white disabled:opacity-50 ${role.is_active ? 'bg-amber-500' : 'bg-emerald-500'}`}>{role.is_active ? 'Off' : 'On'}</button>
                <button type="button" onClick={() => void updateProfessionalRole(role, 'delete')} disabled={saving} className="rounded-[16px] bg-red-600 py-3 text-sm font-black text-white disabled:opacity-50">Delete</button>
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
      const sessionStatusFilters = ['all', 'pending_acceptance', 'active', 'ended', 'declined'];
      const sessionTypeFilters = ['all', 'live_chat', 'offline_booking', 'scheduled', 'escalated'];
      const filteredSessions = adminProfessionalSessions.filter((session) => {
        const statusMatches = adminProfessionalSessionStatusFilter === 'all' || session.status === adminProfessionalSessionStatusFilter;
        const typeMatches = adminProfessionalSessionTypeFilter === 'all' || session.session_type === adminProfessionalSessionTypeFilter;
        return statusMatches && typeMatches;
      });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Calendar className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Sessions</h2>
            <p className="mt-2 text-sm text-slate-300">Full booking/session queue from the mobile admin area.</p>
          </section>
          <section className="space-y-3 rounded-[24px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sessionTypeFilters.map((filter) => (
                <button key={filter} type="button" onClick={() => setAdminProfessionalSessionTypeFilter(filter)} className={`shrink-0 rounded-[14px] px-3 py-2 text-xs font-black capitalize ${adminProfessionalSessionTypeFilter === filter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filter.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {sessionStatusFilters.map((filter) => (
                <button key={filter} type="button" onClick={() => setAdminProfessionalSessionStatusFilter(filter)} className={`rounded-[14px] px-2 py-2 text-xs font-black capitalize ${adminProfessionalSessionStatusFilter === filter ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {filter.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </section>
          {!filteredSessions.length ? <EmptyState icon={Calendar} title="No Sessions Loaded" text="No professional sessions match this filter." /> : null}
          {filteredSessions.map((session) => {
            const sessionUserId = session.user_id || session.user?.id;
            const adminSessionProfessionalId = session.professional?.user_id || session.professional?.pro_user?.id;
            const adminSessionProfessionalLabel =
              session.professional?.pro_user?.full_name || session.professional?.full_name || 'professional';
            return (
            <article key={session.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3">
                {sessionUserId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={sessionUserId} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <Avatar src={session.user?.profile_picture} name={session.user?.full_name || session.user?.email || 'Client'} />
                  </ProfileUserLink>
                ) : (
                  <Avatar src={session.user?.profile_picture} name={session.user?.full_name || session.user?.email || 'Client'} />
                )}
                <div className="min-w-0 flex-1">
                  {sessionUserId ? (
                    <ProfileUserLink viewerUserId={user?.id} subjectUserId={sessionUserId} className="block min-w-0">
                      <p className="truncate font-black text-slate-950 hover:underline">{session.user?.full_name || session.user?.email || 'Client'}</p>
                    </ProfileUserLink>
                  ) : (
                    <p className="truncate font-black text-slate-950">{session.user?.full_name || session.user?.email || 'Client'}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-500">
                    with{' '}
                    {adminSessionProfessionalId ? (
                      <ProfileUserLink viewerUserId={user?.id} subjectUserId={adminSessionProfessionalId} className="inline font-semibold text-slate-600 hover:underline">
                        {adminSessionProfessionalLabel}
                      </ProfileUserLink>
                    ) : (
                      <span>{session.professional?.full_name || 'professional'}</span>
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{session.status || 'pending'}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-500">{session.created_at ? `Created ${new Date(session.created_at).toLocaleString()}` : 'Session created'}{session.scheduled_date ? ` - Scheduled ${new Date(session.scheduled_date).toLocaleString()}` : ''}</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <p>{session.session_type || 'session'} - {session.scheduled_duration_minutes || 60} min - payment {session.payment_status || 'not set'}</p>
                {session.location_address ? <p>{session.location_address}</p> : null}
                {session.booking_notes ? <p className="rounded-[14px] bg-slate-50 p-3">{session.booking_notes}</p> : null}
              </div>
            </article>
            );
          })}
        </div>
      );
    }
    if (subPath === 'professional-reviews') {
      const profRevFilters: Array<'all' | 'pending' | 'approved' | 'rejected' | 'flagged'> = ['all', 'pending', 'approved', 'rejected', 'flagged'];
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Star className="h-10 w-10 fill-amber-300 text-amber-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Reviews</h2>
            <p className="mt-2 text-sm text-slate-300">Filter and search the loaded review batch (same moderation states as mobile).</p>
          </section>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {profRevFilters.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setAdminProfessionalReviewsFilter(f)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black capitalize ring-1 ${adminProfessionalReviewsFilter === f ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminProfessionalReviewsSearch}
              onChange={(event) => setAdminProfessionalReviewsSearch(event.target.value)}
              placeholder="Search client, professional, or review text…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search professional reviews"
            />
          </div>
          {!adminProfessionalReviews.length ? <EmptyState icon={Star} title="No Reviews Loaded" text="No professional reviews are available in the admin queue." /> : null}
          {adminProfessionalReviews.length > 0 && !filteredAdminProfessionalReviews.length ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">
              {adminProfessionalReviewsSearch.trim() ? 'No reviews match that search.' : 'No reviews in this moderation filter.'}
            </p>
          ) : null}
          {filteredAdminProfessionalReviews.map((review) => {
            const adminReviewClientId = !review.is_anonymous ? review.client_id || review.client?.id : null;
            const adminReviewProUserId = review.professional?.user_id || review.professional?.pro_user?.id;
            const adminReviewProLabel = review.professional?.pro_user?.full_name || review.professional?.full_name || 'professional';
            return (
            <article key={review.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              {adminReviewClientId ? (
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={adminReviewClientId} className="inline-block min-w-0">
                  <p className="truncate font-black text-slate-950 hover:underline">{review.client?.full_name || review.client?.email || 'Client'}</p>
                </ProfileUserLink>
              ) : (
                <p className="font-black text-slate-950">{review.client?.full_name || review.client?.email || 'Client'}</p>
              )}
              <p className="mt-1 text-sm text-slate-500">
                for{' '}
                {adminReviewProUserId ? (
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={adminReviewProUserId} className="inline font-semibold text-slate-600 hover:underline">
                    {adminReviewProLabel}
                  </ProfileUserLink>
                ) : (
                  <span>{review.professional?.full_name || 'professional'}</span>
                )}
              </p>
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
            );
          })}
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
    if (subPath === 'roles') {
      const isSuperAdmin = normalizeRole(user.role) === 'super_admin';
      const rq = adminRolesSearchQuery.trim().toLowerCase();
      const roleRows = !rq
        ? routeRows
        : routeRows.filter((member: any) => {
            const name = `${member.full_name || ''}`.toLowerCase();
            const email = `${member.email || ''}`.toLowerCase();
            const id = `${member.id || ''}`.toLowerCase();
            return name.includes(rq) || email.includes(rq) || id.includes(rq);
          });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Admin Roles</h2>
            <p className="mt-2 text-sm text-slate-300">Staff accounts only (moderator, admin, super admin), matching mobile.</p>
          </section>
          {!isSuperAdmin ? <EmptyState icon={Shield} title="Super Admin Only" text="Only super admins can change admin roles." /> : null}
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminRolesSearchQuery}
              onChange={(event) => setAdminRolesSearchQuery(event.target.value)}
              placeholder="Search staff by name, email, or id…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search staff roles"
            />
          </div>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {rq && routeRows.length > 0 && roleRows.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No staff match that search.</p>
          ) : null}
          {roleRows.map((member) => (
            <article key={member.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <ProfileUserLink viewerUserId={user?.id} subjectUserId={member.id} className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500">
                  <Avatar src={member.profile_picture} name={member.full_name || member.email} />
                </ProfileUserLink>
                <div className="min-w-0 flex-1">
                  <ProfileUserLink viewerUserId={user?.id} subjectUserId={member.id} className="block min-w-0">
                    <p className="truncate font-black text-slate-950 hover:underline">{member.full_name || member.email || 'Member'}</p>
                  </ProfileUserLink>
                  <p className="truncate text-sm text-slate-500">{member.email}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{member.role || 'user'}</span>
              </div>
              <select
                value={member.role || 'user'}
                onChange={(event) => void updateAdminUserRole(member.id, event.target.value)}
                disabled={!isSuperAdmin || saving || member.id === user.id}
                className="mt-4 w-full rounded-[16px] border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'reports') {
      const repStatuses: Array<'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed'> = ['all', 'pending', 'reviewing', 'resolved', 'dismissed'];
      const repFiltered = routeRows.filter(
        (report: any) => adminReportsStatusFilter === 'all' || (report.status || 'pending') === adminReportsStatusFilter
      );
      const rs = adminReportsSearch.trim().toLowerCase();
      const repRows = !rs
        ? repFiltered
        : repFiltered.filter((report: any) => {
            const blob = `${report.content_type || ''} ${report.reason || ''} ${report.description || ''} ${report.reporter_id || ''} ${report.content_id || ''}`.toLowerCase();
            return blob.includes(rs);
          });
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Ban className="h-10 w-10 text-red-300" />
            <h2 className="mt-4 text-3xl font-black">Reports</h2>
            <p className="mt-2 text-sm text-slate-300">Review reported posts, reels, comments, messages, and member issues without silently hiding content.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {(['pending', 'reviewing', 'resolved'] as const).map((key) => (
                <div key={key} className="rounded-[16px] bg-white/10 p-2">
                  <p className="text-lg font-black">{routeRows.filter((r: any) => (r.status || 'pending') === key).length}</p>
                  <p className="text-[10px] font-black uppercase text-slate-300">{key}</p>
                </div>
              ))}
            </div>
          </section>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {repStatuses.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setAdminReportsStatusFilter(st)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black capitalize ring-1 ${adminReportsStatusFilter === st ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-600 ring-slate-200'}`}
              >
                {st}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-1 shadow-sm ring-1 ring-slate-200">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <input
              type="search"
              value={adminReportsSearch}
              onChange={(event) => setAdminReportsSearch(event.target.value)}
              placeholder="Search type, reason, description, ids…"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm font-semibold text-slate-950 outline-none ring-0 placeholder:text-slate-400"
              autoComplete="off"
              aria-label="Search reports"
            />
          </div>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Ban} title="No Reports" text={routeRowsError || 'There are no reports waiting for review.'} /> : null}
          {!routeRowsLoading && rs && repFiltered.length > 0 && repRows.length === 0 ? (
            <p className="rounded-[18px] bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">No reports match that search.</p>
          ) : null}
          {!routeRowsLoading && !repRows.length && routeRows.length > 0 && !rs ? (
            <EmptyState icon={Ban} title="No Reports" text="No reports in this status filter." />
          ) : null}
          {repRows.map((report) => (
            <article key={report.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black capitalize text-slate-950">{report.content_type || 'content'} report</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{report.reason || 'No reason provided'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${report.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : report.status === 'dismissed' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{report.status || 'pending'}</span>
              </div>
              {report.description ? <p className="mt-3 rounded-[16px] bg-slate-50 p-3 text-sm leading-6 text-slate-600">{report.description}</p> : null}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                <span>Reporter: {String(report.reporter_id || '').slice(0, 8) || 'Unknown'}</span>
                <span>Content: {String(report.content_id || '').slice(0, 8) || 'None'}</span>
              </div>
              {report.action_taken ? <p className="mt-3 text-xs font-bold text-slate-400">Action: {report.action_taken}</p> : null}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void updateReportedContentStatus(report, 'resolved', 'Reviewed and resolved')} disabled={saving || report.status === 'resolved'} className="rounded-[16px] bg-emerald-500 py-3 text-xs font-black text-white disabled:opacity-50">Resolve</button>
                <button type="button" onClick={() => void updateReportedContentStatus(report, 'dismissed', 'Reviewed and dismissed')} disabled={saving || report.status === 'dismissed'} className="rounded-[16px] bg-slate-700 py-3 text-xs font-black text-white disabled:opacity-50">Dismiss</button>
                <button type="button" onClick={() => void deleteReportedContent(report)} disabled={saving || !report.content_id} className="rounded-[16px] bg-red-500 py-3 text-xs font-black text-white disabled:opacity-50">Delete</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'verification-services') {
      const isSuperAdmin = normalizeRole(user.role) === 'super_admin';
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Phone className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-3xl font-black">Verification Services</h2>
            <p className="mt-2 text-sm text-slate-300">Same SMS and email provider config used by mobile verification flows.</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Phone} title="No Services" text={routeRowsError || 'No verification services are configured yet.'} /> : null}
          {routeRows.map((service) => (
            <article key={service.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black capitalize text-slate-950">{service.service_type || 'service'} verification</p>
                  <p className="mt-1 text-sm text-slate-500">{service.provider || 'Provider not set'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${service.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{service.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <p className="mt-3 rounded-[16px] bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                {Object.keys(service.config || {}).length ? Object.keys(service.config || {}).join(', ') : 'No provider fields stored yet.'}
              </p>
              <button type="button" onClick={() => void toggleVerificationService(service)} disabled={!isSuperAdmin || saving} className="mt-4 w-full rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">
                {service.enabled ? 'Disable service' : 'Enable service'}
              </button>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'stickers') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Sparkles className="h-10 w-10 text-pink-300" />
            <h2 className="mt-4 text-3xl font-black">Stickers</h2>
            <p className="mt-2 text-sm text-slate-300">Manage sticker packs used by chat, comments, and playful replies.</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Sparkles} title="No Sticker Packs" text={routeRowsError || 'Create sticker packs in Supabase or mobile admin to manage them here.'} /> : null}
          {routeRows.map((pack) => (
            <article key={pack.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <Avatar src={pack.icon_url} name={pack.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{pack.name || 'Sticker pack'}</p>
                  <p className="line-clamp-2 text-sm text-slate-500">{pack.description || 'No description'}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${pack.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{pack.is_active ? 'Active' : 'Inactive'}</span>
                {pack.is_featured ? <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black uppercase text-pink-700">Featured</span> : null}
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">Order {pack.display_order || 0}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void toggleStickerPack(pack, 'is_active')} disabled={saving} className="rounded-[16px] bg-blue-600 py-3 text-xs font-black text-white disabled:opacity-50">{pack.is_active ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => void toggleStickerPack(pack, 'is_featured')} disabled={saving} className="rounded-[16px] bg-pink-600 py-3 text-xs font-black text-white disabled:opacity-50">{pack.is_featured ? 'Unfeature' : 'Feature'}</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'settings') {
      const isSuperAdmin = normalizeRole(user.role) === 'super_admin';
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Settings className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Admin Settings</h2>
            <p className="mt-2 text-sm text-slate-300">Operational settings from the same app_settings table used by mobile admin.</p>
          </section>
          {routeRowsLoading ? <ScreenSkeleton /> : null}
          {!routeRowsLoading && !routeRows.length ? <EmptyState icon={Settings} title="No Settings" text={routeRowsError || 'No app settings are saved yet.'} /> : null}
          {routeRows.map((row) => {
            const key = String(row.key || '');
            const draftKey = row.id || key;
            const isSecret = /key|token|secret|password/i.test(key);
            return (
              <article key={draftKey} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="font-black text-slate-950">{key || 'Setting'}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{row.updated_at ? `Updated ${new Date(row.updated_at).toLocaleString()}` : 'Not updated yet'}</p>
                <textarea
                  value={adminSettingDrafts[draftKey] ?? String(row.value ?? '')}
                  onChange={(event) => setAdminSettingDrafts((prev) => ({ ...prev, [draftKey]: event.target.value }))}
                  disabled={!isSuperAdmin}
                  rows={isSecret ? 2 : 4}
                  className="mt-3 w-full resize-none rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 disabled:opacity-60"
                />
                {isSecret ? <p className="mt-2 text-xs font-semibold text-amber-600">Sensitive value. Only edit when rotating credentials.</p> : null}
                <button type="button" onClick={() => void saveAdminSetting(row)} disabled={!isSuperAdmin || saving} className="mt-4 w-full rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">Save setting</button>
              </article>
            );
          })}
        </div>
      );
    }
    if (subPath === 'analytics') {
      const cards = [
        ['Users', adminUsers.length, `${adminUsers.filter((item) => item.verified || item.phone_verified || item.email_verified).length} verified loaded`],
        ['Relationships', adminRelationships.length, `${adminRelationships.filter((item) => item.status === 'verified').length} verified loaded`],
        ['Posts', adminPosts.length, 'latest moderation sample'],
        ['Reels', adminReels.length, 'latest moderation sample'],
        ['Payments', paymentSubmissions.length, 'recent submissions loaded'],
        ['Events', routeRows.length, 'recent analytics events'],
      ];
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <CreditCard className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-3xl font-black">Analytics</h2>
            <p className="mt-2 text-sm text-slate-300">Platform overview from the same users, relationships, posts, reels, messages, and event tables used by mobile admin.</p>
          </section>
          <div className="grid grid-cols-2 gap-3">
            {cards.map(([label, value, helper]) => (
              <article key={String(label)} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <p className="text-3xl font-black text-blue-600">{value}</p>
                <p className="mt-1 font-black text-slate-950">{label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
              </article>
            ))}
          </div>
          {routeRows.slice(0, 12).map((event) => (
            <article key={event.id || JSON.stringify(event)} className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{event.event_name || event.action || 'Analytics event'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{event.created_at ? new Date(event.created_at).toLocaleString() : 'No timestamp'}</p>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'professional-analytics') {
      const sessionCount = routeRows.length;
      const completed = routeRows.filter((item) => item.status === 'completed').length;
      const paid = routeRows.filter((item) => item.payment_status === 'paid' || item.payment_status === 'approved').length;
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Briefcase className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-3xl font-black">Professional Analytics</h2>
            <p className="mt-2 text-sm text-slate-300">Professional booking and review performance from `professional_sessions` and review moderation data.</p>
          </section>
          <div className="grid grid-cols-3 gap-2">
            {[['Sessions', sessionCount], ['Completed', completed], ['Paid', paid]].map(([label, value]) => (
              <article key={String(label)} className="rounded-[20px] bg-white p-3 text-center shadow-sm ring-1 ring-slate-200">
                <p className="text-2xl font-black text-blue-600">{value}</p>
                <p className="text-xs font-black uppercase text-slate-500">{label}</p>
              </article>
            ))}
          </div>
          {routeRows.map((session) => (
            <article key={session.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{session.status || 'Session'}</p>
              <p className="mt-1 text-sm text-slate-500">{session.scheduled_date ? new Date(session.scheduled_date).toLocaleString() : 'No scheduled date'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{session.payment_status || 'payment unknown'}</span>
                {session.booking_fee_amount ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">${session.booking_fee_amount}</span> : null}
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'logs') {
      const isSuperAdmin = normalizeRole(user.role) === 'super_admin';
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <FileText className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Activity Logs</h2>
            <p className="mt-2 text-sm text-slate-300">Last admin and safety activity. Mobile restricts this screen to super admins.</p>
          </section>
          {!isSuperAdmin ? <EmptyState icon={Shield} title="Super Admin Only" text="Only super admins can view activity logs." /> : null}
          {isSuperAdmin && routeRows.map((log) => (
            <article key={log.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="font-black text-slate-950">{log.action || 'Activity'}</p>
              <p className="mt-1 text-sm text-slate-500">by {log.users?.full_name || log.users?.email || String(log.user_id || '').slice(0, 8) || 'Unknown user'}</p>
              <p className="mt-2 text-xs font-semibold text-slate-400">{log.resource_type || log.entity_type || 'resource'} {log.resource_id || log.entity_id || ''}</p>
              {log.created_at ? <p className="mt-3 text-xs font-bold text-slate-400">{new Date(log.created_at).toLocaleString()}</p> : null}
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'disputes') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Shield className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-3xl font-black">Disputes</h2>
            <p className="mt-2 text-sm text-slate-300">Resolve relationship disputes using the same confirmation/rejection rules as mobile admin.</p>
          </section>
          {routeRows.map((dispute) => (
            <article key={dispute.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black capitalize text-slate-950">{String(dispute.dispute_type || 'dispute').replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-sm text-slate-500">{dispute.description || 'No description provided'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${dispute.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{dispute.status || 'pending'}</span>
              </div>
              {dispute.auto_resolve_at ? <p className="mt-3 text-xs font-semibold text-amber-600">Auto resolve: {new Date(dispute.auto_resolve_at).toLocaleString()}</p> : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void resolveAdminDispute(dispute, 'confirmed_by_admin')} disabled={saving || dispute.status !== 'pending'} className="rounded-[16px] bg-cyan-500 py-3 text-xs font-black text-white disabled:opacity-50">Confirm</button>
                <button type="button" onClick={() => void resolveAdminDispute(dispute, 'rejected_by_admin')} disabled={saving || dispute.status !== 'pending'} className="rounded-[16px] bg-slate-700 py-3 text-xs font-black text-white disabled:opacity-50">Reject</button>
              </div>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'escalation-rules' || subPath === 'escalation-rules-fixed') {
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Sparkles className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-3xl font-black">Escalation Rules</h2>
            <p className="mt-2 text-sm text-slate-300">Professional escalation timing, attempts, and routing strategy.</p>
          </section>
          {routeRows.map((rule) => (
            <article key={rule.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{rule.name || 'Escalation rule'}</p>
                  <p className="mt-1 text-sm text-slate-500">{rule.description || `${rule.trigger_type || 'timeout'} · ${rule.escalation_strategy || 'sequential'}`}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${(rule.is_active ?? rule.enabled) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{(rule.is_active ?? rule.enabled) ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700">{rule.timeout_seconds || 0}s</span>
                <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black uppercase text-pink-700">{rule.max_escalation_attempts || rule.max_attempts || 0} attempts</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase text-slate-600">Priority {rule.priority || 0}</span>
              </div>
              <button type="button" onClick={() => void toggleEscalationRule(rule)} disabled={saving} className="mt-4 w-full rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">
                {(rule.is_active ?? rule.enabled) ? 'Disable rule' : 'Enable rule'}
              </button>
            </article>
          ))}
        </div>
      );
    }
    if (subPath === 'face-matching') {
      const isSuperAdmin = normalizeRole(user.role) === 'super_admin';
      return (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[28px] bg-slate-950 p-5 text-white">
            <Camera className="h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-3xl font-black">Face Matching</h2>
            <p className="mt-2 text-sm text-slate-300">Provider controls used by verification and relationship proof matching.</p>
          </section>
          {routeRows.map((provider) => (
            <article key={provider.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{provider.name || 'Face provider'}</p>
                  <p className="mt-1 text-sm text-slate-500">{provider.provider_type || 'provider'} · threshold {provider.similarity_threshold ?? 'default'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${(provider.enabled ?? provider.is_active) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{(provider.enabled ?? provider.is_active) ? 'Enabled' : 'Disabled'}</span>
              </div>
              <button type="button" onClick={() => void toggleFaceProvider(provider)} disabled={!isSuperAdmin || saving} className="mt-4 w-full rounded-[16px] bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">
                {(provider.enabled ?? provider.is_active) ? 'Disable provider' : 'Enable provider'}
              </button>
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
    <WebShellSupabaseContext.Provider value={supabase}>
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
        <ReportUserModal
          open={!!reportProfileTarget}
          reportedName={reportProfileTarget?.name || 'Member'}
          onClose={() => setReportProfileTarget(null)}
          onSubmit={submitReportProfile}
        />
        {datingDiscoveryMatchModal ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dating-match-title"
            className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-center justify-center bg-black/60 px-5 backdrop-blur-[2px]"
            onClick={() => setDatingDiscoveryMatchModal(null)}
          >
            <div
              className="w-full max-w-[340px] rounded-[28px] bg-gradient-to-br from-pink-500 via-rose-500 to-indigo-600 p-6 text-center shadow-2xl ring-4 ring-white/25"
              onClick={(e) => e.stopPropagation()}
            >
              <Sparkles className="mx-auto h-11 w-11 text-white drop-shadow-md" />
              <h2 id="dating-match-title" className="mt-3 text-3xl font-black tracking-tight text-white">
                {"It's a match!"}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-snug text-white/90">
                You and {datingDiscoveryMatchModal.name} liked each other.
              </p>
              <div className="mt-5 flex justify-center">
                <div className="rounded-full bg-white/20 p-1 ring-4 ring-white/40">
                  <Link
                    href={`/app/dating/user-profile?userId=${encodeURIComponent(datingDiscoveryMatchModal.otherUserId)}`}
                    className="block rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-white"
                    onClick={() => setDatingDiscoveryMatchModal(null)}
                  >
                    <Avatar src={datingDiscoveryMatchModal.photoUrl} name={datingDiscoveryMatchModal.name} size="lg" />
                  </Link>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-white py-3.5 text-sm font-black text-slate-900 shadow-lg active:scale-[0.99]"
                  onClick={() => {
                    const id = datingDiscoveryMatchModal.otherUserId;
                    setDatingDiscoveryMatchModal(null);
                    void openConversationWithUser(id);
                  }}
                >
                  <MessageCircle className="h-5 w-5 text-blue-600" strokeWidth={2.4} />
                  Send a message
                </button>
                <Link
                  href={`/app/dating/user-profile?userId=${encodeURIComponent(datingDiscoveryMatchModal.otherUserId)}`}
                  className="block w-full rounded-[18px] bg-white/15 py-3.5 text-center text-sm font-black text-white ring-1 ring-white/35 active:bg-white/25"
                  onClick={() => setDatingDiscoveryMatchModal(null)}
                >
                  View profile
                </Link>
                <button
                  type="button"
                  className="w-full rounded-[18px] py-3 text-sm font-black text-white/95 underline-offset-4 hover:underline"
                  onClick={() => setDatingDiscoveryMatchModal(null)}
                >
                  Keep swiping
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </WebShellSupabaseContext.Provider>
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
  readOnly = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  type?: string;
  readOnly?: boolean;
  hint?: string;
}) {
  const fieldClass = readOnly
    ? 'cursor-not-allowed rounded-[20px] border border-slate-200 bg-slate-100 px-4 text-base font-semibold text-slate-600 outline-none'
    : 'rounded-[20px] border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`w-full resize-none py-4 ${fieldClass}`}
        />
      ) : (
        <input
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          type={type}
          className={`h-14 w-full ${fieldClass}`}
        />
      )}
      {hint ? <p className="mt-1.5 text-xs font-semibold text-slate-500">{hint}</p> : null}
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
  currentUserId,
  onToggleLike,
  onEdit,
  onDelete,
  onReport,
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
  currentUserId: string | null;
  onToggleLike: (comment: SocialComment) => void;
  onEdit: (comment: SocialComment, content: string) => void;
  onDelete: (comment: SocialComment) => void;
  onReport: (comment: SocialComment) => void;
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
              currentUserId={currentUserId}
              onToggleLike={onToggleLike}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
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
  currentUserId,
  onToggleLike,
  onEdit,
  onDelete,
  onReport,
  isReply = false,
}: {
  comment: SocialComment;
  replyDrafts: Record<string, string>;
  onReplyDraftChange: (key: string, value: string) => void;
  onReply: (commentId: string) => void;
  targetPrefix: string;
  submittingKey: string | null;
  currentUserId: string | null;
  onToggleLike: (comment: SocialComment) => void;
  onEdit: (comment: SocialComment, content: string) => void;
  onDelete: (comment: SocialComment) => void;
  onReport: (comment: SocialComment) => void;
  isReply?: boolean;
}) {
  const replyKey = `${targetPrefix}:reply:${comment.id}`;
  const replyDraft = replyDrafts[replyKey] || '';
  const isOwner = currentUserId === comment.userId;
  const isLiked = !!currentUserId && comment.likes.includes(currentUserId);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(comment.content || '');
  const saveEdit = () => {
    const next = editDraft.trim();
    if (!next) return;
    onEdit(comment, next);
    setEditing(false);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <ProfileUserLink
          viewerUserId={currentUserId}
          subjectUserId={comment.userId}
          subjectUsername={comment.userUsername}
          className="shrink-0 self-start rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Avatar src={comment.userAvatar} name={comment.userName} size="sm" />
        </ProfileUserLink>
        <div className="min-w-0 flex-1">
          <div className="rounded-[18px] bg-slate-100 px-4 py-3">
            <div className="flex items-start gap-2">
              <ProfileUserLink viewerUserId={currentUserId} subjectUserId={comment.userId} subjectUsername={comment.userUsername} className="min-w-0 flex-1">
                <p className="truncate font-black text-slate-950 hover:underline">{comment.userName}</p>
              </ProfileUserLink>
              {isOwner && !editing ? (
                <div className="flex shrink-0 items-center gap-1">
                  {comment.messageType !== 'sticker' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditDraft(comment.content || '');
                        setEditing(true);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full bg-white text-slate-500 shadow-sm"
                      aria-label="Edit comment"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onDelete(comment)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-white text-red-500 shadow-sm"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
            {comment.stickerImageUrl ? <img src={comment.stickerImageUrl} alt="" className="mt-2 h-20 w-20 rounded-xl object-contain" /> : null}
            {editing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  rows={2}
                  className="min-h-16 w-full resize-none rounded-[14px] bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none ring-1 ring-slate-200 focus:ring-blue-200"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-xs font-black text-slate-500">
                    Cancel
                  </button>
                  <button type="button" onClick={saveEdit} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white">
                    Save
                  </button>
                </div>
              </div>
            ) : comment.content ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-700">{comment.content}</p>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-3 px-2 text-xs font-bold text-slate-400">
            <span>{timeAgo(comment.createdAt)}</span>
            <button
              type="button"
              onClick={() => onToggleLike(comment)}
              className={isLiked ? 'font-black text-red-500' : 'hover:text-slate-700'}
            >
              {isLiked ? 'Liked' : 'Like'}
            </button>
            <span>{comment.likes.length}</span>
            {!isReply ? <span>Reply</span> : null}
            {!isOwner ? (
              <button type="button" onClick={() => onReport(comment)} className="inline-flex items-center gap-1 text-red-400 hover:text-red-600">
                <Flag className="h-3 w-3" />
                Report
              </button>
            ) : null}
          </div>
          {!isReply ? <div className="mt-2 flex items-end gap-2">
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
          </div> : null}
        </div>
      </div>
      {comment.replies?.length ? (
        <div className="ml-12 space-y-2 border-l border-slate-200 pl-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              replyDrafts={replyDrafts}
              onReplyDraftChange={onReplyDraftChange}
              onReply={onReply}
              targetPrefix={targetPrefix}
              submittingKey={submittingKey}
              currentUserId={currentUserId}
              onToggleLike={onToggleLike}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
              isReply
            />
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
        <ProfileUserLink
          viewerUserId={user?.id}
          subjectUserId={post.user_id}
          subjectUsername={post.users?.username}
          className="shrink-0 rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Avatar src={post.users?.profile_picture} name={getUserDisplayName(post.users)} />
        </ProfileUserLink>
        <div className="min-w-0 flex-1">
          <ProfileUserLink viewerUserId={user?.id} subjectUserId={post.user_id} subjectUsername={post.users?.username} className="block min-w-0">
            <p className="truncate font-black text-slate-950 hover:underline">{getUserDisplayName(post.users)}</p>
          </ProfileUserLink>
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
