-- migration11_private_sessions.sql
-- Parties privées avec lien unique.
-- À exécuter dans Supabase → SQL Editor.

-- ── 1. Colonnes ─────────────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_private   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS private_token TEXT UNIQUE;

-- ── 2. Trigger : génère automatiquement le token quand is_private = true ────
CREATE OR REPLACE FUNCTION generate_private_session_token()
RETURNS TRIGGER AS $$
BEGIN
  -- Générer un token unique de 10 caractères si la partie est privée
  IF NEW.is_private AND NEW.private_token IS NULL THEN
    LOOP
      NEW.private_token := lower(
        substring(replace(gen_random_uuid()::text, '-', ''), 1, 10)
      );
      -- Vérifier l'unicité (très peu probable d'avoir une collision mais on vérifie)
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM sessions WHERE private_token = NEW.private_token AND id != NEW.id
      );
    END LOOP;
  END IF;
  -- Si la partie repasse en publique, on garde le token (pour ne pas casser les anciens liens)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_private_token ON sessions;
CREATE TRIGGER sessions_private_token
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION generate_private_session_token();
