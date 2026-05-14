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

    if (userRow?.email_verified || userRow?.verified) {
      return NextResponse.json({ verified: true }, { status: 200 });
    }

    const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
    const authUser = listData?.users?.find((user) => user.email?.toLowerCase() === email);

    return NextResponse.json({ verified: !!authUser?.email_confirmed_at }, { status: 200 });
  } catch (error) {
    console.error('verification-status error:', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}
