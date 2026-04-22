-- migration24_elo_retroactive.sql
-- Remplace le trigger INSERT-only de migration23 par une logique
-- de recalcul complet qui :
--   • Traite tous les matchs historiques (calcul rétroactif)
--   • Se relance automatiquement à chaque INSERT ou DELETE de match
--     → la suppression d'un match inverse correctement le ELO
--
-- Prérequis : migration23 déjà appliquée (colonne rank_score présente)
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Suppression de l'ancien trigger INSERT-only (migration23)
-- ═══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS elo_update_on_match ON matches;
DROP FUNCTION IF EXISTS update_elo_on_match();

-- ═══════════════════════════════════════════════════════════════
-- 2. Fonction de recalcul complet
--
--   Algorithme :
--     1. Remet tous les rank_score à 1000
--     2. Rejoue chaque match dans l'ordre chronologique
--        (played_at ASC, puis id ASC comme départage)
--     3. Applique le barème ELO pour chaque match
--     4. Exclut les matchs des parties annulées
--
--   Retourne : nombre de matchs traités (INT)
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
  -- ── Remise à zéro ─────────────────────────────────────────
  UPDATE profiles SET rank_score = 1000;

  -- ── Rejeu chronologique ───────────────────────────────────
  -- On exclut les matchs liés à des parties annulées
  FOR v_match IN
    SELECT m.*
    FROM   matches m
    JOIN   sessions s ON s.id = m.session_id
    WHERE  m.winner_team IS NOT NULL
      AND  s.status      != 'cancelled'
    ORDER  BY m.played_at ASC, m.id ASC
  LOOP
    -- Lecture des ranks courants (après les matchs précédents)
    SELECT COALESCE(rank_score, 1000) INTO v_r1 FROM profiles WHERE id = v_match.team1_player1;
    SELECT COALESCE(rank_score, 1000) INTO v_r2 FROM profiles WHERE id = v_match.team1_player2;
    SELECT COALESCE(rank_score, 1000) INTO v_r3 FROM profiles WHERE id = v_match.team2_player1;
    SELECT COALESCE(rank_score, 1000) INTO v_r4 FROM profiles WHERE id = v_match.team2_player2;

    v_avg_a    := (v_r1 + v_r2) / 2.0;
    v_avg_b    := (v_r3 + v_r4) / 2.0;
    v_rank_diff := ABS(v_avg_a - v_avg_b);

    -- Gagnants / perdants
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

    -- Points de base
    IF v_rank_diff < 50 THEN
      v_base_pts := 20;
    ELSIF v_rank_diff < 150 THEN
      v_base_pts := CASE WHEN v_is_favorite THEN 15 ELSE 25 END;
    ELSE
      v_base_pts := CASE WHEN v_is_favorite THEN 10 ELSE 40 END;
    END IF;

    -- Bonus précision du score
    v_game_diff := v_w_score - v_l_score;
    IF v_game_diff <= 4 THEN
      v_final_pts := v_base_pts - 2;
    ELSIF v_game_diff >= 9 THEN
      v_final_pts := v_base_pts + 5;
    ELSE
      v_final_pts := v_base_pts;
    END IF;

    v_final_pts := GREATEST(v_final_pts, 1);

    -- Mise à jour avec plancher 100
    UPDATE profiles
    SET rank_score = GREATEST(100, rank_score + v_final_pts)
    WHERE id IN (v_w1, v_w2);

    UPDATE profiles
    SET rank_score = GREATEST(100, rank_score - v_final_pts)
    WHERE id IN (v_l1, v_l2);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Trigger unique INSERT OR DELETE → recalcul complet
--
--   INSERT : le nouveau match est déjà visible (AFTER INSERT),
--            le loop l'inclut automatiquement.
--   DELETE : la ligne supprimée n'est plus visible (AFTER DELETE),
--            le loop la saute automatiquement → inversion parfaite.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION trigger_elo_recalculate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM recalculate_all_elo();
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS elo_on_match_insert ON matches;
DROP TRIGGER IF EXISTS elo_on_match_delete ON matches;

CREATE TRIGGER elo_on_match_insert
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION trigger_elo_recalculate();

CREATE TRIGGER elo_on_match_delete
  AFTER DELETE ON matches
  FOR EACH ROW EXECUTE FUNCTION trigger_elo_recalculate();

-- ═══════════════════════════════════════════════════════════════
-- 4. Exposer recalculate_all_elo() comme RPC admin
--    (pour appel depuis le bouton Admin → ELO → Recalculer)
-- ═══════════════════════════════════════════════════════════════
-- La fonction est déjà SECURITY DEFINER — elle est appelable via
-- supabase.rpc('recalculate_all_elo') par n'importe quel utilisateur
-- authentifié. La restriction admin se fait côté front (bouton
-- visible uniquement dans l'onglet Admin).

-- ═══════════════════════════════════════════════════════════════
-- 5. Calcul rétroactif initial
--    Rejoue tous les matchs existants pour initialiser les ranks.
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_processed INT;
BEGIN
  SELECT recalculate_all_elo() INTO v_processed;
  RAISE NOTICE 'ELO initialisé — % match(s) traité(s).', v_processed;
END;
$$;
