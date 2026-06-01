-- migration32_session_departures.sql
-- Table d'historique des désinscriptions + mise à jour trigger player_left
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Table session_departures
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS session_departures (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id        UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_status    TEXT NOT NULL DEFAULT 'pending', -- statut au moment du départ
  refund_handled    BOOLEAN NOT NULL DEFAULT false,  -- remboursement géré par l'organisateur
  refund_handled_at TIMESTAMPTZ,
  left_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_session_departures_session ON session_departures(session_id);
CREATE INDEX IF NOT EXISTS idx_session_departures_user    ON session_departures(user_id);

-- RLS
ALTER TABLE session_departures ENABLE ROW LEVEL SECURITY;

-- L'organisateur de la session peut tout lire
CREATE POLICY "organizer_read_departures" ON session_departures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_departures.session_id
        AND sessions.organizer_id = auth.uid()
    )
  );

-- L'organisateur peut mettre à jour refund_handled
CREATE POLICY "organizer_update_departures" ON session_departures
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_departures.session_id
        AND sessions.organizer_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. Trigger : enregistre la désinscription AVANT DELETE
--    (BEFORE pour pouvoir lire payment_status encore présent)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_record_departure()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT status, date, time, organizer_id INTO v_session
  FROM sessions WHERE id = OLD.session_id;

  -- Ne pas enregistrer si session annulée ou passée
  IF NOT FOUND THEN RETURN OLD; END IF;
  IF v_session.status = 'cancelled' THEN RETURN OLD; END IF;
  IF (v_session.date || ' ' || v_session.time)::TIMESTAMPTZ < NOW() THEN RETURN OLD; END IF;
  -- Ne pas enregistrer si c'est l'organisateur
  IF OLD.user_id = v_session.organizer_id THEN RETURN OLD; END IF;

  INSERT INTO session_departures (session_id, user_id, payment_status, left_at)
  VALUES (OLD.session_id, OLD.user_id, COALESCE(OLD.payment_status, 'pending'), NOW());

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS record_departure ON session_participants;
CREATE TRIGGER record_departure
  BEFORE DELETE ON session_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_record_departure();

-- ═══════════════════════════════════════════════════════════════
-- 3. Mise à jour trigger player_left : ajoute payment_status
--    dans le payload de notification
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_player_left()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session      RECORD;
  v_player_name  TEXT;
BEGIN
  SELECT title, date, time, location, organizer_id, status
  INTO   v_session FROM sessions WHERE id = OLD.session_id;

  IF NOT FOUND THEN RETURN OLD; END IF;

  IF v_session.status = 'cancelled'
     OR (v_session.date || ' ' || v_session.time)::TIMESTAMPTZ < NOW()
  THEN RETURN OLD; END IF;

  IF OLD.user_id = v_session.organizer_id THEN RETURN OLD; END IF;

  SELECT name INTO v_player_name FROM profiles WHERE id = OLD.user_id;

  PERFORM insert_notification(
    v_session.organizer_id,
    'player_left',
    jsonb_build_object(
      'session_id',     OLD.session_id,
      'session_title',  v_session.title,
      'session_date',   v_session.date::TEXT,
      'location',       v_session.location,
      'player_id',      OLD.user_id,
      'player_name',    v_player_name,
      'payment_status', COALESCE(OLD.payment_status, 'pending')
    )
  );

  RETURN OLD;
END;
$$;
