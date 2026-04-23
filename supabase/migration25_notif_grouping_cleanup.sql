-- migration25_notif_grouping_cleanup.sql
-- Trois améliorations des notifications :
--
--   1. result_recorded groupé : plusieurs matchs d'une même partie
--      → une seule notification avec un compteur (match_count)
--
--   2. Correction du trigger player_joined groupé (migration22) :
--      la colonne s'appelle user_id et non recipient_id
--
--   3. Suppression automatique des notifications > 7 jours :
--      nettoyage injecté dans send_24h_reminders() (déjà planifié)
--
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. result_recorded groupé
--    Si une notif non-lue de même type existe pour la même
--    partie (créée dans la dernière heure), on incrémente
--    match_count au lieu d'insérer une nouvelle ligne.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_notif_result_recorded()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session_date    TEXT;
  v_organizer_id    UUID;
  v_organizer_name  TEXT;
  v_player_id       UUID;
  v_notified        UUID[];
  v_existing_id     UUID;
  v_existing_data   JSONB;
BEGIN
  SELECT date::TEXT, organizer_id
  INTO   v_session_date, v_organizer_id
  FROM   sessions WHERE id = NEW.session_id;

  SELECT name INTO v_organizer_name FROM profiles WHERE id = v_organizer_id;

  v_notified := ARRAY[]::UUID[];

  FOREACH v_player_id IN ARRAY ARRAY[
    NEW.team1_player1, NEW.team1_player2,
    NEW.team2_player1, NEW.team2_player2
  ] LOOP
    CONTINUE WHEN v_player_id IS NULL;
    CONTINUE WHEN v_player_id = ANY(v_notified);
    v_notified := array_append(v_notified, v_player_id);

    -- Cherche une notif récente non-lue pour la même partie
    SELECT id, data
    INTO   v_existing_id, v_existing_data
    FROM   notifications
    WHERE  user_id                    = v_player_id
      AND  type                       = 'result_recorded'
      AND  (data->>'session_id')      = NEW.session_id::TEXT
      AND  read                       = FALSE
      AND  created_at                 > NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Incrémente le compteur et remonte la notif
      UPDATE notifications
      SET data = jsonb_set(
            v_existing_data,
            '{match_count}',
            to_jsonb(COALESCE((v_existing_data->>'match_count')::INT, 1) + 1)
          ),
          created_at = NOW()
      WHERE id = v_existing_id;
    ELSE
      PERFORM insert_notification(
        v_player_id,
        'result_recorded',
        jsonb_build_object(
          'recorder_id',   v_organizer_id,
          'recorder_name', COALESCE(v_organizer_name, 'L''organisateur'),
          'session_id',    NEW.session_id,
          'session_date',  v_session_date,
          'match_count',   1
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recrée le trigger (remplace celui de migration18)
DROP TRIGGER IF EXISTS notif_result_recorded ON matches;
CREATE TRIGGER notif_result_recorded
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_result_recorded();

-- ═══════════════════════════════════════════════════════════════
-- 2. Correction player_joined groupé (migration22)
--    La colonne de la table notifications est user_id,
--    pas recipient_id — corrige le WHERE de la recherche de
--    notification existante.
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

  IF NEW.user_id = v_session.organizer_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_player_name FROM profiles WHERE id = NEW.user_id;

  -- Cherche une notif récente non-lue pour la même partie
  -- Note : colonne user_id (et non recipient_id)
  SELECT id, data
  INTO   v_existing_id, v_existing_data
  FROM   notifications
  WHERE  user_id                  = v_session.organizer_id
    AND  type                     = 'player_joined'
    AND  (data->>'session_id')    = NEW.session_id::TEXT
    AND  read                     = FALSE
    AND  created_at               > NOW() - INTERVAL '1 hour'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_existing_data->'player_names'))
    INTO v_names;
    v_names := v_names || v_player_name;

    UPDATE notifications
    SET data       = jsonb_set(v_existing_data, '{player_names}', to_jsonb(v_names)),
        created_at = NOW()
    WHERE id = v_existing_id;
  ELSE
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

DROP TRIGGER IF EXISTS notif_player_joined ON session_participants;
CREATE TRIGGER notif_player_joined
  AFTER INSERT ON session_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_player_joined();

-- ═══════════════════════════════════════════════════════════════
-- 3. Suppression automatique des notifications > 7 jours
--    On met à jour send_24h_reminders() pour y injecter
--    le nettoyage en début de fonction.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION send_24h_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session           RECORD;
  v_participant       RECORD;
  v_participant_count INT;
  v_session_ts        TIMESTAMPTZ;
BEGIN
  -- ── Nettoyage : supprime les notifications de plus de 7 jours ──
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '7 days';

  -- ── Rappels 24h ───────────────────────────────────────────────
  FOR v_session IN
    SELECT id, title, date, time, location,
           organizer_id, max_players, cost_per_player
    FROM sessions
    WHERE status = 'open'
  LOOP
    v_session_ts := (v_session.date + v_session.time)
                    AT TIME ZONE 'Europe/Zurich';

    CONTINUE WHEN v_session_ts NOT BETWEEN
      NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours';

    SELECT COUNT(*)
    INTO v_participant_count
    FROM session_participants
    WHERE session_id = v_session.id;

    -- ── Rappels de paiement ──────────────────────────────────
    IF v_session.cost_per_player > 0 THEN
      FOR v_participant IN
        SELECT user_id
        FROM session_participants
        WHERE session_id     = v_session.id
          AND payment_status = 'pending'
          AND user_id       <> v_session.organizer_id
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM notifications
          WHERE user_id                   = v_participant.user_id
            AND type                      = 'payment_reminder'
            AND (data->>'session_id')     = v_session.id::TEXT
            AND created_at                > NOW() - INTERVAL '20 hours'
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

    -- ── Rappel places manquantes (organisateur) ──────────────
    IF v_participant_count < v_session.max_players THEN
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id                   = v_session.organizer_id
          AND type                      = 'missing_players_reminder'
          AND (data->>'session_id')     = v_session.id::TEXT
          AND created_at                > NOW() - INTERVAL '20 hours'
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
