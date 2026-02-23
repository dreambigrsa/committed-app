/**
 * Server-side Supabase admin client for API routes.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only, never expose).
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://dizcuexznganwgddsrfo.supabase.co';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function createSupabaseAdmin() {
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env.local or Vercel env.');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
