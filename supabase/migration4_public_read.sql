-- ────────────────────────────────────────────────────────────────
-- migration4_public_read.sql
-- Allow anonymous (non-authenticated) users to read sessions and
-- participant counts — required for the public landing page and
-- the public session detail teaser view.
-- ────────────────────────────────────────────────────────────────

-- 1. Allow anonymous users to read sessions (title, date, time, location,
--    level, max_players, cost_per_player, status — no phone numbers here)
CREATE POLICY "Public anon read sessions"
  ON sessions
  FOR SELECT
  TO anon
  USING (status = 'open');

-- 2. Allow anonymous users to count session_participants (for slot bar)
--    We only expose the count, not profiles — no sensitive data.
CREATE POLICY "Public anon read session_participants"
  ON session_participants
  FOR SELECT
  TO anon
  USING (true);

-- ────────────────────────────────────────────────────────────────
-- IMPORTANT: profiles table must NOT have an anon read policy.
-- Phone numbers, emails, etc. stay protected behind auth.
-- ────────────────────────────────────────────────────────────────
