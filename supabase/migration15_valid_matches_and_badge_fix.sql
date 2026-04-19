-- Migration 15 : Exclure les parties annulées des stats et badges
-- À exécuter dans Supabase → SQL Editor

-- ── 1. Vue valid_matches ─────────────────────────────────────────────────────
-- Seuls les matchs des parties NON annulées entrent dans les classements.
CREATE OR REPLACE VIEW public.valid_matches AS
SELECT m.*
FROM public.matches m
JOIN public.sessions s ON s.id = m.session_id
WHERE s.status <> 'cancelled';

-- Accès identique à la table matches
GRANT SELECT ON public.valid_matches TO authenticated, anon;

-- ── 2. Fonction compute_badges_for_user — version corrigée ──────────────────
-- Toutes les conditions excluent désormais les sessions annulées.
CREATE OR REPLACE FUNCTION compute_badges_for_user(uid UUID)
RETURNS TEXT[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT b
      FROM unnest(ARRAY[

        -- 🏅 Organisateur actif : 5+ parties créées (non annulées)
        CASE WHEN (
          SELECT COUNT(*) FROM sessions
          WHERE organizer_id = uid AND status <> 'cancelled'
        ) >= 5 THEN 'organizer_active'::TEXT END,

        -- 🎾 Joueur fidèle : 10+ parties jouées (non annulées)
        CASE WHEN (
          SELECT COUNT(*)
          FROM session_participants sp
          JOIN sessions s ON s.id = sp.session_id
          WHERE sp.user_id = uid
            AND s.status <> 'cancelled'
        ) >= 10 THEN 'loyal_player'::TEXT END,

        -- 🔥 En forme : 3+ parties ce mois-ci (non annulées)
        CASE WHEN (
          SELECT COUNT(*)
          FROM session_participants sp
          JOIN sessions s ON s.id = sp.session_id
          WHERE sp.user_id = uid
            AND s.status <> 'cancelled'
            AND s.date >= date_trunc('month', CURRENT_DATE)::date
            AND s.date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
        ) >= 3 THEN 'on_fire'::TEXT END,

        -- ⭐ Organisateur vérifié : badge manuel — toujours préservé
        CASE WHEN EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = uid AND 'verified_organizer' = ANY(p.badges)
        ) THEN 'verified_organizer'::TEXT END

      ]) AS b
      WHERE b IS NOT NULL
    ),
    '{}'::TEXT[]
  );
$$;

-- ── 3. Recalcul immédiat de tous les badges (applique la correction) ─────────
DO $$
DECLARE uid UUID;
BEGIN
  FOR uid IN SELECT id FROM profiles LOOP
    UPDATE profiles
    SET badges = compute_badges_for_user(uid)
    WHERE id = uid;
  END LOOP;
END $$;
