-- ============================================================
-- PadelMates - Migration 2
-- Liste d'attente + rappels automatiques
-- ============================================================

-- ─── 1. TABLE LISTE D'ATTENTE ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_waitlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut voir la liste d'attente"
  ON public.session_waitlist FOR SELECT USING (true);

CREATE POLICY "Les membres peuvent rejoindre la liste d'attente"
  ON public.session_waitlist FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Les membres peuvent quitter la liste d'attente"
  ON public.session_waitlist FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 2. TRIGGER : promotion automatique depuis la liste d'attente ──

-- Quand un participant quitte une partie, le premier sur la liste
-- d'attente est automatiquement promu comme participant.

CREATE OR REPLACE FUNCTION public.handle_participant_leave()
RETURNS TRIGGER AS $$
DECLARE
  next_user UUID;
  session_max INTEGER;
  current_count INTEGER;
BEGIN
  -- Vérifier s'il y a encore de la place (après la suppression)
  SELECT max_players INTO session_max
  FROM public.sessions WHERE id = OLD.session_id;

  SELECT COUNT(*) INTO current_count
  FROM public.session_participants WHERE session_id = OLD.session_id;

  -- S'il reste de la place, promouvoir le premier sur la liste
  IF current_count < session_max THEN
    SELECT user_id INTO next_user
    FROM public.session_waitlist
    WHERE session_id = OLD.session_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF next_user IS NOT NULL THEN
      INSERT INTO public.session_participants (session_id, user_id, payment_status)
      VALUES (OLD.session_id, next_user, 'pending')
      ON CONFLICT DO NOTHING;

      DELETE FROM public.session_waitlist
      WHERE session_id = OLD.session_id AND user_id = next_user;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_participant_leave ON public.session_participants;
CREATE TRIGGER on_participant_leave
  AFTER DELETE ON public.session_participants
  FOR EACH ROW EXECUTE FUNCTION public.handle_participant_leave();

-- ─── 3. RAPPELS AUTOMATIQUES PAR EMAIL ───────────────────────
-- Nécessite : pg_cron activé dans Supabase (Extensions)
-- + Edge Function déployée (voir supabase/functions/send-reminders/)
-- + Variable d'env RESEND_API_KEY configurée dans Supabase

-- Active pg_cron si pas encore fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Appelle l'Edge Function tous les jours à 8h00 (heure UTC, soit 9h ou 10h Suisse)
SELECT cron.schedule(
  'rappels-quotidiens',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
