-- ============================================
-- DATING INTERESTS ADMIN MANAGEMENT
-- ============================================
-- Allows admins to manage dating interests (like Tinder)

-- ============================================
-- DATING INTERESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon_emoji TEXT, -- Emoji icon for the interest
  category TEXT, -- e.g., 'sports', 'music', 'lifestyle', 'hobbies'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dating_interests_active ON dating_interests(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_dating_interests_category ON dating_interests(category);
CREATE INDEX IF NOT EXISTS idx_dating_interests_order ON dating_interests(display_order);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active interests" ON dating_interests;
DROP POLICY IF EXISTS "Admins can manage interests" ON dating_interests;

-- Everyone can view active interests
CREATE POLICY "Anyone can view active interests" ON dating_interests FOR SELECT
  USING (is_active = TRUE);

-- Admins can manage interests
CREATE POLICY "Admins can manage interests" ON dating_interests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- DEFAULT INTERESTS (Tinder-like)
-- ============================================
INSERT INTO dating_interests (name, icon_emoji, category, display_order) VALUES
  -- Sports & Fitness
  ('Fitness', '💪', 'sports', 1),
  ('Running', '🏃', 'sports', 2),
  ('Yoga', '🧘', 'sports', 3),
  ('Gym', '🏋️', 'sports', 4),
  ('Basketball', '🏀', 'sports', 5),
  ('Soccer', '⚽', 'sports', 6),
  ('Tennis', '🎾', 'sports', 7),
  ('Swimming', '🏊', 'sports', 8),
  
  -- Music & Entertainment
  ('Music', '🎵', 'music', 10),
  ('Concerts', '🎤', 'music', 11),
  ('DJ', '🎧', 'music', 12),
  ('Guitar', '🎸', 'music', 13),
  ('Piano', '🎹', 'music', 14),
  ('Singing', '🎤', 'music', 15),
  
  -- Movies & TV
  ('Movies', '🎬', 'entertainment', 20),
  ('Netflix', '📺', 'entertainment', 21),
  ('Anime', '🎌', 'entertainment', 22),
  ('Comedy', '😂', 'entertainment', 23),
  
  -- Food & Dining
  ('Cooking', '👨‍🍳', 'food', 30),
  ('Foodie', '🍕', 'food', 31),
  ('Wine', '🍷', 'food', 32),
  ('Coffee', '☕', 'food', 33),
  ('Brunch', '🥐', 'food', 34),
  
  -- Travel & Adventure
  ('Travel', '✈️', 'travel', 40),
  ('Adventure', '🏔️', 'travel', 41),
  ('Beach', '🏖️', 'travel', 42),
  ('Hiking', '🥾', 'travel', 43),
  ('Camping', '⛺', 'travel', 44),
  ('Photography', '📷', 'travel', 45),
  
  -- Arts & Culture
  ('Art', '🎨', 'arts', 50),
  ('Museums', '🏛️', 'arts', 51),
  ('Theater', '🎭', 'arts', 52),
  ('Dancing', '💃', 'arts', 53),
  ('Writing', '✍️', 'arts', 54),
  
  -- Tech & Gaming
  ('Gaming', '🎮', 'tech', 60),
  ('Tech', '💻', 'tech', 61),
  ('Coding', '⌨️', 'tech', 62),
  ('Anime', '🎌', 'tech', 63),
  
  -- Lifestyle
  ('Fashion', '👗', 'lifestyle', 70),
  ('Shopping', '🛍️', 'lifestyle', 71),
  ('Beauty', '💄', 'lifestyle', 72),
  ('Wellness', '🧘', 'lifestyle', 73),
  ('Meditation', '🧘‍♀️', 'lifestyle', 74),
  
  -- Social
  ('Partying', '🎉', 'social', 80),
  ('Bars', '🍻', 'social', 81),
  ('Clubbing', '🕺', 'social', 82),
  ('Karaoke', '🎤', 'social', 83),
  
  -- Hobbies
  ('Reading', '📚', 'hobbies', 90),
  ('Writing', '✍️', 'hobbies', 91),
  ('Drawing', '🖌️', 'hobbies', 92),
  ('Crafts', '🎨', 'hobbies', 93),
  ('Gardening', '🌱', 'hobbies', 94),
  ('Pets', '🐕', 'hobbies', 95),
  
  -- Other
  ('Politics', '🗳️', 'other', 100),
  ('Activism', '✊', 'other', 101),
  ('Volunteering', '🤝', 'other', 102),
  ('Spirituality', '🕉️', 'other', 103)
ON CONFLICT (name) DO NOTHING;

