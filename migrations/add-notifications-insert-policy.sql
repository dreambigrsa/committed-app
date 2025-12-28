-- ============================================
-- ADD NOTIFICATIONS INSERT POLICY AND FUNCTION
-- ============================================
-- This migration adds an INSERT policy for the notifications table
-- and creates a SECURITY DEFINER function to create notifications
-- This allows users to create notifications for other users (e.g., when ending relationships)

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;

-- Allow authenticated users to create notifications
-- This is needed for features like end relationship requests where User A needs to notify User B
CREATE POLICY "Users can create notifications" ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- ============================================
-- CREATE NOTIFICATION FUNCTION (SECURITY DEFINER)
-- ============================================
-- This function bypasses RLS and allows authenticated users to create notifications
-- for other users. This is safer than allowing direct INSERTs.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Verify that the caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated';
  END IF;

  -- Insert the notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    read,
    created_at
  )
  VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_data,
    false,
    NOW()
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ============================================
-- DISPUTES UPDATE POLICY
-- ============================================
-- Allow partners to update disputes (confirm/reject end relationship requests)
DROP POLICY IF EXISTS "Users can update disputes" ON disputes;

CREATE POLICY "Users can update disputes" ON disputes FOR UPDATE
  USING (
    -- User initiated the dispute OR user is a partner in the relationship
    initiated_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM relationships 
      WHERE id = disputes.relationship_id 
      AND (user_id = auth.uid() OR partner_user_id = auth.uid())
    )
  )
  WITH CHECK (
    -- Same check for WITH CHECK clause
    initiated_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM relationships 
      WHERE id = disputes.relationship_id 
      AND (user_id = auth.uid() OR partner_user_id = auth.uid())
    )
  );

