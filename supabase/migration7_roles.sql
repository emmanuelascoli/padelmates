-- migration7_roles.sql
-- Système de rôles : admin | organizer | member
-- À exécuter dans Supabase → SQL Editor.

-- ── 1. Ajouter la colonne role ──────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('member', 'organizer', 'admin'));

-- ── 2. Fonction utilitaire : récupérer son propre rôle ──────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- ── 3. Fonction utilitaire : vérifier si l'utilisateur est admin ────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ── 4. RLS : permettre aux admins de modifier le rôle des autres profils ─────
-- Les admins peuvent tout voir dans profiles (ils peuvent déjà lire via la policy existante)
-- On ajoute une policy UPDATE spécifique pour les admins

-- D'abord vérifier que la policy de base UPDATE existe ; si non, la créer :
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Admin can update any profile'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admin can update any profile"
      ON profiles FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
    $policy$;
  END IF;
END $$;

-- ── 5. RLS : sessions — les admins peuvent annuler/modifier n'importe quelle partie ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions' AND policyname = 'Admin can update any session'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admin can update any session"
      ON sessions FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
    $policy$;
  END IF;
END $$;

-- ── 6. Définir le premier admin (remplacer par l'email réel) ─────────────────
-- IMPORTANT : exécuter cette ligne après l'inscription de Manu
-- UPDATE profiles SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'emmanuel.ascoli@gmail.com');

-- ── 7. Promouvoir un organisateur vérifié (exemple) ──────────────────────────
-- UPDATE profiles SET role = 'organizer' WHERE id = '<user_uuid>';
