-- Allow users to clear their own pass history (e.g. "See passed profiles again" on web/mobile).
-- Without this, DELETE is blocked by RLS and reset flows never remove rows.

DROP POLICY IF EXISTS "Users can delete their own passes" ON dating_passes;

CREATE POLICY "Users can delete their own passes" ON dating_passes
  FOR DELETE
  USING (passer_id = auth.uid());
