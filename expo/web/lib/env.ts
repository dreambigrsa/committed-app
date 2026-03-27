/**
 * Public env (exposed to client). Set in .env.local or Vercel.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';
export const FUNCTIONS_BASE = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_BASE || '';
export const DEEPLINK_SCHEME = process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'committed://';
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#';
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@dreambig.org.za';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
