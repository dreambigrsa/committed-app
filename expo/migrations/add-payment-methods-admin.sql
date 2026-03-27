-- ============================================
-- PAYMENT METHODS ADMIN MANAGEMENT
-- ============================================
-- Allows admins to create and manage payment methods for subscriptions

-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g., "Bank Transfer", "Mobile Money", "Cash Payment"
  description TEXT, -- Instructions for users
  payment_type TEXT NOT NULL CHECK (payment_type IN ('bank_transfer', 'mobile_money', 'cash', 'crypto', 'other')),
  account_details JSONB, -- Flexible JSON for account numbers, phone numbers, etc.
  instructions TEXT, -- Step-by-step instructions for users
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  icon_emoji TEXT, -- Emoji icon for the payment method
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_order ON payment_methods(display_order);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Everyone can view active payment methods
DROP POLICY IF EXISTS "Anyone can view active payment methods" ON payment_methods;
CREATE POLICY "Anyone can view active payment methods" ON payment_methods FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage payment methods
DROP POLICY IF EXISTS "Admins can manage payment methods" ON payment_methods;
CREATE POLICY "Admins can manage payment methods" ON payment_methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- DEFAULT PAYMENT METHODS
-- ============================================
INSERT INTO payment_methods (name, description, payment_type, account_details, instructions, display_order, icon_emoji) VALUES
  (
    'Bank Transfer',
    'Transfer funds directly to our bank account',
    'bank_transfer',
    '{"bank_name": "Example Bank", "account_number": "1234567890", "account_name": "Committed App", "swift_code": "EXAMPLEXXX", "branch": "Main Branch"}'::jsonb,
    '1. Log in to your banking app\n2. Select "Transfer"\n3. Enter account details above\n4. Use your user ID as reference\n5. Send proof of payment',
    1,
    '🏦'
  ),
  (
    'Mobile Money',
    'Pay using mobile money services',
    'mobile_money',
    '{"provider": "MTN Mobile Money", "phone_number": "+1234567890", "name": "Committed App"}'::jsonb,
    '1. Open your mobile money app\n2. Select "Send Money"\n3. Enter the phone number above\n4. Enter amount\n5. Use your user ID as reference\n6. Send proof of payment',
    2,
    '📱'
  ),
  (
    'Cash Payment',
    'Pay in person at our office',
    'cash',
    '{"location": "123 Main Street, City", "office_hours": "Mon-Fri 9AM-5PM"}'::jsonb,
    '1. Visit our office during business hours\n2. Bring exact cash amount\n3. Provide your user ID\n4. Receive receipt',
    3,
    '💵'
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_methods_updated_at ON payment_methods;
CREATE TRIGGER payment_methods_updated_at
BEFORE UPDATE ON payment_methods
FOR EACH ROW
EXECUTE FUNCTION update_payment_methods_updated_at();

