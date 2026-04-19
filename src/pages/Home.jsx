import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_SHORT, BADGES } from '../lib/constants'

function SlotBar({ current, max }) {
  const pct = Math.min(100, Math.round((current / max) * 100))
  const isFull = current >= max
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{current} / {max} joueurs</span>
        {isFull ? <span className="text-orange-500 font-medium">Complet</span> : <span className="text-green-600 font-medium">{max - current} place{max - current > 1 ? 's' : ''} dispo</span>}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-orange-400' : pct >= 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SessionCard({ session, userId }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session.session_participants?.length ?? 0
  const spotsLeft = session.max_players - participantCount
  const isFull = spotsLeft <= 0
  const isPastSession = isPast(date)
  const isRegistered = (session.session_participants || []).some(p => p.user_id === userId)

  // Special day label for today/tomorrow
  let dayLabel = format(date, 'EEE', { locale: fr })
  if (isToday(date)) dayLabel = "Auj."
  if (isTomorrow(date)) dayLabel = 'Dem.'

  return (
    <Link to={`/sessions/${session.id}`} className="card hover:shadow-md transition-shadow block">
      <div className="flex items-stretch gap-3">
        {/* Date column */}
        <div className="shrink-0 w-12 flex flex-col items-center justify-center text-center py-1">
          <span className={`text-xs font-semibold uppercase tracking-wide ${isToday(date) ? 'text-blue-600' : 'text-gray-400'}`}>
            {dayLabel}
          </span>
          <span className="text-2xl font-bold text-gray-900 leading-tight">
            {format(date, 'd')}
          </span>
          <span className="text-xs text-gray-400 capitalize">
            {format(date, 'MMM', { locale: fr })}
          </span>
          <span className="text-xs font-medium text-blue-600 mt-0.5">
            {format(date, 'HH:mm')}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-100 self-stretch shrink-0" />

        {/* Main content */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className="font-semibold text-gray-900 leading-snug">{session.title}</span>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {isRegistered && <span className="badge bg-green-100 text-green-700">✓ Inscrit</span>}
              {!isPastSession && isFull && !isRegistered && <span className="badge bg-orange-100 text-orange-600">Complet</span>}
              {!isPastSession && !isFull && !isRegistered && <span className="badge bg-blue-100 text-blue-700">Ouvert</span>}
              {isPastSession && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
            </div>
          </div>
          <p className="text-xs text-gray-400 truncate">📍 {session.location}</p>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            {session.organizer?.name && (
              <p className="text-xs text-gray-400">
                👤 {session.organizer.name}
                {session.organizer.badges?.length > 0 && (
                  <span className="ml-1" title={session.organizer.badges.map(b => BADGES[b]?.label).filter(Boolean).join(', ')}>
                    {session.organizer.badges.map(b => BADGES[b]?.emoji).filter(Boolean).join('')}
                  </span>
                )}
              </p>
            )}
            {session.cost_per_player > 0 && (
              <span className="text-xs font-semibold text-gray-600 shrink-0">{session.cost_per_player} CHF</span>
            )}
          </div>
          <SlotBar current={participantCount} max={session.max_players} />
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const { user, profile, signOut } = useAuth()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [myStats, setMyStats] = useState({ wins: 0, losses: 0, played: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const { data: sessionsWithParts } = await supabase
      .from('sessions')
      .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name, badges)')
      .gte('date', today)
      .neq('status', 'cancelled')
      .eq('is_private', false)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(5)

    setUpcomingSessions(sessionsWithParts || [])

    // Fetch my match stats (valid_matches excludes cancelled sessions)
    if (profile) {
      const { data: matches } = await supabase
        .from('valid_matches')
        .select('*')
        .or(`team1_player1.eq.${profile.id},team1_player2.eq.${profile.id},team2_player1.eq.${profile.id},team2_player2.eq.${profile.id}`)
        .not('winner_team', 'is', null)

      if (matches) {
        let wins = 0, losses = 0
        matches.forEach(m => {
          const isTeam1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
          const won = (isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2)
          if (won) wins++
          else losses++
        })
        setMyStats({ wins, losses, played: matches.length })
      }
    }

    setLoading(false)
  }

  const levelLabel = LEVEL_SHORT

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm">Bonjour 👋</p>
            <h2 className="text-2xl font-bold mt-0.5">{profile?.name ?? 'Joueur'}</h2>
            {profile?.level && (
              <span className="inline-block mt-2 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                {levelLabel[profile.level]}
              </span>
            )}
          </div>
          <div className="text-5xl">🎾</div>
        </div>
      </div>

      {/* My stats */}
      {myStats.played === 0 ? (
        <div className="card bg-blue-50 border border-blue-100 flex items-center gap-4 py-4">
          <div className="text-3xl">🎾</div>
          <div>
            <p className="font-semibold text-blue-900 text-sm">Prêt à jouer ?</p>
            <p className="text-xs text-blue-600 mt-0.5">Inscris-toi à une partie pour voir tes stats apparaître ici !</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-blue-600">{myStats.wins}</div>
            <div className="text-xs text-gray-500 mt-0.5">Victoires</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-red-500">{myStats.losses}</div>
            <div className="text-xs text-gray-500 mt-0.5">Défaites</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-gray-700">{myStats.played}</div>
            <div className="text-xs text-gray-500 mt-0.5">Matchs</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link to="/sessions/new" className="flex-1 btn-primary text-center text-sm">
          + Organiser une partie
        </Link>
        <Link to="/sessions" className="flex-1 btn-secondary text-center text-sm">
          Voir les parties
        </Link>
      </div>

      {/* Upcoming sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Prochaines parties</h3>
          <Link to="/sessions" className="text-sm text-blue-700 hover:underline">
            Tout voir →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingSessions.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-sm">Aucune partie prévue</p>
            <Link to="/sessions/new" className="text-sm text-blue-700 hover:underline mt-2 inline-block">
              Organiser la première →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingSessions.map(s => <SessionCard key={s.id} session={s} userId={user?.id} />)}
          </div>
        )}
      </div>

      {/* Sign out link (subtle) */}
      <div className="text-center pt-2 pb-4">
        <button onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
