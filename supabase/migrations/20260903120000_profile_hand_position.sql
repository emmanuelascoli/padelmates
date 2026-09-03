-- Migration : ajout main dominante et position sur le court
-- Colonnes nullable TEXT, aucune contrainte — valeurs gérées côté app

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dominant_hand TEXT,   -- 'droite' | 'gauche'
  ADD COLUMN IF NOT EXISTS court_side    TEXT;   -- 'gauche' | 'droite' | 'les_deux'
