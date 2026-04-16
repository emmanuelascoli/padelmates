-- ============================================================
-- PadelMates - Schéma de base de données Supabase
-- À exécuter dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- ─── 1. PROFILES ────────────────────────────────────────────
-- Étend la table auth.users de Supabase

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,                          -- Numéro Twint/Revolut
  level      TEXT NOT NULL DEFAULT 'intermediate'
               CHECK (level IN ('beginner', 'intermediate', 'advanced', 'pro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crée automatiquement un profil vide à l'inscription
-- (le profil sera rempli par l'app lors de la registration)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Le profil est créé manuellement depuis l'app, cette fonction est juste un backup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 2. SESSIONS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  location         TEXT NOT NULL,
  cost_per_player  DECIMAL(10, 2) NOT NULL DEFAULT 0,
  max_players      INTEGER NOT NULL DEFAULT 4,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'full', 'completed', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. SESSION PARTICIPANTS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_status TEXT NOT NULL DEFAULT 'pending'
                   CHECK (payment_status IN ('pending', 'paid', 'confirmed')),
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- ─── 4. MATCHES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  team1_player1   UUID REFERENCES public.profiles(id),
  team1_player2   UUID REFERENCES public.profiles(id),
  team2_player1   UUID REFERENCES public.profiles(id),
  team2_player2   UUID REFERENCES public.profiles(id),
  team1_score     INTEGER,
  team2_score     INTEGER,
  winner_team     INTEGER CHECK (winner_team IN (1, 2)),
  played_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. ROW LEVEL SECURITY (RLS) ──────────────────────────────
-- IMPORTANT : active la sécurité au niveau des lignes

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Tout le monde peut lire les profils"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "L'utilisateur peut créer son propre profil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "L'utilisateur peut modifier son propre profil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- SESSIONS
CREATE POLICY "Tout le monde peut voir les sessions"
  ON public.sessions FOR SELECT USING (true);

CREATE POLICY "Les membres connectés peuvent créer une session"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = organizer_id);

CREATE POLICY "L'organisateur peut modifier sa session"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = organizer_id);

CREATE POLICY "L'organisateur peut supprimer sa session"
  ON public.sessions FOR DELETE
  USING (auth.uid() = organizer_id);

-- SESSION PARTICIPANTS
CREATE POLICY "Tout le monde peut voir les participants"
  ON public.session_participants FOR SELECT USING (true);

CREATE POLICY "Les membres connectés peuvent rejoindre"
  ON public.session_participants FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "L'utilisateur peut modifier sa propre participation"
  ON public.session_participants FOR UPDATE
  USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT organizer_id FROM public.sessions WHERE id = session_id)
  );

CREATE POLICY "L'utilisateur peut quitter une session"
  ON public.session_participants FOR DELETE
  USING (
    auth.uid() = user_id OR
    auth.uid() = (SELECT organizer_id FROM public.sessions WHERE id = session_id)
  );

-- MATCHES
CREATE POLICY "Tout le monde peut voir les matchs"
  ON public.matches FOR SELECT USING (true);

CREATE POLICY "Les membres connectés peuvent ajouter des matchs"
  ON public.matches FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Les membres connectés peuvent modifier des matchs"
  ON public.matches FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Les membres connectés peuvent supprimer des matchs"
  ON public.matches FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── 6. INDEX UTILES ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_organizer ON public.sessions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON public.session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_session ON public.matches(session_id);
