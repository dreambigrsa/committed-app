/**
 * GET /api/auth/verify-email?token=...
 * Validates token and syncs the same product verification state mobile uses:
 * profiles.is_verified. The users/auth flags are repaired as compatibility mirrors.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { hashToken } from '@/lib/auth-tokens';

async function resolveUserIdByEmail(supabase: ReturnType<typeof createSupabaseAdmin>, email: string | null) {
  if (!email) return null;
  const normalizedEmail = email.toLowerCase();
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle();
  if (userRow?.id) return userRow.id as string;

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', normalizedEmail)
    .limit(1)
    .maybeSingle();
  if (profileRow?.id) return profileRow.id as string;

  const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
  const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
  return authUser?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token || token.length < 16) {
      return NextResponse.json({ ok: false, error: 'Invalid or missing token' }, { status: 400 });
    }

    const tokenHash = await hashToken(token);
    const supabase = createSupabaseAdmin();

    const { data: row, error: fetchErr } = await supabase
      .from('auth_tokens')
      .select('id, user_id, email, used_at, expires_at')
      .eq('token_hash', tokenHash)
      .eq('type', 'verify_email')
      .maybeSingle();

    if (fetchErr || !row) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired link' }, { status: 400 });
    }
    if (row.used_at) {
      return NextResponse.json({ ok: false, error: 'Link already used' }, { status: 400 });
    }
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ ok: false, error: 'Link expired' }, { status: 400 });
    }

    await supabase.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);

    let userId = row.user_id;
    if (!userId) {
      userId = await resolveUserIdByEmail(supabase, row.email);
    }

    if (userId) {
      await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email: (row.email || '').toLowerCase(),
            is_verified: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      await supabase
        .from('users')
        .update({
          email_verified: true,
          verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('verify-email error:', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 });
  }
}
