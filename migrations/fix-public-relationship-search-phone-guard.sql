-- Keep public relationship search from treating non-phone searches as phone matches.

CREATE OR REPLACE FUNCTION public_relationship_search(search_query TEXT)
RETURNS TABLE (
  relationship_id UUID,
  person_name TEXT,
  partner_name TEXT,
  relationship_type TEXT,
  relationship_status TEXT,
  start_date TIMESTAMPTZ,
  verified_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_query TEXT;
  normalized_digits TEXT;
BEGIN
  normalized_query := lower(trim(search_query));
  normalized_digits := regexp_replace(normalized_query, '\D', '', 'g');

  IF normalized_query IS NULL OR length(normalized_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id AS relationship_id,
    COALESCE(u.full_name, 'Committed member')::TEXT AS person_name,
    COALESCE(partner.full_name, r.partner_name, 'Partner')::TEXT AS partner_name,
    r.type::TEXT AS relationship_type,
    r.status::TEXT AS relationship_status,
    r.start_date,
    r.verified_date
  FROM relationships r
  LEFT JOIN users u ON u.id = r.user_id
  LEFT JOIN users partner ON partner.id = r.partner_user_id
  WHERE r.status = 'verified'
    AND COALESCE(r.privacy_level, 'public') = 'public'
    AND (
      lower(COALESCE(u.full_name, '')) LIKE '%' || normalized_query || '%'
      OR lower(COALESCE(partner.full_name, r.partner_name, '')) LIKE '%' || normalized_query || '%'
      OR (
        length(normalized_digits) >= 2
        AND regexp_replace(COALESCE(u.phone_number, ''), '\D', '', 'g') LIKE '%' || normalized_digits || '%'
      )
      OR (
        length(normalized_digits) >= 2
        AND regexp_replace(COALESCE(partner.phone_number, r.partner_phone, ''), '\D', '', 'g') LIKE '%' || normalized_digits || '%'
      )
    )
  ORDER BY r.verified_date DESC NULLS LAST, r.created_at DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public_relationship_search(TEXT) TO anon, authenticated;
