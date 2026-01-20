import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * IMPORTANT (Production):
 * EAS builds do NOT automatically load your local `.env`.
 * Provide these via EAS env/secrets:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://dizcuexznganwgddsrfo.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpemN1ZXh6bmdhbndnZGRzcmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjcxODcsImV4cCI6MjA4MDg0MzE4N30.cvnt9KN4rz2u9yQbDQjFcA_Q7WDz2M_lGln3RCJ-hJQ';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] Missing config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for production builds.'
  );
}

// Configure Supabase client with AsyncStorage for auth persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface SupabaseUser {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  profile_picture?: string;
  role: 'user' | 'moderator' | 'admin' | 'super_admin';
  phone_verified: boolean;
  email_verified: boolean;
  id_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupabaseRelationship {
  id: string;
  user_id: string;
  partner_name: string;
  partner_phone: string;
  partner_user_id?: string;
  type: 'married' | 'engaged' | 'serious' | 'dating';
  status: 'pending' | 'verified' | 'ended';
  start_date: string;
  verified_date?: string;
  end_date?: string;
  privacy_level: 'public' | 'private' | 'verified-only';
  partner_face_photo?: string;
  partner_date_of_birth_month?: number;
  partner_date_of_birth_year?: number;
  partner_city?: string;
  created_at: string;
  updated_at: string;
}

export interface SupabaseAdvertisement {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url?: string;
  type: 'banner' | 'card' | 'video';
  placement: 'feed' | 'reels' | 'messages' | 'all';
  active: boolean;
  impressions: number;
  clicks: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  cta_type?: 'whatsapp' | 'messenger' | 'website';
  cta_phone?: string;
  cta_message?: string;
  cta_messenger_id?: string;
  cta_url?: string;
  sponsor_name?: string;
  sponsor_verified?: boolean;
}

export interface SupabasePost {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  media_type: 'image' | 'video' | 'mixed';
  likes: string[];
  comment_count: number;
  created_at: string;
}

export interface SupabaseReel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url?: string;
  caption: string;
  likes: string[];
  comment_count: number;
  view_count: number;
  created_at: string;
}
