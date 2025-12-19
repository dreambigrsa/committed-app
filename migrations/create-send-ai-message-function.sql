-- ============================================
-- SEND AI MESSAGE FUNCTION
-- Allows AI user to send messages via RPC, bypassing RLS
-- ============================================
-- This function is used when AI needs to send messages
-- (e.g., professional introductions, escalation notifications)

-- Drop any existing versions of this function first
DROP FUNCTION IF EXISTS send_ai_message(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT
);

DROP FUNCTION IF EXISTS send_ai_message(
  UUID, UUID, TEXT
);

DROP FUNCTION IF EXISTS send_ai_message CASCADE;

-- Now create the function with the exact signature we need
CREATE OR REPLACE FUNCTION send_ai_message(
  p_conversation_id UUID,
  p_receiver_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_media_url TEXT DEFAULT NULL,
  p_document_url TEXT DEFAULT NULL,
  p_document_name TEXT DEFAULT NULL,
  p_sticker_id UUID DEFAULT NULL,
  p_status_id UUID DEFAULT NULL,
  p_status_preview_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_ai_user_id UUID;
  v_message_id UUID;
BEGIN
  -- Get or find AI user by email
  SELECT id INTO v_ai_user_id
  FROM users
  WHERE email = 'ai@committed.app'
  LIMIT 1;

  IF v_ai_user_id IS NULL THEN
    RAISE EXCEPTION 'AI user not found. Please ensure the AI user exists (email: ai@committed.app).';
  END IF;

  -- Validate message type
  IF p_message_type NOT IN ('text', 'image', 'document', 'sticker') THEN
    RAISE EXCEPTION 'Invalid message type: %. Must be one of: text, image, document, sticker', p_message_type;
  END IF;

  -- Insert the message
  INSERT INTO messages (
    conversation_id,
    sender_id,
    receiver_id,
    content,
    message_type,
    media_url,
    document_url,
    document_name,
    sticker_id,
    status_id,
    status_preview_url
  )
  VALUES (
    p_conversation_id,
    v_ai_user_id,
    p_receiver_id,
    p_content,
    p_message_type,
    p_media_url,
    p_document_url,
    p_document_name,
    p_sticker_id,
    p_status_id,
    p_status_preview_url
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
-- Must use types only, not parameter names
GRANT EXECUTE ON FUNCTION send_ai_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION send_ai_message(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, TEXT
) IS 
  'Allows the AI user to send messages in conversations. Used for professional introductions, escalation notifications, and AI responses.';

