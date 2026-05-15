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
    const { data: profileByEmail } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    const userId = userRow?.id || profileByEmail?.id || authUser?.id || null;

    const authEmailConfirmedAt = authUser?.email_confirmed_at ?? null;

    if (userId) {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('is_verified,verified_at')
        .eq('id', userId)
        .maybeSingle();
      if (profileError) {
        console.error('verification-status profile lookup error:', profileError);
      }
      if (profileRow?.is_verified === true && authEmailConfirmedAt) {
        return NextResponse.json(
          {
            verified: true,
            source: 'profile',
            verifiedAt: profileRow.verified_at ?? null,
            emailConfirmedAt: authEmailConfirmedAt,
          },
          { status: 200 }
        );
      }
    }

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
      const verifiedAt = tokenRow.used_at || new Date().toISOString();
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email,
            is_verified: true,
            verified_at: verifiedAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      if (profileUpdateError) {
        console.error('verification-status profile sync error:', profileUpdateError);
      }
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
      await supabase.auth.admin.updateUserById(userId, { email_confirm: true }).catch((error) => {
        console.error('verification-status auth confirm sync error:', error);
      });

      if (!authEmailConfirmedAt) {
        return NextResponse.json(
          {
            verified: false,
            source: 'auth_confirmation_pending',
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      {
        verified: isCommittedVerified,
        source: isCommittedVerified ? 'committed_token_synced_to_profile' : 'unverified',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('verification-status error:', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}
