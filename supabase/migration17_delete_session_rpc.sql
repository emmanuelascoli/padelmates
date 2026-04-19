-- Migration 17: RPC to hard-delete a session and all related data.
-- Runs as SECURITY DEFINER (bypasses RLS) after verifying the caller
-- is the session organizer OR an admin.

CREATE OR REPLACE FUNCTION public.delete_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization check: must be organizer or admin
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = p_session_id
      AND (
        s.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this session';
  END IF;

  -- Delete in FK dependency order
  DELETE FROM notification_log  WHERE session_id = p_session_id;
  DELETE FROM matches            WHERE session_id = p_session_id;
  DELETE FROM session_waitlist   WHERE session_id = p_session_id;
  DELETE FROM session_participants WHERE session_id = p_session_id;
  DELETE FROM sessions           WHERE id          = p_session_id;
END;
$$;

-- Grant execute to authenticated users (the function itself checks auth)
GRANT EXECUTE ON FUNCTION public.delete_session(UUID) TO authenticated;
