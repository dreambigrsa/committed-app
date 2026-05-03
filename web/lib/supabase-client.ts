'use client';

import { createClient } from '@supabase/supabase-js';

const PROD_SUPABASE_URL = 'https://dizcuexznganwgddsrfo.supabase.co';
const PROD_PROJECT_REF = 'dizcuexznganwgddsrfo';
const PROD_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpemN1ZXh6bmdhbndnZGRzcmZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjcxODcsImV4cCI6MjA4MDg0MzE4N30.cvnt9KN4rz2u9yQbDQjFcA_Q7WDz2M_lGln3RCJ-hJQ';

const allowAlternateProject = process.env.NEXT_PUBLIC_ALLOW_ALT_SUPABASE === 'true';
const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const WEB_AUTH_STORAGE_KEY = `committed-web-auth-${PROD_PROJECT_REF}`;
const LEGACY_WEB_AUTH_STORAGE_KEYS = [`sb-${PROD_PROJECT_REF}-auth-token`];

function jwtProjectRef(token?: string) {
  if (!token || !token.startsWith('eyJ')) return '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    return typeof payload?.ref === 'string' ? payload.ref : '';
  } catch {
    return '';
  }
}

let supabaseUrl = envSupabaseUrl || PROD_SUPABASE_URL;
let supabaseAnonKey = envSupabaseAnonKey || PROD_SUPABASE_ANON_KEY;

if (!allowAlternateProject) {
  if (!supabaseUrl.includes(`${PROD_PROJECT_REF}.supabase.co`)) {
    console.warn('[Web Supabase] Non-production URL detected; falling back to production project URL.');
    supabaseUrl = PROD_SUPABASE_URL;
  }
  const keyRef = jwtProjectRef(supabaseAnonKey);
  if (keyRef && keyRef !== PROD_PROJECT_REF) {
    console.warn('[Web Supabase] Anon key project mismatch detected; falling back to production anon key.');
    supabaseAnonKey = PROD_SUPABASE_ANON_KEY;
  }
}

/** Same origin the browser Supabase client uses (env + prod fallbacks). Use for storage public URLs. */
export function getWebSupabaseUrl(): string {
  return supabaseUrl;
}

let browserClient: ReturnType<typeof createClient> | null = null;

function clearLegacyWebAuthStorage() {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_WEB_AUTH_STORAGE_KEYS) {
    if (key !== WEB_AUTH_STORAGE_KEY) {
      window.localStorage.removeItem(key);
    }
  }
}

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  if (!supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for web auth.');
  }
  clearLegacyWebAuthStorage();
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: WEB_AUTH_STORAGE_KEY,
    },
  });
  return browserClient;
}
