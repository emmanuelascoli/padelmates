-- migration12_notifications.sql
-- Table de log des notifications + pg_cron pour rappels automatiques
-- À exécuter dans Supabase → SQL Editor

-- ── 1. Table de log (évite les doublons d'envoi) ─────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,        -- 'confirmation' | 'reminder_24h' | 'organizer_nudge'
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, user_id, session_id)
);

-- Index pour les lookups fréquents
CREATE INDEX IF NOT EXISTS notification_log_session_idx ON notification_log(session_id);
CREATE INDEX IF NOT EXISTS notification_log_user_idx    ON notification_log(user_id);

-- RLS : lecture réservée aux admins, insertion via service role (Edge Functions)
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can view notification log"
  ON notification_log FOR SELECT
  USING (is_admin());

-- ── 2. pg_cron : déclencher send-reminders toutes les heures ─────────────────
-- Prérequis : activer l'extension pg_cron dans Supabase Dashboard
--   → Database → Extensions → pg_cron → Enable
--
-- Remplace YOUR_PROJECT_REF par ton ID de projet (ex : abcdefghijklmn)
-- et YOUR_SERVICE_ROLE_KEY par ta clé service role (Settings → API)

-- Option A : via pg_cron (plan Pro)
/*
SELECT cron.schedule(
  'hourly-session-reminders',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body    := '{}'::jsonb
    );
  $$
);
*/

-- Option B : via GitHub Actions (plan gratuit) — voir instructions dans le README

-- ── 3. Voir les jobs cron actifs ─────────────────────────────────────────────
-- SELECT * FROM cron.job;

-- ── 4. Supprimer un job cron ─────────────────────────────────────────────────
-- SELECT cron.unschedule('hourly-session-reminders');
