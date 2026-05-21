// Edge Function : rappels automatiques et relance organisateur
// Déclenchée toutes les heures par pg_cron (voir migration12_notifications.sql)
//
// Ce qu'elle fait :
//   1. Rappel 24h avant : email à chaque participant
//   2. Relance J-2 : email à l'organisateur si la partie n'est pas complète
//
// Déploiement : supabase functions deploy send-reminders
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

Deno.serve(async () => {
  const now = new Date()
  let totalSent = 0
  const errors: string[] = []

  // ── 1. RAPPEL 24H AVANT ───────────────────────────────────────────────────
  // Fenêtre : sessions dont le début est dans 23h30–24h30 à partir de maintenant
  try {
    const winStart = new Date(now.getTime() + 23.5 * 3600000)
    const winEnd   = new Date(now.getTime() + 24.5 * 3600000)

    // On construit deux filtres date+time pour couvrir la fenêtre
    // Simplification : on filtre par date et on vérifie l'heure en mémoire
    const tomorrowStr = winStart.toISOString().split('T')[0]

    const { data: sessions24h } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(name)')
      .eq('date', tomorrowStr)
      .eq('status', 'open')

    for (const session of sessions24h ?? []) {
      const sessionDt = new Date(`${session.date}T${session.time}`)
      if (sessionDt < winStart || sessionDt > winEnd) continue

      // Participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id, profiles(name)')
        .eq('session_id', session.id)

      if (!participants?.length) continue

      const firstNames = participants
        .map((p: Record<string, Record<string, string>>) => p.profiles?.name?.split(' ')[0])
        .filter(Boolean) as string[]

      const dateStr  = formatDateFr(session.date, session.time)
      const gcal     = googleCalendarUrl(session)
      const outlook  = outlookCalendarUrl(session)
      const icsB64   = btoa(buildICS(session))
      const sessionUrl = `${APP_URL}/sessions/${session.id}`

      for (const p of participants) {
        // Anti-doublon
        const { data: already } = await supabase
          .from('notification_log')
          .select('id')
          .eq('type', 'reminder_24h')
          .eq('user_id', p.user_id)
          .eq('session_id', session.id)
          .maybeSingle()
        if (already) continue

        const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id)
        if (!user?.email) continue

        const displayName = (p.profiles as Record<string, string>)?.name?.split(' ')[0] ?? 'Joueur'

        const body = `
          <p style="color:#374151;margin:0 0 4px 0;">Bonjour <strong>${displayName}</strong> 👋</p>
          <p style="color:#374151;margin:0 0 20px 0;">Ta partie de padel est <strong>demain</strong> — tout est prêt ?</p>

          ${sessionInfoBlock(session, dateStr)}
          ${playersBlock(firstNames)}

          ${calendarButtons(gcal, outlook)}
          ${ctaButton('Voir la partie →', sessionUrl)}

          <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:8px;text-align:center;">
            <a href="${sessionUrl}?action=leave" style="font-size:12px;color:#9ca3af;text-decoration:none;">
              Me désinscrire
            </a>
          </div>
        `
        const html = emailWrapper('⏰', 'Ta partie est demain !', body)

        const ok = await sendEmail({
          to: user.email,
          subject: `⏰ Demain — Padel à ${(session.time as string).substring(0, 5)} · ${session.location}`,
          html,
          attachments: [{ filename: `padel-${session.date}.ics`, content: icsB64 }],
        })

        if (ok) {
          await supabase.from('notification_log').insert({
            type: 'reminder_24h',
            user_id: p.user_id,
            session_id: session.id,
          })
          totalSent++
        }
      }
    }
  } catch (e) {
    errors.push(`reminder_24h: ${(e as Error).message}`)
  }

  // ── 2. RELANCE ORGANISATEUR J-2 ───────────────────────────────────────────
  // Fenêtre : sessions dans 47h30–48h30 qui ne sont pas complètes
  try {
    const win2Start = new Date(now.getTime() + 47.5 * 3600000)
    const win2End   = new Date(now.getTime() + 48.5 * 3600000)
    const in2daysStr = win2Start.toISOString().split('T')[0]

    const { data: sessions2d } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(id, name), session_participants(id)')
      .eq('date', in2daysStr)
      .eq('status', 'open')

    for (const session of sessions2d ?? []) {
      const sessionDt = new Date(`${session.date}T${session.time}`)
      if (sessionDt < win2Start || sessionDt > win2End) continue

      const participantCount = (session.session_participants as unknown[])?.length ?? 0
      const spotsLeft = session.max_players - participantCount
      if (spotsLeft <= 0) continue  // Partie complète, pas de relance

      const organizerId = (session.organizer as Record<string, string>)?.id
      if (!organizerId) continue

      // Anti-doublon
      const { data: already } = await supabase
        .from('notification_log')
        .select('id')
        .eq('type', 'organizer_nudge')
        .eq('user_id', organizerId)
        .eq('session_id', session.id)
        .maybeSingle()
      if (already) continue

      const { data: { user } } = await supabase.auth.admin.getUserById(organizerId)
      if (!user?.email) continue

      const orgName = (session.organizer as Record<string, string>)?.name?.split(' ')[0] ?? 'Organisateur'
      const dateStr    = formatDateFr(session.date, session.time)
      const sessionUrl = `${APP_URL}/sessions/${session.id}`
      const privateToken = session.private_token
      const shareUrl = privateToken
        ? `${APP_URL}/partie/${privateToken}`
        : sessionUrl

      // Message WhatsApp pré-rempli
      const waText = encodeURIComponent(
        `🎾 Il reste ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} pour notre partie !\n📅 ${dateStr}\n📍 ${session.location}\n\n➡️ Rejoins-nous : ${shareUrl}`
      )
      const waUrl = `https://wa.me/?text=${waText}`

      const body = `
        <p style="color:#374151;margin:0 0 4px 0;">Bonjour <strong>${orgName}</strong> 👋</p>
        <p style="color:#374151;margin:0 0 20px 0;">
          Ta partie est dans <strong>2 jours</strong> et il manque encore
          <strong>${spotsLeft} joueur${spotsLeft > 1 ? 's' : ''}</strong> pour la compléter.
        </p>

        ${sessionInfoBlock(session, dateStr)}

        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:12px 16px;margin:16px 0;">
          <p style="margin:0;color:#854d0e;font-size:14px;">
            🟡 <strong>${participantCount}/${session.max_players} joueurs</strong> inscrits — encore ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} à remplir.
          </p>
        </div>

        <div style="text-align:center;margin:20px 0;">
          <a href="${waUrl}" style="display:inline-block;background:#25D366;color:#ffffff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
            📲 Partager sur WhatsApp
          </a>
        </div>

        ${ctaButton('Voir la partie →', sessionUrl, '#2563eb')}

        <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:4px;">
          Tu peux aussi copier le lien et l'envoyer directement :
          <a href="${shareUrl}" style="color:#6b7280;">${shareUrl}</a>
        </p>
      `
      const html = emailWrapper('🔔', `Il manque ${spotsLeft} joueur${spotsLeft > 1 ? 's' : ''} !`, body)

      const ok = await sendEmail({
        to: user.email,
        subject: `🔔 Il manque ${spotsLeft} joueur${spotsLeft > 1 ? 's' : ''} — ta partie dans 2 jours · ${session.location}`,
        html,
      })

      if (ok) {
        await supabase.from('notification_log').insert({
          type: 'organizer_nudge',
          user_id: organizerId,
          session_id: session.id,
        })
        totalSent++
      }
    }
  } catch (e) {
    errors.push(`organizer_nudge: ${(e as Error).message}`)
  }

  // ── 3. RAPPEL 4H AVANT ───────────────────────────────────────────────────
  // Fenêtre : sessions dont le début est dans 3h30–4h30 à partir de maintenant
  try {
    const win4hStart = new Date(now.getTime() + 3.5 * 3600000)
    const win4hEnd   = new Date(now.getTime() + 4.5 * 3600000)
    const todayStr   = win4hStart.toISOString().split('T')[0]

    const { data: sessions4h } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(name, revolut_tag)')
      .eq('date', todayStr)
      .eq('status', 'open')

    for (const session of sessions4h ?? []) {
      const sessionDt = new Date(`${session.date}T${session.time}`)
      if (sessionDt < win4hStart || sessionDt > win4hEnd) continue

      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id, payment_status, profiles(name)')
        .eq('session_id', session.id)

      if (!participants?.length) continue

      const firstNames = participants
        .map((p: Record<string, Record<string, string>>) => p.profiles?.name?.split(' ')[0])
        .filter(Boolean) as string[]

      const dateStr    = formatDateFr(session.date, session.time)
      const sessionUrl = `${APP_URL}/sessions/${session.id}`
      const revTag     = (session.organizer as Record<string, string>)?.revolut_tag

      for (const p of participants) {
        const { data: already } = await supabase
          .from('notification_log')
          .select('id')
          .eq('type', 'reminder_4h')
          .eq('user_id', p.user_id)
          .eq('session_id', session.id)
          .maybeSingle()
        if (already) continue

        const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id)
        if (!user?.email) continue

        const displayName = (p.profiles as Record<string, string>)?.name?.split(' ')[0] ?? 'Joueur'
        const isPending   = (p.payment_status as string) === 'pending'
        const hasCost     = (session.cost_per_player as number) > 0

        const paymentBlock = isPending && hasCost
          ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin:16px 0;">
               <p style="margin:0;color:#9a3412;font-size:14px;">
                 💳 Pense à régler ta part — <strong>${session.cost_per_player} CHF</strong> à rembourser à ${(session.organizer as Record<string, string>)?.name ?? "l'organisateur"}.
               </p>
             </div>
             ${revTag ? ctaButton(`💸 Payer ${session.cost_per_player} CHF via Revolut`, `https://revolut.me/${revTag.replace(/^@/, '')}?amount=${Math.round((session.cost_per_player as number) * 100)}&currency=CHF`, '#191C1F') : ''}`
          : ''

        const body = `
          <p style="color:#374151;margin:0 0 4px 0;">Bonjour <strong>${displayName}</strong> 👋</p>
          <p style="color:#374151;margin:0 0 20px 0;">Ta partie de padel commence dans <strong>4 heures</strong> — on t'attend !</p>

          ${sessionInfoBlock(session, dateStr)}
          ${playersBlock(firstNames)}
          ${paymentBlock}

          ${ctaButton('Voir la partie →', sessionUrl)}

          <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:8px;text-align:center;">
            <a href="${sessionUrl}?action=leave" style="font-size:12px;color:#9ca3af;text-decoration:none;">
              Me désinscrire
            </a>
          </div>
        `
        const html = emailWrapper('⏰', 'Ta partie dans 4 heures !', body)

        const ok = await sendEmail({
          to: user.email,
          subject: `⏰ Dans 4h — Padel à ${(session.time as string).substring(0, 5)} · ${session.location}`,
          html,
        })

        if (ok) {
          await supabase.from('notification_log').insert({
            type: 'reminder_4h',
            user_id: p.user_id,
            session_id: session.id,
          })
          totalSent++
        }
      }
    }
  } catch (e) {
    errors.push(`reminder_4h: ${(e as Error).message}`)
  }

  // ── 4. EMAIL PROMOTION LISTE D'ATTENTE ───────────────────────────────────
  // Cherche les joueurs récemment promus (joined_at dans les 2 dernières heures,
  // payment_status='pending', pas d'email de confirmation normale → promus via trigger)
  try {
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString()

    const { data: recentJoins } = await supabase
      .from('session_participants')
      .select('id, user_id, session_id, payment_status, joined_at, profiles(name)')
      .eq('payment_status', 'pending')
      .gte('joined_at', twoHoursAgo)

    for (const p of recentJoins ?? []) {
      // Si un email de confirmation normale a été envoyé → pas promu, inscription classique
      const { data: confAlready } = await supabase
        .from('notification_log')
        .select('id')
        .eq('type', 'confirmation')
        .eq('user_id', p.user_id)
        .eq('session_id', p.session_id)
        .maybeSingle()
      if (confAlready) continue

      // Anti-doublon pour cet email
      const { data: promoAlready } = await supabase
        .from('notification_log')
        .select('id')
        .eq('type', 'waitlist_promotion')
        .eq('user_id', p.user_id)
        .eq('session_id', p.session_id)
        .maybeSingle()
      if (promoAlready) continue

      // Données session
      const { data: session } = await supabase
        .from('sessions')
        .select('*, organizer:profiles!sessions_organizer_id_fkey(name, revolut_tag)')
        .eq('id', p.session_id)
        .single()
      if (!session || session.status !== 'open') continue

      // Seulement les parties futures
      const sessionDt = new Date(`${session.date}T${session.time}`)
      if (sessionDt < now) continue

      const { data: { user } } = await supabase.auth.admin.getUserById(p.user_id)
      if (!user?.email) continue

      const displayName = (p.profiles as Record<string, string>)?.name?.split(' ')[0] ?? 'Joueur'
      const dateStr     = formatDateFr(session.date, session.time)
      const sessionUrl  = `${APP_URL}/sessions/${session.id}`
      const revTag      = (session.organizer as Record<string, string>)?.revolut_tag
      const hasCost     = (session.cost_per_player as number) > 0

      const paymentBlock = hasCost
        ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin:16px 0;">
             <p style="margin:0 0 4px 0;color:#9a3412;font-size:14px;font-weight:600;">💳 Action requise — règle ta part</p>
             <p style="margin:0;color:#c2410c;font-size:13px;">
               Pour confirmer ta place, rembourse <strong>${session.cost_per_player} CHF</strong> à ${(session.organizer as Record<string, string>)?.name ?? "l'organisateur"}.
             </p>
           </div>
           ${revTag ? ctaButton(`💸 Payer ${session.cost_per_player} CHF via Revolut`, `https://revolut.me/${revTag.replace(/^@/, '')}?amount=${Math.round((session.cost_per_player as number) * 100)}&currency=CHF`, '#191C1F') : ''}`
        : ''

      const body = `
        <p style="color:#374151;margin:0 0 4px 0;">Bonjour <strong>${displayName}</strong> 🎉</p>
        <p style="color:#374151;margin:0 0 20px 0;">
          Une place vient de se libérer et tu es <strong>automatiquement inscrit(e)</strong> à la partie !
        </p>

        ${sessionInfoBlock(session, dateStr)}
        ${paymentBlock}

        ${ctaButton('Voir la partie →', sessionUrl)}

        <div style="border-top:1px solid #f3f4f6;padding-top:16px;margin-top:8px;text-align:center;">
          <a href="${sessionUrl}?action=leave" style="font-size:12px;color:#9ca3af;text-decoration:none;">
            Je ne peux plus jouer — me désinscrire
          </a>
        </div>
      `
      const html = emailWrapper('🎉', 'Une place est libre — tu es inscrit(e) !', body)

      const ok = await sendEmail({
        to: user.email,
        subject: `🎉 Place libérée ! Tu es inscrit(e) — ${session.location}, ${(session.time as string).substring(0, 5)}`,
        html,
      })

      if (ok) {
        await supabase.from('notification_log').insert({
          type: 'waitlist_promotion',
          user_id: p.user_id,
          session_id: p.session_id,
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
