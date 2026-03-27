-- ============================================
-- DATING DATE REQUEST OPTIONS ADMIN
-- ============================================
-- Allows admins to manage date request options (dress codes, budget ranges, etc.)

-- ============================================
-- DATE REQUEST OPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_date_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_type TEXT NOT NULL, -- 'dress_code', 'budget_range', 'suggested_activity'
  option_value TEXT NOT NULL, -- The actual value (e.g., 'casual', 'low', 'Coffee')
  display_label TEXT NOT NULL, -- Display name (e.g., 'Casual', 'Low Budget', 'Coffee & Conversation')
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(option_type, option_value)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dating_date_options_type ON dating_date_options(option_type);
CREATE INDEX IF NOT EXISTS idx_dating_date_options_active ON dating_date_options(option_type, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_dating_date_options_order ON dating_date_options(option_type, display_order);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Everyone can view active options
DROP POLICY IF EXISTS "Anyone can view active date options" ON dating_date_options;
CREATE POLICY "Anyone can view active date options" ON dating_date_options FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage options
DROP POLICY IF EXISTS "Admins can manage date options" ON dating_date_options;
CREATE POLICY "Admins can manage date options" ON dating_date_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- DEFAULT OPTIONS
-- ============================================
-- Dress Codes
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order) VALUES
  ('dress_code', 'casual', 'Casual', 1),
  ('dress_code', 'smart_casual', 'Smart Casual', 2),
  ('dress_code', 'formal', 'Formal', 3),
  ('dress_code', 'beach', 'Beach', 4),
  ('dress_code', 'outdoor', 'Outdoor', 5)
ON CONFLICT (option_type, option_value) DO NOTHING;

-- Budget Ranges
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order) VALUES
  ('budget_range', 'low', 'Low Budget', 1),
  ('budget_range', 'medium', 'Medium Budget', 2),
  ('budget_range', 'high', 'High Budget', 3)
ON CONFLICT (option_type, option_value) DO NOTHING;

-- Expense Handling Options
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order) VALUES
  ('expense_handling', 'split', 'Split the Bill', 1),
  ('expense_handling', 'initiator_pays', 'I''ll Pay', 2),
  ('expense_handling', 'acceptor_pays', 'You Pay', 3)
ON CONFLICT (option_type, option_value) DO NOTHING;

-- Suggested Activities (Common ones)
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order) VALUES
  ('suggested_activity', 'coffee', 'Coffee & Conversation', 1),
  ('suggested_activity', 'dinner', 'Dinner', 2),
  ('suggested_activity', 'movie', 'Movie', 3),
  ('suggested_activity', 'walk', 'Walk in the Park', 4),
  ('suggested_activity', 'museum', 'Museum Visit', 5),
  ('suggested_activity', 'concert', 'Concert', 6),
  ('suggested_activity', 'beach', 'Beach Day', 7),
  ('suggested_activity', 'hiking', 'Hiking', 8),
  ('suggested_activity', 'brunch', 'Brunch', 9),
  ('suggested_activity', 'art_gallery', 'Art Gallery', 10),
  ('suggested_activity', 'cooking', 'Cooking Class', 11),
  ('suggested_activity', 'wine_tasting', 'Wine Tasting', 12),
  ('suggested_activity', 'bowling', 'Bowling', 13),
  ('suggested_activity', 'mini_golf', 'Mini Golf', 14),
  ('suggested_activity', 'arcade', 'Arcade Games', 15)
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_dating_date_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dating_date_options_updated_at ON dating_date_options;
CREATE TRIGGER dating_date_options_updated_at
BEFORE UPDATE ON dating_date_options
FOR EACH ROW
EXECUTE FUNCTION update_dating_date_options_updated_at();

