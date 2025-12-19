-- ============================================
-- ADD USER SETTINGS TABLE & POST/REEL MODERATION
-- ============================================

-- Create user_settings table for storing user preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  notification_settings JSONB DEFAULT '{"relationshipRequests": true, "cheatingAlerts": true, "partnerActivity": true, "verificationUpdates": true}'::jsonb,
  privacy_settings JSONB DEFAULT '{"profileVisibility": "public", "showRelationshipHistory": false, "allowSearchByPhone": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add status column to posts for moderation
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE posts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add status column to reels for moderation
ALTER TABLE reels ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE reels ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Add unique username support for better search
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create indexes for user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Create indexes for post/reel status
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_reels_status ON reels(status);

-- Update RLS policies for user_settings
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE 
  USING (auth.uid() = user_id);

-- Update posts policy to only show approved posts to regular users
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
CREATE POLICY "Users can view approved posts or own posts" ON posts FOR SELECT 
  USING (
    status = 'approved' OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Update reels policy to only show approved reels to regular users
DROP POLICY IF EXISTS "Anyone can view reels" ON reels;
CREATE POLICY "Users can view approved reels or own reels" ON reels FOR SELECT 
  USING (
    status = 'approved' OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Add trigger to update user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_settings IS 'User notification and privacy settings';
COMMENT ON COLUMN posts.status IS 'Moderation status: pending, approved, or rejected';
COMMENT ON COLUMN reels.status IS 'Moderation status: pending, approved, or rejected';
