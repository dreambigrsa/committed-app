-- ============================================
-- PAYMENT VERIFICATION SYSTEM
-- ============================================
-- Allows users to submit payment proof and admins to verify payments

-- ============================================
-- PAYMENT SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_proof_url TEXT, -- Image/PDF of payment receipt
  transaction_reference TEXT, -- Transaction ID or reference number
  payment_date DATE,
  notes TEXT, -- Additional notes from user
  
  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT, -- Reason if rejected
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_submissions_user ON payment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_plan ON payment_submissions(subscription_plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_method ON payment_submissions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_created ON payment_submissions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Users can view their own payment submissions
CREATE POLICY "Users can view their payment submissions" ON payment_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create payment submissions
CREATE POLICY "Users can create payment submissions" ON payment_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all payment submissions
CREATE POLICY "Admins can view all payment submissions" ON payment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Admins can update payment submissions (verify)
CREATE POLICY "Admins can verify payments" ON payment_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- FUNCTION: Auto-activate subscription on approval
-- ============================================
CREATE OR REPLACE FUNCTION activate_subscription_on_payment_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment is approved and has a subscription plan, activate the subscription
  IF NEW.status = 'approved' AND OLD.status = 'pending' AND NEW.subscription_plan_id IS NOT NULL THEN
    -- Check if user already has an active subscription for this plan
    INSERT INTO user_subscriptions (
      user_id,
      subscription_plan_id,
      status,
      start_date,
      end_date
    )
    SELECT
      NEW.user_id,
      NEW.subscription_plan_id,
      'active',
      NOW(),
      NOW() + INTERVAL '1 month' * sp.duration_months
    FROM subscription_plans sp
    WHERE sp.id = NEW.subscription_plan_id
    ON CONFLICT (user_id, subscription_plan_id) 
    DO UPDATE SET
      status = 'active',
      start_date = NOW(),
      end_date = NOW() + INTERVAL '1 month' * (SELECT duration_months FROM subscription_plans WHERE id = NEW.subscription_plan_id),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Auto-activate subscription
-- ============================================
DROP TRIGGER IF EXISTS payment_approval_trigger ON payment_submissions;
CREATE TRIGGER payment_approval_trigger
AFTER UPDATE ON payment_submissions
FOR EACH ROW
WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
EXECUTE FUNCTION activate_subscription_on_payment_approval();

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_payment_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_submissions_updated_at ON payment_submissions;
CREATE TRIGGER payment_submissions_updated_at
BEFORE UPDATE ON payment_submissions
FOR EACH ROW
EXECUTE FUNCTION update_payment_submissions_updated_at();

