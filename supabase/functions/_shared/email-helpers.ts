// ─── Helpers partagés entre les Edge Functions email ────────────────────────
// Design aligné sur PadelMates : vert #14532d, fond #F5F4F0, cards blanches

export const APP_URL = Deno.env.get('APP_URL') || 'https://padelmates.ch'

// ── Formatage date en français ───────────────────────────────────────────────
export function formatDateFr(dateStr: string, timeStr: string): string {
  const date = new Date(`${dateStr}T${timeStr}`)
  return new Intl.DateTimeFormat('fr-CH', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(date)
}

// ── Encodage base64 Unicode-safe (btoa ne supporte pas les accents/emojis) ───
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}

// ── Durée → minutes ──────────────────────────────────────────────────────────
export function durationToMinutes(duration?: string): number {
  if (duration === '1h')   return 60
  if (duration === '1h30') return 90
  if (duration === '2h')   return 120
  return 90
}

// ── Contenu .ics ─────────────────────────────────────────────────────────────
// Utilise TZID=Europe/Zurich pour éviter le décalage horaire UTC
export function buildICS(session: Record<string, unknown>): string {
  // Format local YYYYMMDDTHHMMSS sans Z (heure suisse, pas UTC)
  const fmtLocal = (dateStr: string, timeStr: string, addMinutes = 0) => {
    const [h, m] = (timeStr as string).split(':').map(Number)
    const totalMin = h * 60 + m + addMinutes
    const newH = Math.floor(totalMin / 60) % 24
    const newM = totalMin % 60
    const d = (dateStr as string).replace(/-/g, '')
    return `${d}T${String(newH).padStart(2,'0')}${String(newM).padStart(2,'0')}00`
  }
  const duration = durationToMinutes(session.duration as string)
  const org = (session.organizer as Record<string, string>)?.name ?? ''
  const dateStr = session.date as string
  const timeStr = (session.time as string).substring(0, 5)

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMates//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Zurich',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Europe/Zurich:${fmtLocal(dateStr, timeStr)}`,
    `DTEND;TZID=Europe/Zurich:${fmtLocal(dateStr, timeStr, duration)}`,
    `SUMMARY:Padel - ${session.location}`,
    `DESCRIPTION:Partie PadelMates - Organisateur : ${org}${(session.access_code as string) ? ` - Code terrain : ${session.access_code as string} (valide 15 min avant)` : ''} - ${APP_URL}/sessions/${session.id}`,
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
    action: 'TEMPLATE', text: `🎾 Padel — ${session.location}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: `Partie PadelMates | Organisateur : ${org}\n${APP_URL}/sessions/${session.id}`,
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
    rru: 'addevent', startdt: start.toISOString(), enddt: end.toISOString(),
    subject: `🎾 Padel — ${session.location}`,
    location: session.location as string,
    body: `Partie PadelMates | Organisateur : ${org}\n${APP_URL}/sessions/${session.id}`,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p}`
}

// ── Envoi email via Resend ───────────────────────────────────────────────────
export async function sendEmail(opts: {
  to: string; subject: string; html: string
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
      to: opts.to, subject: opts.subject, html: opts.html,
      attachments: opts.attachments,
    }),
  })
  return res.ok
}

// ── Template de base — design vert PadelMates ────────────────────────────────
export function emailWrapper(headerTitle: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F4F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;padding:32px 0;">
  <tr><td align="center">
    <table width="100%" style="max-width:520px;">

      <!-- LOGO / EN-TÊTE -->
      <tr><td style="padding:0 0 16px 0;text-align:center;">
        <span style="font-size:13px;font-weight:600;color:#14532d;letter-spacing:0.05em;text-transform:uppercase;">🎾 PadelMates</span>
      </td></tr>

      <!-- CARTE PRINCIPALE -->
      <tr><td style="background:#ffffff;border-radius:20px;border:0.5px solid #E5E7EB;overflow:hidden;">

        <!-- Bande verte -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="background:#14532d;padding:24px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:500;line-height:1.3;">${headerTitle}</h1>
          </td></tr>

          <!-- Corps -->
          <tr><td style="padding:24px;">
            ${body}
          </td></tr>
        </table>

      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:20px 0 0 0;text-align:center;">
        <p style="margin:0;color:#9CA3AF;font-size:11px;">
          PadelMates · <a href="${APP_URL}" style="color:#9CA3AF;text-decoration:none;">${APP_URL.replace('https://', '')}</a>
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
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">💰 <strong>${session.cost_per_player} CHF / joueur</strong></td></tr>`
    : ''
  const org = (session.organizer as Record<string, string>)?.name
    ? `<tr><td style="padding:3px 0;font-size:13px;color:#374151;">👤 Organisé par ${(session.organizer as Record<string, string>).name}</td></tr>`
    : ''
  const accessCode = session.access_code as string | null
  const code = accessCode ? `
      <tr><td style="padding:6px 0 3px;border-top:0.5px solid #E5E7EB;">
        <span style="font-size:13px;color:#374151;">🔑 Code d'accès : <strong style="font-family:monospace;letter-spacing:0.08em;">${accessCode}</strong></span>
      </td></tr>` : ''
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F4F0;border-radius:12px;padding:16px;margin:16px 0;">
  <tr><td>
    <table cellpadding="0" cellspacing="0">
      <tr><td style="padding:3px 0;font-size:14px;font-weight:600;color:#111827;">📅 ${dateStr} à ${(session.time as string).substring(0, 5)}</td></tr>
      <tr><td style="padding:3px 0;font-size:13px;color:#374151;">📍 ${session.location}</td></tr>
      ${cost}
      ${org}
      ${code}
    </table>
  </td></tr>
</table>`
}

// ── Liste joueurs (prénoms) ──────────────────────────────────────────────────
export function playersBlock(names: string[]): string {
  if (!names.length) return ''
  const pills = names.map(n =>
    `<span style="display:inline-block;background:#DCFCE7;color:#166534;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;margin:3px;">${n}</span>`
  ).join('')
  return `
<div style="margin:16px 0;">
  <p style="margin:0 0 8px 0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;">Joueurs inscrits</p>
  <div>${pills}</div>
</div>`
}

// ── Bouton CTA principal ─────────────────────────────────────────────────────
export function ctaButton(label: string, url: string, color = '#14532d'): string {
  return `
<div style="text-align:center;margin:20px 0;">
  <a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:500;font-size:14px;">${label}</a>
</div>`
}

// ── Boutons agenda ───────────────────────────────────────────────────────────
export function calendarButtons(gcal: string, outlook: string): string {
  return `
<div style="margin:16px 0;">
  <p style="margin:0 0 8px 0;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;">Ajouter à mon agenda</p>
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="padding-right:8px;">
      <a href="${gcal}" style="display:inline-block;background:#ffffff;border:0.5px solid #E5E7EB;color:#374151;padding:9px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:500;">📅 Google Calendar</a>
    </td>
    <td>
      <a href="${outlook}" style="display:inline-block;background:#ffffff;border:0.5px solid #E5E7EB;color:#374151;padding:9px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:500;">📅 Outlook</a>
    </td>
  </tr></table>
  <p style="margin:8px 0 0 0;font-size:11px;color:#9CA3AF;">Le fichier .ics (Apple Calendar) est joint à cet email.</p>
</div>`
}
