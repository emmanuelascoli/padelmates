-- migration26_player_left_notification.sql
-- Notification "player_left" : avertit l'organisateur quand un joueur
-- inscrit se désinscrit d'une partie.
--
-- Prérequis : migrations 18, 22 appliquées (table notifications + insert_notification)
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Ajouter le type player_left à l'enum
-- ═══════════════════════════════════════════════════════════════
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'player_left';

-- ═══════════════════════════════════════════════════════════════
-- 2. Fonction trigger
--    Déclenché APRÈS DELETE sur session_participants.
--    Ne notifie PAS si :
--      - le joueur supprimé est l'organisateur lui-même
--      - la session n'existe plus (cascade delete)
--      - la session est déjà annulée ou terminée
--      - la session est passée (date déjà dépassée)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_player_left()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session      RECORD;
  v_player_name  TEXT;
BEGIN
  -- Récupère la session (si elle existe encore)
  SELECT title, date, time, location, organizer_id, status
  INTO   v_session
  FROM   sessions
  WHERE  id = OLD.session_id;

  -- La session n'existe plus (suppression en cascade) → on sort
  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  -- Ne pas notifier si la session est annulée ou si la date est passée
  IF v_session.status = 'cancelled'
     OR (v_session.date + v_session.time) AT TIME ZONE 'Europe/Zurich' < NOW()
  THEN
    RETURN OLD;
  END IF;

  -- Ne pas notifier si c'est l'organisateur qui se désinscrit lui-même
  IF OLD.user_id = v_session.organizer_id THEN
    RETURN OLD;
  END IF;

  -- Récupère le nom du joueur qui part
  SELECT name INTO v_player_name FROM profiles WHERE id = OLD.user_id;

  -- Envoie la notification à l'organisateur
  PERFORM insert_notification(
    v_session.organizer_id,
    'player_left',
    jsonb_build_object(
      'session_id',    OLD.session_id,
      'session_title', v_session.title,
      'session_date',  v_session.date::TEXT,
      'location',      v_session.location,
      'player_id',     OLD.user_id,
      'player_name',   v_player_name
    )
  );

  RETURN OLD;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Branchement du trigger
-- ═══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS notif_player_left ON session_participants;

CREATE TRIGGER notif_player_left
  AFTER DELETE ON session_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_player_left();
