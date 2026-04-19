// ─── Helpers partagés entre les Edge Functions email ────────────────────────

export const APP_URL = Deno.env.get('APP_URL') || 'https://padelmates.ch'

// ── Formatage date en français ───────────────────────────────────────────────
export function formatDateFr(dateStr: string, timeStr: string): string {
  const date = new Date(`${dateStr}T${timeStr}`)
  return new Intl.DateTimeFormat('fr-CH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

// ── Durée → minutes ──────────────────────────────────────────────────────────
export function durationToMinutes(duration?: string): number {
  if (duration === '1h')   return 60
  if (duration === '1h30') return 90
  if (duration === '2h')   return 120
  return 90
}

// ── Contenu .ics ─────────────────────────────────────────────────────────────
export function buildICS(session: Record<string, unknown>): string {
  const start = new Date(`${session.date}T${session.time}`)
  const end   = new Date(start.getTime() + durationToMinutes(session.duration as string) * 60000)
  const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const org   = (session.organizer as Record<string, string>)?.name ?? ''

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMates//FR',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:🎾 Padel — ${session.location}`,
    `DESCRIPTION:Partie PadelMates\\nOrganisateur : ${org}\\n${APP_URL}/sessions/${session.id}`,
    `LOCATION:${session.location}`,
    `URL:${APP_URL}/sessions/${session.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

// ── Lien Google Calendar ─────────────────────────────────────────────────────
export function googleCalendarUrl(session: Record<string, unknown>): string {
  const start = new Date(`${session.date}T${session.time}`)
  const end   = new Date(start.getTime() + durationToMinutes(session.duration as string) * 60000)
  const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const org   = (session.organizer as Record<string, string>)?.name ?? ''

  const p = new URLSearchParams({
    action:   'TEMPLATE',
    text:     `🎾 Padel — ${session.location}`,
    dates:    `${fmt(start)}/${fmt(end)}`,
    details:  `Partie PadelMates | Organisateur : ${org}\n${APP_URL}/sessions/${session.id}`,
    location: session.location as string,
  })
  return `https://calendar.google.com/calendar/render?${p}`
}

// ── Lien Outlook Calendar ────────────────────────────────────────────────────
export function outlookCalendarUrl(session: Record<string, unknown>): string {
  const start = new Date(`${session.date}T${session.time}`)
  const end   = new Date(start.getTime() + durationToMinutes(session.duration as string) * 60000)
  const org   = (session.organizer as Record<string, string>)?.name ?? ''

  const p = new URLSearchParams({
    rru:      'addevent',
    startdt:  start.toISOString(),
    enddt:    end.toISOString(),
    subject:  `🎾 Padel — ${session.location}`,
    location: session.location as string,
    body:     `Partie PadelMates | Organisateur : ${org}\n${APP_URL}/sessions/${session.id}`,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`
}

// ── Envoi email via Resend ───────────────────────────────────────────────────
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  attachments?: { filename: string; content: string }[]
}): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'PadelMates <noreply@padelmates.ch>',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments,
    }),
  })
  return res.ok
}

// ── Template de base partagé ─────────────────────────────────────────────────
export function emailWrapper(headerEmoji: string, headerTitle: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 24px;text-align:center;">
        <div style="font-size:44px;margin-bottom:8px;">${headerEmoji}</div>
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${headerTitle}</h1>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding:28px 24px;">
        ${body}
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">
          PadelMates · <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">${APP_URL.replace('https://', '')}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}

// ── Bloc infos session ───────────────────────────────────────────────────────
export function sessionInfoBlock(session: Record<string, unknown>, dateStr: string): string {
  const cost = (session.cost_per_player as number) > 0
    ? `<tr><td style="padding:4px 0;color:#1e40af;">💰 <strong>${session.cost_per_player} CHF / joueur</strong></td></tr>`
    : ''
  const duration = session.duration
    ? `<tr><td style="padding:4px 0;color:#1e40af;">⏱ Durée : ${session.duration}</td></tr>`
    : ''
  const org = (session.organizer as Record<string, string>)?.name
    ? `<tr><td style="padding:4px 0;color:#1e40af;">👤 Organisateur : ${(session.organizer as Record<string, string>).name}</td></tr>`
    : ''

  return `
<table width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:16px 0;" cellpadding="0" cellspacing="0">
  <tr><td>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 0;color:#1e40af;font-weight:600;font-size:15px;">📅 ${dateStr} à ${(session.time as string).substring(0, 5)}</td></tr>
      ${duration}
      <tr><td style="padding:4px 0;color:#1e40af;">📍 ${session.location}</td></tr>
      ${cost}
      ${org}
    </table>
  </td></tr>
</table>`
}

// ── Liste joueurs (prénoms) ──────────────────────────────────────────────────
export function playersBlock(names: string[]): string {
  if (!names.length) return ''
  const pills = names.map(n =>
    `<span style="display:inline-block;background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:20px;font-size:13px;font-weight:600;margin:3px;">${n}</span>`
  ).join('')
  return `
<div style="margin:16px 0;">
  <p style="margin:0 0 8px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Joueurs inscrits</p>
  <div>${pills}</div>
</div>`
}

// ── Bouton CTA ───────────────────────────────────────────────────────────────
export function ctaButton(label: string, url: string, color = '#2563eb'): string {
  return `
<div style="text-align:center;margin:20px 0;">
  <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">${label}</a>
</div>`
}

// ── Boutons agenda ───────────────────────────────────────────────────────────
export function calendarButtons(gcal: string, outlook: string): string {
  return `
<div style="margin:20px 0;">
  <p style="margin:0 0 10px 0;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Ajouter à mon agenda</p>
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:8px;">
      <a href="${gcal}" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;padding:10px 16px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;">📅 Google Calendar</a>
    </td>
    <td>
      <a href="${outlook}" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;padding:10px 16px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:600;">📅 Outlook</a>
    </td>
  </tr></table>
  <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">Le fichier .ics (Apple Calendar) est joint à cet email.</p>
</div>`
}
