-- Ensure all professionals have user_status entries for hybrid status tracking
-- This migration creates user_status entries for any professional profiles
-- that don't already have one (e.g., from before the hybrid status system)

INSERT INTO user_status (
  user_id,
  status_type,
  last_active_at,
  status_visibility,
  last_seen_visibility,
  created_at,
  updated_at
)
SELECT 
  pp.user_id,
  'offline' as status_type,
  NOW() as last_active_at,
  'everyone' as status_visibility,
  'everyone' as last_seen_visibility,
  NOW() as created_at,
  NOW() as updated_at
FROM professional_profiles pp
WHERE NOT EXISTS (
  SELECT 1 
  FROM user_status us 
  WHERE us.user_id = pp.user_id
)
ON CONFLICT (user_id) DO NOTHING;

