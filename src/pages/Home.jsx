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
    <div className="mt-2.5">
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-orange-400' : 'bg-forest-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{current} / {max} joueurs</span>
        {isFull
          ? <span className="text-orange-500 font-medium">Complet</span>
          : <span className="text-forest-600 font-medium">{max - current} place{max - current > 1 ? 's' : ''} dispo</span>
        }
      </div>
    </div>
  )
}

function SessionCard({ session, userId }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session.session_participants?.length ?? 0
  const isFull = participantCount >= session.max_players
  const isPastSession = isPast(date)
  const isRegistered = (session.session_participants || []).some(p => p.user_id === userId)

  let dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase()
  if (isToday(date)) dayLabel = 'AUJ.'
  if (isTomorrow(date)) dayLabel = 'DEM.'

  return (
    <Link to={`/sessions/${session.id}`} className="card hover:shadow-md transition-shadow block p-4">
      <div className="flex items-stretch gap-3.5">
        {/* Date column */}
        <div className="shrink-0 w-[58px] bg-forest-900 rounded-xl flex flex-col items-center justify-center py-2 text-center">
          <span className="text-forest-300 text-[10px] font-semibold uppercase tracking-widest leading-none">
            {dayLabel}
          </span>
          <span className="text-white text-2xl font-bold leading-tight mt-0.5">
            {format(date, 'd')}
          </span>
          <span className="text-forest-300 text-[10px] uppercase tracking-wide leading-none">
            {format(date, 'MMM', { locale: fr })}
          </span>
          <span className="text-forest-400 text-xs font-semibold mt-1 leading-none">
            {format(date, 'HH:mm')}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-gray-900 leading-snug">{session.title}</span>
            <div className="shrink-0">
              {isRegistered && <span className="badge bg-forest-100 text-forest-800">✓ Inscrit</span>}
              {!isPastSession && isFull && !isRegistered && <span className="badge bg-orange-100 text-orange-600">Complet</span>}
              {!isPastSession && !isFull && !isRegistered && <span className="badge bg-forest-50 text-forest-700 border border-forest-200">Ouvert</span>}
              {isPastSession && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.location}
          </p>
          <SlotBar current={participantCount} max={session.max_players} />
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const { user, profile, signOut } = useAuth()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [myStats, setMyStats] = useState({ wins: 0, losses: 0, played: 0, friends: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const { data: sessions } = await supabase
      .from('sessions')
      .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name, badges)')
      .gte('date', today)
      .neq('status', 'cancelled')
      .eq('is_private', false)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(5)

    setUpcomingSessions(sessions || [])

    if (profile) {
      // Match stats
      const { data: matches } = await supabase
        .from('valid_matches')
        .select('*')
        .or(`team1_player1.eq.${profile.id},team1_player2.eq.${profile.id},team2_player1.eq.${profile.id},team2_player2.eq.${profile.id}`)
        .not('winner_team', 'is', null)

      let wins = 0, losses = 0
      if (matches) {
        matches.forEach(m => {
          const isTeam1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
          const won = (isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2)
          if (won) wins++; else losses++
        })
      }

      // Friends count
      const { count: friends } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      setMyStats({ wins, losses, played: matches?.length ?? 0, friends: friends ?? 0 })
    }

    setLoading(false)
  }

  const levelLabel = LEVEL_SHORT

  return (
    <div>
      {/* ── Hero banner ─────────────────────────────────── */}
      <div className="bg-forest-900 px-5 pt-7 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-forest-300 text-sm font-medium">Bonjour,</p>
            <h2 className="text-white text-3xl font-bold tracking-tight mt-0.5">
              {profile?.name?.split(' ')[0] ?? 'Joueur'}
            </h2>
            {profile?.level && (
              <span className="inline-flex items-center gap-1.5 mt-2 bg-forest-800 text-forest-200 text-xs font-semibold px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-forest-400 rounded-full" />
                {levelLabel[profile.level]}
              </span>
            )}
          </div>
          <div className="w-12 h-12 bg-forest-800/60 rounded-2xl flex items-center justify-center text-2xl">
            🎾
          </div>
        </div>

        {/* Stats in banner */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: myStats.played, label: 'Parties' },
            { value: myStats.wins,   label: 'Victoires' },
            { value: myStats.friends, label: 'Amis actifs' },
          ].map(s => (
            <div key={s.label} className="bg-forest-800/50 rounded-2xl py-3 text-center">
              <div className="text-white text-xl font-bold">{s.value}</div>
              <div className="text-forest-300 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── White section ───────────────────────────────── */}
      <div className="px-4 py-5 space-y-6">

        {/* Quick actions */}
        <div className="flex gap-3">
          <Link to="/sessions/new" className="flex-1 btn-primary text-sm gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Organiser une partie
          </Link>
          <Link to="/sessions" className="flex-1 btn-secondary text-sm text-center">
            Voir tout
          </Link>
        </div>

        {/* Upcoming sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-base">Prochaines parties</h3>
            <Link to="/sessions" className="text-sm text-forest-700 font-medium hover:underline">
              Tout voir →
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-[3px] border-forest-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <p className="text-sm">Aucune partie prévue</p>
              <Link to="/sessions/new" className="text-sm text-forest-700 hover:underline mt-2 inline-block">
                Organiser la première →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map(s => (
                <SessionCard key={s.id} session={s} userId={user?.id} />
              ))}
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="text-center pt-1 pb-6">
          <button onClick={signOut} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
