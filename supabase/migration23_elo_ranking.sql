-- migration23_elo_ranking.sql
-- Système de classement ELO
--
-- Règles :
--   • rank_score : entier, défaut 1000, plancher 100
--   • Points échangés selon la différence de force des équipes et le résultat
--   • Bonus/malus selon l'écart de jeux (score_diff)
--   • Calculé automatiquement à chaque INSERT dans matches
--   • Les systèmes XP (+3/+1) et badges restent inchangés
--
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Nouvelle colonne rank_score dans profiles
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rank_score INTEGER NOT NULL DEFAULT 1000;

-- Plancher : jamais en dessous de 100
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_rank_score_min;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_rank_score_min CHECK (rank_score >= 100);

-- Initialise les profils existants à 1000 s'ils seraient nuls
UPDATE profiles SET rank_score = 1000 WHERE rank_score IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 2. Fonction de calcul ELO
--
--   Paramètres reçus depuis la ligne NEW du trigger :
--     team1_player1/2, team2_player1/2  → UUIDs
--     team1_score, team2_score          → jeux totaux
--     winner_team                       → 1 ou 2
--
--   Algorithme :
--     1. Moyennes des ranks par équipe
--     2. rank_diff = |avg_A - avg_B|
--     3. Base points selon diff + favori/outsider
--     4. Ajustement selon game_diff
--     5. Mise à jour avec plancher 100
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_elo_on_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  -- Ranks actuels des 4 joueurs
  v_r1          INT;
  v_r2          INT;
  v_r3          INT;
  v_r4          INT;
  -- Moyennes par équipe
  v_avg_a       NUMERIC;
  v_avg_b       NUMERIC;
  v_rank_diff   NUMERIC;
  -- Résultat
  v_winner_avg  NUMERIC;
  v_loser_avg   NUMERIC;
  v_is_favorite BOOLEAN;
  -- Joueurs gagnants / perdants
  v_w1          UUID;
  v_w2          UUID;
  v_l1          UUID;
  v_l2          UUID;
  -- Scores
  v_w_score     INT;
  v_l_score     INT;
  v_game_diff   INT;
  -- Points
  v_base_pts    INT;
  v_final_pts   INT;
BEGIN
  -- Sécurité : pas de winner_team → on ignore
  IF NEW.winner_team IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Lecture des ranks actuels ──────────────────────────────
  SELECT COALESCE(rank_score, 1000) INTO v_r1 FROM profiles WHERE id = NEW.team1_player1;
  SELECT COALESCE(rank_score, 1000) INTO v_r2 FROM profiles WHERE id = NEW.team1_player2;
  SELECT COALESCE(rank_score, 1000) INTO v_r3 FROM profiles WHERE id = NEW.team2_player1;
  SELECT COALESCE(rank_score, 1000) INTO v_r4 FROM profiles WHERE id = NEW.team2_player2;

  -- ── Moyennes équipes ───────────────────────────────────────
  v_avg_a    := (v_r1 + v_r2) / 2.0;
  v_avg_b    := (v_r3 + v_r4) / 2.0;
  v_rank_diff := ABS(v_avg_a - v_avg_b);

  -- ── Assignation gagnants / perdants ───────────────────────
  IF NEW.winner_team = 1 THEN
    v_w1 := NEW.team1_player1;  v_w2 := NEW.team1_player2;
    v_l1 := NEW.team2_player1;  v_l2 := NEW.team2_player2;
    v_winner_avg := v_avg_a;    v_loser_avg  := v_avg_b;
    v_w_score    := NEW.team1_score;
    v_l_score    := NEW.team2_score;
  ELSE
    v_w1 := NEW.team2_player1;  v_w2 := NEW.team2_player2;
    v_l1 := NEW.team1_player1;  v_l2 := NEW.team1_player2;
    v_winner_avg := v_avg_b;    v_loser_avg  := v_avg_a;
    v_w_score    := NEW.team2_score;
    v_l_score    := NEW.team1_score;
  END IF;

  -- ── Favori = équipe avec le rank moyen le plus élevé ──────
  v_is_favorite := v_winner_avg >= v_loser_avg;

  -- ── Points de base ────────────────────────────────────────
  --   Diff 0–49   : match équilibré → 20 pts
  --   Diff 50–149 : favori gagne    → 15 pts  /  outsider → 25 pts
  --   Diff 150+   : favori gagne    → 10 pts  /  outsider → 40 pts
  IF v_rank_diff < 50 THEN
    v_base_pts := 20;
  ELSIF v_rank_diff < 150 THEN
    v_base_pts := CASE WHEN v_is_favorite THEN 15 ELSE 25 END;
  ELSE
    v_base_pts := CASE WHEN v_is_favorite THEN 10 ELSE 40 END;
  END IF;

  -- ── Bonus précision du score (adapté matchs 6/7 jeux) ───────
  --   Diff = 1 (7-6, 6-5) → Très serré   : -3 pts
  --   Diff = 2 (6-4)       → Standard     :  0 pts
  --   Diff = 3-4 (6-3,6-2) → Dominant     : +3 pts
  --   Diff ≥ 5  (6-1, 6-0) → Écrasant     : +6 pts
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

  -- Minimum 1 point échangé
  v_final_pts := GREATEST(v_final_pts, 1);

  -- ── Mise à jour des ranks (plancher 100) ──────────────────
  UPDATE profiles
  SET rank_score = GREATEST(100, rank_score + v_final_pts)
  WHERE id IN (v_w1, v_w2);

  UPDATE profiles
  SET rank_score = GREATEST(100, rank_score - v_final_pts)
  WHERE id IN (v_l1, v_l2);

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Trigger : se déclenche après chaque INSERT de match
--    (la suppression d'un match n'inverse PAS le ELO —
--     à implémenter ultérieurement si nécessaire)
-- ═══════════════════════════════════════════════════════════════
DROP TRIGGER IF EXISTS elo_update_on_match ON matches;
CREATE TRIGGER elo_update_on_match
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION update_elo_on_match();

-- ═══════════════════════════════════════════════════════════════
-- 4. RLS : les admins peuvent lire rank_score de tous les profils
--    (la colonne est dans profiles, déjà accessible en SELECT)
--    Aucune nouvelle politique nécessaire — rank_score est
--    automatiquement inclus dans les SELECT existants.
-- ═══════════════════════════════════════════════════════════════

-- Vérification manuelle (optionnel) :
-- SELECT id, name, rank_score FROM profiles ORDER BY rank_score DESC;
