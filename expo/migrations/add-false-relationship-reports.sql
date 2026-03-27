-- ============================================
-- FALSE RELATIONSHIP REPORTS
-- ============================================
-- Allows users to report relationships they are incorrectly listed in

-- ============================================
-- FALSE RELATIONSHIP REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS false_relationship_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  evidence_urls TEXT[], -- Array of URLs to screenshots or evidence
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  resolution TEXT, -- Admin's resolution notes
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicate reports from same user for same relationship
  UNIQUE(relationship_id, reported_by)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_false_relationship_reports_relationship_id ON false_relationship_reports(relationship_id);
CREATE INDEX IF NOT EXISTS idx_false_relationship_reports_reported_by ON false_relationship_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_false_relationship_reports_status ON false_relationship_reports(status);
CREATE INDEX IF NOT EXISTS idx_false_relationship_reports_created_at ON false_relationship_reports(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can report false relationships" ON false_relationship_reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON false_relationship_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON false_relationship_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON false_relationship_reports;

-- Users can create reports
CREATE POLICY "Users can report false relationships" ON false_relationship_reports FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports" ON false_relationship_reports FOR SELECT
  USING (auth.uid() = reported_by);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" ON false_relationship_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports" ON false_relationship_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

-- ============================================
-- FUNCTION: Auto-flag if both partners report
-- ============================================
CREATE OR REPLACE FUNCTION check_dual_false_relationship_report()
RETURNS TRIGGER AS $$
DECLARE
  relationship_record RECORD;
  partner_id UUID;
  other_partner_report_count INTEGER;
BEGIN
  -- Get the relationship details
  SELECT * INTO relationship_record
  FROM relationships
  WHERE id = NEW.relationship_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine the partner's ID
  IF relationship_record.user_id = NEW.reported_by THEN
    partner_id := relationship_record.partner_user_id;
  ELSIF relationship_record.partner_user_id = NEW.reported_by THEN
    partner_id := relationship_record.user_id;
  ELSE
    -- User reporting is not part of the relationship, which is valid
    RETURN NEW;
  END IF;

  -- If partner_id is NULL, they're not registered, so can't report
  IF partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the other partner has also reported this relationship
  SELECT COUNT(*) INTO other_partner_report_count
  FROM false_relationship_reports
  WHERE relationship_id = NEW.relationship_id
    AND reported_by = partner_id
    AND status IN ('pending', 'reviewing');

  -- If both partners have reported, auto-flag for immediate admin review
  IF other_partner_report_count > 0 THEN
    -- Update both reports to 'reviewing' status
    UPDATE false_relationship_reports
    SET status = 'reviewing',
        updated_at = NOW()
    WHERE relationship_id = NEW.relationship_id
      AND reported_by IN (NEW.reported_by, partner_id)
      AND status = 'pending';

    -- Create notification for admins
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT 
      u.id,
      'false_relationship_dual_report',
      'Dual False Relationship Report',
      'Both partners have reported relationship ' || NEW.relationship_id || ' as false. Immediate review required.',
      jsonb_build_object(
        'relationship_id', NEW.relationship_id,
        'report_id', NEW.id
      )
    FROM users u
    WHERE u.role IN ('admin', 'super_admin', 'moderator')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_check_dual_false_relationship_report ON false_relationship_reports;
CREATE TRIGGER trigger_check_dual_false_relationship_report
  AFTER INSERT ON false_relationship_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_dual_false_relationship_report();

