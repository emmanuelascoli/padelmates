-- ============================================================
-- PadelMates - Migration (à exécuter après schema.sql)
-- ============================================================

-- ─── 1. PROFILS : ajout avatar + nouveaux niveaux ────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Mise à jour du système de niveaux (1-10 officiel padel)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_level_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_level_check
  CHECK (level IN ('1','2','3','4','5','6','7','8','9','10'));
ALTER TABLE public.profiles ALTER COLUMN level SET DEFAULT '3';

-- ─── 2. SESSIONS : durée + niveau souhaité ───────────────────

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '1h30'
  CHECK (duration IN ('1h', '1h30', '2h'));
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS level_min TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS level_max TEXT;
ALTER TABLE public.sessions ALTER COLUMN title SET DEFAULT '';

-- ─── 3. TRIGGER UTILISATEUR (remplace l'ancienne version) ────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, level)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'level', '3')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 4. STORAGE : bucket photos de profil ────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
CREATE POLICY "Public avatar access"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
CREATE POLICY "Users can update avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
CREATE POLICY "Users can delete avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
