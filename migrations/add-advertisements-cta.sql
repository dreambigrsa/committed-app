-- Add CTA and sponsor fields to advertisements
ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS cta_type TEXT CHECK (cta_type IN ('whatsapp', 'messenger', 'website')),
ADD COLUMN IF NOT EXISTS cta_phone TEXT,
ADD COLUMN IF NOT EXISTS cta_message TEXT,
ADD COLUMN IF NOT EXISTS cta_messenger_id TEXT,
ADD COLUMN IF NOT EXISTS cta_url TEXT,
ADD COLUMN IF NOT EXISTS sponsor_name TEXT,
ADD COLUMN IF NOT EXISTS sponsor_verified BOOLEAN DEFAULT false;

-- Index for active ads by placement (optional but useful)
CREATE INDEX IF NOT EXISTS idx_ads_active_placement ON advertisements (active, placement);

