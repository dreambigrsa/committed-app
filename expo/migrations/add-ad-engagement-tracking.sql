-- ============================================
-- AD ENGAGEMENT TRACKING FOR CPE (Cost Per Engagement)
-- ============================================
-- Tracks likes, comments, and shares on ads for engagement-based pricing

-- ============================================
-- AD ENGAGEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ad_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertisement_id UUID NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  engagement_type TEXT NOT NULL CHECK (engagement_type IN ('like', 'comment', 'share')),
  related_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  related_reel_id UUID REFERENCES reels(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(advertisement_id, user_id, engagement_type, related_post_id, related_reel_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ad_engagements_ad ON ad_engagements(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_ad_engagements_type ON ad_engagements(engagement_type);
CREATE INDEX IF NOT EXISTS idx_ad_engagements_created ON ad_engagements(created_at);

-- RLS for ad_engagements
ALTER TABLE ad_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ad engagements" ON ad_engagements FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create ad engagements" ON ad_engagements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- UPDATE AD SYSTEM SETTINGS TO INCLUDE CPE
-- ============================================
UPDATE ad_system_settings
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{bidding,defaultCpe}',
  '0.10'::jsonb,
  true
)
WHERE id = 'default';

-- If no settings exist, create with CPE
INSERT INTO ad_system_settings (id, settings)
VALUES (
  'default',
  jsonb_build_object(
    'bidding', jsonb_build_object(
      'defaultCpm', COALESCE((SELECT settings->'bidding'->>'defaultCpm' FROM ad_system_settings WHERE id = 'default'), '0.50'),
      'defaultCpc', COALESCE((SELECT settings->'bidding'->>'defaultCpc' FROM ad_system_settings WHERE id = 'default'), '0.05'),
      'defaultCpe', '0.10',
      'defaultMaxMultiplier', COALESCE((SELECT settings->'bidding'->>'defaultMaxMultiplier' FROM ad_system_settings WHERE id = 'default'), '2.0'),
      'competitorStep', COALESCE((SELECT settings->'bidding'->>'competitorStep' FROM ad_system_settings WHERE id = 'default'), '0.10')
    )
  )
)
ON CONFLICT (id) DO UPDATE
SET settings = jsonb_set(
  COALESCE(ad_system_settings.settings, '{}'::jsonb),
  '{bidding,defaultCpe}',
  COALESCE(ad_system_settings.settings->'bidding'->'defaultCpe', '0.10'::jsonb),
  true
);

