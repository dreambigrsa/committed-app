-- ============================================
-- PROFESSIONAL BOOKINGS SYSTEM
-- Adds booking-specific fields to professional_sessions
-- for managing scheduled/offline appointments
-- ============================================

-- Add booking-specific columns to professional_sessions
ALTER TABLE professional_sessions 
ADD COLUMN IF NOT EXISTS scheduled_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS location_type TEXT CHECK (location_type IN ('online', 'in_person', 'phone', 'video')),
ADD COLUMN IF NOT EXISTS location_address TEXT,
ADD COLUMN IF NOT EXISTS location_notes TEXT,
ADD COLUMN IF NOT EXISTS booking_fee_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS booking_fee_currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rescheduled_from_session_id UUID REFERENCES professional_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS reschedule_requested_by TEXT CHECK (reschedule_requested_by IN ('user', 'professional')),
ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_requested_by TEXT CHECK (cancellation_requested_by IN ('user', 'professional')),
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS booking_notes TEXT; -- Internal notes for professionals

-- Update session_type to include 'offline_booking'
ALTER TABLE professional_sessions 
DROP CONSTRAINT IF EXISTS professional_sessions_session_type_check;

ALTER TABLE professional_sessions
ADD CONSTRAINT professional_sessions_session_type_check 
CHECK (session_type IN ('live_chat', 'escalated', 'scheduled', 'offline_booking'));

-- Add status values for bookings
ALTER TABLE professional_sessions 
DROP CONSTRAINT IF EXISTS professional_sessions_status_check;

ALTER TABLE professional_sessions
ADD CONSTRAINT professional_sessions_status_check 
CHECK (status IN ('pending_acceptance', 'active', 'ended', 'declined', 'cancelled', 'scheduled', 'confirmed', 'completed', 'no_show'));

-- Create indexes for booking queries
CREATE INDEX IF NOT EXISTS idx_professional_sessions_scheduled_date ON professional_sessions(scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professional_sessions_professional_scheduled ON professional_sessions(professional_id, scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professional_sessions_user_scheduled ON professional_sessions(user_id, scheduled_date) WHERE scheduled_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professional_sessions_session_type ON professional_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_professional_sessions_payment_status ON professional_sessions(payment_status) WHERE payment_status IS NOT NULL;

-- Add comments
COMMENT ON COLUMN professional_sessions.scheduled_date IS 'Scheduled date and time for offline/booked sessions';
COMMENT ON COLUMN professional_sessions.scheduled_duration_minutes IS 'Duration of scheduled session in minutes';
COMMENT ON COLUMN professional_sessions.location_type IS 'Type of location: online, in_person, phone, or video';
COMMENT ON COLUMN professional_sessions.location_address IS 'Physical address for in-person sessions';
COMMENT ON COLUMN professional_sessions.location_notes IS 'Additional location instructions or notes';
COMMENT ON COLUMN professional_sessions.booking_fee_amount IS 'Fee charged for this booking';
COMMENT ON COLUMN professional_sessions.booking_fee_currency IS 'Currency code for the booking fee';
COMMENT ON COLUMN professional_sessions.payment_status IS 'Payment status for the booking';
COMMENT ON COLUMN professional_sessions.rescheduled_from_session_id IS 'Reference to original session if this was rescheduled';
COMMENT ON COLUMN professional_sessions.booking_notes IS 'Internal notes visible only to the professional';

