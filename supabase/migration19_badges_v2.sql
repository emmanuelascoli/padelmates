-- migration19_badges_v2.sql
-- Refonte des badges : suppression de verified_organizer (manuel)
-- Ajout de veteran (50 parties), renommage loyal_player → habitue
-- À exécuter dans Supabase → SQL Editor

-- ── 1. Migrer les données : renommer loyal_player → habitue ──────────────────
UPDATE profiles
SET badges = array_replace(badges, 'loyal_player', 'habitue')
WHERE 'loyal_player' = ANY(badges);

-- ── 2. Supprimer le badge verified_organizer de tous les profils ─────────────
UPDATE profiles
SET badges = array_remove(badges, 'verified_organizer')
WHERE 'verified_organizer' = ANY(badges);

-- ── 3. Supprimer la fonction admin_toggle_verified_organizer ─────────────────
DROP FUNCTION IF EXISTS admin_toggle_verified_organizer(UUID, BOOLEAN);

-- ── 4. Mettre à jour compute_badges_for_user ─────────────────────────────────
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

        -- 🎾 Habitué : 10+ parties jouées
        CASE WHEN (
          SELECT COUNT(*) FROM session_participants WHERE user_id = uid
        ) >= 10 THEN 'habitue'::TEXT END,

        -- 🏅 Organisateur Actif : 5+ parties créées
        CASE WHEN (
          SELECT COUNT(*) FROM sessions WHERE organizer_id = uid
        ) >= 5 THEN 'organizer_active'::TEXT END,

        -- 🔥 En forme : 3+ parties dans le même mois calendaire
        CASE WHEN (
          SELECT COUNT(*)
          FROM session_participants sp
          JOIN sessions s ON s.id = sp.session_id
          WHERE sp.user_id = uid
            AND s.date >= date_trunc('month', CURRENT_DATE)::date
            AND s.date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
        ) >= 3 THEN 'on_fire'::TEXT END,

        -- 🏆 Vétéran : 50+ parties jouées
        CASE WHEN (
          SELECT COUNT(*) FROM session_participants WHERE user_id = uid
        ) >= 50 THEN 'veteran'::TEXT END

      ]) AS b
      WHERE b IS NOT NULL
    ),
    '{}'::TEXT[]
  );
$$;

-- ── 5. Recalculer les badges de tous les profils ──────────────────────────────
DO $$
DECLARE uid UUID;
BEGIN
  FOR uid IN SELECT id FROM profiles LOOP
    UPDATE profiles
    SET badges = compute_badges_for_user(uid)
    WHERE id = uid;
  END LOOP;
END $$;
