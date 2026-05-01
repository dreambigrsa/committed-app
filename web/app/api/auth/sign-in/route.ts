import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://dizcuexznganwgddsrfo.supabase.co';

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Password sign-in proxied through the web app origin so clients behind strict
 * networks or flaky paths to *.supabase.co can still authenticate (server → Supabase).
 */
export async function POST(request: Request) {
  if (!anonKey) {
    return NextResponse.json({ error: 'Server misconfiguration: missing anon key.' }, { status: 500 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const session = data.session;
  const userId = data.user?.id;
  if (!session?.access_token || !session?.refresh_token || !userId) {
    return NextResponse.json({ error: 'No session returned. Try again or contact support.' }, { status: 500 });
  }

  // Same Supabase client instance carries this session for RLS on the next query.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('is_verified')
    .eq('id', userId)
    .maybeSingle();

  return NextResponse.json({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? null,
    expires_in: session.expires_in ?? null,
    user: {
      id: userId,
      email: data.user?.email ?? null,
    },
    profile: profileRow ? { is_verified: (profileRow as { is_verified?: boolean }).is_verified ?? null } : null,
  });
}
