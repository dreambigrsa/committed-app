/**
 * POST /api/auth/request-password-reset
 * Creates reset_password token, sends email via Resend. Replaces Supabase Edge Function.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { randomToken, hashToken } from '@/lib/auth-tokens';
import { Resend } from 'resend';
import { passwordResetEmail } from '@/lib/email-templates';

const RESET_EXPIRY_MINUTES = 30;
const RATE_LIMIT_PER_EMAIL_MINUTES = 10;
const RATE_LIMIT_MAX_PER_EMAIL = 3;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: true, message: 'If this email is registered, you will receive a password reset link.' },
        { status: 200 }
      );
    }

    const supabase = createSupabaseAdmin();

    const { data: recent } = await supabase
      .from('auth_tokens')
      .select('id')
      .eq('email', email)
      .eq('type', 'reset_password')
      .gte('created_at', new Date(Date.now() - RATE_LIMIT_PER_EMAIL_MINUTES * 60 * 1000).toISOString());
    if (recent && recent.length >= RATE_LIMIT_MAX_PER_EMAIL) {
      return NextResponse.json(
        { success: true, message: 'If this email is registered, you will receive a password reset link.' },
        { status: 200 }
      );
    }

    const { data: profileRow } = await supabase.from('profiles').select('id').eq('email', email).limit(1).maybeSingle();
    const uid = profileRow?.id ?? null;

    const rawToken = randomToken(32);
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

    const { error: insertErr } = await supabase.from('auth_tokens').insert({
      user_id: uid,
      email,
      token_hash: tokenHash,
      type: 'reset_password',
      expires_at: expiresAt,
      request_ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
      user_agent: req.headers.get('user-agent') ?? null,
    });
    if (insertErr) {
      console.error('auth_tokens insert error:', insertErr.message);
      return NextResponse.json(
        { success: true, message: 'If this email is registered, you will receive a password reset link.' },
        { status: 200 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';
    const appScheme = process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'committed://';
    const resetUrl = `${siteUrl}/auth-callback?type=recovery&token=${encodeURIComponent(rawToken)}`;
    const deepLink = `${appScheme}auth-callback?type=recovery&token=${encodeURIComponent(rawToken)}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set');
      return NextResponse.json(
        { success: true, message: 'If this email is registered, you will receive a password reset link.' },
        { status: 200 }
      );
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Committed <noreply@resend.dev>';
    const html = passwordResetEmail(resetUrl, deepLink, RESET_EXPIRY_MINUTES);

    await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Reset your password – Committed',
      html,
    });

    return NextResponse.json(
      { success: true, message: 'If this email is registered, you will receive a password reset link.' },
      { status: 200 }
    );
  } catch (e) {
    console.error('request-password-reset error:', e);
    return NextResponse.json(
      { success: true, message: 'If this email is registered, you will receive a password reset link.' },
      { status: 200 }
    );
  }
}
