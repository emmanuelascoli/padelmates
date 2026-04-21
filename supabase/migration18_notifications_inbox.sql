-- migration18_notifications_inbox.sql
-- Table notifications in-app + triggers automatiques
-- À exécuter dans Supabase → SQL Editor

-- ── 1. Enum type ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'friend_request',
    'player_joined',
    'game_created',
    'result_recorded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Table notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx    ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx   ON notifications(created_at DESC);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur ne voit que ses propres notifications
CREATE POLICY "users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Seul le service role (triggers) peut insérer
CREATE POLICY "service role can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (TRUE);

-- L'utilisateur peut marquer ses notifs comme lues
CREATE POLICY "users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Trigger helper : insérer une notification ──────────────────────────────
CREATE OR REPLACE FUNCTION insert_notification(
  p_user_id UUID,
  p_type    notification_type,
  p_data    JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Ne pas notifier soi-même
  IF p_user_id IS NULL THEN RETURN; END IF;
  INSERT INTO notifications (user_id, type, data)
  VALUES (p_user_id, p_type, p_data);
END;
$$;

-- ── 5. Trigger : demande d'ami reçue ─────────────────────────────────────────
-- friendships(requester_id, addressee_id, status)
CREATE OR REPLACE FUNCTION trigger_notif_friend_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT name INTO v_name FROM profiles WHERE id = NEW.requester_id;
    PERFORM insert_notification(
      NEW.addressee_id,
      'friend_request',
      jsonb_build_object(
        'from_user_id',   NEW.requester_id,
        'from_user_name', COALESCE(v_name, 'Quelqu''un'),
        'friendship_id',  NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_friend_request ON friendships;
CREATE TRIGGER notif_friend_request
  AFTER INSERT ON friendships
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_friend_request();

-- ── 6. Trigger : un joueur rejoint une partie ─────────────────────────────────
-- session_participants(session_id, user_id)
CREATE OR REPLACE FUNCTION trigger_notif_player_joined()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_player_name  TEXT;
  v_organizer_id UUID;
  v_session_date TEXT;
  v_location     TEXT;
  v_session_title TEXT;
BEGIN
  SELECT name INTO v_player_name FROM profiles WHERE id = NEW.user_id;

  SELECT organizer_id, date::TEXT, location, title
    INTO v_organizer_id, v_session_date, v_location, v_session_title
    FROM sessions WHERE id = NEW.session_id;

  -- Ne pas notifier si c'est l'organisateur qui s'inscrit lui-même
  IF v_organizer_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM insert_notification(
      v_organizer_id,
      'player_joined',
      jsonb_build_object(
        'player_id',     NEW.user_id,
        'player_name',   COALESCE(v_player_name, 'Un joueur'),
        'session_id',    NEW.session_id,
        'session_title', v_session_title,
        'session_date',  v_session_date,
        'location',      v_location
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

-- ── 7. Trigger : nouvelle partie (notifier les amis du créateur) ──────────────
CREATE OR REPLACE FUNCTION trigger_notif_game_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_organizer_name TEXT;
  v_friend         RECORD;
BEGIN
  -- Seulement parties publiques
  IF NEW.is_private = TRUE THEN RETURN NEW; END IF;

  SELECT name INTO v_organizer_name FROM profiles WHERE id = NEW.organizer_id;

  FOR v_friend IN
    SELECT CASE
             WHEN requester_id = NEW.organizer_id THEN addressee_id
             ELSE requester_id
           END AS friend_id
    FROM friendships
    WHERE (requester_id = NEW.organizer_id OR addressee_id = NEW.organizer_id)
      AND status = 'accepted'
  LOOP
    PERFORM insert_notification(
      v_friend.friend_id,
      'game_created',
      jsonb_build_object(
        'organizer_id',   NEW.organizer_id,
        'organizer_name', COALESCE(v_organizer_name, 'Un ami'),
        'session_id',     NEW.id,
        'session_title',  NEW.title,
        'session_date',   NEW.date::TEXT,
        'location',       NEW.location
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_game_created ON sessions;
CREATE TRIGGER notif_game_created
  AFTER INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_game_created();

-- ── 8. Trigger : résultat enregistré ─────────────────────────────────────────
-- matches(session_id, team1_player1, team1_player2, team2_player1, team2_player2, ...)
CREATE OR REPLACE FUNCTION trigger_notif_result_recorded()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session_date    TEXT;
  v_organizer_id    UUID;
  v_organizer_name  TEXT;
  v_player_id       UUID;
  v_notified        UUID[];
BEGIN
  SELECT date::TEXT, organizer_id
    INTO v_session_date, v_organizer_id
    FROM sessions WHERE id = NEW.session_id;

  SELECT name INTO v_organizer_name FROM profiles WHERE id = v_organizer_id;

  v_notified := ARRAY[]::UUID[];

  -- Notifier les 4 joueurs du match (dédupliqués)
  FOREACH v_player_id IN ARRAY ARRAY[
    NEW.team1_player1, NEW.team1_player2,
    NEW.team2_player1, NEW.team2_player2
  ] LOOP
    CONTINUE WHEN v_player_id IS NULL;
    CONTINUE WHEN v_player_id = ANY(v_notified);
    v_notified := array_append(v_notified, v_player_id);

    PERFORM insert_notification(
      v_player_id,
      'result_recorded',
      jsonb_build_object(
        'recorder_id',   v_organizer_id,
        'recorder_name', COALESCE(v_organizer_name, 'L''organisateur'),
        'session_id',    NEW.session_id,
        'session_date',  v_session_date
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notif_result_recorded ON matches;
CREATE TRIGGER notif_result_recorded
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION trigger_notif_result_recorded();

-- ── 9. Activer Realtime sur la table notifications ────────────────────────────
-- Dans Supabase Dashboard → Database → Replication → activer "notifications"
-- Ou via SQL :
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
