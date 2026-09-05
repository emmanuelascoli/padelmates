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
  if (session.level_min || session.level_max) {
    const minLabel = session.level_min ? LEVEL_LABEL[session.level_min] ?? session.level_min : null
    const maxLabel = session.level_max ? LEVEL_LABEL[session.level_max] ?? session.level_max : null
    if (minLabel && maxLabel) {
      msg += `🎯 Niveau : ${minLabel} → ${maxLabel}\n`
    } else if (minLabel) {
      msg += `🎯 Niveau : ${minLabel} ou plus\n`
    } else if (maxLabel) {
      msg += `🎯 Niveau : jusqu'à ${maxLabel}\n`
    }
  }
  msg += `\n👥 ${spotsLeft} place${spotsLeft > 1 ? 's' : ''} disponible${spotsLeft > 1 ? 's' : ''}\n`
  msg += `\n➡️ Inscris-toi ici : ${url}`
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
  const title = encodeURIComponent(`🎾 Padel - ${session.location}`)
  const details = encodeURIComponent(
    `Partie de padel PadelMates\nhttps://padelmates.ch/sessions/${session.id}\n\n⏰ Pense à activer les rappels dans Google Calendar !`
  )
  const loc = encodeURIComponent(session.location)
  // &ctz pour le fuseau horaire suisse
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatICSDate(start)}/${formatICSDate(end)}&details=${details}&location=${loc}&ctz=Europe/Zurich`
}

function downloadICS(session) {
  const start = new Date(`${session.date}T${session.time}`)
  const end = new Date(start.getTime() + getDurationMinutes(session.duration) * 60000)
  const uid = `padel-${session.id}-${Date.now()}@padelmates.ch`
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PadelMates//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:🎾 Padel - ${session.location}`,
    `DESCRIPTION:Partie de padel PadelMates${session.access_code ? `\\nCode terrain : ${session.access_code} (valide 15 min avant)` : ''}\\nhttps://padelmates.ch/sessions/${session.id}`,
    `LOCATION:${session.location}`,
    // Rappel 24h avant
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel — ta partie de padel est demain !',
    'TRIGGER:-P1D',
    'END:VALARM',
    // Rappel 3h avant
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel — ta partie de padel commence dans 3h !',
    'TRIGGER:-PT3H',
    'END:VALARM',
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

  // When team 1 changes → clear team 2 so auto-fill can re-trigger
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = { ...prev, [name]: value }
      if (name === 't1p1' || name === 't1p2') {
        next.t2p1 = ''
        next.t2p2 = ''
      }
      return next
    })
  }

  // Auto-fill team 2 when both team 1 players are chosen and exactly 2 remain
  useEffect(() => {
    if (!form.t1p1 || !form.t1p2) return
    const remaining = players.filter(p => p.id !== form.t1p1 && p.id !== form.t1p2)
    if (remaining.length === 2) {
      setForm(prev => ({ ...prev, t2p1: remaining[0].id, t2p2: remaining[1].id }))
    }
  }, [form.t1p1, form.t1p2]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build <option> list: show all players, disable those already picked in other slots
  const renderOptions = (fieldName) => {
    const takenIds = ['t1p1', 't1p2', 't2p1', 't2p2']
      .filter(f => f !== fieldName)
      .map(f => form[f])
      .filter(Boolean)
    return players.map(p => (
      <option key={p.id} value={p.id} disabled={takenIds.includes(p.id)}>
        {p.name}
      </option>
    ))
  }

  // True when team 2 was auto-filled (exactly 2 participants remain after team 1)
  const isAutoFilled = !!(form.t1p1 && form.t1p2 && form.t2p1 && form.t2p2 &&
    players.filter(p => p.id !== form.t1p1 && p.id !== form.t1p2).length === 2)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
      <div className="grid grid-cols-2 gap-3">

        {/* ── Équipe 1 ── */}
        <div className="bg-forest-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-forest-800 uppercase tracking-wide">Équipe 1</p>

          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Joueur 1</label>
            <select name="t1p1" value={form.t1p1} onChange={handleChange} required className="input text-sm py-2">
              <option value="">-- Joueur --</option>
              {renderOptions('t1p1')}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Joueur 2</label>
            <select name="t1p2" value={form.t1p2} onChange={handleChange} required className="input text-sm py-2">
              <option value="">-- Joueur --</option>
              {renderOptions('t1p2')}
            </select>
          </div>

          <input
            type="number"
            inputMode="numeric"
            name="t1score"
            value={form.t1score}
            onChange={handleChange}
            required min="0" max="99"
            className="input text-sm py-2"
            placeholder="Score"
          />
        </div>

        {/* ── Équipe 2 ── */}
        <div className="bg-purple-50 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
            Équipe 2{isAutoFilled && (
              <span style={{ fontSize: 9, fontWeight: 400, color: '#9CA3AF', textTransform: 'none', letterSpacing: 0 }}> · auto</span>
            )}
          </p>

          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Joueur 3</label>
            <select name="t2p1" value={form.t2p1} onChange={handleChange} required className="input text-sm py-2">
              <option value="">-- Joueur --</option>
              {renderOptions('t2p1')}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-0.5 block">Joueur 4</label>
            <select name="t2p2" value={form.t2p2} onChange={handleChange} required className="input text-sm py-2">
              <option value="">-- Joueur --</option>
              {renderOptions('t2p2')}
            </select>
          </div>

          <input
            type="number"
            inputMode="numeric"
            name="t2score"
            value={form.t2score}
            onChange={handleChange}
            required min="0" max="99"
            className="input text-sm py-2"
            placeholder="Score"
          />
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
        <div className={`flex-1 text-sm font-medium ${t1Won ? 'text-forest-800' : 'text-gray-500'}`}>
          {t1Won && <span className="mr-1">🏆</span>}{T1}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-lg font-bold ${t1Won ? 'text-forest-700' : 'text-gray-400'}`}>{match.team1_score}</span>
          <span className="text-gray-300">—</span>
          <span className={`text-lg font-bold ${!t1Won ? 'text-forest-700' : 'text-gray-400'}`}>{match.team2_score}</span>
        </div>
        <div className={`flex-1 text-right text-sm font-medium ${!t1Won ? 'text-forest-800' : 'text-gray-500'}`}>
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
              ? <span className="badge bg-red-100 text-red-600">Complet</span>
              : <span className="badge bg-forest-100 text-forest-800">Ouvert</span>
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
          className="w-full bg-forest-900 hover:bg-forest-800 text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
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
      <div className="card bg-forest-50 border-forest-100">
        <p className="text-sm font-semibold text-forest-900 mb-1">🎾 Qu'est-ce que PadelMates ?</p>
        <p className="text-sm text-forest-800">La plateforme de votre groupe padel — organise des parties, suis ton classement, retrouve tes amis.</p>
        <p className="text-sm text-forest-700 mt-1 font-medium">Inscription gratuite en 30 secondes.</p>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, role, isAdmin, profile } = useAuth()
  const [linkCopied, setLinkCopied] = useState(false)

  const [session, setSession] = useState(null)
  const [participants, setParticipants] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [leaveFromEmail, setLeaveFromEmail] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showMatchForm, setShowMatchForm] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [tab, setTab] = useState('info')
  const [removingPlayerId, setRemovingPlayerId] = useState(null)
  const [showOrganizerLeaveConfirm, setShowOrganizerLeaveConfirm] = useState(false)

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
      .select('*, organizer:profiles!sessions_organizer_id_fkey(id, name, phone, revolut_tag, level), is_private, private_token')
      .eq('id', id).single()
    setSession(data)
  }

  async function fetchParticipants() {
    const { data } = await supabase
      .from('session_participants')
      .select('*, profiles(id, name, phone, level, role, avatar_url)')
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
  // Vérification du niveau requis par la partie
  const playerLevel    = profile?.level ? parseInt(profile.level, 10) : null
  const sessionLevelMin = session?.level_min ? parseInt(session.level_min, 10) : null
  const sessionLevelMax = session?.level_max ? parseInt(session.level_max, 10) : null
  const levelTooLow  = playerLevel !== null && sessionLevelMin !== null && playerLevel < sessionLevelMin
  const levelTooHigh = playerLevel !== null && sessionLevelMax !== null && playerLevel > sessionLevelMax
  const levelBlocked = levelTooLow || levelTooHigh

  const canJoin     = !isParticipant && !isFull  && !isPastSession && session?.status === 'open' && !levelBlocked
  const canWaitlist = !isParticipant && isFull && !isOnWaitlist && !isPastSession && session?.status === 'open' && !levelBlocked

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

  const canOrganizerLeave = isOrganizer && isParticipant && !isPastSession && session?.status !== 'cancelled'

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
    setActionLoading(true)
    setShowLeaveConfirm(false)

    // Snapshot des IDs actuels avant désinscription
    const prevIds = new Set(participants.map(p => p.user_id))

    await supabase.from('session_participants').delete().eq('session_id', id).eq('user_id', user.id)

    // Vérifier si quelqu'un a été promu depuis la liste d'attente
    // (le trigger DB insère avec promoted_from_waitlist = true)
    const { data: newParts } = await supabase
      .from('session_participants')
      .select('user_id, promoted_from_waitlist')
      .eq('session_id', id)
      .eq('promoted_from_waitlist', true)

    const promoted = (newParts || []).find(p => !prevIds.has(p.user_id))
    if (promoted) {
      // Email "place libérée" au joueur promu (fire-and-forget)
      supabase.functions.invoke('send-confirmation', {
        body: { sessionId: id, userId: promoted.user_id, promoted: true }
      }).catch(() => {})
    }

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

  // Organizer confirms a player's payment (or cycles back)
  async function togglePayment(participantId, currentStatus) {
    const now = new Date().toISOString()
    const next = currentStatus === 'confirmed' ? 'pending' : currentStatus === 'paid' ? 'confirmed' : 'paid'
    const extra = next === 'confirmed' ? { payment_confirmed_at: now } : next === 'paid' ? { payment_declared_at: now } : {}
    await supabase.from('session_participants').update({ payment_status: next, ...extra }).eq('id', participantId)
    await fetchParticipants()
  }

  // Participant declares they have paid
  async function handleDeclarePayment() {
    const me = participants.find(p => p.user_id === user?.id)
    if (!me) return
    setActionLoading(true)
    await supabase.from('session_participants').update({
      payment_status: 'paid',
      payment_declared_at: new Date().toISOString(),
    }).eq('id', me.id)
    await fetchParticipants()
    setActionLoading(false)
  }

  // Participant cancels their payment declaration (back to pending)
  async function handleUndeclarePayment() {
    const me = participants.find(p => p.user_id === user?.id)
    if (!me) return
    setActionLoading(true)
    await supabase.from('session_participants').update({
      payment_status: 'pending',
      payment_declared_at: null,
    }).eq('id', me.id)
    await fetchParticipants()
    setActionLoading(false)
  }

  async function handleCancelSession() {
    setActionLoading(true)
    setShowCancelConfirm(false)
    const { error } = await supabase.rpc('delete_session', { p_session_id: id })
    if (error) {
      console.error('Cancel session error:', error.message)
      alert(`Erreur : ${error.message}`)
      setActionLoading(false)
      return
    }
    navigate('/sessions', { replace: true })
  }

  async function handleDeleteMatch(matchId) {
    await supabase.from('matches').delete().eq('id', matchId)
    await fetchMatches()
  }

  async function handleOrganizerLeave() {
    setActionLoading(true)
    setShowOrganizerLeaveConfirm(false)
    await supabase.from('session_participants').delete().eq('session_id', id).eq('user_id', user.id)
    await Promise.all([fetchParticipants(), fetchWaitlist()])
    setActionLoading(false)
  }

  async function handleRemovePlayer(participantUserId) {
    setActionLoading(true)
    await supabase.from('session_participants')
      .delete()
      .eq('session_id', id)
      .eq('user_id', participantUserId)
    setRemovingPlayerId(null)
    await Promise.all([fetchParticipants(), fetchWaitlist()])
    setActionLoading(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-forest-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!session) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Partie introuvable.</p>
      <Link to="/sessions" className="text-forest-700 hover:underline mt-2 inline-block">← Retour</Link>
    </div>
  )

  // Non-authenticated: show public teaser
  if (!user) {
    return <PublicSessionTeaser session={session} participantCount={participants.length} />
  }

  const myParticipant = participants.find(p => p.user_id === user?.id)

  const CheckIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )

  const paymentStatusLabel = {
    pending:   '⏳ En attente',
    paid:      '💸 Déclaré',
    confirmed: (
      <span className="inline-flex items-center gap-1">
        <CheckIcon /> Confirmé
      </span>
    ),
  }
  const paymentStatusColor = {
    pending:   'bg-yellow-50 text-yellow-700 border border-yellow-200',
    paid:      'bg-orange-50 text-orange-700 border border-orange-200',
    confirmed: '',  // overridden inline below
  }
  const paymentConfirmedStyle = { background: '#E8F5EE', color: '#2D6A4F', border: '1px solid rgba(82,183,136,0.3)' }

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
        {/* Title + status badges */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
              {session.is_private && <span className="badge bg-purple-100 text-purple-700">Privée</span>}
              {session.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
              {session.status !== 'cancelled' && isPastSession && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
              {session.status === 'open' && !isPastSession && !isFull && <span className="badge bg-forest-100 text-forest-900">Ouverte</span>}
              {session.status === 'open' && !isPastSession && isFull && <span className="badge bg-red-100 text-red-600">Complet</span>}
            </div>
          </div>
        </div>

        {/* Slot bar */}
        {(() => {
          const pct = Math.min(100, Math.round((participants.length / (session.max_players ?? 4)) * 100))
          const spotsLeft = (session.max_players ?? 4) - participants.length
          return (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-medium text-gray-700">{participants.length} / {session.max_players} joueurs</span>
                {!isFull && <span className="text-xs font-medium text-green-600">{spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}</span>}
                {isFull && <span className="text-xs font-medium text-red-500">Complet</span>}
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: '#E9EAE7' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: isFull
                      ? 'linear-gradient(90deg,#f87171,#ef4444)'
                      : 'linear-gradient(90deg,#86efac,#16a34a)',
                  }}
                />
              </div>
            </div>
          )
        })()}

        {/* Info rows */}
        {sessionDate && (() => {
          const timeFormatted = sessionDate.getMinutes() === 0
            ? `${sessionDate.getHours()}h`
            : `${sessionDate.getHours()}h${String(sessionDate.getMinutes()).padStart(2, '0')}`
          const rows = [
            {
              value: `${format(sessionDate, 'EEEE d MMMM yyyy', { locale: fr })} · ${timeFormatted}`,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C72" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              ),
            },
            ...(session.duration ? [{
              value: session.duration,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C72" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              ),
            }] : []),
            {
              value: session.location,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C72" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              ),
            },
            {
              value: session.organizer?.name ?? '—',
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C72" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              ),
            },
            ...(session.cost_per_player > 0 ? [{
              value: `${session.cost_per_player} CHF / joueur — ${(session.cost_per_player * session.max_players).toFixed(2)} CHF total`,
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C72" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              ),
            }] : []),
            ...((session.level_min || session.level_max) ? [{
              value: [session.level_min && LEVEL_LABEL[session.level_min], session.level_max && LEVEL_LABEL[session.level_max]].filter(Boolean).join(' → '),
              icon: (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7C72" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              ),
            }] : []),
          ]
          return (
            <div className="space-y-0 mb-4">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 py-2"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}
                >
                  <span className="shrink-0 flex items-center">{row.icon}</span>
                  <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.4 }} className="capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Actions inscription */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 flex-wrap">

          {/* Blocage niveau */}
          {levelBlocked && !isParticipant && !isPastSession && session?.status === 'open' && (
            <div className="w-full" style={{
              background: '#FFFBEB',
              border: '1.5px solid rgba(217,119,6,0.3)',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}>
              {/* Icône cible */}
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#FEF3C7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, color: '#92400E', fontSize: 13, marginBottom: 3 }}>
                  Niveau requis non atteint
                </p>
                <p style={{ color: '#B45309', fontSize: 12, lineHeight: 1.55 }}>
                  {levelTooLow
                    ? <>Cette partie est réservée aux joueurs de niveau <strong>{LEVEL_LABEL[session.level_min]}</strong> minimum.</>
                    : <>Cette partie est réservée aux joueurs jusqu'au niveau <strong>{LEVEL_LABEL[session.level_max]}</strong>.</>
                  }
                  {profile?.level && (
                    <> Ton niveau actuel est <strong>{LEVEL_LABEL[profile.level] ?? profile.level}</strong>.</>
                  )}
                </p>
              </div>
            </div>
          )}

          {canJoin && (
            <button onClick={handleJoin} disabled={actionLoading}
              className="flex-1 bg-forest-900 hover:bg-forest-800 text-white font-semibold text-sm py-3 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
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
          {canLeave && !showLeaveConfirm && (
            <button onClick={() => setShowLeaveConfirm(true)} disabled={actionLoading}
              className="flex-1 bg-white hover:bg-red-50 text-red-500 font-medium text-sm py-2.5 rounded-xl border border-red-200 transition-colors disabled:opacity-50">
              Se désinscrire
            </button>
          )}
          {canLeave && showLeaveConfirm && (
            <div className="w-full bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-red-800">Confirmer la désinscription ?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleLeave}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading ? '…' : 'Oui, me désinscrire'}
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 bg-white border border-red-200 text-red-600 text-sm font-medium py-2 rounded-xl"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
          {leaveBlockedReason && (
            <div className="w-full bg-orange-50 border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-xl">
              ⏱ {leaveBlockedReason}
            </div>
          )}
          {canOrganizerLeave && !showOrganizerLeaveConfirm && (
            <button
              onClick={() => setShowOrganizerLeaveConfirm(true)}
              disabled={actionLoading}
              className="flex-1 bg-white hover:bg-orange-50 text-orange-600 font-medium text-sm py-2.5 rounded-xl border border-orange-200 transition-colors disabled:opacity-50"
            >
              Me retirer de la partie
            </button>
          )}
          {canOrganizerLeave && showOrganizerLeaveConfirm && (
            <div className="w-full bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-orange-800">Te retirer en tant que joueur ?</p>
              <p className="text-xs text-orange-600">Tu restes organisateur. Les joueurs te rembourseront toujours.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleOrganizerLeave}
                  disabled={actionLoading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading ? '…' : 'Oui, me retirer'}
                </button>
                <button
                  onClick={() => setShowOrganizerLeaveConfirm(false)}
                  className="flex-1 bg-white border border-orange-200 text-orange-700 text-sm font-medium py-2 rounded-xl"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
          {canCancelSession && !showCancelConfirm && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={actionLoading}
              className="transition-colors disabled:opacity-50"
              style={{
                background: '#F7F5F1',
                color: '#6B7C72',
                border: '1.5px solid rgba(0,0,0,0.08)',
                borderRadius: 13,
                fontWeight: 600,
                fontSize: 12,
                padding: '8px 12px',
              }}
            >
              {isAdmin && !isOrganizer ? 'Annuler (admin)' : 'Annuler la partie'}
            </button>
          )}
          {canCancelSession && showCancelConfirm && (
            <div className="w-full bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-red-800">Annuler définitivement cette partie ?</p>
              <p className="text-xs text-red-600">Tous les joueurs inscrits seront notifiés.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelSession}
                  disabled={actionLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading ? '…' : 'Oui, annuler la partie'}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 bg-white border border-red-200 text-red-600 text-sm font-medium py-2 rounded-xl"
                >
                  Garder
                </button>
              </div>
            </div>
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

        {/* Code d'accès terrain — visible pour les inscrits uniquement */}
        {isParticipant && session.access_code && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0' }}>
            <span className="shrink-0 flex items-center" style={{ marginTop: 2 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14532d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </span>
            <div>
              <span style={{ fontSize: 11, color: '#166534', fontWeight: 600, display: 'block', marginBottom: 1 }}>Code d'accès terrain</span>
              <span style={{ fontSize: 26, fontWeight: 700, color: '#14532d', fontFamily: 'monospace', letterSpacing: '0.12em', lineHeight: 1.2, display: 'block' }}>
                {session.access_code}
              </span>
              <span style={{ fontSize: 11, color: '#166534', display: 'block', marginTop: 2 }}>Valide 15 min avant le début de ta réservation</span>
            </div>
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
              className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 px-4 transition-colors"
              style={{
                background: '#ffffff',
                color: '#128C7E',
                border: '1.5px solid rgba(18,140,126,0.25)',
                borderRadius: 13,
                fontWeight: 700,
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Partager sur WhatsApp
            </a>

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
                    <p className="text-xs text-gray-400">S'ouvre dans ton calendrier principal</p>
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
                    <p className="text-xs text-gray-400">Avec rappels 24h et 3h avant ⏰</p>
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
              tab === key ? 'bg-white text-forest-900 shadow-sm' : 'text-gray-500'
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
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                <span className="text-sm font-medium text-gray-700">{participants.length} inscrit{participants.length > 1 ? 's' : ''}</span>
                <span className="text-xs text-gray-400">{session.max_players - participants.length > 0 ? `${session.max_players - participants.length} place${session.max_players - participants.length > 1 ? 's' : ''} libre${session.max_players - participants.length > 1 ? 's' : ''}` : 'Complet'}</span>
              </div>

              {/* Player rows */}
              {participants.map((p, idx) => {
                const isOrganizerRow = p.user_id === session.organizer_id
                const canBeRemoved = isAdmin && !isOrganizerRow && !isPastSession && session?.status !== 'cancelled'
                const confirmingRemove = removingPlayerId === p.user_id

                return (
                  <div key={p.id}>
                    {confirmingRemove && (
                      <div className="mx-3 my-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
                        <p className="text-sm text-red-800 font-medium">Retirer <strong>{p.profiles?.name}</strong> ?</p>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleRemovePlayer(p.user_id)}
                            disabled={actionLoading}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading ? '…' : 'Retirer'}
                          </button>
                          <button
                            onClick={() => setRemovingPlayerId(null)}
                            className="text-xs bg-white border border-gray-300 text-gray-600 font-medium px-3 py-1.5 rounded-lg"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      className="flex items-center gap-3 px-4"
                      style={{
                        paddingTop: 10,
                        paddingBottom: 10,
                        borderBottom: idx < participants.length - 1 ? '0.5px solid #F3F4F6' : 'none',
                      }}
                    >
                      {/* Avatar */}
                      <Link to={`/players/${p.user_id}`} className="shrink-0 hover:opacity-80 transition-opacity">
                        {p.profiles?.avatar_url ? (
                          <img src={p.profiles.avatar_url} alt={p.profiles.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 bg-forest-100 rounded-full flex items-center justify-center font-bold text-forest-800 text-sm">
                            {p.profiles?.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Link>

                      {/* Name + level */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link to={`/players/${p.user_id}`} className="text-sm font-medium text-gray-900 hover:text-forest-800 transition-colors">
                            {p.profiles?.name}
                          </Link>
                          {isOrganizerRow && (
                            <span style={{ fontSize: 10, fontWeight: 500, background: '#F3F4F6', color: '#6B7280', borderRadius: 4, padding: '1px 5px' }}>
                              Orga
                            </span>
                          )}
                          {p.profiles?.role === 'admin' && (
                            <span style={{ fontSize: 10, fontWeight: 500, background: '#EDE9FE', color: '#5B21B6', borderRadius: 4, padding: '1px 5px' }}>
                              👑
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{LEVEL_LABEL[p.profiles?.level] ?? '—'}</div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Payment pill (clickable for organizer) */}
                        {session.cost_per_player > 0 && (() => {
                          const pillStyle = {
                            pending:   { background: '#F3F4F6', color: '#9CA3AF' },
                            paid:      { background: '#FEF3C7', color: '#92400E' },
                            confirmed: { background: '#D1FAE5', color: '#065F46' },
                          }[p.payment_status] ?? { background: '#F3F4F6', color: '#9CA3AF' }
                          const pillLabel = {
                            pending:   'En attente',
                            paid:      'Déclaré',
                            confirmed: '✓ Réglé',
                          }[p.payment_status] ?? '—'
                          return (
                            <button
                              onClick={() => isOrganizer ? togglePayment(p.id, p.payment_status) : undefined}
                              title={isOrganizer ? 'Changer le statut de paiement' : undefined}
                              style={{
                                ...pillStyle,
                                fontSize: 11, fontWeight: 500,
                                borderRadius: 6, padding: '3px 8px',
                                border: 'none', whiteSpace: 'nowrap', flexShrink: 0,
                                cursor: isOrganizer ? 'pointer' : 'default',
                              }}
                            >
                              {pillLabel}
                            </button>
                          )
                        })()}

                        {/* WhatsApp */}
                        {p.profiles?.phone && (
                          <a
                            href={`https://wa.me/${p.profiles.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            style={{
                              width: 30, height: 30, borderRadius: 8,
                              background: '#F0FDF4',
                              border: '0.5px solid #BBF7D0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            className="hover:opacity-80 transition-opacity"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#16A34A">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}

                        {/* Remove (admin only) */}
                        {canBeRemoved && (
                          <button
                            onClick={() => setRemovingPlayerId(confirmingRemove ? null : p.user_id)}
                            title="Retirer ce joueur"
                            style={{
                              width: 26, height: 26, borderRadius: 7,
                              background: '#FEF2F2',
                              border: '0.5px solid #FECACA',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            className="hover:bg-red-100 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Organizer payment hint + summary */}
              {isOrganizer && session.cost_per_player > 0 && participants.filter(p => p.user_id !== session.organizer_id).length > 0 && (
                <div style={{ borderTop: '0.5px solid #F3F4F6', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <p style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.4, flex: 1 }}>
                    💡 Appuie sur le statut d'un joueur pour confirmer la réception du paiement.
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {participants.filter(p => p.payment_status === 'confirmed').length}/{participants.filter(p => p.user_id !== session.organizer_id).length} réglés · {(participants.filter(p => p.user_id !== session.organizer_id).length * session.cost_per_player).toFixed(0)} CHF
                  </span>
                </div>
              )}

            </div>
          )}

          {/* ── PAYMENT SECTION ───────────────────────────────── */}
          {session.cost_per_player > 0 && (

            /* ── Participant : Régler ma part ── */
            isParticipant && !isOrganizer ? (
              <div className="card border-forest-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-forest-900">💳 Ta part</h4>
                  <span className="text-lg font-bold text-forest-800">{session.cost_per_player} CHF</span>
                </div>

                {/* Status : Confirmé */}
                {myParticipant?.payment_status === 'confirmed' && (
                  <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-green-800">Paiement confirmé !</p>
                      <p className="text-xs text-green-600">{session.organizer?.name} a bien reçu ta part.</p>
                    </div>
                  </div>
                )}

                {/* Status : Déclaré — en attente de confirmation */}
                {myParticipant?.payment_status === 'paid' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                      <span className="text-2xl">⏳</span>
                      <div>
                        <p className="text-sm font-semibold text-orange-800">En attente de confirmation</p>
                        <p className="text-xs text-orange-600">{session.organizer?.name} doit valider la réception.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleUndeclarePayment}
                      disabled={actionLoading}
                      className="w-full text-xs text-gray-400 hover:text-gray-600 underline text-center py-1 transition-colors"
                    >
                      Annuler — je n'ai pas encore payé
                    </button>
                  </div>
                )}

                {/* Status : En attente — afficher les boutons de paiement */}
                {myParticipant?.payment_status === 'pending' && (() => {
                  // Deadline = 48h avant la partie
                  const paymentDeadline = sessionDate
                    ? new Date(sessionDate.getTime() - 48 * 3600000)
                    : null
                  const isDeadlinePast = paymentDeadline ? new Date() > paymentDeadline : false
                  const deadlineStr = paymentDeadline
                    ? format(paymentDeadline, "EEEE d MMMM 'à' HH'h'mm", { locale: fr })
                    : null

                  return (
                  <div className="space-y-3">

                    {/* Bannière deadline */}
                    {deadlineStr && !isPastSession && (
                      isDeadlinePast ? (
                        <div style={{
                          background: '#FEF2F2',
                          border: '1.5px solid #FECACA',
                          borderRadius: 14,
                          padding: '11px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                        }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', marginBottom: 2 }}>Délai de paiement dépassé</p>
                            <p style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.4 }}>Ta place n'est plus garantie. Paye maintenant pour la conserver.</p>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: '#FFF7ED',
                          border: '1.5px solid #FED7AA',
                          borderRadius: 14,
                          padding: '11px 14px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 11, color: '#9A3412', marginBottom: 2 }}>Paiement requis avant le</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#EA580C', textTransform: 'capitalize', marginBottom: 2 }}>{deadlineStr}</p>
                            <p style={{ fontSize: 10, color: '#C2410C', lineHeight: 1.4 }}>Place non garantie passé ce délai</p>
                          </div>
                          <span style={{
                            background: '#F97316', color: '#fff',
                            fontSize: 10, fontWeight: 700,
                            padding: '3px 8px', borderRadius: 20,
                            whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2,
                          }}>
                            {Math.ceil((paymentDeadline.getTime() - new Date().getTime()) / 3600000 / 24) > 0
                              ? `J-${Math.ceil((paymentDeadline.getTime() - new Date().getTime()) / 3600000 / 24)}`
                              : 'Aujourd\'hui'}
                          </span>
                        </div>
                      )
                    )}

                    <p className="text-sm text-gray-600">
                      Rembourse <strong>{session.organizer?.name}</strong> via :
                    </p>

                    {/* Bouton de paiement Revolut — auto-déclare au clic */}
                    {session.organizer?.revolut_tag ? (
                      <a
                        href={`https://revolut.me/${session.organizer.revolut_tag.replace(/^@/, '')}?amount=${Math.round(session.cost_per_player * 100)}&currency=CHF`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleDeclarePayment}
                        className="flex items-center justify-center gap-2 w-full text-white text-sm font-semibold py-3.5 px-4 rounded-xl transition-colors shadow-sm"
                        style={{ background: isDeadlinePast ? '#DC2626' : '#191C1F' }}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21.507 8.442c-.07-4.715-3.85-8.44-8.507-8.44H3v24l4-4V4h5.674c2.52 0 4.593 1.912 4.826 4.37a4.76 4.76 0 0 1-4.75 5.13H9.5V17h3.5l4 4h4l-4-4.322A8.454 8.454 0 0 0 21.507 8.442z"/>
                        </svg>
                        Payer {session.cost_per_player} CHF via Revolut
                      </a>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
                        L'organisateur n'a pas encore configuré Revolut. Contacte-le directement.
                      </div>
                    )}

                    {/* Fallback : aucun moyen de paiement configuré */}
                    {!session.organizer?.revolut_tag && !session.organizer?.phone && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500">
                        L'organisateur n'a pas encore configuré ses moyens de paiement. Contacte-le directement.
                      </div>
                    )}

                    {/* Séparateur */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-xs text-gray-400">une fois le paiement effectué</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Bouton "J'ai payé" */}
                    <button
                      onClick={handleDeclarePayment}
                      disabled={actionLoading}
                      className="w-full bg-forest-50 hover:bg-forest-100 border border-forest-200 text-forest-800 text-sm font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? '…' : '✓ J\'ai payé — en attente de confirmation'}
                    </button>
                  </div>
                  )
                })()}
              </div>

            ) : null
          )}

          {/* Liste d'attente */}
          {waitlist.length > 0 && (
            <div className="card border-orange-100">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-orange-700">⏳ Liste d'attente ({waitlist.length})</h4>
              </div>
              <p className="text-xs text-orange-500 mb-3">
                Ajout automatique si une place se libère
              </p>
              <div className="space-y-0">
                {waitlist.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: i < waitlist.length - 1 ? '0.5px solid #FEF3C7' : 'none' }}>
                    <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                      {w.profiles?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-700 font-medium">{w.profiles?.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{LEVEL_LABEL[w.profiles?.level] ?? '—'}</span>
                    </div>
                    {isOrganizer && w.profiles?.phone && (
                      <a
                        href={`https://wa.me/${w.profiles.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center hover:opacity-80 transition-opacity shrink-0"
                      >
                        <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
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
