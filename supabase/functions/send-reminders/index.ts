// Edge Function Supabase : envoi des rappels email la veille des parties
// Déploiement : supabase functions deploy send-reminders
// Variable d'env requise : RESEND_API_KEY (https://resend.com — gratuit jusqu'à 3000 emails/mois)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://padelmates.ch'

Deno.serve(async () => {
  try {
    // Trouver les parties de demain
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(name)')
      .eq('date', tomorrowStr)
      .eq('status', 'open')

    if (sessionsError) throw sessionsError
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ message: 'Aucune partie demain.' }), { status: 200 })
    }

    let totalSent = 0

    for (const session of sessions) {
      // Récupérer les participants avec leur email
      const { data: participants } = await supabase
        .from('session_participants')
        .select('profiles(name, id), user_email:auth.users(email)')
        .eq('session_id', session.id)

      // Récupérer les emails depuis auth.users
      const { data: participantProfiles } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', session.id)

      if (!participantProfiles) continue

      const userIds = participantProfiles.map(p => p.user_id)

      // Récupérer les profils + emails
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const participantUsers = users.filter(u => userIds.includes(u.id))

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)

      const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]))

      for (const u of participantUsers) {
        if (!u.email) continue

        const name = nameMap[u.id] || 'Joueur'
        const sessionUrl = `${APP_URL}/sessions/${session.id}`

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); border-radius: 16px; padding: 24px; color: white; text-align: center; margin-bottom: 24px;">
              <div style="font-size: 40px; margin-bottom: 8px;">🎾</div>
              <h1 style="margin: 0; font-size: 22px;">Rappel — Partie demain !</h1>
            </div>

            <p style="color: #374151;">Bonjour <strong>${name}</strong>,</p>
            <p style="color: #374151;">Tu as une partie de padel demain. Voici les détails :</p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <p style="margin: 4px 0; color: #0c4a6e;">📅 <strong>${session.date}</strong> à ${session.time}</p>
              ${session.duration ? `<p style="margin: 4px 0; color: #0c4a6e;">⏱ Durée : ${session.duration}</p>` : ''}
              <p style="margin: 4px 0; color: #0c4a6e;">📍 ${session.location}</p>
              ${session.cost_per_player > 0 ? `<p style="margin: 4px 0; color: #0c4a6e;">💰 ${session.cost_per_player} CHF / joueur</p>` : ''}
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${sessionUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold;">
                Voir la partie →
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              PadelMates — ${APP_URL}
            </p>
          </div>
        `

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'PadelMates <rappels@padelmates.ch>',
            to: u.email,
            subject: `🎾 Rappel — Partie demain à ${session.time} · ${session.location}`,
            html: emailHtml,
          }),
        })

        totalSent++
      }
    }

    return new Response(
      JSON.stringify({ message: `${totalSent} rappel(s) envoyé(s) pour ${sessions.length} partie(s).` }),
      { status: 200 }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
