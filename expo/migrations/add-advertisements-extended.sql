-- Extended ads schema for CTA, ownership, review, billing, targeting, and promoted content

ALTER TABLE advertisements
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('draft','pending','approved','rejected','paused')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS targeting JSONB,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS daily_budget NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS total_budget NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS spend NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_status TEXT CHECK (billing_status IN ('unpaid','paid','failed','refunded')) DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS billing_provider TEXT,
ADD COLUMN IF NOT EXISTS billing_txn_id TEXT,
ADD COLUMN IF NOT EXISTS promoted_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS promoted_reel_id UUID REFERENCES reels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ads_status ON advertisements(status);
CREATE INDEX IF NOT EXISTS idx_ads_user ON advertisements(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_promoted_post ON advertisements(promoted_post_id);
CREATE INDEX IF NOT EXISTS idx_ads_promoted_reel ON advertisements(promoted_reel_id);

