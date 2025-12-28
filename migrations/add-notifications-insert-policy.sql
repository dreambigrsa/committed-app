-- ============================================
-- ADD NOTIFICATIONS INSERT POLICY AND FUNCTION
-- ============================================
-- This migration adds an INSERT policy for the notifications table
-- and creates a SECURITY DEFINER function to create notifications
-- This allows users to create notifications for other users (e.g., when ending relationships)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Allow authenticated users to create notifications
-- This is needed for features like end relationship requests where User A needs to notify User B
-- This policy allows any authenticated user to insert notifications
CREATE POLICY "Users can create notifications" ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Grant INSERT permission to authenticated role (if not already granted)
GRANT INSERT ON notifications TO authenticated;

-- ============================================
-- CREATE NOTIFICATION FUNCTION (SECURITY DEFINER)
-- ============================================
-- This function bypasses RLS and allows authenticated users to create notifications
-- for other users. This is safer than allowing direct INSERTs.
-- IMPORTANT: This function MUST exist for notifications to work properly.
DROP FUNCTION IF EXISTS public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB);

CREATE FUNCTION public.create_notification(
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
  v_current_user_id UUID;
BEGIN
  -- Get current authenticated user
  v_current_user_id := auth.uid();
  
  -- Verify that the caller is authenticated
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User must be authenticated';
  END IF;

  -- Validate required parameters
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parameter: p_user_id cannot be NULL';
  END IF;
  
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'Invalid parameter: p_type cannot be NULL or empty';
  END IF;
  
  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'Invalid parameter: p_title cannot be NULL or empty';
  END IF;
  
  IF p_message IS NULL OR p_message = '' THEN
    RAISE EXCEPTION 'Invalid parameter: p_message cannot be NULL or empty';
  END IF;

  -- Insert the notification (bypasses RLS due to SECURITY DEFINER)
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
    COALESCE(p_data, '{}'::jsonb),
    false,
    NOW()
  )
  RETURNING id INTO v_notification_id;

  -- Return the notification ID
  RETURN v_notification_id;
END;
$$;

-- Grant execute permission to authenticated role
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================
-- UPDATE NOTIFICATION TYPE CHECK CONSTRAINT
-- ============================================
-- Add missing notification types to the check constraint
-- This includes relationship_end_request and false_relationship_resolved which are used in the app
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  -- Relationship types
  'relationship_request', 
  'relationship_verified', 
  'relationship_ended', 
  'relationship_end_request',
  -- Cheating alerts
  'cheating_alert',
  -- Social interactions
  'post_like', 
  'post_comment', 
  'message', 
  'follow',
  -- Anniversary
  'anniversary_reminder',
  -- Verification
  'verification_attempt',
  -- Status
  'status_reaction',
  -- Dating
  'dating_match', 
  'dating_like', 
  'dating_super_like',
  'dating_date_request',
  'dating_date_accepted',
  'dating_date_declined',
  -- Payments
  'payment_submission',
  'payment_approved',
  'payment_rejected',
  -- False relationship reports
  'false_relationship_dual_report',
  'false_relationship_resolved'
));

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

