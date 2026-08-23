-- migration35_locations.sql
-- Table des lieux de jeu gérée par l'admin
-- À appliquer : npx supabase db push  (ou SQL Editor)

-- ═══════════════════════════════════════════════════════════════
-- 1. Table locations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS locations (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL UNIQUE,
  address    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. RLS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir les lieux"
  ON locations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins peuvent gérer les lieux"
  ON locations FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 3. Insérer les 9 lieux actuellement hardcodés dans NewSession
-- ═══════════════════════════════════════════════════════════════
INSERT INTO locations (name) VALUES
  ('Bernex'),
  ('Cologny'),
  ('David Lloyd''s Club'),
  ('Jonction'),
  ('La Praille'),
  ('Les Acacias'),
  ('Padel Station'),
  ('Parc des Evaux'),
  ('TC International Chambesy')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 4. Ajouter location_id (nullable) sur sessions
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_location_id ON sessions(location_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. Migrer les sessions existantes
--    session.location peut valoir "Bernex" ou "Bernex — Terrain 3"
--    → on matche par LIKE 'nom_lieu%'
-- ═══════════════════════════════════════════════════════════════
UPDATE sessions s
SET    location_id = l.id
FROM   locations l
WHERE  s.location LIKE l.name || '%'
  AND  s.location_id IS NULL;
