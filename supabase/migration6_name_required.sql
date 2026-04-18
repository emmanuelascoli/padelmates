-- migration6_name_required.sql
-- Rend le champ name obligatoire dans profiles au niveau base de données.
-- À exécuter dans Supabase → SQL Editor.

-- 1. Remplir les noms manquants avec un placeholder avant d'ajouter la contrainte
--    (pour ne pas bloquer si des profils sans nom existent déjà)
UPDATE profiles
SET name = 'Utilisateur ' || substring(id::text, 1, 6)
WHERE name IS NULL OR trim(name) = '';

-- 2. Ajouter la contrainte NOT NULL
ALTER TABLE profiles
  ALTER COLUMN name SET NOT NULL;

-- 3. Ajouter une contrainte CHECK pour garantir un minimum de 2 caractères
ALTER TABLE profiles
  ADD CONSTRAINT profiles_name_min_length CHECK (length(trim(name)) >= 2);
