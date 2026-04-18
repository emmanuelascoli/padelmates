import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_LABEL } from '../lib/constants'

// Silhouette "avatar" for blurred participant slots
function BlurredAvatar({ size = 'w-7 h-7' }) {
  return (
    <div className={`${size} rounded-full bg-gray-200 border-2 border-white flex items-center justify-center overflow-hidden`}>
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-400" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  )
}

function PublicSessionCard({ session, onJoin }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session._count ?? 0
  const spotsLeft = session.max_players - participantCount
  const isFull = spotsLeft <= 0
  const pct = Math.min(100, Math.round((participantCount / session.max_players) * 100))

  let dateLabel = format(date, 'EEEE d MMMM', { locale: fr })
  if (isToday(date)) dateLabel = "Aujourd'hui"
  if (isTomorrow(date)) dateLabel = 'Demain'

  // Generate the right number of "ghost" avatar slots
  const avatarSlots = Array.from({ length: Math.min(participantCount, 4) })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Top accent bar */}
      <div className={`h-1 w-full ${isFull ? 'bg-orange-400' : 'bg-gradient-to-r from-blue-400 to-indigo-500'}`} />

      <div className="p-4">
        {/* Title + lock badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{session.title}</span>
              {isFull
                ? <span className="text-xs font-semibold px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">Complet</span>
                : <span className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Ouvert</span>
              }
            </div>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateLabel} · {format(date, 'HH:mm')}</p>
            <p className="text-sm text-gray-400 truncate mt-0.5">📍 {session.location}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-gray-900 text-sm">
              {session.cost_per_player > 0 ? `${session.cost_per_player} CHF` : 'Gratuit'}
            </p>
            {(session.level_min || session.level_max) && (
              <p className="text-xs text-gray-400 mt-0.5">
                🎯 {LEVEL_LABEL[session.level_min] ?? ''}{session.level_min && session.level_max ? ' – ' : ''}{LEVEL_LABEL[session.level_max] ?? ''}
              </p>
            )}
          </div>
        </div>

        {/* Blurred participants row */}
        <div className="flex items-center gap-2 my-3">
          <div className="flex -space-x-2">
            {avatarSlots.map((_, i) => (
              <BlurredAvatar key={i} />
            ))}
            {participantCount > 4 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-500 font-medium">
                +{participantCount - 4}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400 ml-1">
            {participantCount > 0
              ? `${participantCount} joueur${participantCount > 1 ? 's' : ''} inscrit${participantCount > 1 ? 's' : ''}`
              : 'Sois le premier à rejoindre !'}
          </span>
        </div>

        {/* Slot progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{participantCount} / {session.max_players} places</span>
            {!isFull && <span className="text-green-600 font-medium">{spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}</span>}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-orange-400' : pct >= 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => onJoin(session)}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors shadow-sm"
        >
          <span>🔒</span>
          {isFull ? 'Voir la liste d\'attente' : 'Je rejoins cette partie'}
        </button>
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero */}
      <div className="max-w-lg mx-auto px-4 pt-10 pb-6 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
          <span className="text-4xl">🎾</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">PadelMates</h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-xs mx-auto">
          Rejoins votre groupe padel à Genève — organise des parties, suis ton classement, retrouve tes amis.
        </p>

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={() => navigate('/auth?mode=register')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
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
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            🔒 Connecte-toi pour rejoindre
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📅</div>
            <p className="font-semibold text-gray-700">Aucune partie prévue pour l'instant</p>
            <p className="text-sm text-gray-400 mt-1">Inscris-toi pour organiser la prochaine !</p>
            <button
              onClick={() => navigate('/auth?mode=register')}
              className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors"
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
            <div className="bg-blue-600 rounded-2xl p-5 text-center text-white mt-2">
              <p className="font-bold text-lg mb-1">Prêt à jouer ?</p>
              <p className="text-blue-100 text-sm mb-4">Crée ton compte en 30 secondes et rejoins la prochaine partie.</p>
              <button
                onClick={() => navigate('/auth?mode=register')}
                className="bg-white text-blue-700 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
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
