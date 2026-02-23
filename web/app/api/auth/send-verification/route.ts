/**
 * POST /api/auth/send-verification
 * Creates verify_email token (24h), sends email via Resend. Replaces Supabase Edge Function.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { randomToken, hashToken } from '@/lib/auth-tokens';
import { Resend } from 'resend';
import { verifyEmailEmail } from '@/lib/email-templates';

const VERIFY_EXPIRY_HOURS = 24;
const RATE_LIMIT_PER_EMAIL_MINUTES = 5;
const RATE_LIMIT_MAX_PER_EMAIL = 3;

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    let email: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user?.email) email = user.email;
    }
    if (!email) {
      const body = await req.json().catch(() => ({}));
      email = body?.email ?? null;
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: true, message: 'If this email is registered, you will receive a verification link.' },
        { status: 200 }
      );
    }

    email = email.toLowerCase().trim();

    const { data: recent } = await supabase
      .from('auth_tokens')
      .select('id')
      .eq('email', email)
      .eq('type', 'verify_email')
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_PER_EMAIL_MINUTES * 60 * 1000).toISOString());
    if (recent && recent.length >= RATE_LIMIT_MAX_PER_EMAIL) {
      return NextResponse.json(
        { success: true, message: 'If this email is registered, you will receive a verification link.' },
        { status: 200 }
      );
    }

    let uid: string | null = null;
    const { data: profileRow } = await supabase.from('profiles').select('id').eq('email', email).limit(1).maybeSingle();
    if (profileRow?.id) uid = profileRow.id;
    if (!uid) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 });
      const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (authUser?.id) uid = authUser.id;
    }

    const rawToken = randomToken(32);
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFY_EXPIRY_HOURS * 60 * 60 * 1000);

    const { error: insertErr } = await supabase.from('auth_tokens').insert({
      user_id: uid,
      email,
      token_hash: tokenHash,
      type: 'verify_email',
      expires_at: expiresAt,
      request_ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
    if (insertErr) {
      console.error('auth_tokens insert error:', insertErr.message);
      return NextResponse.json(
        { success: false, error: 'Unable to process request. Please try again later.' },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';
    const appScheme = process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'committed://';
    const verifyUrl = `${siteUrl}/auth-callback?type=verify&token=${encodeURIComponent(rawToken)}`;
    const deepLink = `${appScheme}auth-callback?type=verify&token=${encodeURIComponent(rawToken)}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set');
      return NextResponse.json(
        { success: false, error: 'Email service is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Committed <noreply@resend.dev>';
    const html = verifyEmailEmail(verifyUrl, deepLink, VERIFY_EXPIRY_HOURS);

    const { data, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Verify your email – Committed',
      html,
    });

    if (sendError) {
      console.error('Resend send error:', sendError.message, sendError);
      return NextResponse.json(
        {
          success: false,
          error:
            sendError.message?.includes('domain') || sendError.message?.includes('verify')
              ? 'Email could not be sent. Please contact support—domain may need verification.'
              : 'We couldn\'t send the verification email. Please try again in a few minutes.',
        },
        { status: 500 }
      );
    }

    if (!data?.id) {
      console.error('Resend returned no email id:', data);
      return NextResponse.json(
        { success: false, error: 'We couldn\'t send the verification email. Please try again.' },
        { status: 500 }
      );
    }

    console.info('[send-verification] Sent email', { resendId: data.id, toDomain: email.split('@')[1] });

    return NextResponse.json(
      { success: true, message: 'If this email is registered, you will receive a verification link.' },
      { status: 200 }
    );
  } catch (e) {
    console.error('send-verification error:', e);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
