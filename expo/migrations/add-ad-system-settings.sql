-- Global ad system settings (admin adjustable)
-- Stores defaults for CPM/CPC and bidding competition rules.

CREATE TABLE IF NOT EXISTS ad_system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure a single default row exists
INSERT INTO ad_system_settings (id, settings)
VALUES (
  'default',
  jsonb_build_object(
    'bidding', jsonb_build_object(
      'defaultCpm', 0.50,
      'defaultCpc', 0.05,
      'defaultMaxMultiplier', 2.0,
      'competitorStep', 0.10,          -- +10% per competing ad in same group
      'groupBy', 'placement+niche'     -- future-proof (UI can expand)
    )
  )
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE ad_system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage ad system settings" ON ad_system_settings;
CREATE POLICY "Admins can manage ad system settings"
ON ad_system_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ad_system_settings TO authenticated;


