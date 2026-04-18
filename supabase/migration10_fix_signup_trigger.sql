-- migration10_fix_signup_trigger.sql
-- Corrige l'erreur "Database error saving new user" lors de l'inscription email/password.
--
-- Problème : le trigger handle_new_user insère un profil avec name = '' (chaîne vide)
-- car aucun nom n'est disponible à l'étape 1 (email+password seulement).
-- migration6 a ajouté CHECK (length(trim(name)) >= 2) qui rejette la chaîne vide.
--
-- Solution :
--   - Si le nom dans les métadonnées est valide (≥ 2 chars) → insérer le profil
--     (cas Google OAuth : le nom Google est dans raw_user_meta_data->>'name')
--   - Sinon → ne rien insérer ; l'app crée le profil à l'étape 2 de l'inscription
--
-- À exécuter dans Supabase → SQL Editor.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer le profil seulement si un nom valide est disponible dans les métadonnées
  -- (Google OAuth fournit le nom ; inscription email/password ne le fournit pas encore)
  IF length(trim(COALESCE(NEW.raw_user_meta_data->>'name', ''))) >= 2 THEN
    INSERT INTO public.profiles (id, name, phone, level)
    VALUES (
      NEW.id,
      trim(NEW.raw_user_meta_data->>'name'),
      NEW.raw_user_meta_data->>'phone',
      COALESCE(NEW.raw_user_meta_data->>'level', '3')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
