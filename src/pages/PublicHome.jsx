import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_LABEL } from '../lib/constants'

const IconLock = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)

function PublicSessionCard({ session, onJoin }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session._count ?? 0
  const spotsLeft = session.max_players - participantCount
  const isFull = spotsLeft <= 0
  const pct = Math.min(100, Math.round((participantCount / session.max_players) * 100))

  let dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')
  if (isToday(date))    dayLabel = 'AUJ.'
  if (isTomorrow(date)) dayLabel = 'DEM.'

  // Generate the right number of "ghost" avatar slots
  const avatarSlots = Array.from({ length: Math.min(participantCount, 4) })

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center">

        {/* ── Date block (same as Home SessionCard) ── */}
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{ width: 52, background: '#1B4332', borderRadius: 12, margin: 12, padding: '8px 0', textAlign: 'center' }}
        >
          <span style={{ color: '#6B9B7A', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>
            {dayLabel}
          </span>
          <span style={{ color: '#fff', fontSize: 24, fontWeight: 700, lineHeight: 1.15, marginTop: 2 }}>
            {format(date, 'd')}
          </span>
          <span style={{ color: '#6B9B7A', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
            {format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}
          </span>
          <span style={{ color: '#52B788', fontWeight: 700, fontSize: 12, marginTop: 6, lineHeight: 1 }}>
            {format(date, 'HH:mm')}
          </span>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 pr-4 py-3 min-w-0">

          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p
              className="font-bold text-gray-900 text-[15px] leading-snug"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {session.title}
            </p>
            {isFull && (
              <span
                className="shrink-0 inline-flex items-center"
                style={{
                  background: '#FEF2F2',
                  color: '#DC2626',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  whiteSpace: 'nowrap',
                }}
              >
                Complet
              </span>
            )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {session.location}
            </span>
          </div>

          {/* Blurred participants row */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex -space-x-2">
              {avatarSlots.map((_, i) => (
                <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center overflow-hidden">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-400" fill="currentColor">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                </div>
              ))}
              {participantCount > 4 && (
                <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-500 font-medium">
                  +{participantCount - 4}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {participantCount > 0
                ? `${participantCount} / ${session.max_players} joueurs`
                : 'Sois le premier !'}
            </span>
          </div>

          {/* Slot progress bar */}
          <div className="w-full bg-gray-100 rounded-[3px] h-[6px] mb-2.5">
            <div
              className="h-[6px] rounded-[3px] transition-all"
              style={{ width: `${pct}%`, background: isFull ? '#DC2626' : '#52B788' }}
            />
          </div>

          {/* CTA */}
          <button
            onClick={() => onJoin(session)}
            className="w-full flex items-center justify-center gap-1.5 font-semibold text-sm py-2.5 transition-colors"
            style={isFull
              ? { background: '#F7F5F1', color: '#6B7C72', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 13 }
              : { background: '#1B4332', color: '#fff', border: 'none', borderRadius: 13 }
            }
          >
            {isFull ? 'Voir liste d\'attente' : 'Rejoindre'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default function PublicHome() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublicSessions()
  }, [])

  async function fetchPublicSessions() {
    const today = new Date().toISOString().split('T')[0]

    // 1. Fetch sessions (requires "Public anon read sessions" RLS policy)
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, title, date, time, location, max_players, cost_per_player, level_min, level_max, status')
      .eq('status', 'open')
      .eq('is_private', false)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(4)

    if (sessionsError) {
      console.error('[PublicHome] sessions fetch error:', sessionsError)
      setLoading(false)
      return
    }
    if (!sessionsData?.length) {
      setLoading(false)
      return
    }

    // 2. Fetch participant counts separately (requires "Public anon read session_participants" RLS policy)
    const sessionIds = sessionsData.map(s => s.id)
    const { data: partsData } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('session_id', sessionIds)

    // Build a count map { sessionId: count }
    const countMap = {}
    ;(partsData || []).forEach(p => {
      countMap[p.session_id] = (countMap[p.session_id] ?? 0) + 1
    })

    setSessions(sessionsData.map(s => ({
      ...s,
      _count: countMap[s.id] ?? 0,
    })))
    setLoading(false)
  }

  function handleJoin(session) {
    // Redirect to auth with join context
    navigate(`/auth?join=${session.id}&mode=register`)
  }

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Hero */}
      <div className="max-w-lg mx-auto px-4 pt-10 pb-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-forest-800 to-forest-800 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
          <span className="text-4xl">🎾</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">PadelMates</h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-xs mx-auto">
          Rejoins votre groupe padel à Genève — organise des parties, suis ton classement, retrouve tes amis.
        </p>

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={() => navigate('/auth?mode=register')}
            className="px-6 py-3 bg-forest-900 hover:bg-forest-800 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
          >
            Créer mon compte
          </button>
          <button
            onClick={() => navigate('/auth?mode=login')}
            className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl border border-gray-200 transition-colors"
          >
            Se connecter
          </button>
        </div>
      </div>

      {/* Sessions teaser */}
      <div className="max-w-lg mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-lg">Prochaines parties</h2>
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              background: '#F7F5F1',
              color: '#9CA3AF',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              padding: '4px 10px',
            }}
          >
            <IconLock size={11} />
            Connecte-toi pour rejoindre
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📅</div>
            <p className="font-semibold text-gray-700">Aucune partie prévue pour l'instant</p>
            <p className="text-sm text-gray-400 mt-1">Inscris-toi pour organiser la prochaine !</p>
            <button
              onClick={() => navigate('/auth?mode=register')}
              className="mt-4 px-5 py-2.5 bg-forest-900 hover:bg-forest-800 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Rejoindre PadelMates →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(s => (
              <PublicSessionCard key={s.id} session={s} onJoin={handleJoin} />
            ))}

            {/* Bottom CTA */}
            <div className="bg-forest-900 rounded-2xl p-5 text-center text-white mt-2">
              <p className="font-bold text-lg mb-1">Prêt à jouer ?</p>
              <p className="text-[#90C9A0] text-sm mb-4">Crée ton compte en 30 secondes et rejoins la prochaine partie.</p>
              <button
                onClick={() => navigate('/auth?mode=register')}
                className="bg-white text-forest-800 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-forest-50 transition-colors"
              >
                Je m'inscris gratuitement →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
