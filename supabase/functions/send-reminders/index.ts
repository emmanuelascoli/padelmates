// Edge Function : rappels automatiques
// Déclenchée toutes les heures par pg_cron
//
// Ce qu'elle fait :
//   1. Rappel veille à 8h : email à chaque participant de toute partie le lendemain
//      (envoyé entre 6h et 7h UTC = 8h heure suisse été/hiver)
//      Inclut un rappel de paiement avec lien vers la partie si payment_status = pending
//   2. Promotion liste d'attente : email au joueur promu automatiquement
//
// Déploiement : supabase functions deploy send-reminders
// Variables d'env : RESEND_API_KEY, APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  APP_URL,
  formatDateFr,
  buildICS,
  encodeBase64,
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

Deno.serve(async () => {
  const now = new Date()
  let totalSent = 0
  const errors: string[] = []

  // ── 1. RAPPEL VEILLE À 8H ────────────────────────────────────────────────
  // Exécuté seulement entre 6h00 et 7h59 UTC (= 8h heure suisse été et hiver)
  // Cible : toutes les parties du lendemain (date = demain)
  // TEST_MODE : condition d'heure désactivée temporairement
  try {
    const utcHour = now.getUTCHours()
    if (utcHour === 6 || utcHour === 7) {
      const tomorrow = new Date(now)
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      const tomorrowStr = tomorrow.toISOString().split('T')[0]

      const { data: sessions } = await supabase
        .from('sessions')
        .select('*, organizer:profiles!sessions_organizer_id_fkey(name)')
        .eq('date', tomorrowStr)
        .eq('status', 'open')

      for (const session of sessions ?? []) {
        const { data: participants } = await supabase
          .from('session_participants')
          .select('user_id, payment_status, profiles(name)')
          .eq('session_id', session.id)

        if (!participants?.length) continue

        const firstNames = participants
          .map((p: Record<string, Record<string, string>>) => p.profiles?.name)
          .filter(Boolean) as string[]

        const sessionUrl = `${APP_URL}/sessions/${session.id}`
        const dateLabel  = formatDateFr(session.date, session.time)
        const gcal       = googleCalendarUrl(session)
        const outlook    = outlookCalendarUrl(session)
        const icsB64     = encodeBase64(buildICS(session))

        for (const p of participants) {
          // Anti-doublon
          const { data: already } = await supabase
            .from('notification_log').select('id')
            .eq('type', 'reminder_veille').eq('user_id', p.user_id).eq('session_id', session.id)
            .maybeSingle()
          if (already) continue

          const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id)
          if (!user?.email) continue

          const displayName = (p.profiles as Record<string, string>)?.name?.split(' ')[0] ?? 'Joueur'
          const isPending   = (p.payment_status as string) === 'pending'
          const hasCost     = (session.cost_per_player as number) > 0

          // Rappel paiement : redirige vers la partie (pas de lien Revolut direct)
          // → le joueur clique Revolut dans l'app et son statut passe à "déclaré"
          const paymentBlock = isPending && hasCost ? `
<table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;margin:16px 0;border:1.5px solid #f97316;">
  <tr><td style="background:#f97316;padding:10px 16px;">
    <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;">💳 Paiement en attente</p>
  </td></tr>
  <tr><td style="background:#fff7ed;padding:12px 16px;">
    <p style="margin:0 0 10px 0;font-size:13px;color:#7c2d12;">
      Rembourse <strong>${session.cost_per_player} CHF</strong> à ${(session.organizer as Record<string, string>)?.name ?? "l'organisateur"} avant la partie.
    </p>
    ${ctaButton('Régler maintenant →', sessionUrl, '#f97316')}
  </td></tr>
</table>` : ''

          const body = `
<p style="margin:0 0 4px 0;font-size:14px;color:#374151;">Bonjour <strong>${displayName}</strong> 👋</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#6B7280;">Ta partie de padel est <strong>demain</strong> — tout est prêt ?</p>

${sessionInfoBlock(session, dateLabel)}
${playersBlock(firstNames)}
${paymentBlock}
${calendarButtons(gcal, outlook)}
${ctaButton('Voir la partie →', sessionUrl)}

<div style="border-top:0.5px solid #E5E7EB;padding-top:14px;margin-top:4px;text-align:center;">
  <a href="${sessionUrl}?action=leave" style="font-size:12px;color:#9CA3AF;text-decoration:none;">Me désinscrire</a>
</div>`

          const html = emailWrapper(`Ta partie est demain — ${session.location}`, body)

          const ok = await sendEmail({
            to: user.email,
            subject: `🎾 Demain — Padel à ${(session.time as string).substring(0, 5)} · ${session.location}`,
            html,
            attachments: [{ filename: `padel-${session.date}.ics`, content: icsB64 }],
          })

          if (ok) {
            await supabase.from('notification_log').insert({
              type: 'reminder_veille', user_id: p.user_id, session_id: session.id,
            })
            totalSent++
          }
        }
      }
    }
  } catch (e) {
    errors.push(`reminder_veille: ${(e as Error).message}`)
  }

  // ── 2. EMAIL PROMOTION LISTE D'ATTENTE ───────────────────────────────────
  // Cherche les joueurs promus depuis la liste d'attente via le trigger DB :
  // promoted_from_waitlist = true + joined_at dans les 2 dernières heures
  // La colonne promoted_from_waitlist est posée par migration33
  try {
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString()

    const { data: recentJoins } = await supabase
      .from('session_participants')
      .select('id, user_id, session_id, payment_status, joined_at, profiles(name)')
      .eq('promoted_from_waitlist', true)
      .gte('joined_at', twoHoursAgo)

    for (const p of recentJoins ?? []) {

      // Anti-doublon
      const { data: promoAlready } = await supabase
        .from('notification_log').select('id')
        .eq('type', 'waitlist_promotion').eq('user_id', p.user_id).eq('session_id', p.session_id)
        .maybeSingle()
      if (promoAlready) continue

      const { data: session } = await supabase
        .from('sessions')
        .select('*, organizer:profiles!sessions_organizer_id_fkey(name)')
        .eq('id', p.session_id).single()
      if (!session || session.status !== 'open') continue

      const sessionDt = new Date(`${session.date}T${session.time}`)
      if (sessionDt < now) continue

      const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id)
      if (!user?.email) continue

      const displayName = (p.profiles as Record<string, string>)?.name?.split(' ')[0] ?? 'Joueur'
      const dateLabel   = formatDateFr(session.date, session.time)
      const sessionUrl  = `${APP_URL}/sessions/${session.id}`
      const gcal        = googleCalendarUrl(session)
      const outlook     = outlookCalendarUrl(session)
      const icsB64      = encodeBase64(buildICS(session))
      const hasCost     = (session.cost_per_player as number) > 0

      // Rappel paiement : redirige vers la partie, pas de lien Revolut direct
      const paymentBlock = hasCost ? `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;margin:16px 0;">
  <tr><td>
    <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#9a3412;">💳 Pense à régler ta part</p>
    <p style="margin:0;font-size:13px;color:#c2410c;">
      <strong>${session.cost_per_player} CHF</strong> à rembourser à ${(session.organizer as Record<string, string>)?.name ?? "l'organisateur"}.
    </p>
  </td></tr>
</table>
${ctaButton('Payer ma part →', sessionUrl)}` : ''

      const body = `
<p style="margin:0 0 4px 0;font-size:14px;color:#374151;">Bonjour <strong>${displayName}</strong> 🎉</p>
<p style="margin:0 0 20px 0;font-size:14px;color:#6B7280;">Une place vient de se libérer et tu es <strong>automatiquement inscrit(e)</strong> à la partie !</p>

${sessionInfoBlock(session, dateLabel)}
${paymentBlock}
${calendarButtons(gcal, outlook)}
${ctaButton('Voir la partie →', sessionUrl)}

<div style="border-top:0.5px solid #E5E7EB;padding-top:14px;margin-top:4px;text-align:center;">
  <a href="${sessionUrl}?action=leave" style="font-size:12px;color:#9CA3AF;text-decoration:none;">Je ne peux plus jouer — me désinscrire</a>
</div>`

      const html = emailWrapper('Place libérée — tu es inscrit(e) !', body)

      const ok = await sendEmail({
        to: user.email,
        subject: `🎉 Place libérée — tu es inscrit(e) · ${session.location}, ${(session.time as string).substring(0, 5)}`,
        html,
        attachments: [{ filename: `padel-${session.date}.ics`, content: icsB64 }],
      })

      if (ok) {
        await supabase.from('notification_log').insert({
          type: 'waitlist_promotion', user_id: p.user_id, session_id: p.session_id,
        })
        totalSent++
      }
    }
  } catch (e) {
    errors.push(`waitlist_promotion: ${(e as Error).message}`)
  }

  return new Response(
    JSON.stringify({ sent: totalSent, errors }),
    { status: errors.length ? 207 : 200, headers: { 'Content-Type': 'application/json' } }
  )
})
