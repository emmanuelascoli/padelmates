-- Migration 17: ON DELETE CASCADE on all FK → sessions
-- + RLS DELETE policy so the organizer (or admin) can delete directly from the client.
-- After this migration, deleting a row in `sessions` automatically removes
-- all related participants, waitlist entries, matches, and notification logs.

-- ── 1. Re-create FK constraints with CASCADE ─────────────────

ALTER TABLE session_participants
  DROP CONSTRAINT IF EXISTS session_participants_session_id_fkey;
ALTER TABLE session_participants
  ADD CONSTRAINT session_participants_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE session_waitlist
  DROP CONSTRAINT IF EXISTS session_waitlist_session_id_fkey;
ALTER TABLE session_waitlist
  ADD CONSTRAINT session_waitlist_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_session_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;

-- notification_log may not exist in all setups — safe to ignore if missing
DO $$ BEGIN
  ALTER TABLE notification_log
    DROP CONSTRAINT IF EXISTS notification_log_session_id_fkey;
  ALTER TABLE notification_log
    ADD CONSTRAINT notification_log_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN
  NULL; -- table doesn't exist yet, skip
END $$;

-- ── 2. RLS DELETE policy on sessions ────────────────────────

-- Drop old policy if it exists
DROP POLICY IF EXISTS "organizer or admin can delete session" ON sessions;

CREATE POLICY "organizer or admin can delete session"
  ON sessions
  FOR DELETE
  USING (
    organizer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
