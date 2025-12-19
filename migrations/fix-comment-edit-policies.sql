-- Fix comment editing permissions
-- This migration adds RLS UPDATE policies for comments and reel_comments tables
-- to allow users to edit their own comments

-- Enable RLS on comments table if not already enabled
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Drop existing UPDATE policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;

-- Create UPDATE policy for comments: users can update their own comments
CREATE POLICY "Users can update their own comments" 
  ON comments 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable RLS on reel_comments table if not already enabled
ALTER TABLE reel_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing UPDATE policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can update their own reel comments" ON reel_comments;

-- Create UPDATE policy for reel_comments: users can update their own comments
CREATE POLICY "Users can update their own reel comments" 
  ON reel_comments 
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

