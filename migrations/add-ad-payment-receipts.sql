-- ============================================
-- AD PAYMENT RECEIPTS
-- ============================================
-- Auto-generated receipts for paid ads

CREATE TABLE IF NOT EXISTS ad_payment_receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertisement_id UUID REFERENCES advertisements(id) ON DELETE SET NULL,
  payment_submission_id UUID REFERENCES payment_submissions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  receipt_number TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_payment_receipts_user ON ad_payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_payment_receipts_ad ON ad_payment_receipts(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_ad_payment_receipts_submission ON ad_payment_receipts(payment_submission_id);

-- Users can view their receipts
CREATE POLICY "Users can view their ad payment receipts" ON ad_payment_receipts FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all receipts
CREATE POLICY "Admins can view all ad payment receipts" ON ad_payment_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );
