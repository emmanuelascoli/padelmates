-- migration21_notif_friend_accepted_game_cancelled.sql
-- Deux nouveaux types de notifications :
--   • friend_request_accepted : notifie le demandeur quand sa demande est acceptée
--   • game_cancelled          : notifie tous les participants quand une partie est annulée
-- À exécuter dans Supabase → SQL Editor

-- ── 1. Étendre l'enum notification_type ──────────────────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_request_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'game_cancelled';

-- ── 2. Trigger : demande d'ami acceptée ──────────────────────────────────────
-- friendships(requester_id, addressee_id, status)
-- Quand status passe à 'accepted', notifier le requester
CREATE OR REPLACE FUNCTION trigger_notif_friend_accepted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_acceptor_name TEXT;
BEGIN
  -- Seulement si le statut vient de passer à 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT name INTO v_acceptor_name FROM profiles WHERE id = NEW.addressee_id;

    PERFORM insert_notification(
      NEW.requester_id,
      'friend_request_accepted',
      jsonb_build_object(
        'acceptor_id',   NEW.addressee_id,
        'acceptor_name', COALESCE(v_acceptor_name, 'Quelqu''un')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_friend_accepted ON friendships;
CREATE TRIGGER notif_friend_accepted
  AFTER UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_friend_accepted();

-- ── 3. Trigger : partie annulée ───────────────────────────────────────────────
-- sessions(status) — quand status passe à 'cancelled'
-- Notifier tous les participants sauf l'organisateur
CREATE OR REPLACE FUNCTION trigger_notif_game_cancelled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_participant RECORD;
BEGIN
  -- Seulement si le statut vient de passer à 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    FOR v_participant IN
      SELECT user_id FROM session_participants WHERE session_id = NEW.id
    LOOP
      -- Ne pas notifier l'organisateur
      IF v_participant.user_id IS DISTINCT FROM NEW.organizer_id THEN
        PERFORM insert_notification(
          v_participant.user_id,
          'game_cancelled',
          jsonb_build_object(
            'session_id',    NEW.id,
            'session_title', NEW.title,
            'session_date',  NEW.date::TEXT,
            'location',      NEW.location,
            'organizer_id',  NEW.organizer_id
          )
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_game_cancelled ON sessions;
CREATE TRIGGER notif_game_cancelled
  AFTER UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_game_cancelled();
