-- Migration 14 : P2P Payment fields
-- Run in Supabase SQL Editor

-- 1. Add revolut_tag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS revolut_tag TEXT;

-- 2. Add payment timestamps to session_participants (optional tracking)
ALTER TABLE public.session_participants ADD COLUMN IF NOT EXISTS payment_declared_at TIMESTAMPTZ;
ALTER TABLE public.session_participants ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- 3. Comments
COMMENT ON COLUMN public.profiles.revolut_tag IS 'Revolut @tag for P2P payments (without the @, e.g. "emmanuelbla")';
COMMENT ON COLUMN public.session_participants.payment_declared_at IS 'When the participant clicked "J''ai payé"';
COMMENT ON COLUMN public.session_participants.payment_confirmed_at IS 'When the organizer confirmed the payment';

-- Note: payment_status column already exists on session_participants with values:
--   pending  = not yet paid
--   paid     = participant declared payment (waiting for organizer confirmation)
--   confirmed = organizer confirmed reception
