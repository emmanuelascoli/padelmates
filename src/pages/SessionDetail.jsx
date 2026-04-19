import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_LABEL, ROLES, CANCEL_HOURS } from '../lib/constants'

// ── WhatsApp helpers ─────────────────────────────────────────
function getSessionUrl(session) {
  if (session.is_private && session.private_token) {
    return `${window.location.origin}/partie/${session.private_token}`
  }
  return `${window.location.origin}/sessions/${session.id}`
}

function buildShareMessage(session, participantCount) {
  const date = new Date(`${session.date}T${session.time}`)
  const dateStr = format(date, 'EEEE d MMMM à HH:mm', { locale: fr })
  const spotsLeft = session.max_players - participantCount
  const url = getSessionUrl(session)

  let msg = `🎾 *Nouvelle partie de padel !*\n\n`
  msg += `📅 ${dateStr}\n`
  if (session.duration) msg += `⏱ Durée : ${session.duration}\n`
  msg += `📍 ${session.location}\n`
  if (session.cost_per_player > 0) msg += `💰 ${session.cost_per_player} CHF / joueur\n`
  if (session.level_min && session.level_max) {
    msg += `🎯 Niveau : ${session.level_min} → ${session.level_max}\n`
  }
  msg += `\n👥 ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} disponible${spotsLeft > 1 ? 's' : ''}\n`
  msg += `\n➡️ Inscris-toi ici : ${url}`
  return encodeURIComponent(msg)
}

function buildReminderMessage(session, participants) {
  const date = new Date(`${session.date}T${session.time}`)
  const dateStr = format(date, 'EEEE d MMMM à HH:mm', { locale: fr })
  const url = `${window.location.origin}/sessions/${session.id}`

  let msg = `🎾 *Rappel — Partie demain !*\n\n`
  msg += `📅 ${dateStr}\n`
  if (session.duration) msg += `⏱ Durée : ${session.duration}\n`
  msg += `📍 ${session.location}\n`
  if (session.cost_per_player > 0) msg += `💰 ${session.cost_per_player} CHF / joueur\n`
  msg += `\n👥 Joueurs inscrits :\n`
  participants.forEach(p => { msg += `• ${p.profiles?.name}\n` })
  msg += `\n➡️ Voir la partie : ${getSessionUrl(session)}`
  return encodeURIComponent(msg)
}

// ── Calendar helpers ─────────────────────────────────────────
function getDurationMinutes(duration) {
  if (duration === '1h') return 60
  if (duration === '1h30') return 90
  if (duration === '2h') return 120
  return 90
}

function formatICSDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function buildGoogleCalendarUrl(session) {
  const start = new Date(`${session.date}T${session.time}`)
  const end = new Date(start.getTime() + getDurationMinutes(session.duration) * 60000)
  const title = encodeURIComponent(`Padel - ${session.location}`)
  const details = encodeURIComponent('Partie de padel PadelMates')
  const loc = encodeURIComponent(session.location)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatICSDate(start)}/${formatICSDate(end)}&details=${details}&location=${loc}`
}

function downloadICS(session) {
  const start = new Date(`${session.date}T${session.time}`)
  const end = new Date(start.getTime() + getDurationMinutes(session.duration) * 60000)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMates//FR',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:Padel - ${session.location}`,
    `DESCRIPTION:Partie de padel PadelMates`,
    `LOCATION:${session.location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `padel-${session.date}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Match Form ───────────────────────────────────────────────
function MatchForm({ sessionId, participants, onSaved }) {
  const [form, setForm] = useState({ t1p1: '', t1p2: '', t2p1: '', t2p2: '', t1score: '', t2score: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const players = participants.map(p => p.profiles)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ids = [form.t1p1, form.t1p2, form.t2p1, form.t2p2]
    if (new Set(ids).size !== 4) { setError("Chaque joueur ne peut apparaître qu'une seule fois."); return }
    if (!form.t1score || !form.t2score) { setError('Le score est requis.'); return }
    const t1 = parseInt(form.t1score), t2 = parseInt(form.t2score)
    if (t1 === t2) { setError("Pas d'égalité au padel."); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.from('matches').insert({
      session_id: sessionId,
      team1_player1: form.t1p1, team1_player2: form.t1p2,
      team2_player1: form.t2p1, team2_player2: form.t2p2,
      team1_score: t1, team2_score: t2,
      winner_team: t1 > t2 ? 1 : 2,
    })
    if (err) { setError(err.message); setLoading(false); return }
    setForm({ t1p1: '', t1p2: '', t2p1: '', t2p2: '', t1score: '', t2score: '' })
    onSaved(); setLoading(false)
  }

  const PlayerSelect = ({ name, label }) => (
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
      <select name={name} value={form[name]} onChange={handleChange} required className="input text-sm py-2">
        <option value="">-- Joueur --</option>
        {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Équipe 1</p>
          <PlayerSelect name="t1p1" label="Joueur 1" />
          <PlayerSelect name="t1p2" label="Joueur 2" />
          <input type="number" name="t1score" value={form.t1score} onChange={handleChange} required min="0" max="99" className="input text-sm py-2" placeholder="Score" />
        </div>
        <div className="bg-purple-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Équipe 2</p>
          <PlayerSelect name="t2p1" label="Joueur 3" />
          <PlayerSelect name="t2p2" label="Joueur 4" />
          <input type="number" name="t2score" value={form.t2score} onChange={handleChange} required min="0" max="99" className="input text-sm py-2" placeholder="Score" />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full text-sm">
        {loading ? 'Enregistrement...' : 'Enregistrer le match'}
      </button>
    </form>
  )
}

// ── Match Card ───────────────────────────────────────────────
function MatchCard({ match, canDelete, onDelete }) {
  const t1Won = match.winner_team === 1
  const T1 = [match.t1p1_name, match.t1p2_name].filter(Boolean).join(' & ')
  const T2 = [match.t2p1_name, match.t2p2_name].filter(Boolean).join(' & ')
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-3">
        <div className={`flex-1 text-sm font-medium ${t1Won ? 'text-blue-700' : 'text-gray-500'}`}>
          {t1Won && <span className="mr-1">🏆</span>}{T1}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-lg font-bold ${t1Won ? 'text-blue-600' : 'text-gray-400'}`}>{match.team1_score}</span>
          <span className="text-gray-300">—</span>
          <span className={`text-lg font-bold ${!t1Won ? 'text-blue-600' : 'text-gray-400'}`}>{match.team2_score}</span>
        </div>
        <div className={`flex-1 text-right text-sm font-medium ${!t1Won ? 'text-blue-700' : 'text-gray-500'}`}>
          {T2}{!t1Won && <span className="ml-1">🏆</span>}
        </div>
        {canDelete && (
          <button onClick={() => onDelete(match.id)} className="ml-2 text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Public teaser view (non-authenticated) ───────────────────
function PublicSessionTeaser({ session, participantCount }) {
  const navigate = useNavigate()
  const date = new Date(`${session.date}T${session.time}`)
  const spotsLeft = session.max_players - participantCount
  const isFull = spotsLeft <= 0
  const pct = Math.min(100, Math.round((participantCount / session.max_players) * 100))

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      {/* Session info */}
      <div className="card">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 mb-1">{session.title}</h1>
            <p className="text-gray-600 font-medium capitalize">
              📅 {format(date, 'EEEE d MMMM yyyy', { locale: fr })} à {session.time}
            </p>
            {session.duration && <p className="text-gray-500 text-sm mt-0.5">⏱ Durée : {session.duration}</p>}
            <p className="text-gray-500 text-sm">📍 {session.location}</p>
            {session.cost_per_player > 0 && (
              <p className="text-gray-500 text-sm">💰 {session.cost_per_player} CHF / joueur</p>
            )}
            {(session.level_min || session.level_max) && (
              <p className="text-gray-500 text-sm">
                🎯 Niveau : {session.level_min && LEVEL_LABEL[session.level_min]}
                {session.level_min && session.level_max && ' → '}
                {session.level_max && LEVEL_LABEL[session.level_max]}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            {isFull
              ? <span className="badge bg-orange-100 text-orange-600">Complet</span>
              : <span className="badge bg-blue-100 text-blue-700">Ouvert</span>
            }
          </div>
        </div>

        {/* Slot bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{participantCount} / {session.max_players} joueurs</span>
            {!isFull && <span className="text-green-600 font-medium">{spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}</span>}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${isFull ? 'bg-orange-400' : pct >= 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Blurred participant silhouettes */}
        {participantCount > 0 && (
          <div className="flex items-center gap-3 py-3 border-t border-gray-50 mb-4">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(participantCount, 5) }).map((_, i) => (
                <div key={i} className="w-9 h-9 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-400" fill="currentColor">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">
              <span className="font-semibold">{participantCount} joueur{participantCount > 1 ? 's' : ''}</span> déjà inscrit{participantCount > 1 ? 's' : ''}
              <span className="text-gray-400"> — connecte-toi pour voir qui</span>
            </p>
          </div>
        )}

        {/* Join CTA */}
        <button
          onClick={() => navigate(`/auth?join=${session.id}&mode=register`)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>🔒</span>
          {isFull ? 'Rejoindre la liste d\'attente' : 'Je rejoins cette partie'}
        </button>
        <button
          onClick={() => navigate(`/auth?join=${session.id}&mode=login`)}
          className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          J'ai déjà un compte → me connecter
        </button>
      </div>

      {/* Value prop */}
      <div className="card bg-blue-50 border-blue-100">
        <p className="text-sm font-semibold text-blue-900 mb-1">🎾 Qu'est-ce que PadelMates ?</p>
        <p className="text-sm text-blue-700">La plateforme de votre groupe padel — organise des parties, suis ton classement, retrouve tes amis.</p>
        <p className="text-sm text-blue-600 mt-1 font-medium">Inscription gratuite en 30 secondes.</p>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, role, isAdmin } = useAuth()
  const [linkCopied, setLinkCopied] = useState(false)

  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [leaveFromEmail, setLeaveFromEmail] = useState(false)
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [tab, setTab] = useState('info')

  useEffect(() => { fetchAll() }, [id])

  // Désinscription depuis le lien email (?action=leave)
  useEffect(() => {
    if (searchParams.get('action') === 'leave' && user && !loading) {
      setLeaveFromEmail(true)
    }
  }, [searchParams, user, loading])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchSession(), fetchParticipants(), fetchWaitlist(), fetchMatches()])
    setLoading(false)
  }

  async function fetchSession() {
    const { data } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(id, name, phone, level), is_private, private_token')
      .eq('id', id).single()
    setSession(data)
  }

  async function fetchParticipants() {
    const { data } = await supabase
      .from('session_participants')
      .select('*, profiles(id, name, phone, level, role)')
      .eq('session_id', id).order('joined_at')
    setParticipants(data || [])
  }

  async function fetchWaitlist() {
    const { data } = await supabase
      .from('session_waitlist')
      .select('*, profiles(id, name, level)')
      .eq('session_id', id).order('created_at')
    setWaitlist(data || [])
  }

  async function fetchMatches() {
    const { data: rawMatches } = await supabase.from('matches').select('*').eq('session_id', id).order('played_at')
    if (!rawMatches?.length) { setMatches([]); return }
    const playerIds = [...new Set(rawMatches.flatMap(m =>
      [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].filter(Boolean)
    ))]
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', playerIds)
    const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]))
    setMatches(rawMatches.map(m => ({
      ...m,
      t1p1_name: nameMap[m.team1_player1] || '?',
      t1p2_name: nameMap[m.team1_player2] || '?',
      t2p1_name: nameMap[m.team2_player1] || '?',
      t2p2_name: nameMap[m.team2_player2] || '?',
    })))
  }

  const isOrganizer = session?.organizer_id === user?.id
  const isParticipant = participants.some(p => p.user_id === user?.id)
  const isOnWaitlist = waitlist.some(w => w.user_id === user?.id)
  const sessionDate = session ? new Date(`${session.date}T${session.time}`) : null
  const isPastSession = sessionDate ? isPast(sessionDate) : false
  const isFull = participants.length >= (session?.max_players ?? 4)
  const canJoin = !isParticipant && !isFull && !isPastSession && session?.status === 'open'
  const canWaitlist = !isParticipant && isFull && !isOnWaitlist && !isPastSession && session?.status === 'open'

  // Cancel restrictions: admin=anytime, organizer=2h, member=24h
  const hoursUntilSession = sessionDate
    ? (sessionDate.getTime() - Date.now()) / 3600000
    : Infinity
  const cancelHoursRequired = CANCEL_HOURS[role] ?? CANCEL_HOURS.member
  const canCancelSession = (isOrganizer || isAdmin) && !isPastSession && session?.status !== 'cancelled'
  const canLeave = isParticipant && !isOrganizer && !isPastSession && session?.status !== 'cancelled'
    && (isAdmin ? true : hoursUntilSession >= cancelHoursRequired)
  const leaveBlockedReason = isParticipant && !isOrganizer && !isPastSession && session?.status !== 'cancelled'
    && !isAdmin && hoursUntilSession < cancelHoursRequired
    ? `Désinscription impossible — il reste moins de ${cancelHoursRequired}h avant la partie.`
    : null

  async function handleJoin() {
    setActionLoading(true)
    await supabase.from('session_participants').insert({ session_id: id, user_id: user.id, payment_status: 'pending' })
    await fetchParticipants()
    setActionLoading(false)
    // Email de confirmation (fire-and-forget, ne bloque pas l'UX)
    supabase.functions.invoke('send-confirmation', { body: { sessionId: id, userId: user.id } })
      .catch(() => {}) // silencieux si l'envoi échoue
  }

  async function handleLeave() {
    if (!confirm('Quitter cette partie ?')) return
    setActionLoading(true)
    await supabase.from('session_participants').delete().eq('session_id', id).eq('user_id', user.id)
    await Promise.all([fetchParticipants(), fetchWaitlist()])
    setActionLoading(false)
  }

  async function handleJoinWaitlist() {
    setActionLoading(true)
    await supabase.from('session_waitlist').insert({ session_id: id, user_id: user.id })
    await fetchWaitlist()
    setActionLoading(false)
  }

  async function handleLeaveWaitlist() {
    setActionLoading(true)
    await supabase.from('session_waitlist').delete().eq('session_id', id).eq('user_id', user.id)
    await fetchWaitlist()
    setActionLoading(false)
  }

  async function togglePayment(participantId, currentStatus) {
    const next = currentStatus === 'confirmed' ? 'pending' : currentStatus === 'paid' ? 'confirmed' : 'paid'
    await supabase.from('session_participants').update({ payment_status: next }).eq('id', participantId)
    await fetchParticipants()
  }

  async function handleCancelSession() {
    if (!confirm('Annuler cette partie ?')) return
    setActionLoading(true)
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', id)
    await fetchSession()
    setActionLoading(false)
  }

  async function handleDeleteMatch(matchId) {
    if (!confirm('Supprimer ce match ?')) return
    await supabase.from('matches').delete().eq('id', matchId)
    await fetchMatches()
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Partie introuvable.</p>
      <Link to="/sessions" className="text-blue-600 hover:underline mt-2 inline-block">← Retour</Link>
    </div>
  )

  // Non-authenticated: show public teaser
  if (!user) {
    return <PublicSessionTeaser session={session} participantCount={participants.length} />
  }

  const paymentStatusLabel = { pending: 'En attente', paid: 'Payé', confirmed: 'Confirmé' }
  const paymentStatusColor = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-blue-100 text-blue-700', confirmed: 'bg-blue-100 text-blue-800' }

  return (
    <div className="max-w-lg mx-auto space-y-5">

      {/* Banner désinscription depuis email */}
      {leaveFromEmail && isParticipant && !isOrganizer && session?.status !== 'cancelled' && !isPastSession && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="font-semibold text-orange-900 text-sm mb-1">📧 Demande de désinscription</p>
          <p className="text-orange-700 text-sm mb-3">Tu souhaites te désinscrire de cette partie ?</p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setActionLoading(true)
                await supabase.from('session_participants').delete().eq('session_id', id).eq('user_id', user.id)
                await Promise.all([fetchParticipants(), fetchWaitlist()])
                setLeaveFromEmail(false)
                setActionLoading(false)
              }}
              disabled={actionLoading}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Oui, me désinscrire
            </button>
            <button
              onClick={() => setLeaveFromEmail(false)}
              className="flex-1 bg-white border border-orange-200 text-orange-700 text-sm font-medium py-2.5 rounded-xl"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      {/* Session header */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
              {session.is_private && <span className="badge bg-purple-100 text-purple-700">🔒 Privée</span>}
              {session.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
              {session.status !== 'cancelled' && isPastSession && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
              {session.status === 'open' && !isPastSession && !isFull && <span className="badge bg-blue-100 text-blue-800">Ouverte</span>}
              {session.status === 'open' && !isPastSession && isFull && <span className="badge bg-orange-100 text-orange-600">Complet</span>}
            </div>
            <p className="text-gray-600 font-medium capitalize">
              📅 {sessionDate && format(sessionDate, 'EEEE d MMMM yyyy', { locale: fr })} à {session.time}
            </p>
            {session.duration && <p className="text-gray-500 text-sm mt-0.5">⏱ Durée : {session.duration}</p>}
            <p className="text-gray-500 text-sm mt-0.5">📍 {session.location}</p>
            <p className="text-gray-500 text-sm">👤 Organisateur : {session.organizer?.name}</p>
            {session.cost_per_player > 0 && (
              <p className="text-gray-500 text-sm">
                💰 {(session.cost_per_player * session.max_players).toFixed(2)} CHF total →{' '}
                <strong>{session.cost_per_player} CHF / joueur</strong>
              </p>
            )}
            {(session.level_min || session.level_max) && (
              <p className="text-gray-500 text-sm">
                🎯 Niveau : {session.level_min && LEVEL_LABEL[session.level_min]}
                {session.level_min && session.level_max && ' → '}
                {session.level_max && LEVEL_LABEL[session.level_max]}
              </p>
            )}
          </div>
        </div>

        {/* Actions inscription */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">
          {canJoin && (
            <button onClick={handleJoin} disabled={actionLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {actionLoading ? '…' : '✓ S\'inscrire à cette partie'}
            </button>
          )}
          {canWaitlist && (
            <button onClick={handleJoinWaitlist} disabled={actionLoading}
              className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold text-sm py-3 rounded-xl border border-orange-200 transition-colors disabled:opacity-50">
              {actionLoading ? '…' : '⏳ Rejoindre la liste d\'attente'}
            </button>
          )}
          {isOnWaitlist && (
            <button onClick={handleLeaveWaitlist} disabled={actionLoading}
              className="flex-1 bg-white hover:bg-gray-50 text-orange-600 font-medium text-sm py-2.5 rounded-xl border border-orange-200 transition-colors disabled:opacity-50">
              {actionLoading ? '…' : 'Quitter la liste d\'attente'}
            </button>
          )}
          {canLeave && (
            <button onClick={handleLeave} disabled={actionLoading}
              className="flex-1 bg-white hover:bg-red-50 text-red-500 font-medium text-sm py-2.5 rounded-xl border border-red-200 transition-colors disabled:opacity-50">
              {actionLoading ? '…' : 'Se désinscrire'}
            </button>
          )}
          {leaveBlockedReason && (
            <div className="w-full bg-orange-50 border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-xl">
              ⏱ {leaveBlockedReason}
            </div>
          )}
          {canCancelSession && (
            <button onClick={handleCancelSession} disabled={actionLoading}
              className="bg-white hover:bg-red-50 text-red-500 font-medium text-xs py-2 px-3 rounded-xl border border-red-200 transition-colors disabled:opacity-50">
              {isAdmin && !isOrganizer ? '👑 Annuler (admin)' : 'Annuler la partie'}
            </button>
          )}
        </div>

        {/* Lien privé (organisateur uniquement) */}
        {session.is_private && session.private_token && isOrganizer && (
          <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-purple-700 mb-2">🔒 Lien d'invitation privé</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-purple-200 rounded-lg px-2 py-1.5 text-purple-800 truncate font-mono">
                {getSessionUrl(session)}
              </code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(getSessionUrl(session))
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2500)
                }}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  linkCopied
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
              >
                {linkCopied ? '✓ Copié !' : 'Copier'}
              </button>
            </div>
            <p className="text-xs text-purple-500 mt-1.5">Partage ce lien uniquement avec les personnes que tu veux inviter.</p>
          </div>
        )}

        {/* Boutons WhatsApp */}
        {!isPastSession && session.status !== 'cancelled' && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {/* Partager la partie */}
            <a
              href={`https://wa.me/?text=${buildShareMessage(session, participants.length)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Partager sur WhatsApp
            </a>

            {/* Rappel (organisateur seulement) */}
            {isOrganizer && participants.length > 0 && (
              <a
                href={`https://wa.me/?text=${buildReminderMessage(session, participants)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white border border-[#25D366] text-[#25D366] hover:bg-green-50 text-sm font-semibold py-2.5 px-4 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Envoyer un rappel
              </a>
            )}
          </div>
        )}

        {/* Bouton Agenda */}
        {!isPastSession && session.status !== 'cancelled' && (
          <div className="relative mt-2">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium py-2.5 px-4 rounded-xl transition-colors"
            >
              📅 Ajouter à mon agenda
              <svg className={`w-4 h-4 transition-transform ${showCalendar ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showCalendar && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10">
                <a
                  href={buildGoogleCalendarUrl(session)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowCalendar(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xl">📅</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Google Calendar</p>
                    <p className="text-xs text-gray-400">Ouvrir dans Google Calendar</p>
                  </div>
                </a>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { downloadICS(session); setShowCalendar(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-xl">🍎</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Apple Calendar / Outlook</p>
                    <p className="text-xs text-gray-400">Télécharger le fichier .ics</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bannière liste d'attente */}
        {isOnWaitlist && (
          <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-800">
            ⏳ Tu es sur la liste d'attente. Tu seras automatiquement inscrit si une place se libère.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'info', label: `Joueurs (${participants.length}/${session.max_players})` },
          { key: 'matches', label: `Matchs (${matches.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Joueurs */}
      {tab === 'info' && (
        <div className="space-y-3">
          {participants.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">Aucun joueur inscrit</div>
          ) : (
            participants.map(p => (
              <div key={p.id} className="card">
                <div className="flex items-center gap-3">
                  <Link to={`/players/${p.user_id}`} className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-sm shrink-0 hover:opacity-80 transition-opacity">
                    {p.profiles?.name?.charAt(0).toUpperCase()}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/players/${p.user_id}`} className="font-medium text-gray-900 hover:text-blue-700 transition-colors">
                        {p.profiles?.name}
                      </Link>
                      {p.user_id === session.organizer_id && (
                        <span className="badge bg-gray-100 text-gray-500 text-xs">Organisateur</span>
                      )}
                      {p.profiles?.role === 'admin' && (
                        <span className="badge bg-purple-100 text-purple-700 text-xs border border-purple-200">👑</span>
                      )}
                      {p.profiles?.role === 'organizer' && (
                        <span className="badge bg-blue-100 text-blue-700 text-xs border border-blue-200">✓ Vérifié</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{LEVEL_LABEL[p.profiles?.level] ?? '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {session.cost_per_player > 0 && (
                      <button
                        onClick={() => isOrganizer && togglePayment(p.id, p.payment_status)}
                        disabled={!isOrganizer}
                        className={`badge ${paymentStatusColor[p.payment_status]} ${isOrganizer ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {paymentStatusLabel[p.payment_status]}
                      </button>
                    )}
                    {p.profiles?.phone && (
                      <div className="flex gap-1">
                        <a
                          href={`https://wa.me/${p.profiles.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center hover:opacity-80 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </a>
                        <a
                          href={`tel:${p.profiles.phone}`}
                          title="Appeler"
                          className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Remboursement info */}
          {session.cost_per_player > 0 && participants.length > 0 && (
            <div className="card bg-blue-50 border-blue-100">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">💳 Remboursement</h4>
              <p className="text-sm text-blue-700 mb-3">
                Chaque joueur doit <strong>{session.cost_per_player} CHF</strong> à{' '}
                <strong>{session.organizer?.name}</strong>.
              </p>
              {session.organizer?.phone && !isOrganizer && (
                <div className="flex gap-2">
                  <a
                    href={`https://wa.me/${session.organizer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour, je t'envoie ${session.cost_per_player} CHF pour la partie de padel du ${session.date}.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Payer via WhatsApp
                  </a>
                  <a
                    href={`tel:${session.organizer.phone}`}
                    className="flex items-center justify-center gap-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold py-2 px-3 rounded-xl transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                    </svg>
                    Appeler
                  </a>
                </div>
              )}
              {isOrganizer && (
                <p className="text-xs text-blue-500 mt-1">Clique sur le badge de paiement d'un joueur pour confirmer la réception.</p>
              )}
            </div>
          )}

          {/* Liste d'attente */}
          {waitlist.length > 0 && (
            <div className="card border-orange-100">
              <h4 className="text-sm font-semibold text-orange-700 mb-3">
                ⏳ Liste d'attente ({waitlist.length})
              </h4>
              <div className="space-y-2">
                {waitlist.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600">
                      {w.profiles?.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700">{w.profiles?.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{LEVEL_LABEL[w.profiles?.level] ?? '—'}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-500 mt-3">
                La première personne sera automatiquement inscrite si une place se libère.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Matchs */}
      {tab === 'matches' && (
        <div className="space-y-4">
          {(isOrganizer || isParticipant) && participants.length >= 4 && (
            <div className="card">
              <button
                onClick={() => setShowMatchForm(!showMatchForm)}
                className="flex items-center justify-between w-full"
              >
                <span className="font-semibold text-gray-900">+ Ajouter un match</span>
                <svg className={`w-5 h-5 text-gray-500 transition-transform ${showMatchForm ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showMatchForm && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <MatchForm sessionId={id} participants={participants} onSaved={() => { fetchMatches(); setShowMatchForm(false) }} />
                </div>
              )}
            </div>
          )}
          {participants.length < 4 && (isOrganizer || isParticipant) && (
            <div className="card text-center py-4 text-gray-400 text-sm">Il faut 4 joueurs inscrits pour saisir des matchs.</div>
          )}
          {matches.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🎾</div>
              <p>Aucun match enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {matches.map((m, i) => (
                <div key={m.id}>
                  <p className="text-xs text-gray-400 mb-1 ml-1">Match {i + 1}</p>
                  <MatchCard match={m} canDelete={isOrganizer || isParticipant} onDelete={handleDeleteMatch} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
