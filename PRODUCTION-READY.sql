-- PRODUCTION READY DATABASE SETUP
-- Run this complete SQL script in your Supabase SQL Editor
-- This includes all tables, RLS policies, functions, and triggers

-- =============================================
-- 1. CREATE ALL TABLES
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  profile_picture TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'super_admin')),
  phone_verified BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  id_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  partner_phone TEXT NOT NULL,
  partner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('married', 'engaged', 'serious', 'dating')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'ended', 'disputed')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  verified_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  privacy_level TEXT DEFAULT 'public' CHECK (privacy_level IN ('public', 'private', 'verified-only')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationship requests table
CREATE TABLE IF NOT EXISTS relationship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_name TEXT NOT NULL,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[],
  media_type TEXT CHECK (media_type IN ('image', 'video', 'none')),
  comment_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reels table
CREATE TABLE IF NOT EXISTS reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  comment_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reel likes table
CREATE TABLE IF NOT EXISTS reel_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reel_id, user_id)
);

-- Reel comments table
CREATE TABLE IF NOT EXISTS reel_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id UUID NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_ids UUID[] NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cheating alerts table
CREATE TABLE IF NOT EXISTS cheating_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  description TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Follows table
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'escalated')),
  resolution TEXT,
  auto_resolve_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Couple certificates table
CREATE TABLE IF NOT EXISTS couple_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  certificate_url TEXT NOT NULL,
  verification_selfie_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anniversaries table
CREATE TABLE IF NOT EXISTS anniversaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  reminder_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reported content table
CREATE TABLE IF NOT EXISTS reported_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  type TEXT NOT NULL CHECK (type IN ('banner', 'video', 'sponsored')),
  placement TEXT NOT NULL CHECK (placement IN ('feed', 'reels', 'all')),
  active BOOLEAN DEFAULT TRUE,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advertisement impressions table
CREATE TABLE IF NOT EXISTS advertisement_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advertisement clicks table
CREATE TABLE IF NOT EXISTS advertisement_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notification_settings JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_relationships_user_id ON relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_partner_user_id ON relationships(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_relationships_status ON relationships(status);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_user_id ON reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cheating_alerts_user_id ON cheating_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- =============================================
-- 3. CREATE RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheating_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reported_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisement_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisement_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Relationships policies
CREATE POLICY "Anyone can view public relationships" ON relationships FOR SELECT USING (
  privacy_level = 'public' OR 
  user_id = auth.uid() OR 
  partner_user_id = auth.uid()
);
CREATE POLICY "Users can create relationships" ON relationships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their relationships" ON relationships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = partner_user_id);

-- Relationship requests policies
CREATE POLICY "Users can view their requests" ON relationship_requests FOR SELECT USING (to_user_id = auth.uid() OR from_user_id = auth.uid());
CREATE POLICY "Users can create requests" ON relationship_requests FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can update requests sent to them" ON relationship_requests FOR UPDATE USING (to_user_id = auth.uid());

-- Posts policies
CREATE POLICY "Anyone can view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Post likes policies
CREATE POLICY "Anyone can view likes" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Reels policies
CREATE POLICY "Anyone can view reels" ON reels FOR SELECT USING (true);
CREATE POLICY "Users can create reels" ON reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their reels" ON reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their reels" ON reels FOR DELETE USING (auth.uid() = user_id);

-- Reel likes policies
CREATE POLICY "Anyone can view reel likes" ON reel_likes FOR SELECT USING (true);
CREATE POLICY "Users can like reels" ON reel_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike reels" ON reel_likes FOR DELETE USING (auth.uid() = user_id);

-- Reel comments policies
CREATE POLICY "Anyone can view reel comments" ON reel_comments FOR SELECT USING (true);
CREATE POLICY "Users can create reel comments" ON reel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their reel comments" ON reel_comments FOR DELETE USING (auth.uid() = user_id);

-- Conversations policies
CREATE POLICY "Users can view their conversations" ON conversations FOR SELECT USING (auth.uid() = ANY(participant_ids));
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = ANY(participant_ids));

-- Messages policies
CREATE POLICY "Users can view their messages" ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Cheating alerts policies
CREATE POLICY "Users can view their alerts" ON cheating_alerts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create alerts" ON cheating_alerts FOR INSERT WITH CHECK (true);

-- Follows policies
CREATE POLICY "Anyone can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Disputes policies
CREATE POLICY "Users can view their disputes" ON disputes FOR SELECT USING (
  initiated_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM relationships WHERE id = relationship_id AND (user_id = auth.uid() OR partner_user_id = auth.uid()))
);
CREATE POLICY "Users can create disputes" ON disputes FOR INSERT WITH CHECK (auth.uid() = initiated_by);

-- Couple certificates policies
CREATE POLICY "Users can view their certificates" ON couple_certificates FOR SELECT USING (
  EXISTS (SELECT 1 FROM relationships WHERE id = relationship_id AND (user_id = auth.uid() OR partner_user_id = auth.uid()))
);
CREATE POLICY "Users can create certificates" ON couple_certificates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM relationships WHERE id = relationship_id AND user_id = auth.uid())
);

-- Anniversaries policies
CREATE POLICY "Users can view their anniversaries" ON anniversaries FOR SELECT USING (
  EXISTS (SELECT 1 FROM relationships WHERE id = relationship_id AND (user_id = auth.uid() OR partner_user_id = auth.uid()))
);
CREATE POLICY "Users can create anniversaries" ON anniversaries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM relationships WHERE id = relationship_id AND user_id = auth.uid())
);

-- Reported content policies
CREATE POLICY "Admins can view reports" ON reported_content FOR SELECT USING (
  reporter_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'))
);
CREATE POLICY "Users can create reports" ON reported_content FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Activity logs policies
CREATE POLICY "Users can view their logs" ON activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create logs" ON activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Advertisements policies
CREATE POLICY "Anyone can view active ads" ON advertisements FOR SELECT USING (active = true OR created_by = auth.uid());
CREATE POLICY "Admins can create ads" ON advertisements FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Admins can update ads" ON advertisements FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Ad impressions and clicks policies
CREATE POLICY "System can track impressions" ON advertisement_impressions FOR INSERT WITH CHECK (true);
CREATE POLICY "System can track clicks" ON advertisement_clicks FOR INSERT WITH CHECK (true);

-- User settings policies
CREATE POLICY "Users can view their settings" ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can upsert their settings" ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their settings" ON user_settings FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- 4. CREATE FUNCTIONS
-- =============================================

-- Function to search users
CREATE OR REPLACE FUNCTION search_users(search_query TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT,
  phone_number TEXT,
  profile_picture TEXT,
  role TEXT,
  phone_verified BOOLEAN,
  email_verified BOOLEAN,
  id_verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.full_name,
    u.email,
    u.phone_number,
    u.profile_picture,
    u.role,
    u.phone_verified,
    u.email_verified,
    u.id_verified
  FROM users u
  WHERE 
    LOWER(u.full_name) LIKE '%' || LOWER(search_query) || '%' OR
    u.phone_number LIKE '%' || search_query || '%'
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect cheating (duplicate relationships)
CREATE OR REPLACE FUNCTION detect_duplicate_relationships()
RETURNS TRIGGER AS $$
DECLARE
  existing_relationship RECORD;
  alert_user_id UUID;
BEGIN
  -- Check if user already has a verified relationship
  SELECT * INTO existing_relationship
  FROM relationships
  WHERE user_id = NEW.user_id 
    AND status = 'verified'
    AND id != NEW.id;

  IF FOUND THEN
    -- Create cheating alert for the existing partner
    IF existing_relationship.partner_user_id IS NOT NULL THEN
      INSERT INTO cheating_alerts (
        user_id,
        partner_user_id,
        alert_type,
        description
      ) VALUES (
        existing_relationship.partner_user_id,
        NEW.user_id,
        'duplicate_relationship',
        'Your partner has attempted to register a new relationship.'
      );

      -- Create notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        existing_relationship.partner_user_id,
        'cheating_alert',
        'Cheating Alert',
        'Your partner has attempted to register a new relationship.',
        jsonb_build_object('relationship_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cheating detection
DROP TRIGGER IF EXISTS trigger_detect_duplicate_relationships ON relationships;
CREATE TRIGGER trigger_detect_duplicate_relationships
  AFTER INSERT OR UPDATE OF status ON relationships
  FOR EACH ROW
  WHEN (NEW.status = 'verified')
  EXECUTE FUNCTION detect_duplicate_relationships();

-- Function to auto-resolve disputes after 7 days
CREATE OR REPLACE FUNCTION auto_resolve_disputes()
RETURNS void AS $$
BEGIN
  UPDATE disputes
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    resolution = 'Auto-resolved after 7 days'
  WHERE 
    status = 'pending' 
    AND auto_resolve_at IS NOT NULL 
    AND auto_resolve_at <= NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. CREATE STORAGE BUCKETS
-- =============================================

-- Note: Run these commands separately in Supabase Dashboard > Storage

-- Create media bucket for user uploads
-- INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Set storage policies for media bucket
-- CREATE POLICY "Anyone can view media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
-- CREATE POLICY "Authenticated users can upload media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');
-- CREATE POLICY "Users can update their own media" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND auth.uid()::text = owner);
-- CREATE POLICY "Users can delete their own media" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = owner);

-- =============================================
-- 6. PRODUCTION READY MESSAGE
-- =============================================

-- Log setup completion
DO $$
BEGIN
  RAISE NOTICE 'Production database setup complete!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create storage bucket named "media" in Supabase Dashboard';
  RAISE NOTICE '2. Make the bucket public';
  RAISE NOTICE '3. Run seed-sample-data.sql to add sample data (optional)';
  RAISE NOTICE '4. Your app is now production ready!';
END $$;
