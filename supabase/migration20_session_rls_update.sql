-- migration20_session_rls_update.sql
-- Politique RLS UPDATE sur sessions : organisateur peut modifier sa propre partie,
-- admin peut modifier n'importe quelle partie (ex : changer status → cancelled/open)

DROP POLICY IF EXISTS "organizer or admin can update session" ON sessions;

CREATE POLICY "organizer or admin can update session"
  ON sessions
  FOR UPDATE
  USING (
    organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
