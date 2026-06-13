-- migration34_access_code.sql
-- Colonne access_code (code terrain) sur la table sessions
-- Facultatif (NULL si non renseigné), format attendu : "XXXX#"
-- À exécuter dans : Supabase → SQL Editor

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS access_code TEXT;

COMMENT ON COLUMN sessions.access_code IS
  'Code d''accès au terrain (format XXXX#). Transmis uniquement aux participants inscrits par email la veille et visible dans l''app pour les inscrits.';
