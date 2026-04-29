-- Tighten ad promotion/payment flow.
-- Run this in Supabase SQL editor after the earlier ad payment migrations.

-- Prevent duplicate receipts for the same verified ad payment submission.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_payment_receipts_submission_unique
  ON ad_payment_receipts(payment_submission_id)
  WHERE payment_submission_id IS NOT NULL;

-- Speed up the admin/user ad views and delivery filters.
CREATE INDEX IF NOT EXISTS idx_ads_delivery_state
  ON advertisements(status, billing_status, active, placement, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id
  ON advertisement_impressions(advertisement_id);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id
  ON advertisement_clicks(advertisement_id);

CREATE INDEX IF NOT EXISTS idx_ad_payment_receipts_ad_user
  ON ad_payment_receipts(advertisement_id, user_id);
