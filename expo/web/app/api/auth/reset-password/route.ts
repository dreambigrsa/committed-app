/**
 * POST /api/auth/reset-password
 * Validates token, updates auth user password via Supabase Admin, marks token used.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { hashToken } from '@/lib/auth-tokens';

const MIN_PASSWORD_LENGTH = 6;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    const newPassword = body?.newPassword ?? body?.new_password;

    if (!token || typeof token !== 'string' || token.length < 16) {
      return NextResponse.json({ ok: false, error: 'Invalid or missing token' }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ ok: false, error: 'New password is required' }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    }

    const tokenHash = await hashToken(token);
    const supabase = createSupabaseAdmin();

    const { data: row, error: fetchErr } = await supabase
      .from('auth_tokens')
      .select('id, user_id, email, used_at, expires_at')
      .eq('token_hash', tokenHash)
      .eq('type', 'reset_password')
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

    let userId = row.user_id;
    if (!userId && row.email) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
      const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === row.email.toLowerCase());
      if (authUser?.id) userId = authUser.id;
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Invalid or expired link' }, { status: 400 });
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
    if (updateErr) {
      console.error('admin updateUserById error:', updateErr.message);
      return NextResponse.json(
        { ok: false, error: updateErr.message || 'Failed to update password' },
        { status: 400 }
      );
    }

    await supabase.from('auth_tokens').update({ used_at: new Date().toISOString() }).eq('id', row.id);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('reset-password error:', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 });
  }
}
