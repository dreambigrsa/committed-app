# Email Campaign System

Automated follow-up emails for subscription-related notifications.

## Campaigns

| Campaign | When | Cooldown |
|----------|------|----------|
| **Never subscribed** | Users with no active subscription, signed up 3+ days ago | 7 days |
| **Subscription due soon** | Subscription expires in 1–3 days | 7 days |
| **Subscription expired** | Subscription expired in last 14 days | 14 days |

## Setup

### 1. Database

Run the migration to create `email_sent_log`:

```bash
# In Supabase SQL Editor or via migration
supabase/migrations/20250219000000_add_email_sent_log.sql
```

### 2. Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for sending emails |
| `RESEND_FROM_EMAIL` | e.g. `Committed <noreply@dreambig.org.za>` |
| `CRON_SECRET` | Secret for cron job authorization |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://committed.dreambig.org.za` |
| `NEXT_PUBLIC_DEEPLINK_SCHEME` | e.g. `committed://` |

### 3. Cron Schedule

`vercel.json` configures a daily cron at **8:00 AM UTC**. Vercel invokes:

```
POST /api/cron/send-follow-up-emails
Authorization: Bearer <CRON_SECRET>
```

## Manual Test

```bash
curl -X POST https://committed.dreambig.org.za/api/cron/send-follow-up-emails \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Templates

- `subscriptionFollowUpEmail` – users who never subscribed
- `subscriptionDueEmail` – subscription due soon
- `subscriptionExpiredEmail` – subscription expired

Defined in `web/lib/email-templates.ts`.
