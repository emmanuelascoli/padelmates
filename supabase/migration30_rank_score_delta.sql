-- migration30_rank_score_delta.sql
-- Ajoute rank_score_delta pour afficher le dernier changement ELO dans le classement.
--
-- CE QUE ÇA CHANGE :
--   • Nouvelle colonne rank_score_delta (INTEGER, défaut 0) dans profiles
--   • recalculate_all_elo() mis à jour : remet delta à 0 au reset, puis
--     enregistre le dernier delta de chaque joueur au fil des matchs
--     (ordre chronologique → la dernière valeur écrite = delta du match le plus récent)
--
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Nouvelle colonne
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rank_score_delta INTEGER NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════
-- 2. Mise à jour de recalculate_all_elo()
--    Identique à migration24, avec deux ajouts :
--      • Le reset remet aussi rank_score_delta à 0
--      • Chaque UPDATE de rank_score écrit aussi le delta
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION recalculate_all_elo()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_match       RECORD;
  v_r1 INT; v_r2 INT; v_r3 INT; v_r4 INT;
  v_avg_a       NUMERIC;
  v_avg_b       NUMERIC;
  v_rank_diff   NUMERIC;
  v_winner_avg  NUMERIC;
  v_loser_avg   NUMERIC;
  v_is_favorite BOOLEAN;
  v_w1 UUID; v_w2 UUID;
  v_l1 UUID; v_l2 UUID;
  v_w_score INT; v_l_score INT;
  v_game_diff   INT;
  v_base_pts    INT;
  v_final_pts   INT;
  v_count       INT := 0;
BEGIN
  -- ── Remise à zéro (score + delta) ─────────────────────────
  UPDATE profiles SET rank_score = 1000, rank_score_delta = 0 WHERE TRUE;

  -- ── Rejeu chronologique ───────────────────────────────────
  FOR v_match IN
    SELECT m.*
    FROM   matches m
    JOIN   sessions s ON s.id = m.session_id
    WHERE  m.winner_team IS NOT NULL
      AND  s.status      != 'cancelled'
    ORDER  BY m.played_at ASC, m.id ASC
  LOOP
    SELECT COALESCE(rank_score, 1000) INTO v_r1 FROM profiles WHERE id = v_match.team1_player1;
    SELECT COALESCE(rank_score, 1000) INTO v_r2 FROM profiles WHERE id = v_match.team1_player2;
    SELECT COALESCE(rank_score, 1000) INTO v_r3 FROM profiles WHERE id = v_match.team2_player1;
    SELECT COALESCE(rank_score, 1000) INTO v_r4 FROM profiles WHERE id = v_match.team2_player2;

    v_avg_a    := (v_r1 + v_r2) / 2.0;
    v_avg_b    := (v_r3 + v_r4) / 2.0;
    v_rank_diff := ABS(v_avg_a - v_avg_b);

    IF v_match.winner_team = 1 THEN
      v_w1 := v_match.team1_player1;  v_w2 := v_match.team1_player2;
      v_l1 := v_match.team2_player1;  v_l2 := v_match.team2_player2;
      v_winner_avg := v_avg_a;         v_loser_avg  := v_avg_b;
      v_w_score    := v_match.team1_score;
      v_l_score    := v_match.team2_score;
    ELSE
      v_w1 := v_match.team2_player1;  v_w2 := v_match.team2_player2;
      v_l1 := v_match.team1_player1;  v_l2 := v_match.team1_player2;
      v_winner_avg := v_avg_b;         v_loser_avg  := v_avg_a;
      v_w_score    := v_match.team2_score;
      v_l_score    := v_match.team1_score;
    END IF;

    v_is_favorite := v_winner_avg >= v_loser_avg;

    IF v_rank_diff < 50 THEN
      v_base_pts := 20;
    ELSIF v_rank_diff < 150 THEN
      v_base_pts := CASE WHEN v_is_favorite THEN 15 ELSE 25 END;
    ELSE
      v_base_pts := CASE WHEN v_is_favorite THEN 10 ELSE 40 END;
    END IF;

    v_game_diff := v_w_score - v_l_score;
    IF v_game_diff = 1 THEN
      v_final_pts := v_base_pts - 3;
    ELSIF v_game_diff = 2 THEN
      v_final_pts := v_base_pts;
    ELSIF v_game_diff <= 4 THEN
      v_final_pts := v_base_pts + 3;
    ELSE
      v_final_pts := v_base_pts + 6;
    END IF;

    v_final_pts := GREATEST(v_final_pts, 1);

    -- ── Mise à jour rank_score + rank_score_delta ──────────
    UPDATE profiles
    SET rank_score       = GREATEST(100, rank_score + v_final_pts),
        rank_score_delta = v_final_pts
    WHERE id IN (v_w1, v_w2);

    UPDATE profiles
    SET rank_score       = GREATEST(100, rank_score - v_final_pts),
        rank_score_delta = -v_final_pts
    WHERE id IN (v_l1, v_l2);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Calcul rétroactif : peuple rank_score_delta sur les données existantes
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_processed INT;
BEGIN
  SELECT recalculate_all_elo() INTO v_processed;
  RAISE NOTICE 'rank_score_delta initialisé — % match(s) traité(s).', v_processed;
END;
$$;
