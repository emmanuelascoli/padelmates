import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_SHORT } from '../lib/constants'

function SessionCard({ session }) {
  const date = new Date(`${session.date}T${session.time}`)
  const spotsLeft = session.max_players - (session.session_participants?.length ?? 0)
  const isFull = spotsLeft <= 0
  const isPastSession = isPast(date)

  let dateLabel = format(date, 'EEEE d MMMM', { locale: fr })
  if (isToday(date)) dateLabel = "Aujourd'hui"
  if (isTomorrow(date)) dateLabel = 'Demain'

  return (
    <Link to={`/sessions/${session.id}`} className="card hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 truncate">{session.title}</span>
            {isPastSession && (
              <span className="badge bg-gray-100 text-gray-500">Terminée</span>
            )}
            {!isPastSession && isFull && (
              <span className="badge bg-orange-100 text-orange-600">Complet</span>
            )}
            {!isPastSession && !isFull && (
              <span className="badge bg-green-100 text-green-700">Ouvert</span>
            )}
          </div>
          <p className="text-sm text-gray-500 capitalize">{dateLabel} à {format(date, 'HH:mm')}</p>
          <p className="text-sm text-gray-500 truncate">📍 {session.location}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold text-gray-900">
            {session.cost_per_player > 0 ? `${session.cost_per_player} CHF` : 'Gratuit'}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {session.session_participants?.length ?? 0} / {session.max_players} joueurs
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const { profile, signOut } = useAuth()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [myStats, setMyStats] = useState({ wins: 0, losses: 0, played: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    // Fetch upcoming sessions (next 14 days)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*, session_participants(count)')
      .gte('date', today)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(5)

    // Fetch participant counts properly
    const { data: sessionsWithParts } = await supabase
      .from('sessions')
      .select('*, session_participants(id)')
      .gte('date', today)
      .neq('status', 'cancelled')
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(5)

    setUpcomingSessions(sessionsWithParts || [])

    // Fetch my match stats
    if (profile) {
      const { data: matches } = await supabase
        .from('matches')
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
            {upcomingSessions.map(s => <SessionCard key={s.id} session={s} />)}
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
