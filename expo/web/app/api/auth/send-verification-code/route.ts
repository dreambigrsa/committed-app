/**
 * POST /api/auth/send-verification-code
 * Sends email verification code via Resend. Matches design of other auth emails.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { Resend } from 'resend';
import { verificationCodeEmail } from '@/lib/email-templates';

const RATE_LIMIT_PER_EMAIL_MINUTES = 5;
const RATE_LIMIT_MAX_PER_EMAIL = 5;
const CODE_EXPIRY_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null;
    const code = typeof body?.code === 'string' ? body.code.trim() : null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Valid email required' }, { status: 400 });
    }
    if (!code || code.length < 4) {
      return NextResponse.json({ success: false, error: 'Valid code required' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set');
      return NextResponse.json({ success: false, error: 'Email service unavailable' }, { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Committed <noreply@resend.dev>';
    const html = verificationCodeEmail(code, CODE_EXPIRY_MINUTES);

    const { data, error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'Your Committed verification code',
      html,
      text: `Your Committed verification code is: ${code}. This code expires in ${CODE_EXPIRY_MINUTES} minutes.`,
    });

    if (sendError) {
      console.error('Resend send error:', sendError.message, sendError);
      return NextResponse.json(
        { success: false, error: sendError.message || 'Failed to send email' },
        { status: 500 }
      );
    }
    if (!data?.id) {
      return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error('send-verification-code error:', e);
    return NextResponse.json({ success: false, error: 'Failed to send email' }, { status: 500 });
  }
}
