import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_LABEL } from '../lib/constants'

const MEDAL = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { user } = useAuth()
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')

  useEffect(() => {
    fetchRankings()
  }, [period])

  async function fetchRankings() {
    setLoading(true)

    // Fetch all matches (with optional date filter)
    let query = supabase.from('matches').select('*').not('winner_team', 'is', null)

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
      .select('id, name, level')
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

  const myRank = rankings.findIndex(r => r.id === user?.id)
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Classement</h1>
        <p className="text-sm text-gray-500 mt-0.5">Victoire = 3 pts · Défaite = 1 pt</p>
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
              period === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* My rank highlight */}
      {myRank >= 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">{myRank < 3 ? MEDAL[myRank] : `#${myRank + 1}`}</span>
          <div>
            <p className="text-sm font-semibold text-blue-900">Ta position : {myRank + 1}ème</p>
            <p className="text-xs text-blue-700">
              {rankings[myRank].points} pts · {rankings[myRank].wins}V / {rankings[myRank].losses}D
            </p>
          </div>
        </div>
      )}

      {/* Rankings table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rankings.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🏆</div>
          <p className="font-medium text-gray-600">Aucun match joué pour cette période</p>
          <p className="text-sm mt-1">Jouez et enregistrez vos matchs pour apparaître ici !</p>
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
              {rankings.map((player, i) => {
                const isMe = player.id === user?.id
                return (
                  <tr
                    key={player.id}
                    className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${isMe ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {player.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isMe ? 'text-blue-800' : 'text-gray-900'}`}>
                            {player.name}{isMe && ' (moi)'}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{LEVEL_LABEL[player.level]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="font-bold text-gray-900">{player.points}</span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className="text-blue-700 font-medium">{player.wins}</span>
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
