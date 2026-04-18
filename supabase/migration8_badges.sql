-- migration8_badges.sql
-- Système de badges gamification
-- À exécuter dans Supabase → SQL Editor.

-- ── 1. Colonne badges sur profiles ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS badges TEXT[] NOT NULL DEFAULT '{}';

-- ── 2. Fonction de calcul des badges pour un utilisateur ───────────────────
CREATE OR REPLACE FUNCTION compute_badges_for_user(uid UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_count      INT;
  played_count       INT;
  this_month_count   INT;
  existing_badges    TEXT[];
  result             TEXT[] := '{}';
BEGIN
  -- Lire les badges existants (pour préserver les badges manuels)
  SELECT COALESCE(badges, '{}') INTO existing_badges
  FROM profiles WHERE id = uid;

  -- 🏅 Organisateur actif : 5+ parties créées
  SELECT COUNT(*) INTO session_count
  FROM sessions WHERE organizer_id = uid;
  IF session_count >= 5 THEN
    result := array_append(result, 'organizer_active');
  END IF;

  -- 🎾 Joueur fidèle : 10+ parties jouées
  SELECT COUNT(*) INTO played_count
  FROM session_participants WHERE user_id = uid;
  IF played_count >= 10 THEN
    result := array_append(result, 'loyal_player');
  END IF;

  -- 🔥 En forme : 3+ parties jouées ce mois-ci
  SELECT COUNT(*) INTO this_month_count
  FROM session_participants sp
  JOIN sessions s ON s.id = sp.session_id
  WHERE sp.user_id = uid
    AND s.date >= date_trunc('month', CURRENT_DATE)::date
    AND s.date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date;
  IF this_month_count >= 3 THEN
    result := array_append(result, 'on_fire');
  END IF;

  -- ⭐ Organisateur vérifié : badge manuel — conserver s'il existait
  -- (utilise @> pour éviter l'ambiguïté de ANY() avec les variables tableau)
  IF existing_badges @> ARRAY['verified_organizer'::TEXT] THEN
    result := array_append(result, 'verified_organizer');
  END IF;

  RETURN result;
END;
$$;

-- ── 3. Rafraîchir les badges d'un utilisateur ──────────────────────────────
CREATE OR REPLACE FUNCTION refresh_user_badges(uid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET badges = compute_badges_for_user(uid)
  WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_user_badges(UUID) TO authenticated;

-- ── 4. Trigger : badge organisateur actif quand une partie est créée ────────
CREATE OR REPLACE FUNCTION trigger_session_badge()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_user_badges(NEW.organizer_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sessions_badge_refresh ON sessions;
CREATE TRIGGER sessions_badge_refresh
  AFTER INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION trigger_session_badge();

-- ── 5. Trigger : badge joueur fidèle + en forme quand un participant rejoint ─
CREATE OR REPLACE FUNCTION trigger_participant_badge()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_user_badges(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS participants_badge_refresh ON session_participants;
CREATE TRIGGER participants_badge_refresh
  AFTER INSERT ON session_participants
  FOR EACH ROW EXECUTE FUNCTION trigger_participant_badge();

-- ── 6. Fonction admin : attribuer / retirer le badge Organisateur Vérifié ───
CREATE OR REPLACE FUNCTION admin_toggle_verified_organizer(uid UUID, grant_badge BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission refusée — réservé aux admins';
  END IF;

  IF grant_badge THEN
    -- Ajouter le badge (sans doublon)
    UPDATE profiles
    SET badges = array_append(
      array_remove(COALESCE(badges, '{}'), 'verified_organizer'),
      'verified_organizer'
    )
    WHERE id = uid;
  ELSE
    -- Retirer le badge
    UPDATE profiles
    SET badges = array_remove(COALESCE(badges, '{}'), 'verified_organizer')
    WHERE id = uid;
  END IF;

  -- Recalculer les badges auto en préservant l'état manuel qu'on vient de setter
  PERFORM refresh_user_badges(uid);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_toggle_verified_organizer(UUID, BOOLEAN) TO authenticated;

-- ── 7. Fonction admin : recalculer tous les badges ─────────────────────────
CREATE OR REPLACE FUNCTION admin_refresh_all_badges()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID;
  cnt INT := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission refusée — réservé aux admins';
  END IF;
  FOR uid IN SELECT id FROM profiles LOOP
    PERFORM refresh_user_badges(uid);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_refresh_all_badges() TO authenticated;

-- ── 8. Calcul initial pour tous les profils existants ──────────────────────
DO $$
DECLARE uid UUID;
BEGIN
  FOR uid IN SELECT id FROM profiles LOOP
    UPDATE profiles
    SET badges = compute_badges_for_user(uid)
    WHERE id = uid;
  END LOOP;
END $$;
