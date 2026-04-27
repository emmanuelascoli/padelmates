-- migration27_user_logins.sql
-- Suivi des connexions des joueurs.
-- Permet aux admins de voir : activité quotidienne, joueurs actifs,
-- dernière connexion par joueur.
--
-- Prérequis : migration.sql appliquée (table profiles)
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Table user_logins
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_logins (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at  timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_user_logins_user_id   ON user_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logins_logged_at ON user_logins(logged_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2. Row-Level Security
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifié peut insérer sa propre connexion
DROP POLICY IF EXISTS "Users can insert own login" ON user_logins;
CREATE POLICY "Users can insert own login"
  ON user_logins FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Seuls les admins peuvent lire les connexions
DROP POLICY IF EXISTS "Admins can read all logins" ON user_logins;
CREATE POLICY "Admins can read all logins"
  ON user_logins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id   = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- 3. log_user_login()
--    Appelée depuis le frontend à chaque SIGNED_IN.
--    Anti-doublon : ne logue pas si une entrée existe dans la
--    dernière heure pour cet utilisateur.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION log_user_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Ne pas loguer si le joueur n'a pas encore de profil
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
    RETURN;
  END IF;

  -- Anti-doublon 1h (gère les rechargements de page)
  IF NOT EXISTS (
    SELECT 1 FROM user_logins
    WHERE user_id  = auth.uid()
      AND logged_at > NOW() - INTERVAL '1 hour'
  ) THEN
    INSERT INTO user_logins (user_id, logged_at)
    VALUES (auth.uid(), NOW());
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. get_user_login_stats()
--    Retourne les statistiques de connexion par joueur.
--    Réservé aux admins (vérification interne).
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_user_login_stats()
RETURNS TABLE(
  user_id       uuid,
  total_logins  bigint,
  logins_30d    bigint,
  logins_7d     bigint,
  logins_today  bigint,
  last_login    timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérification admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé — rôle admin requis';
  END IF;

  RETURN QUERY
  SELECT
    p.id                                                                        AS user_id,
    COUNT(ul.id)::bigint                                                        AS total_logins,
    COUNT(ul.id) FILTER (WHERE ul.logged_at > NOW() - INTERVAL '30 days')::bigint AS logins_30d,
    COUNT(ul.id) FILTER (WHERE ul.logged_at > NOW() - INTERVAL '7 days')::bigint  AS logins_7d,
    COUNT(ul.id) FILTER (
      WHERE ul.logged_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Zurich')
                            AT TIME ZONE 'Europe/Zurich'
    )::bigint                                                                   AS logins_today,
    MAX(ul.logged_at)                                                           AS last_login
  FROM profiles p
  LEFT JOIN user_logins ul ON ul.user_id = p.id
  GROUP BY p.id
  ORDER BY MAX(ul.logged_at) DESC NULLS LAST;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. get_daily_login_chart(p_days)
--    Retourne le nombre de connexions par jour sur les N derniers
--    jours. Jours sans connexion non inclus (remplis côté front).
--    Réservé aux admins.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_daily_login_chart(p_days int DEFAULT 14)
RETURNS TABLE(day date, login_count bigint) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérification admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé — rôle admin requis';
  END IF;

  RETURN QUERY
  SELECT
    (logged_at AT TIME ZONE 'Europe/Zurich')::date AS day,
    COUNT(*)::bigint                               AS login_count
  FROM user_logins
  WHERE logged_at > NOW() - (p_days || ' days')::interval
  GROUP BY 1
  ORDER BY 1;
END;
$$;
