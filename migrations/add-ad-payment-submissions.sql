-- ============================================
-- AD PAYMENT SUBMISSIONS
-- ============================================
-- Extend payment_submissions to support ads

ALTER TABLE payment_submissions
  ADD COLUMN IF NOT EXISTS advertisement_id UUID REFERENCES advertisements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_submissions_ad ON payment_submissions(advertisement_id);

