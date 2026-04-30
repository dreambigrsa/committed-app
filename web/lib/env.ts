/**
 * Public env (exposed to client). Set in .env.local or Vercel.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';
export const WEB_APP_URL =
  process.env.NEXT_PUBLIC_WEB_APP_URL ||
  process.env.NEXT_PUBLIC_EXPO_WEB_APP_URL ||
  SITE_URL;
export const FUNCTIONS_BASE = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_BASE || '';
export const DEEPLINK_SCHEME = process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'committed://';
export const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#';
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#';
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@dreambig.org.za';
const PROD_SUPABASE_URL = 'https://dizcuexznganwgddsrfo.supabase.co';
const PROD_PROJECT_REF = 'dizcuexznganwgddsrfo';
const PROD_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpemN1ZXh6bmdhbndnZGRzcmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjcxODcsImV4cCI6MjA4MDg0MzE4N30.cvnt9KN4rz2u9yQbDQjFcA_Q7WDz2M_lGln3RCJ-hJQ';
const allowAlternateProject = process.env.NEXT_PUBLIC_ALLOW_ALT_SUPABASE === 'true';

const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function jwtProjectRef(token?: string) {
  if (!token || !token.startsWith('eyJ')) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return typeof payload?.ref === 'string' ? payload.ref : '';
  } catch {
    return '';
  }
}

let resolvedSupabaseUrl = envSupabaseUrl || PROD_SUPABASE_URL;
let resolvedSupabaseAnonKey = envSupabaseAnonKey || PROD_SUPABASE_ANON_KEY;

if (!allowAlternateProject) {
  if (!resolvedSupabaseUrl.includes(`${PROD_PROJECT_REF}.supabase.co`)) {
    resolvedSupabaseUrl = PROD_SUPABASE_URL;
  }
  const keyRef = jwtProjectRef(resolvedSupabaseAnonKey);
  if (keyRef && keyRef !== PROD_PROJECT_REF) {
    resolvedSupabaseAnonKey = PROD_SUPABASE_ANON_KEY;
  }
}

export const SUPABASE_URL = resolvedSupabaseUrl;
export const SUPABASE_ANON_KEY = resolvedSupabaseAnonKey;
