// Edge Function : email de confirmation à l'inscription d'une partie
// Appelée depuis le client React après handleJoin() dans SessionDetail.jsx
// Déploiement : supabase functions deploy send-confirmation
// Variables d'env : RESEND_API_KEY, APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  APP_URL,
  formatDateFr,
  buildICS,
  googleCalendarUrl,
  outlookCalendarUrl,
  sendEmail,
  emailWrapper,
  sessionInfoBlock,
  playersBlock,
  ctaButton,
  calendarButtons,
} from '../_shared/email-helpers.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { sessionId, userId } = await req.json()
    if (!sessionId || !userId) {
      return new Response(JSON.stringify({ error: 'sessionId et userId requis' }), { status: 400, headers: corsHeaders })
    }

    // ── 1. Anti-doublon ──────────────────────────────────────────────────────
    const { data: already } = await supabase
      .from('notification_log')
      .select('id')
      .eq('type', 'confirmation')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (already) {
      return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders })
    }

    // ── 2. Données session ───────────────────────────────────────────────────
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(name)')
      .eq('id', sessionId)
      .single()

    if (sErr || !session) {
      return new Response(JSON.stringify({ error: 'Session introuvable' }), { status: 404, headers: corsHeaders })
    }

    // ── 3. Email utilisateur ─────────────────────────────────────────────────
    const { data: { user }, error: uErr } = await supabase.auth.admin.getUserById(userId)
    if (uErr || !user?.email) {
      return new Response(JSON.stringify({ error: 'Utilisateur introuvable' }), { status: 404, headers: corsHeaders })
    }

    // ── 4. Liste des participants (prénoms) ──────────────────────────────────
    const { data: participants } = await supabase
      .from('session_participants')
      .select('profiles(name)')
      .eq('session_id', sessionId)

    const firstNames = (participants || [])
      .map((p: Record<string, Record<string, string>>) => p.profiles?.name?.split(' ')[0])
      .filter(Boolean) as string[]

    // ── 5. Construction email ────────────────────────────────────────────────
    const firstName = user.email.split('@')[0]  // fallback si pas de profil
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', userId).single()
    const displayName = profile?.name?.split(' ')[0] ?? firstName

    const dateStr  = formatDateFr(session.date, session.time)
    const gcal     = googleCalendarUrl(session)
    const outlook  = outlookCalendarUrl(session)
    const icsB64   = btoa(buildICS(session))
    const sessionUrl = `${APP_URL}/sessions/${session.id}`
    const leaveUrl   = `${sessionUrl}?action=leave`
    const spotsLeft  = session.max_players - (participants?.length ?? 0)

    const body = `
      <p style="color:#374151;margin:0 0 4px 0;">Bonjour <strong>${displayName}</strong> 👋</p>
      <p style="color:#374151;margin:0 0 20px 0;">Tu es bien inscrit à cette partie de padel. On t'y attend !</p>

      ${sessionInfoBlock(session, dateStr)}
      ${playersBlock(firstNames)}

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin:16px 0;">
        <p style="margin:0;color:#166534;font-size:13px;">
          ${spotsLeft > 0
            ? `🟢 <strong>${spotsLeft} place${spotsLeft > 1 ? 's' : ''} encore disponible${spotsLeft > 1 ? 's' : ''}</strong> — partage la partie pour compléter l'équipe !`
            : `🎾 La partie est <strong>complète</strong> — à vous de jouer !`
          }
        </p>
      </div>

      ${calendarButtons(gcal, outlook)}
      ${ctaButton('Voir ma partie →', sessionUrl)}

      <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:8px;text-align:center;">
        <a href="${leaveUrl}" style="font-size:12px;color:#9ca3af;text-decoration:none;">
          Me désinscrire de cette partie
        </a>
      </div>
    `

    const html = emailWrapper('✅', 'Tu es inscrit !', body)

    // ── 6. Envoi ─────────────────────────────────────────────────────────────
    const ok = await sendEmail({
      to: user.email,
      subject: `✅ Inscription confirmée — ${session.location}, ${(session.time as string).substring(0, 5)}`,
      html,
      attachments: [{ filename: `padel-${session.date}.ics`, content: icsB64 }],
    })

    if (!ok) {
      return new Response(JSON.stringify({ error: 'Échec envoi email' }), { status: 500, headers: corsHeaders })
    }

    // ── 7. Log anti-doublon ──────────────────────────────────────────────────
    await supabase.from('notification_log').insert({
      type: 'confirmation',
      user_id: userId,
      session_id: sessionId,
    })

    return new Response(JSON.stringify({ sent: true }), { headers: corsHeaders })

  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
