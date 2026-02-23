/**
 * POST /api/cron/send-follow-up-emails
 *
 * Sends subscription follow-up, due, and expired emails. Protected by CRON_SECRET.
 * Call via Vercel Cron or manually with Authorization: Bearer <CRON_SECRET>.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { Resend } from 'resend';
import {
  subscriptionFollowUpEmail,
  subscriptionDueEmail,
  subscriptionExpiredEmail,
} from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';
const APP_SCHEME = process.env.NEXT_PUBLIC_DEEPLINK_SCHEME || 'committed://';
const DOWNLOAD_URL = `${SITE_URL}/download`;
const PREMIUM_APP_URL = `${APP_SCHEME}dating/premium`;
const FOLLOW_UP_COOLDOWN_DAYS = 7;
const MIN_DAYS_SINCE_SIGNUP = 3; // Don't email brand-new users
const DUE_SOON_DAYS = 3;
const EXPIRED_COOLDOWN_DAYS = 14;

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return auth === `Bearer ${cronSecret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('[cron/send-follow-up-emails] RESEND_API_KEY not set');
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();
  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Committed <noreply@resend.dev>';

  const cooldown = new Date();
  cooldown.setDate(cooldown.getDate() - FOLLOW_UP_COOLDOWN_DAYS);
  const dueSoonStart = new Date();
  dueSoonStart.setDate(dueSoonStart.getDate() + 1);
  const dueSoonEnd = new Date();
  dueSoonEnd.setDate(dueSoonEnd.getDate() + DUE_SOON_DAYS);
  const expiredCooldown = new Date();
  expiredCooldown.setDate(expiredCooldown.getDate() - EXPIRED_COOLDOWN_DAYS);

  const results = { followUp: 0, dueSoon: 0, expired: 0, errors: 0 };

  try {
    // 1) Users who never subscribed (no active subscription)
    const { data: activeSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .in('status', ['active', 'trial']);

    const activeUserIds = new Set((activeSubs || []).map((s) => s.user_id));

    const { data: neverSubscribed } = await supabase
      .from('users')
      .select('id, email, created_at')
      .not('email', 'is', null);

    const neverSubUsers = (neverSubscribed || []).filter(
      (u) => u.email && !activeUserIds.has(u.id)
    );

    const minSignupDate = new Date();
    minSignupDate.setDate(minSignupDate.getDate() - MIN_DAYS_SINCE_SIGNUP);

    for (const user of neverSubUsers) {
      if (new Date(user.created_at) > minSignupDate) continue;
      const { data: alreadySent } = await supabase
        .from('email_sent_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_type', 'subscription_follow_up')
        .gte('sent_at', cooldown.toISOString())
        .limit(1)
        .maybeSingle();

      if (alreadySent) continue;

      const daysSince = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const html = subscriptionFollowUpEmail(PREMIUM_APP_URL, DOWNLOAD_URL, daysSince);

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: [user.email!],
        subject: 'Unlock more with Committed Premium',
        html,
      });

      if (error) {
        console.error('[cron] follow-up send error:', user.id, error.message);
        results.errors++;
      } else {
        await supabase.from('email_sent_log').insert({
          user_id: user.id,
          email_type: 'subscription_follow_up',
        });
        results.followUp++;
      }
    }

    // 2) Users whose subscription expires in 1-3 days
    const { data: dueSoon } = await supabase
      .from('user_subscriptions')
      .select(
        `
        user_id,
        expires_at,
        plan:subscription_plans!inner(display_name)
      `
      )
      .in('status', ['active', 'trial'])
      .not('expires_at', 'is', null)
      .gte('expires_at', dueSoonStart.toISOString())
      .lte('expires_at', dueSoonEnd.toISOString());

    for (const sub of dueSoon || []) {
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', sub.user_id)
        .single();

      if (!user?.email) continue;

      const { data: alreadySent } = await supabase
        .from('email_sent_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_type', 'subscription_due')
        .gte('sent_at', cooldown.toISOString())
        .limit(1)
        .maybeSingle();

      if (alreadySent) continue;

      const daysLeft = Math.ceil(
        (new Date(sub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const planName =
        (sub.plan as { display_name?: string })?.display_name || 'Premium';
      const html = subscriptionDueEmail(PREMIUM_APP_URL, daysLeft, planName);

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        subject: `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        html,
      });

      if (error) {
        console.error('[cron] due-soon send error:', user.id, error.message);
        results.errors++;
      } else {
        await supabase.from('email_sent_log').insert({
          user_id: user.id,
          email_type: 'subscription_due',
        });
        results.dueSoon++;
      }
    }

    // 3) Users whose subscription expired recently (send once after expiry)
    const { data: expiredSubs } = await supabase
      .from('user_subscriptions')
      .select(
        `
        user_id,
        expires_at,
        plan:subscription_plans!inner(display_name)
      `
      )
      .in('status', ['expired', 'cancelled'])
      .gte('expires_at', expiredCooldown.toISOString())
      .lt('expires_at', new Date().toISOString());

    for (const sub of expiredSubs || []) {
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', sub.user_id)
        .single();

      if (!user?.email) continue;

      const { data: alreadySent } = await supabase
        .from('email_sent_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_type', 'subscription_expired')
        .gte('sent_at', expiredCooldown.toISOString())
        .limit(1)
        .maybeSingle();

      if (alreadySent) continue;

      const planName =
        (sub.plan as { display_name?: string })?.display_name || 'Premium';
      const html = subscriptionExpiredEmail(PREMIUM_APP_URL, planName);

      const { error } = await resend.emails.send({
        from: fromEmail,
        to: [user.email],
        subject: 'Your Committed subscription has expired',
        html,
      });

      if (error) {
        console.error('[cron] expired send error:', user.id, error.message);
        results.errors++;
      } else {
        await supabase.from('email_sent_log').insert({
          user_id: user.id,
          email_type: 'subscription_expired',
        });
        results.expired++;
      }
    }

    console.info('[cron/send-follow-up-emails] Done:', results);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error('[cron/send-follow-up-emails] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
