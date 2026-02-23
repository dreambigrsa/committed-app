/**
 * GET /api/auth/verify-email?token=...
 * Validates token, marks used, sets profiles.is_verified = true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { hashToken } from '@/lib/auth-tokens';

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

    const profileId = row.user_id;
    if (profileId) {
      await supabase
        .from('profiles')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);
    } else {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', row.email)
        .limit(1)
        .maybeSingle();
      if (byEmail?.id) {
        await supabase
          .from('profiles')
          .update({
            is_verified: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', byEmail.id);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('verify-email error:', e);
    return NextResponse.json({ ok: false, error: 'Something went wrong' }, { status: 500 });
  }
}
