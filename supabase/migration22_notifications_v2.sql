-- migration22_notifications_v2.sql
-- Quatre améliorations du système de notifications :
--   1. player_promoted      : notifie un joueur promu de la liste d'attente
--   2. player_joined groupé : fusionne les inscriptions récentes sur la même partie
--   3. payment_reminder     : rappel 24h avant si la part n'est pas payée
--   4. missing_players_reminder : rappel organisateur 24h avant si places libres
--
-- Prérequis :
--   • Extension pg_cron activée : Database → Extensions → pg_cron
--   • Migrations 18, 21 déjà appliquées
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Nouveaux types d'enum
-- ═══════════════════════════════════════════════════════════════
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'player_promoted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'missing_players_reminder';

-- ═══════════════════════════════════════════════════════════════
-- 2. player_joined groupé
--    Quand un nouveau joueur s'inscrit, on regarde s'il existe
--    déjà une notification player_joined non-lue pour la même
--    partie (créée il y a moins d'1h). Si oui, on ajoute le
--    nouveau nom au tableau player_names et on remonte la notif.
--    Sinon, on en crée une nouvelle.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_player_joined()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session        RECORD;
  v_player_name    TEXT;
  v_existing_id    UUID;
  v_existing_data  JSONB;
  v_names          TEXT[];
BEGIN
  SELECT title, date, location, organizer_id
  INTO v_session
  FROM sessions WHERE id = NEW.session_id;

  -- Ne pas notifier si c'est l'organisateur qui rejoint sa propre partie
  IF NEW.user_id = v_session.organizer_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_player_name FROM profiles WHERE id = NEW.user_id;

  -- Cherche une notif récente (< 1h) non-lue pour cette partie
  SELECT id, data
  INTO   v_existing_id, v_existing_data
  FROM   notifications
  WHERE  recipient_id             = v_session.organizer_id
    AND  type                     = 'player_joined'
    AND  (data->>'session_id')    = NEW.session_id::TEXT
    AND  read                     = FALSE
    AND  created_at               > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Fusion : on ajoute le nouveau nom au tableau existant
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_existing_data->'player_names'))
    INTO v_names;
    v_names := v_names || v_player_name;

    UPDATE notifications
    SET data       = jsonb_set(v_existing_data, '{player_names}', to_jsonb(v_names)),
        created_at = NOW()   -- remonte la notif en tête de liste
    WHERE id = v_existing_id;
  ELSE
    -- Nouvelle notification
    PERFORM insert_notification(
      v_session.organizer_id,
      'player_joined',
      jsonb_build_object(
        'session_id',    NEW.session_id,
        'session_title', v_session.title,
        'session_date',  v_session.date::TEXT,
        'location',      v_session.location,
        'player_names',  jsonb_build_array(v_player_name)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recrée le trigger avec la fonction mise à jour
DROP TRIGGER IF EXISTS notif_player_joined ON session_participants;
CREATE TRIGGER notif_player_joined
  AFTER INSERT ON session_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_player_joined();

-- ═══════════════════════════════════════════════════════════════
-- 3. Promotion depuis la liste d'attente → player_promoted
--    Déclenché APRÈS DELETE sur session_waitlist.
--    Si le joueur supprimé de la liste d'attente est désormais
--    dans session_participants, c'est qu'il a été promu
--    (et non pas qu'il a quitté volontairement).
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_player_promoted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Le joueur est-il maintenant inscrit à la partie ?
  IF EXISTS (
    SELECT 1 FROM session_participants
    WHERE session_id = OLD.session_id
      AND user_id    = OLD.user_id
  ) THEN
    SELECT title, date, location
    INTO v_session
    FROM sessions WHERE id = OLD.session_id;

    PERFORM insert_notification(
      OLD.user_id,
      'player_promoted',
      jsonb_build_object(
        'session_id',    OLD.session_id,
        'session_title', v_session.title,
        'session_date',  v_session.date::TEXT,
        'location',      v_session.location
      )
    );
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS notif_player_promoted ON session_waitlist;
CREATE TRIGGER notif_player_promoted
  AFTER DELETE ON session_waitlist
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_player_promoted();

-- ═══════════════════════════════════════════════════════════════
-- 4. Rappels 24h : paiement + places manquantes
--    À appeler toutes les heures via pg_cron.
--    Cible : sessions 'open' prévues dans 23h–25h.
--    Garde-fou : on ne renvoie pas une notif du même type pour
--    la même partie si une a déjà été envoyée dans les 20h.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION send_24h_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session           RECORD;
  v_participant       RECORD;
  v_participant_count INT;
  v_session_ts        TIMESTAMPTZ;
BEGIN
  FOR v_session IN
    SELECT id, title, date, time, location,
           organizer_id, max_players, cost_per_player
    FROM sessions
    WHERE status = 'open'
  LOOP
    -- Horodatage de la session en heure suisse
    v_session_ts := (v_session.date + v_session.time)
                    AT TIME ZONE 'Europe/Zurich';

    -- Filtre : partie dans la fenêtre 23h–25h à partir de maintenant
    CONTINUE WHEN v_session_ts NOT BETWEEN
      NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours';

    SELECT COUNT(*)
    INTO v_participant_count
    FROM session_participants
    WHERE session_id = v_session.id;

    -- ── Rappels de paiement ────────────────────────────────
    IF v_session.cost_per_player > 0 THEN
      FOR v_participant IN
        SELECT user_id
        FROM session_participants
        WHERE session_id      = v_session.id
          AND payment_status  = 'pending'
          AND user_id        <> v_session.organizer_id
      LOOP
        -- Anti-doublon : pas de rappel si déjà envoyé dans les 20h
        IF NOT EXISTS (
          SELECT 1 FROM notifications
          WHERE recipient_id          = v_participant.user_id
            AND type                  = 'payment_reminder'
            AND (data->>'session_id') = v_session.id::TEXT
            AND created_at            > NOW() - INTERVAL '20 hours'
        ) THEN
          PERFORM insert_notification(
            v_participant.user_id,
            'payment_reminder',
            jsonb_build_object(
              'session_id',    v_session.id,
              'session_title', v_session.title,
              'session_date',  v_session.date::TEXT,
              'location',      v_session.location,
              'amount',        v_session.cost_per_player
            )
          );
        END IF;
      END LOOP;
    END IF;

    -- ── Rappel places manquantes (organisateur) ────────────
    IF v_participant_count < v_session.max_players THEN
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE recipient_id          = v_session.organizer_id
          AND type                  = 'missing_players_reminder'
          AND (data->>'session_id') = v_session.id::TEXT
          AND created_at            > NOW() - INTERVAL '20 hours'
      ) THEN
        PERFORM insert_notification(
          v_session.organizer_id,
          'missing_players_reminder',
          jsonb_build_object(
            'session_id',      v_session.id,
            'session_title',   v_session.title,
            'session_date',    v_session.date::TEXT,
            'location',        v_session.location,
            'current_players', v_participant_count,
            'max_players',     v_session.max_players,
            'spots_remaining', v_session.max_players - v_participant_count
          )
        );
      END IF;
    END IF;

  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. Planification via pg_cron (toutes les heures)
--
--    PRÉREQUIS : activez l'extension pg_cron dans votre projet
--    Supabase avant d'exécuter ce bloc.
--    Menu : Database → Extensions → chercher "pg_cron" → Enable
--
--    Si pg_cron n'est pas disponible sur votre plan, vous pouvez
--    appeler send_24h_reminders() manuellement ou via une
--    Edge Function déclenchée par un service externe (ex. cron-job.org).
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Vérifie que l'extension pg_cron est bien activée (schéma 'cron' présent)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Supprime l'ancienne planification si elle existe
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-24h-reminders') THEN
      PERFORM cron.unschedule('send-24h-reminders');
    END IF;

    -- Planifie l'exécution toutes les heures pile
    PERFORM cron.schedule(
      'send-24h-reminders',
      '0 * * * *',
      'SELECT send_24h_reminders()'
    );

    RAISE NOTICE 'Tâche pg_cron "send-24h-reminders" planifiée (toutes les heures).';
  ELSE
    RAISE NOTICE 'pg_cron non disponible — activez l''extension (Database → Extensions → pg_cron) ou appelez SELECT send_24h_reminders() manuellement.';
  END IF;
END;
$$;
