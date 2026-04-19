import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_LABEL } from '../lib/constants'
import { BadgeList } from '../components/BadgeList'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function PlayerProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ wins: 0, losses: 0, matchCount: 0, sessionCount: 0 })
  const [h2h, setH2h] = useState([])
  const [recentMatches, setRecentMatches] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('h2h')
  const [friendship, setFriendship] = useState(null)
  const [friendLoading, setFriendLoading] = useState(false)

  const isOwnProfile = user?.id === id

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchProfile(), fetchMatchStats(), fetchSessions(), fetchFriendship()])
    setLoading(false)
  }

  async function fetchFriendship() {
    if (!user || user.id === id) return
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${user.id})`)
      .maybeSingle()
    setFriendship(data)
  }

  async function handleAddFriend() {
    setFriendLoading(true)
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: id })
    await fetchFriendship()
    setFriendLoading(false)
  }

  async function handleAcceptFriend() {
    setFriendLoading(true)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.id)
    await fetchFriendship()
    setFriendLoading(false)
  }

  async function handleRemoveFriend() {
    setFriendLoading(true)
    await supabase.from('friendships').delete().eq('id', friendship.id)
    setFriendship(null)
    setFriendLoading(false)
  }

  async function fetchProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(data)
  }

  async function fetchMatchStats() {
    // Use valid_matches view to exclude cancelled sessions
    const { data: matches } = await supabase
      .from('valid_matches')
      .select('*')
      .or(`team1_player1.eq.${id},team1_player2.eq.${id},team2_player1.eq.${id},team2_player2.eq.${id}`)
      .not('winner_team', 'is', null)
      .order('played_at', { ascending: false })

    if (!matches?.length) return

    let wins = 0, losses = 0
    const h2hMap = {}

    matches.forEach(m => {
      const isTeam1 = m.team1_player1 === id || m.team1_player2 === id
      const won = (isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2)
      if (won) wins++; else losses++

      // Adversaires (équipe opposée)
      const opponents = isTeam1
        ? [m.team2_player1, m.team2_player2].filter(Boolean)
        : [m.team1_player1, m.team1_player2].filter(Boolean)

      opponents.forEach(oppId => {
        if (!h2hMap[oppId]) h2hMap[oppId] = { wins: 0, losses: 0 }
        if (won) h2hMap[oppId].wins++
        else h2hMap[oppId].losses++
      })
    })

    setStats(s => ({ ...s, wins, losses, matchCount: matches.length }))

    // Récupérer les profils des adversaires
    const oppIds = Object.keys(h2hMap)
    if (oppIds.length > 0) {
      const { data: oppProfiles } = await supabase
        .from('profiles').select('id, name, level, avatar_url').in('id', oppIds)

      const h2hList = (oppProfiles || [])
        .map(p => ({ ...p, ...h2hMap[p.id], total: h2hMap[p.id].wins + h2hMap[p.id].losses }))
        .sort((a, b) => b.total - a.total)

      setH2h(h2hList)
    }

    // Récupérer les noms des joueurs pour les matchs récents
    const allPlayerIds = [...new Set(matches.flatMap(m =>
      [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].filter(Boolean)
    ))]
    const { data: allProfiles } = await supabase.from('profiles').select('id, name').in('id', allPlayerIds)
    const nameMap = Object.fromEntries((allProfiles || []).map(p => [p.id, p.name]))

    setRecentMatches(matches.slice(0, 15).map(m => ({
      ...m,
      t1p1_name: nameMap[m.team1_player1] || '?',
      t1p2_name: nameMap[m.team1_player2] || '?',
      t2p1_name: nameMap[m.team2_player1] || '?',
      t2p2_name: nameMap[m.team2_player2] || '?',
    })))
  }

  async function fetchSessions() {
    const { data } = await supabase
      .from('session_participants')
      .select('*, sessions(id, date, time, location, title, status)')
      .eq('user_id', id)
      .order('joined_at', { ascending: false })
      .limit(15)

    const sessions = (data || [])
      .filter(p => p.sessions)
      .map(p => p.sessions)

    setRecentSessions(sessions) // Keep all for display (cancelled shown with badge)
    setStats(s => ({ ...s, sessionCount: sessions.filter(s => s.status !== 'cancelled').length }))
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!profile) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Joueur introuvable.</p>
      <Link to="/leaderboard" className="text-blue-600 hover:underline mt-2 inline-block">← Classement</Link>
    </div>
  )

  const winRate = stats.wins + stats.losses > 0
    ? Math.round(stats.wins / (stats.wins + stats.losses) * 100)
    : 0

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour
      </button>

      {/* Header joueur */}
      <div className="card text-center py-6">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="avatar"
            className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white ring-2 ring-blue-100 shadow-md" />
        ) : (
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
            <span className="text-3xl font-bold text-white">{profile.name?.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
        {profile.level && (
          <span className="badge bg-blue-100 text-blue-800 mt-2">{LEVEL_LABEL[profile.level]}</span>
        )}
        {profile.badges?.length > 0 && (
          <div className="mt-3">
            <BadgeList badges={profile.badges} size="lg" className="justify-center" />
          </div>
        )}
        {isOwnProfile && (
          <div className="mt-2">
            <Link to="/profile" className="text-xs text-blue-600 hover:underline">Modifier mon profil →</Link>
          </div>
        )}

        {/* Bouton ami */}
        {!isOwnProfile && (
          <div className="mt-3">
            {!friendship && (
              <button
                onClick={handleAddFriend}
                disabled={friendLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {friendLoading ? '...' : '+ Ajouter comme ami'}
              </button>
            )}
            {friendship?.status === 'pending' && friendship.requester_id === user?.id && (
              <div className="flex items-center gap-2 justify-center">
                <span className="text-sm text-gray-500">⏳ Demande envoyée</span>
                <button onClick={handleRemoveFriend} disabled={friendLoading} className="text-xs text-red-400 hover:text-red-600">
                  Annuler
                </button>
              </div>
            )}
            {friendship?.status === 'pending' && friendship.addressee_id === user?.id && (
              <div className="flex items-center gap-2 justify-center">
                <button
                  onClick={handleAcceptFriend}
                  disabled={friendLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {friendLoading ? '...' : '✓ Accepter la demande'}
                </button>
                <button onClick={handleRemoveFriend} disabled={friendLoading} className="text-xs text-red-400 hover:text-red-600">
                  Refuser
                </button>
              </div>
            )}
            {friendship?.status === 'accepted' && (
              <div className="flex items-center gap-2 justify-center">
                <span className="text-sm text-blue-600 font-medium">✓ Amis</span>
                <button onClick={handleRemoveFriend} disabled={friendLoading} className="text-xs text-gray-400 hover:text-red-500">
                  Retirer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Parties', value: stats.sessionCount, color: 'text-gray-800' },
          { label: 'Matchs', value: stats.matchCount, color: 'text-gray-700' },
          { label: 'Victoires', value: stats.wins, color: 'text-blue-600' },
          { label: '% Victoire', value: `${winRate}%`, color: stats.losses === 0 && stats.wins === 0 ? 'text-gray-400' : winRate >= 50 ? 'text-blue-600' : 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3 px-1">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'h2h', label: 'Face-à-face' },
          { key: 'matches', label: 'Matchs' },
          { key: 'sessions', label: 'Parties' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Face-à-face */}
      {tab === 'h2h' && (
        <div className="space-y-2">
          {h2h.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">🎾</div>
              <p>Aucun match joué pour l'instant</p>
            </div>
          ) : (
            h2h.map(opp => {
              const oppWinRate = Math.round(opp.wins / opp.total * 100)
              return (
                <Link key={opp.id} to={`/players/${opp.id}`} className="card hover:shadow-md transition-shadow block">
                  <div className="flex items-center gap-3">
                    {opp.avatar_url ? (
                      <img src={opp.avatar_url} className="w-10 h-10 rounded-full object-cover shrink-0" alt="" />
                    ) : (
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-sm shrink-0">
                        {opp.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{opp.name}</p>
                      <p className="text-xs text-gray-400">{LEVEL_LABEL[opp.level] ?? '—'}</p>
                    </div>
                    {/* Barre de progression */}
                    <div className="text-right shrink-0 min-w-[80px]">
                      <p className="text-sm font-semibold text-gray-900">
                        <span className="text-blue-600">{opp.wins}V</span>
                        {' · '}
                        <span className="text-red-500">{opp.losses}D</span>
                      </p>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${oppWinRate >= 50 ? 'bg-blue-500' : 'bg-red-400'}`}
                          style={{ width: `${oppWinRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}

      {/* Tab Matchs récents */}
      {tab === 'matches' && (
        <div className="space-y-2">
          {recentMatches.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p>Aucun match enregistré</p>
            </div>
          ) : (
            recentMatches.map((m, i) => {
              const isTeam1 = m.team1_player1 === id || m.team1_player2 === id
              const won = (isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2)
              const T1 = [m.t1p1_name, m.t1p2_name].filter(Boolean).join(' & ')
              const T2 = [m.t2p1_name, m.t2p2_name].filter(Boolean).join(' & ')
              return (
                <div key={m.id} className={`card border-l-4 ${won ? 'border-l-blue-500' : 'border-l-red-400'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${won ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'}`}>
                          {won ? 'Victoire' : 'Défaite'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(m.played_at), 'd MMM', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        <span className={isTeam1 && won ? 'font-semibold text-blue-700' : ''}>{T1}</span>
                        <span className="text-gray-400 mx-1">vs</span>
                        <span className={!isTeam1 && won ? 'font-semibold text-blue-700' : ''}>{T2}</span>
                      </p>
                    </div>
                    <div className="text-lg font-bold text-gray-900 shrink-0">
                      {m.team1_score} — {m.team2_score}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab Parties */}
      {tab === 'sessions' && (
        <div className="space-y-2">
          {recentSessions.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p>Aucune partie jouée</p>
            </div>
          ) : (
            recentSessions.map(s => {
              const date = new Date(`${s.date}T${s.time}`)
              const past = isPast(date)
              return (
                <Link key={s.id} to={`/sessions/${s.id}`} className="card hover:shadow-md transition-shadow block">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 rounded-xl p-2 text-center min-w-[44px] shrink-0">
                      <div className="text-xs text-blue-600 font-medium">{format(date, 'MMM', { locale: fr })}</div>
                      <div className="text-lg font-bold text-blue-800 leading-none">{format(date, 'd')}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{s.title}</p>
                      <p className="text-sm text-gray-400">📍 {s.location} · {format(date, 'HH:mm')}</p>
                    </div>
                    {s.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
                    {past && s.status !== 'cancelled' && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
                    {!past && s.status === 'open' && <span className="badge bg-blue-100 text-blue-700">À venir</span>}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
