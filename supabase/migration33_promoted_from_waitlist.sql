-- migration33_promoted_from_waitlist.sql
-- Ajoute une colonne fiable pour identifier les promotions depuis la liste d'attente
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Colonne sur session_participants
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE session_participants
  ADD COLUMN IF NOT EXISTS promoted_from_waitlist BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════
-- 2. Mise à jour du trigger de promotion
--    Quand un joueur passe de session_waitlist → session_participants,
--    on marque promoted_from_waitlist = true
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION promote_from_waitlist()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_max      INT;
  v_count    INT;
  v_next     UUID;
BEGIN
  SELECT max_players INTO v_max FROM sessions WHERE id = OLD.session_id;
  SELECT COUNT(*) INTO v_count FROM session_participants WHERE session_id = OLD.session_id;

  IF v_count < v_max THEN
    SELECT user_id INTO v_next
    FROM session_waitlist
    WHERE session_id = OLD.session_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_next IS NOT NULL THEN
      INSERT INTO session_participants (session_id, user_id, promoted_from_waitlist)
      VALUES (OLD.session_id, v_next, true)
      ON CONFLICT (session_id, user_id) DO NOTHING;

      DELETE FROM session_waitlist
      WHERE session_id = OLD.session_id AND user_id = v_next;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;
