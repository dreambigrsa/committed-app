-- ============================================
-- DATING DATE REQUESTS
-- ============================================
-- Allows users to send date requests to their matches

-- ============================================
-- DATE REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dating_date_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES dating_matches(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  
  -- Date details
  date_title TEXT NOT NULL,
  date_description TEXT,
  date_location TEXT NOT NULL,
  date_location_latitude DECIMAL(10, 8),
  date_location_longitude DECIMAL(11, 8),
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  date_duration_hours INTEGER DEFAULT 2,
  
  -- Additional details
  suggested_activities TEXT[], -- Array of suggested activities
  dress_code TEXT, -- e.g., 'casual', 'smart casual', 'formal'
  budget_range TEXT, -- e.g., 'low', 'medium', 'high'
  expense_handling TEXT DEFAULT 'split' CHECK (expense_handling IN ('split', 'initiator_pays', 'acceptor_pays')), -- How expenses are handled
  number_of_people INTEGER DEFAULT 2, -- Number of people (2 = just the two of them, more = group date)
  gender_preference TEXT DEFAULT 'everyone' CHECK (gender_preference IN ('men', 'women', 'everyone')), -- For group dates
  special_requests TEXT, -- Any special requests or notes
  
  -- Response details
  response_message TEXT, -- Message from the responder
  responded_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dating_date_requests_match_id ON dating_date_requests(match_id);
CREATE INDEX IF NOT EXISTS idx_dating_date_requests_from_user ON dating_date_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_dating_date_requests_to_user ON dating_date_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_dating_date_requests_status ON dating_date_requests(status);
CREATE INDEX IF NOT EXISTS idx_dating_date_requests_date_time ON dating_date_requests(date_time);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Users can view date requests they sent or received
CREATE POLICY "Users can view their date requests" ON dating_date_requests FOR SELECT
  USING (
    auth.uid() = from_user_id OR auth.uid() = to_user_id
  );

-- Users can create date requests for their matches
CREATE POLICY "Users can create date requests" ON dating_date_requests FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id AND
    EXISTS (
      SELECT 1 FROM dating_matches
      WHERE dating_matches.id = match_id
      AND (dating_matches.user1_id = auth.uid() OR dating_matches.user2_id = auth.uid())
    )
  );

-- Users can update date requests they sent (to cancel) or received (to accept/decline)
CREATE POLICY "Users can update their date requests" ON dating_date_requests FOR UPDATE
  USING (
    (auth.uid() = from_user_id AND status = 'pending') OR -- Can cancel
    (auth.uid() = to_user_id AND status = 'pending') -- Can accept/decline
  );

-- ============================================
-- UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_dating_date_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dating_date_requests_updated_at
BEFORE UPDATE ON dating_date_requests
FOR EACH ROW
EXECUTE FUNCTION update_dating_date_requests_updated_at();

