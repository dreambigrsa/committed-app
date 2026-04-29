-- False relationship reports are review cases only.
-- A report must never hide/end/delete a relationship by itself.
-- Admins may update or delete report cases, and only explicit admin relationship
-- actions should change rows in relationships.

ALTER TABLE false_relationship_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete reports" ON false_relationship_reports;

CREATE POLICY "Admins can delete reports" ON false_relationship_reports
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'super_admin', 'moderator')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON false_relationship_reports TO authenticated;

CREATE OR REPLACE FUNCTION check_dual_false_relationship_report()
RETURNS TRIGGER AS $$
DECLARE
  relationship_record RECORD;
  partner_id UUID;
  other_partner_report_count INTEGER;
BEGIN
  SELECT * INTO relationship_record
  FROM relationships
  WHERE id = NEW.relationship_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF relationship_record.user_id = NEW.reported_by THEN
    partner_id := relationship_record.partner_user_id;
  ELSIF relationship_record.partner_user_id = NEW.reported_by THEN
    partner_id := relationship_record.user_id;
  ELSE
    RETURN NEW;
  END IF;

  IF partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO other_partner_report_count
  FROM false_relationship_reports
  WHERE relationship_id = NEW.relationship_id
    AND reported_by = partner_id
    AND status IN ('pending', 'reviewing');

  IF other_partner_report_count > 0 THEN
    -- Dual reports raise urgency only. They do not change relationships.
    UPDATE false_relationship_reports
    SET status = 'reviewing',
        resolution = COALESCE(resolution, 'Both partners reported this relationship. Admin review required. Relationship remains visible until an admin decision.'),
        updated_at = NOW()
    WHERE relationship_id = NEW.relationship_id
      AND reported_by IN (NEW.reported_by, partner_id)
      AND status = 'pending';

    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT
      u.id,
      'false_relationship_dual_report',
      'Dual False Relationship Report',
      'Both partners have reported relationship ' || NEW.relationship_id || ' as false. Review required; the relationship remains active until an admin decision.',
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

DROP TRIGGER IF EXISTS trigger_check_dual_false_relationship_report ON false_relationship_reports;
CREATE TRIGGER trigger_check_dual_false_relationship_report
  AFTER INSERT ON false_relationship_reports
  FOR EACH ROW
  EXECUTE FUNCTION check_dual_false_relationship_report();
