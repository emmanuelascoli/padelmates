-- Migration 16: Auto-recalculate badges when a match is deleted
-- Triggered when a session is hard-deleted (which cascades to its matches).

-- ── Trigger function ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_match_delete_refresh_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid UUID;
BEGIN
  -- For each of the 4 players in the deleted match, recompute their badges.
  -- NULL-safe: FOREACH skips NULLs via the IS NOT NULL check.
  FOREACH pid IN ARRAY ARRAY[
    OLD.team1_player1,
    OLD.team1_player2,
    OLD.team2_player1,
    OLD.team2_player2
  ] LOOP
    IF pid IS NOT NULL THEN
      PERFORM public.compute_badges_for_user(pid);
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

-- ── Trigger on matches ───────────────────────────────────────
-- Fires AFTER DELETE FOR EACH ROW so OLD.* is available.
DROP TRIGGER IF EXISTS trg_match_delete_refresh_badges ON public.matches;

CREATE TRIGGER trg_match_delete_refresh_badges
  AFTER DELETE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.on_match_delete_refresh_badges();
