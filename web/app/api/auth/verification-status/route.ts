import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get('email') || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ verified: false }, { status: 200 });
    }

    const supabase = createSupabaseAdmin();
    const { data: userRow } = await supabase
      .from('users')
      .select('id,email_verified,verified')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();

    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
    const authUser = listData?.users?.find((user) => user.email?.toLowerCase() === email);
    const userId = userRow?.id || authUser?.id || null;
    const { data: tokenRow, error: tokenError } = await supabase
      .from('auth_tokens')
      .select('id,used_at')
      .eq('type', 'verify_email')
      .or(userId ? `user_id.eq.${userId},email.eq.${email}` : `email.eq.${email}`)
      .not('used_at', 'is', null)
      .order('used_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tokenError) {
      console.error('verification-status token lookup error:', tokenError);
    }
    const isCommittedVerified = !!tokenRow?.used_at;

    if (isCommittedVerified && userId) {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          email_verified: true,
          verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (updateError) {
        console.error('verification-status sync error:', updateError);
      }
    }

    return NextResponse.json(
      {
        verified: isCommittedVerified,
        source: isCommittedVerified ? 'committed_token' : 'unverified',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('verification-status error:', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}
