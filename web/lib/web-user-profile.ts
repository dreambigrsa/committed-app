/**
 * Single place to merge Supabase Auth user + public.users row for the Next.js shell.
 * Mirrors mobile AuthContext: prefer DB when sane, then auth user_metadata, never use email as display name.
 */

import { resolveProfilePictureUrl } from '@/lib/profile-media-url';

export type AuthUserLike = {
  id: string;
  email?: string | null;
  phone?: string | null;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function metaStr(meta: Record<string, unknown> | null | undefined, key: string): string {
  const v = meta?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function authMetadataStrings(auth: AuthUserLike) {
  const m = auth.user_metadata || {};
  return {
    fullName: metaStr(m, 'full_name'),
    phoneNumber: metaStr(m, 'phone_number'),
    profilePicture:
      metaStr(m, 'profile_picture') ||
      metaStr(m, 'avatar_url') ||
      metaStr(m, 'picture') ||
      metaStr(m, 'avatar') ||
      metaStr(m, 'photo_url') ||
      metaStr(m, 'image'),
  };
}

export function usersRowBootstrapFromAuth(authUser: AuthUserLike) {
  const meta = authMetadataStrings(authUser);
  const metadataRole =
    typeof authUser.user_metadata?.role === 'string' ? authUser.user_metadata.role.trim() : '';
  return {
    id: authUser.id,
    full_name: meta.fullName || null,
    username: null as string | null,
    email: authUser.email || null,
    phone_number: meta.phoneNumber || (authUser.phone || null) || null,
    role: metadataRole || 'user',
    profile_picture: resolveProfilePictureUrl(meta.profilePicture || null),
    email_verified: !!authUser.email_confirmed_at,
    phone_verified: !!authUser.phone_confirmed_at,
  };
}

type UsersRow = {
  id?: string;
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  phone_number?: string | null;
  profile_picture?: string | null;
  role?: string | null;
  verified?: boolean | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  id_verified?: boolean | null;
  banned_at?: string | null;
  banned_by?: string | null;
  ban_reason?: string | null;
};

/**
 * Merge `public.users` (may be null if RLS/timing) with `auth.users` metadata — same priority as mobile hydrate.
 */
export function mergeUsersProfileForWebShell(profile: UsersRow | null, authUser: AuthUserLike): UsersRow & { id: string } {
  const meta = authMetadataStrings(authUser);
  const email = (authUser.email || '').trim().toLowerCase();
  const dbFull = (profile?.full_name || '').trim();
  const dbFullLower = dbFull.toLowerCase();
  const dbLooksLikeEmailPlaceholder = !!dbFull && (dbFullLower === email || dbFull.includes('@'));

  const full_name =
    (meta.fullName) ||
    (dbFull && !dbLooksLikeEmailPlaceholder ? dbFull : '') ||
    (profile?.username?.trim() || '') ||
    'Committed member';

  const phone_number =
    (profile?.phone_number || '').trim() || meta.phoneNumber || (authUser.phone || '').trim() || null;

  const rawPicture = (profile?.profile_picture || '').trim() || meta.profilePicture || null;
  const profile_picture = resolveProfilePictureUrl(rawPicture);

  const metadataRole =
    typeof authUser.user_metadata?.role === 'string' ? authUser.user_metadata.role.trim() : '';

  return {
    id: authUser.id,
    full_name,
    username: profile?.username ?? null,
    email: profile?.email || authUser.email || null,
    phone_number,
    profile_picture,
    role: (profile?.role as string | undefined) || metadataRole || 'user',
    verified: profile?.verified ?? null,
    email_verified: profile?.email_verified ?? !!authUser.email_confirmed_at,
    phone_verified: profile?.phone_verified ?? !!authUser.phone_confirmed_at,
    id_verified: profile?.id_verified ?? null,
    banned_at: profile?.banned_at ?? null,
    banned_by: profile?.banned_by ?? null,
    ban_reason: profile?.ban_reason ?? null,
  };
}
