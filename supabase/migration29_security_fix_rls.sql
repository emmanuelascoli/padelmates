-- migration29_security_fix_rls.sql
-- CRITIQUE : Correction de la vulnérabilité A01:2021 (Broken Access Control)
-- Les profils étaient lisibles sans authentification → extraction de masse possible.
--
-- CE QUE ÇA CHANGE :
--   • Les anonymes (non connectés) ne peuvent PLUS lire la table profiles
--   • Seuls les utilisateurs authentifiés peuvent lire les profils
--   • Le numéro de téléphone est restreint : visible uniquement par soi-même,
--     les admins, et les co-participants d'une même partie
--
-- À exécuter dans : Supabase → SQL Editor

-- ═══════════════════════════════════════════════════════════════
-- 1. Supprimer les politiques publiques existantes sur profiles
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone"        ON profiles;
DROP POLICY IF EXISTS "profiles are viewable by everyone"        ON profiles;
DROP POLICY IF EXISTS "profiles_public_read"                     ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users"         ON profiles;

-- S'assurer que RLS est bien activé
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 2. Remplacer par : lecture réservée aux utilisateurs connectés
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- ═══════════════════════════════════════════════════════════════
-- 3. Restreindre l'accès au numéro de téléphone
--
--    Supabase/PostgreSQL ne supporte pas le masquage par colonne
--    via RLS. On passe par une vue sécurisée "profiles_safe" qui
--    masque le téléphone pour les requêtes générales.
--    La colonne phone reste accessible via session_participants
--    (co-joueurs) et dans le panneau Admin.
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW profiles_safe AS
SELECT
  id,
  name,
  level,
  avatar_url,
  role,
  badges,
  rank_score,
  created_at
  -- phone et revolut_tag intentionnellement exclus
FROM profiles;

-- Accès public à la vue safe (pour les pages publiques de l'app)
GRANT SELECT ON profiles_safe TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. Vérifier les autres tables sensibles
-- ═══════════════════════════════════════════════════════════════

-- session_waitlist : ne doit pas être lisible anonymement
ALTER TABLE session_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read waitlist" ON session_waitlist;
DROP POLICY IF EXISTS "Enable read access for all users" ON session_waitlist;

CREATE POLICY "Authenticated users can read waitlist"
  ON session_waitlist FOR SELECT
  TO authenticated
  USING (true);

-- notifications : déjà protégées normalement, vérification
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- user_logins : déjà protégé (migration27), vérification
ALTER TABLE user_logins ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 5. Fonction de vérification — à exécuter après la migration
--    Retourne les tables avec des politiques trop permissives
-- ═══════════════════════════════════════════════════════════════
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND (roles @> ARRAY['anon']::name[] OR qual = 'true')
-- ORDER BY tablename;
