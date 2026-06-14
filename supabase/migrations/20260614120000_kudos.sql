-- migration32_kudos.sql
-- Table kudos : réactions sociales sur les résultats de matches et séries

CREATE TABLE IF NOT EXISTS kudos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  giver_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('session', 'streak')),
  target_id   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (giver_id, target_type, target_id)
);

-- RLS
ALTER TABLE kudos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir les kudos"
  ON kudos FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Un utilisateur peut donner des kudos"
  ON kudos FOR INSERT
  WITH CHECK (auth.uid() = giver_id);

CREATE POLICY "Un utilisateur peut retirer ses propres kudos"
  ON kudos FOR DELETE
  USING (auth.uid() = giver_id);

-- Index pour les requêtes du feed
CREATE INDEX idx_kudos_target ON kudos (target_type, target_id);
CREATE INDEX idx_kudos_giver  ON kudos (giver_id);

-- ─── Trigger : notification quand on reçoit des kudos ────────────────────────

CREATE OR REPLACE FUNCTION notify_on_kudos()
RETURNS TRIGGER AS $$
DECLARE
  v_giver_name TEXT;
  v_player_id  UUID;
BEGIN
  SELECT name INTO v_giver_name FROM profiles WHERE id = NEW.giver_id;

  IF NEW.target_type = 'session' THEN
    -- Notifier tous les joueurs qui ont joué un match dans cette session
    FOR v_player_id IN
      SELECT DISTINCT unnest(ARRAY[
        team1_player1, team1_player2,
        team2_player1, team2_player2
      ])
      FROM valid_matches
      WHERE session_id = NEW.target_id::UUID
        AND winner_team IS NOT NULL
    LOOP
      IF v_player_id IS NOT NULL AND v_player_id <> NEW.giver_id THEN
        INSERT INTO notifications (user_id, type, data)
        VALUES (
          v_player_id,
          'kudos_received',
          jsonb_build_object(
            'giver_id',    NEW.giver_id,
            'giver_name',  v_giver_name,
            'session_id',  NEW.target_id,
            'target_type', NEW.target_type
          )
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

  ELSIF NEW.target_type = 'streak' THEN
    -- Notifier le joueur dont c'est la série
    v_player_id := NEW.target_id::UUID;
    IF v_player_id <> NEW.giver_id THEN
      INSERT INTO notifications (user_id, type, data)
      VALUES (
        v_player_id,
        'kudos_received',
        jsonb_build_object(
          'giver_id',    NEW.giver_id,
          'giver_name',  v_giver_name,
          'target_type', NEW.target_type
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_kudos_insert ON kudos;
CREATE TRIGGER on_kudos_insert
  AFTER INSERT ON kudos
  FOR EACH ROW EXECUTE FUNCTION notify_on_kudos();
