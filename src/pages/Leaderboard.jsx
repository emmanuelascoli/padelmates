import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_LABEL, BADGES } from '../lib/constants'

const MEDAL = ['🥇', '🥈', '🥉']

function PointsTooltip() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold hover:bg-gray-300 transition-colors flex items-center justify-center"
        aria-label="Explication du système de points"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-7 z-10 w-52 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-xl">
          <p className="font-semibold mb-1.5">Système de points</p>
          <div className="space-y-1 text-gray-300">
            <p>🏆 Victoire = <span className="text-white font-medium">3 pts</span></p>
            <p>😓 Défaite = <span className="text-white font-medium">1 pt</span></p>
          </div>
          <p className="mt-2 text-gray-400 text-xs">La défaite rapporte 1 pt pour récompenser la participation.</p>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 rotate-45" />
        </div>
      )}
    </div>
  )
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [friendIds, setFriendIds] = useState([])

  useEffect(() => {
    if (user) fetchFriendIds()
  }, [user])

  useEffect(() => {
    fetchRankings()
  }, [period])

  async function fetchFriendIds() {
    const { data } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    const ids = (data || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    setFriendIds(ids)
  }

  async function fetchRankings() {
    setLoading(true)

    // Fetch all matches from non-cancelled sessions only
    let query = supabase.from('valid_matches').select('*').not('winner_team', 'is', null)

    if (period === 'month') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      query = query.gte('played_at', startOfMonth.toISOString())
    } else if (period === 'week') {
      const startOfWeek = new Date()
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      query = query.gte('played_at', startOfWeek.toISOString())
    }

    const { data: matches } = await query

    if (!matches || matches.length === 0) {
      setRankings([])
      setLoading(false)
      return
    }

    // Count stats per player
    const stats = {}

    matches.forEach(m => {
      const team1 = [m.team1_player1, m.team1_player2].filter(Boolean)
      const team2 = [m.team2_player1, m.team2_player2].filter(Boolean)
      const allPlayers = [...team1, ...team2]

      allPlayers.forEach(pid => {
        if (!stats[pid]) stats[pid] = { wins: 0, losses: 0, points: 0 }
      })

      team1.forEach(pid => {
        if (m.winner_team === 1) { stats[pid].wins++; stats[pid].points += 3 }
        else { stats[pid].losses++; stats[pid].points += 1 }
      })

      team2.forEach(pid => {
        if (m.winner_team === 2) { stats[pid].wins++; stats[pid].points += 3 }
        else { stats[pid].losses++; stats[pid].points += 1 }
      })
    })

    // Fetch player profiles
    const playerIds = Object.keys(stats)
    if (playerIds.length === 0) { setRankings([]); setLoading(false); return }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, level, avatar_url, badges')
      .in('id', playerIds)

    const ranked = (profiles || [])
      .map(p => ({
        ...p,
        ...stats[p.id],
        winRate: stats[p.id].wins + stats[p.id].losses > 0
          ? Math.round((stats[p.id].wins / (stats[p.id].wins + stats[p.id].losses)) * 100)
          : 0,
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses)

    setRankings(ranked)
    setLoading(false)
  }

  // Filtre amis : garde uniquement les amis + soi-même
  const visibleRankings = friendsOnly
    ? rankings.filter(r => r.id === user?.id || friendIds.includes(r.id))
    : rankings

  const myRank = visibleRankings.findIndex(r => r.id === user?.id)
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="section-title text-gray-900">Classement</h1>
        <PointsTooltip />
      </div>

      {/* Period filter */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'all', label: 'Tout temps' },
          { key: 'month', label: 'Ce mois' },
          { key: 'week', label: 'Cette semaine' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              period === key ? 'bg-white text-forest-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Friends toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setFriendsOnly(false)}
          className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
            !friendsOnly
              ? 'bg-forest-900 text-white border-forest-700'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          🌍 Tous les joueurs
        </button>
        <button
          onClick={() => setFriendsOnly(true)}
          className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all ${
            friendsOnly
              ? 'bg-forest-900 text-white border-forest-700'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          👥 Mes amis
        </button>
      </div>

      {/* My rank highlight */}
      {myRank >= 0 && (
        <div className="bg-forest-50 border border-forest-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">{myRank < 3 ? MEDAL[myRank] : `#${myRank + 1}`}</span>
          <div>
            <p className="text-sm font-semibold text-forest-900">Ta position : {myRank + 1}ème</p>
            <p className="text-xs text-forest-800">
              {visibleRankings[myRank].points} pts · {visibleRankings[myRank].wins}V / {visibleRankings[myRank].losses}D
            </p>
          </div>
        </div>
      )}

      {/* Rankings table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visibleRankings.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">{friendsOnly ? '👥' : '🏆'}</div>
          <p className="font-semibold text-gray-700 text-base">
            {friendsOnly ? 'Aucun ami n\'a joué sur cette période' : 'Aucun match enregistré'}
          </p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            {friendsOnly
              ? 'Ajoute des amis depuis la page Membres pour voir leur classement ici.'
              : 'Jouez une partie et enregistrez vos matchs pour apparaître dans le classement !'}
          </p>
          {!friendsOnly && (
            <Link to="/sessions" className="inline-block mt-4 px-4 py-2 bg-forest-900 text-white text-sm font-semibold rounded-xl hover:bg-forest-800 transition-colors">
              Voir les parties →
            </Link>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs text-gray-500 font-medium py-3 px-4">#</th>
                <th className="text-left text-xs text-gray-500 font-medium py-3 px-2">Joueur</th>
                <th className="text-center text-xs text-gray-500 font-medium py-3 px-2">Pts</th>
                <th className="text-center text-xs text-gray-500 font-medium py-3 px-2">V</th>
                <th className="text-center text-xs text-gray-500 font-medium py-3 px-2">D</th>
                <th className="text-center text-xs text-gray-500 font-medium py-3 px-2">%</th>
              </tr>
            </thead>
            <tbody>
              {visibleRankings.map((player, i) => {
                const isMe = player.id === user?.id
                return (
                  <tr
                    key={player.id}
                    className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${isMe ? 'bg-forest-50 hover:bg-forest-50' : ''}`}
                    onClick={() => navigate(`/players/${player.id}`)}
                  >
                    <td className="py-3 px-4">
                      {i < 3 ? (
                        <span className="text-lg">{MEDAL[i]}</span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        {player.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt={player.name}
                            className={`w-8 h-8 rounded-full object-cover shrink-0 ${isMe ? 'ring-2 ring-forest-400' : ''}`}
                          />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isMe ? 'bg-forest-700 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {player.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <p className={`text-sm font-medium truncate ${isMe ? 'text-forest-900' : 'text-gray-900'}`}>
                              {player.name}{isMe && ' (moi)'}
                            </p>
                            {player.badges?.length > 0 && (
                              <span className="shrink-0 text-xs leading-none" title={player.badges.map(b => BADGES[b]?.label).filter(Boolean).join(', ')}>
                                {player.badges.map(b => BADGES[b]?.emoji).filter(Boolean).join('')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{LEVEL_LABEL[player.level]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="font-bold text-gray-900">{player.points}</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="text-forest-800 font-medium">{player.wins}</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="text-red-500 font-medium">{player.losses}</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="text-gray-500 text-sm">{player.winRate}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
