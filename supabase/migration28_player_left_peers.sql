-- migration28_player_left_peers.sql
-- Étend la notification "player_left" pour avertir TOUS les participants
-- quand un joueur se désinscrit d'une partie, pas seulement l'organisateur.
--
-- Nouveaux comportements :
--   • L'organisateur  → reçoit toujours "player_left" (inchangé)
--   • Les co-joueurs  → reçoivent "player_left_peer" (nouveau type)
--
-- Prérequis : migration26_player_left_notification.sql déjà appliquée
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Nouveau type d'enum
-- ═══════════════════════════════════════════════════════════════
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'player_left_peer';

-- ═══════════════════════════════════════════════════════════════
-- 2. Mise à jour de la fonction trigger
--    Garde toute la logique existante (guards + notif organisateur)
--    et ajoute une boucle pour notifier les co-participants.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_player_left()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session      RECORD;
  v_player_name  TEXT;
  v_participant  RECORD;
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

  -- ── 1. Notifie l'organisateur (player_left) ─────────────────
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

  -- ── 2. Notifie les co-participants (player_left_peer) ────────
  --   Exclut : le joueur qui part (OLD.user_id),
  --            l'organisateur (déjà notifié ci-dessus).
  --   NOTE : le DELETE est AFTER, donc OLD.user_id n'est
  --          plus dans session_participants → pas besoin de l'exclure
  --          explicitement mais on le fait par clarté.
  FOR v_participant IN
    SELECT user_id
    FROM   session_participants
    WHERE  session_id = OLD.session_id
      AND  user_id   <> OLD.user_id
      AND  user_id   <> v_session.organizer_id
  LOOP
    PERFORM insert_notification(
      v_participant.user_id,
      'player_left_peer',
      jsonb_build_object(
        'session_id',    OLD.session_id,
        'session_title', v_session.title,
        'session_date',  v_session.date::TEXT,
        'location',      v_session.location,
        'player_id',     OLD.user_id,
        'player_name',   v_player_name
      )
    );
  END LOOP;

  RETURN OLD;
END;
$$;

-- Le trigger notif_player_left sur session_participants pointe déjà sur
-- trigger_notif_player_left() — pas besoin de le recréer.
