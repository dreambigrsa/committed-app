-- ============================================
-- DATING DATE REQUEST OPTIONS - COMPLETE SQL
-- ============================================
-- Complete SQL for managing date request options
-- Includes: dress codes, budget ranges, expense handling, suggested activities, and more

-- ============================================
-- DATE REQUEST OPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_date_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_type TEXT NOT NULL,
  option_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT, -- Optional description for the option
  icon_emoji TEXT, -- Optional emoji icon
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(option_type, option_value)
);

-- ============================================
-- ADD MISSING COLUMNS (if table already exists)
-- ============================================
ALTER TABLE dating_date_options 
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon_emoji TEXT;

-- ============================================
-- ADD CHECK CONSTRAINT FOR OPTION TYPE (if not exists)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dating_date_options_option_type_check'
  ) THEN
    ALTER TABLE dating_date_options 
      ADD CONSTRAINT dating_date_options_option_type_check 
      CHECK (option_type IN (
        'dress_code', 
        'budget_range', 
        'expense_handling',
        'suggested_activity',
        'date_duration',
        'group_size',
        'time_of_day'
      ));
  END IF;
END $$;

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

-- Admins can manage all options
DROP POLICY IF EXISTS "Admins can manage date options" ON dating_date_options;
CREATE POLICY "Admins can manage date options" ON dating_date_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- ============================================
-- DEFAULT OPTIONS - DRESS CODES
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, icon_emoji) VALUES
  ('dress_code', 'casual', 'Casual', 1, '👕'),
  ('dress_code', 'smart_casual', 'Smart Casual', 2, '👔'),
  ('dress_code', 'business_casual', 'Business Casual', 3, '👨‍💼'),
  ('dress_code', 'formal', 'Formal', 4, '🎩'),
  ('dress_code', 'semi_formal', 'Semi-Formal', 5, '🤵'),
  ('dress_code', 'beach', 'Beach Wear', 6, '🏖️'),
  ('dress_code', 'outdoor', 'Outdoor/Active', 7, '🥾'),
  ('dress_code', 'cocktail', 'Cocktail Attire', 8, '🍸'),
  ('dress_code', 'black_tie', 'Black Tie', 9, '🎭'),
  ('dress_code', 'theme', 'Theme/Costume', 10, '🎪')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- DEFAULT OPTIONS - BUDGET RANGES
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, description, icon_emoji) VALUES
  ('budget_range', 'low', 'Low Budget', 1, 'Under $50', '💵'),
  ('budget_range', 'medium', 'Medium Budget', 2, '$50 - $150', '💸'),
  ('budget_range', 'high', 'High Budget', 3, '$150 - $300', '💰'),
  ('budget_range', 'luxury', 'Luxury', 4, '$300+', '💎'),
  ('budget_range', 'free', 'Free/No Cost', 5, 'No money needed', '🆓')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- DEFAULT OPTIONS - EXPENSE HANDLING
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, icon_emoji) VALUES
  ('expense_handling', 'split', 'Split the Bill', 1, '⚖️'),
  ('expense_handling', 'initiator_pays', 'I''ll Pay', 2, '💳'),
  ('expense_handling', 'acceptor_pays', 'You Pay', 3, '🎁'),
  ('expense_handling', 'alternate', 'Alternate (You Pay Next Time)', 4, '🔄')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- DEFAULT OPTIONS - SUGGESTED ACTIVITIES
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, icon_emoji) VALUES
  -- Food & Drinks
  ('suggested_activity', 'coffee', 'Coffee & Conversation', 1, '☕'),
  ('suggested_activity', 'brunch', 'Brunch', 2, '🥐'),
  ('suggested_activity', 'dinner', 'Dinner', 3, '🍽️'),
  ('suggested_activity', 'lunch', 'Lunch', 4, '🥗'),
  ('suggested_activity', 'wine_tasting', 'Wine Tasting', 5, '🍷'),
  ('suggested_activity', 'cocktails', 'Cocktails', 6, '🍸'),
  ('suggested_activity', 'food_tour', 'Food Tour', 7, '🍜'),
  ('suggested_activity', 'cooking_class', 'Cooking Class', 8, '👨‍🍳'),
  
  -- Entertainment
  ('suggested_activity', 'movie', 'Movie', 9, '🎬'),
  ('suggested_activity', 'concert', 'Concert', 10, '🎵'),
  ('suggested_activity', 'comedy_show', 'Comedy Show', 11, '😂'),
  ('suggested_activity', 'theater', 'Theater/Play', 12, '🎭'),
  ('suggested_activity', 'karaoke', 'Karaoke', 13, '🎤'),
  ('suggested_activity', 'dancing', 'Dancing', 14, '💃'),
  
  -- Outdoor Activities
  ('suggested_activity', 'walk', 'Walk in the Park', 15, '🚶'),
  ('suggested_activity', 'hiking', 'Hiking', 16, '⛰️'),
  ('suggested_activity', 'beach', 'Beach Day', 17, '🏖️'),
  ('suggested_activity', 'picnic', 'Picnic', 18, '🧺'),
  ('suggested_activity', 'bike_ride', 'Bike Ride', 19, '🚴'),
  ('suggested_activity', 'sunset', 'Watch Sunset', 20, '🌅'),
  ('suggested_activity', 'stargazing', 'Stargazing', 21, '⭐'),
  
  -- Cultural & Educational
  ('suggested_activity', 'museum', 'Museum Visit', 22, '🏛️'),
  ('suggested_activity', 'art_gallery', 'Art Gallery', 23, '🖼️'),
  ('suggested_activity', 'bookstore', 'Bookstore Browsing', 24, '📚'),
  ('suggested_activity', 'library', 'Library Visit', 25, '📖'),
  ('suggested_activity', 'workshop', 'Workshop/Class', 26, '🎓'),
  
  -- Active & Sports
  ('suggested_activity', 'bowling', 'Bowling', 27, '🎳'),
  ('suggested_activity', 'mini_golf', 'Mini Golf', 28, '⛳'),
  ('suggested_activity', 'arcade', 'Arcade Games', 29, '🎮'),
  ('suggested_activity', 'pool', 'Pool/Billiards', 30, '🎱'),
  ('suggested_activity', 'rock_climbing', 'Rock Climbing', 31, '🧗'),
  ('suggested_activity', 'yoga', 'Yoga Class', 32, '🧘'),
  ('suggested_activity', 'fitness', 'Fitness/Gym', 33, '💪'),
  
  -- Shopping & Markets
  ('suggested_activity', 'market', 'Farmer''s Market', 34, '🛒'),
  ('suggested_activity', 'shopping', 'Shopping', 35, '🛍️'),
  ('suggested_activity', 'flea_market', 'Flea Market', 36, '🏪'),
  
  -- Relaxation
  ('suggested_activity', 'spa', 'Spa Day', 37, '💆'),
  ('suggested_activity', 'massage', 'Massage', 38, '💆‍♀️'),
  ('suggested_activity', 'beach_day', 'Beach Day', 39, '🏖️'),
  
  -- Unique Experiences
  ('suggested_activity', 'escape_room', 'Escape Room', 40, '🔐'),
  ('suggested_activity', 'trivia', 'Trivia Night', 41, '🧠'),
  ('suggested_activity', 'board_games', 'Board Games', 42, '🎲'),
  ('suggested_activity', 'volunteer', 'Volunteer Together', 43, '🤝'),
  ('suggested_activity', 'photography', 'Photography Walk', 44, '📸'),
  ('suggested_activity', 'city_tour', 'City Tour', 45, '🏙️')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- DEFAULT OPTIONS - DATE DURATION
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, description, icon_emoji) VALUES
  ('date_duration', 'quick', 'Quick Meet (30 min - 1 hour)', 1, 'Coffee, quick lunch', '⏱️'),
  ('date_duration', 'standard', 'Standard (2-3 hours)', 2, 'Dinner, movie, activity', '⏰'),
  ('date_duration', 'half_day', 'Half Day (4-6 hours)', 3, 'Multiple activities', '🕐'),
  ('date_duration', 'full_day', 'Full Day (6+ hours)', 4, 'All day adventure', '🌅'),
  ('date_duration', 'weekend', 'Weekend Getaway', 5, 'Overnight or weekend', '🏕️')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- DEFAULT OPTIONS - GROUP SIZE
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, description, icon_emoji) VALUES
  ('group_size', 'just_us', 'Just Us Two', 1, 'Intimate one-on-one', '💑'),
  ('group_size', 'small_group', 'Small Group (3-5 people)', 2, 'Close friends', '👥'),
  ('group_size', 'medium_group', 'Medium Group (6-10 people)', 3, 'Friend group', '👨‍👩‍👧‍👦'),
  ('group_size', 'large_group', 'Large Group (10+ people)', 4, 'Party or event', '🎉')
ON CONFLICT (option_type, option_value) DO NOTHING;

-- ============================================
-- DEFAULT OPTIONS - TIME OF DAY
-- ============================================
INSERT INTO dating_date_options (option_type, option_value, display_label, display_order, icon_emoji) VALUES
  ('time_of_day', 'morning', 'Morning', 1, '🌅'),
  ('time_of_day', 'brunch', 'Brunch Time', 2, '🥐'),
  ('time_of_day', 'afternoon', 'Afternoon', 3, '☀️'),
  ('time_of_day', 'evening', 'Evening', 4, '🌆'),
  ('time_of_day', 'night', 'Night', 5, '🌙'),
  ('time_of_day', 'late_night', 'Late Night', 6, '🌃')
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

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get options by type
CREATE OR REPLACE FUNCTION get_date_options_by_type(p_option_type TEXT)
RETURNS TABLE (
  id UUID,
  option_value TEXT,
  display_label TEXT,
  display_order INTEGER,
  description TEXT,
  icon_emoji TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ddo.id,
    ddo.option_value,
    ddo.display_label,
    ddo.display_order,
    ddo.description,
    ddo.icon_emoji
  FROM dating_date_options ddo
  WHERE ddo.option_type = p_option_type
    AND ddo.is_active = TRUE
  ORDER BY ddo.display_order ASC, ddo.display_label ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE dating_date_options IS 'Stores configurable options for date requests (dress codes, budgets, activities, etc.)';
COMMENT ON COLUMN dating_date_options.option_type IS 'Type of option: dress_code, budget_range, expense_handling, suggested_activity, date_duration, group_size, time_of_day';
COMMENT ON COLUMN dating_date_options.option_value IS 'The actual value stored in the database';
COMMENT ON COLUMN dating_date_options.display_label IS 'Human-readable label shown to users';
COMMENT ON COLUMN dating_date_options.display_order IS 'Order in which options appear in UI';

