-- ============================================
-- COMMITTED APP - SAMPLE DATA FOR TESTING
-- Run this AFTER running complete-database-setup.sql
-- AND after you've created at least one user account via signup
-- ============================================

-- This file creates sample posts, reels, and other content
-- so you can see the app working with real data

-- ============================================
-- SAMPLE POSTS
-- ============================================

-- First, we need to get a user ID to create posts
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID
-- You can find your user ID by running: SELECT id FROM users WHERE email = 'your@email.com';

-- Example posts (replace the user_id with yours)
DO $$
DECLARE
  sample_user_id UUID;
BEGIN
  -- Get the first user in the database (you can modify this to target a specific user)
  SELECT id INTO sample_user_id FROM users LIMIT 1;
  
  IF sample_user_id IS NOT NULL THEN
    -- Insert sample posts
    INSERT INTO posts (user_id, content, media_urls, media_type, created_at) VALUES
    (sample_user_id, 'Just registered our relationship on Committed! 💍 Feeling secure and transparent about our love. #Committed #RelationshipGoals', 
     ARRAY['https://images.unsplash.com/photo-1519741497674-611481863552?w=800'], 
     'image', NOW() - INTERVAL '2 hours'),
    
    (sample_user_id, 'Love this app! Finally, a way to prove our commitment publicly. No more trust issues! 🔒❤️ #Transparency #TrustMatters', 
     ARRAY['https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800'], 
     'image', NOW() - INTERVAL '5 hours'),
    
    (sample_user_id, 'Anniversary dinner tonight! 3 years of verified love 💕 Thanks @committed for keeping us accountable! #Anniversary #VerifiedLove', 
     ARRAY['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800'], 
     'image', NOW() - INTERVAL '1 day'),
    
    (sample_user_id, 'Date night! Being in a verified relationship just hits different 😍 #DateNight #CommittedApp', 
     ARRAY['https://images.unsplash.com/photo-1481391243133-f96216dcb5d2?w=800'], 
     'image', NOW() - INTERVAL '2 days'),
    
    (sample_user_id, 'Pro tip: Get your ID verified for that extra badge of trust! It makes a huge difference 💪 #VerificationMatters #BuildTrust', 
     NULL, NULL, NOW() - INTERVAL '3 days');
    
    -- Insert sample reels
    INSERT INTO reels (user_id, video_url, thumbnail_url, caption, created_at) VALUES
    (sample_user_id, 
     'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
     'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400',
     'Why we chose to verify our relationship 💍 #Committed #Transparency', 
     NOW() - INTERVAL '1 hour'),
    
    (sample_user_id,
     'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
     'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400',
     'How to register your relationship - Quick tutorial 📱 #HowTo #CommittedApp',
     NOW() - INTERVAL '6 hours');
  END IF;
END $$;

-- ============================================
-- SAMPLE ADVERTISEMENTS (Only for admins)
-- ============================================

-- Create sample advertisements (you need to be an admin user)
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get admin user (you can modify this query to get a specific admin)
  SELECT id INTO admin_user_id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO advertisements (title, description, image_url, link_url, type, placement, active, created_by) VALUES
    ('Premium Verification', 'Upgrade to Premium and get priority verification within 24 hours!', 
     'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800', 
     'https://committed.app/premium', 'card', 'feed', true, admin_user_id),
    
    ('Couple Counseling', 'Get 20% off your first couples therapy session with our partner TherapyWorks', 
     'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800', 
     'https://therapyworks.example.com', 'card', 'all', true, admin_user_id),
    
    ('Wedding Planning', 'Planning to tie the knot? Check out our partner WeddingBliss for amazing deals!', 
     'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800', 
     'https://weddingbliss.example.com', 'card', 'feed', true, admin_user_id);
  END IF;
END $$;

-- ============================================
-- USEFUL QUERIES FOR TESTING
-- ============================================

-- Get your user ID
-- SELECT id, email, full_name FROM users WHERE email = 'your@email.com';

-- View all posts
-- SELECT p.*, u.full_name FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC;

-- View all relationships
-- SELECT r.*, u.full_name as user_name FROM relationships r JOIN users u ON r.user_id = u.id;

-- View all advertisements
-- SELECT * FROM advertisements WHERE active = true;

-- Count posts, reels, users
-- SELECT 
--   (SELECT COUNT(*) FROM users) as total_users,
--   (SELECT COUNT(*) FROM posts) as total_posts,
--   (SELECT COUNT(*) FROM reels) as total_reels,
--   (SELECT COUNT(*) FROM relationships WHERE status = 'verified') as verified_relationships;
