-- migration31_notifications_v3.sql
-- Trois corrections/ajouts au système de notifications :
--
--   1. payment_confirmed  : notifie le joueur quand l'organisateur confirme son paiement
--   2. Fix delete_session : passe le statut à 'cancelled' avant suppression pour
--                           déclencher le trigger notif_game_cancelled (migration21)
--                           qui jusque là ne se déclenchait jamais (hard DELETE direct)
--   3. player_left        : rétablit la version organizer-only
--                           (annule migration28 qui notifiait aussi les co-joueurs)
--
-- Prérequis : migrations 21, 22, 26, 28 déjà appliquées
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Nouveau type d'enum
-- ═══════════════════════════════════════════════════════════════
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_confirmed';

-- ═══════════════════════════════════════════════════════════════
-- 2. Trigger payment_confirmed
--    Déclenché sur UPDATE de session_participants quand
--    payment_status passe à 'confirmed'.
--    Notifie le joueur concerné (pas l'organisateur).
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_payment_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Seulement si le statut vient de passer à 'confirmed'
  IF NEW.payment_status = 'confirmed'
     AND (OLD.payment_status IS DISTINCT FROM 'confirmed')
  THEN
    SELECT title, date, location, organizer_id, cost_per_player
    INTO   v_session
    FROM   sessions
    WHERE  id = NEW.session_id;

    -- Ne pas notifier l'organisateur (cas où il serait aussi participant)
    IF NEW.user_id IS DISTINCT FROM v_session.organizer_id THEN
      PERFORM insert_notification(
        NEW.user_id,
        'payment_confirmed',
        jsonb_build_object(
          'session_id',    NEW.session_id,
          'session_title', v_session.title,
          'session_date',  v_session.date::TEXT,
          'location',      v_session.location,
          'amount',        v_session.cost_per_player
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_payment_confirmed ON session_participants;
CREATE TRIGGER notif_payment_confirmed
  AFTER UPDATE ON session_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_payment_confirmed();

-- ═══════════════════════════════════════════════════════════════
-- 3. Fix delete_session
--    Avant de supprimer, on passe le statut à 'cancelled'.
--    Cela déclenche le trigger notif_game_cancelled (migration21)
--    qui envoie une notification à chaque participant.
--    Ensuite on supprime tout normalement.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_session(p_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérification des droits
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

  -- Étape 1 : marquer comme annulée → déclenche notif_game_cancelled
  --           qui notifie tous les participants sauf l'organisateur
  UPDATE sessions
  SET    status = 'cancelled'
  WHERE  id = p_session_id
    AND  status IS DISTINCT FROM 'cancelled';  -- évite un double-trigger inutile

  -- Étape 2 : suppression des données liées
  DELETE FROM notification_log    WHERE session_id = p_session_id;
  DELETE FROM matches              WHERE session_id = p_session_id;
  DELETE FROM session_waitlist     WHERE session_id = p_session_id;
  DELETE FROM session_participants WHERE session_id = p_session_id;
  DELETE FROM sessions             WHERE id         = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_session(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. player_left — organizer-only (annule migration28)
--    Migration28 avait étendu ce trigger pour notifier aussi
--    les co-joueurs via player_left_peer.
--    On revient à la version organizer-only.
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

  -- Ne pas notifier si session annulée ou passée
  IF v_session.status = 'cancelled'
     OR (v_session.date + v_session.time) AT TIME ZONE 'Europe/Zurich' < NOW()
  THEN
    RETURN OLD;
  END IF;

  -- Ne pas notifier si c'est l'organisateur qui se retire lui-même
  IF OLD.user_id = v_session.organizer_id THEN
    RETURN OLD;
  END IF;

  SELECT name INTO v_player_name FROM profiles WHERE id = OLD.user_id;

  -- Notifie uniquement l'organisateur
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

-- Le trigger notif_player_left existe déjà sur session_participants,
-- il pointe automatiquement sur la fonction mise à jour.
