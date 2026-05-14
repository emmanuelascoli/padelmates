import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_LABEL, BADGES } from '../lib/constants'

const MEDAL = ['🥇', '🥈', '🥉']

// ── Tooltip points classiques ──────────────────────────────────
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

// ── Drawer explicatif ELO (caché par défaut) ───────────────────
function EloExplainer({ open }) {
  const [tab, setTab] = useState('base')

  if (!open) return null

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-3">
      {/* Sous-onglets */}
      <div className="flex border-b border-gray-100 px-3 gap-1">
        {[
          { key: 'base',    label: 'Points de base' },
          { key: 'score',   label: 'Bonus score' },
          { key: 'exemple', label: 'Exemple' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`py-2.5 px-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'text-forest-700 border-forest-600'
                : 'text-gray-400 border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {/* Points de base */}
        {tab === 'base' && (
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-semibold">Écart de force</th>
                  <th className="pb-2 font-semibold text-center">Favori</th>
                  <th className="pb-2 font-semibold text-center">Outsider</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Équilibré (&lt; 50)</td>
                  <td className="py-1.5 text-center"><span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+20</span></td>
                  <td className="py-1.5 text-center"><span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+20</span></td>
                </tr>
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Moyen (50–149)</td>
                  <td className="py-1.5 text-center"><span className="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">+15</span></td>
                  <td className="py-1.5 text-center"><span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+25</span></td>
                </tr>
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Grand (150+)</td>
                  <td className="py-1.5 text-center"><span className="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">+10</span></td>
                  <td className="py-1.5 text-center"><span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+40</span></td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Les perdants perdent autant que les gagnants en gagnent. Plancher : 100 pts.
            </p>
          </div>
        )}

        {/* Bonus score */}
        {tab === 'score' && (
          <div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 font-semibold">Écart de jeux</th>
                  <th className="pb-2 font-semibold">Exemple</th>
                  <th className="pb-2 font-semibold text-center">Ajust.</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Très serré (diff 1)</td>
                  <td className="py-1.5 text-gray-400">7-6, 6-5</td>
                  <td className="py-1.5 text-center"><span className="bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">−3</span></td>
                </tr>
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Standard (diff 2)</td>
                  <td className="py-1.5 text-gray-400">6-4</td>
                  <td className="py-1.5 text-center"><span className="bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full">±0</span></td>
                </tr>
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Dominant (diff 3–4)</td>
                  <td className="py-1.5 text-gray-400">6-3, 6-2</td>
                  <td className="py-1.5 text-center"><span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+3</span></td>
                </tr>
                <tr className="border-t border-gray-50">
                  <td className="py-1.5">Écrasant (diff ≥ 5)</td>
                  <td className="py-1.5 text-gray-400">6-1, 6-0</td>
                  <td className="py-1.5 text-center"><span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">+6</span></td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2 text-center">Ce bonus/malus s'ajoute aux points de base.</p>
          </div>
        )}

        {/* Exemple */}
        {tab === 'exemple' && (
          <div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex-1 text-center">
                <div className="text-xs text-gray-400 font-bold uppercase mb-1">Ton équipe</div>
                <div className="text-xl font-black text-green-700">1 050</div>
                <div className="text-xs text-gray-400">ELO moyen</div>
              </div>
              <div className="text-gray-300 font-bold text-lg">⚔️</div>
              <div className="flex-1 text-center">
                <div className="text-xs text-gray-400 font-bold uppercase mb-1">Adversaires</div>
                <div className="text-xl font-black text-red-600">1 250</div>
                <div className="text-xs text-gray-400">ELO moyen</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 mb-2">
              Écart = 200 → <strong className="text-gray-700">outsider</strong> (base <strong className="text-gray-700">+40</strong>) · Score 6-4 → <strong className="text-gray-700">±0</strong>
            </div>
            <div className="bg-green-50 text-green-700 font-bold text-xs rounded-xl px-3 py-2 text-center mb-1.5">
              🏆 Victoire 6-4 → +40 pts
            </div>
            <div className="bg-red-50 text-red-600 font-bold text-xs rounded-xl px-3 py-2 text-center mb-2">
              ❌ Défaite 6-4 → −40 pts
            </div>
            <p className="text-xs text-gray-400 text-center">
              Tout le monde démarre à <strong className="text-gray-600">1 000 pts</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────
export default function Leaderboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('classic')
  const [period, setPeriod] = useState('all')

  // Onglet classique
  const [rankings, setRankings] = useState([])
  const [loadingClassic, setLoadingClassic] = useState(true)

  // Onglet ELO
  const [eloRankings, setEloRankings] = useState([])
  const [loadingElo, setLoadingElo] = useState(true)
  const [eloExplainerOpen, setEloExplainerOpen] = useState(false)

  useEffect(() => { fetchClassicRankings() }, [period])
  useEffect(() => { fetchEloRankings() },   [period])

  // ── Classique ────────────────────────────────────────────────
  async function fetchClassicRankings() {
    setLoadingClassic(true)

    let query = supabase.from('valid_matches').select('*').not('winner_team', 'is', null)

    if (period === 'month') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      query = query.gte('played_at', startOfMonth.toISOString())
    }

    const { data: matches } = await query

    if (!matches || matches.length === 0) {
      setRankings([])
      setLoadingClassic(false)
      return
    }

    const stats = {}
    matches.forEach(m => {
      const team1 = [m.team1_player1, m.team1_player2].filter(Boolean)
      const team2 = [m.team2_player1, m.team2_player2].filter(Boolean)
      const all = [...team1, ...team2]
      all.forEach(pid => { if (!stats[pid]) stats[pid] = { wins: 0, losses: 0, points: 0 } })
      team1.forEach(pid => {
        if (m.winner_team === 1) { stats[pid].wins++;   stats[pid].points += 3 }
        else                     { stats[pid].losses++; stats[pid].points += 1 }
      })
      team2.forEach(pid => {
        if (m.winner_team === 2) { stats[pid].wins++;   stats[pid].points += 3 }
        else                     { stats[pid].losses++; stats[pid].points += 1 }
      })
    })

    const playerIds = Object.keys(stats)
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
    setLoadingClassic(false)
  }

  // ── ELO ──────────────────────────────────────────────────────
  async function fetchEloRankings() {
    setLoadingElo(true)

    // Récupère les matchs de la période pour les stats V/D/%
    let query = supabase.from('valid_matches').select('*').not('winner_team', 'is', null)

    if (period === 'month') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      query = query.gte('played_at', startOfMonth.toISOString())
    }

    const { data: matches } = await query

    if (!matches || matches.length === 0) {
      setEloRankings([])
      setLoadingElo(false)
      return
    }

    // Calcule les stats V/D/% de la période
    const stats = {}
    matches.forEach(m => {
      const team1 = [m.team1_player1, m.team1_player2].filter(Boolean)
      const team2 = [m.team2_player1, m.team2_player2].filter(Boolean)
      const all = [...team1, ...team2]
      all.forEach(pid => { if (!stats[pid]) stats[pid] = { wins: 0, losses: 0 } })
      team1.forEach(pid => { if (m.winner_team === 1) stats[pid].wins++; else stats[pid].losses++ })
      team2.forEach(pid => { if (m.winner_team === 2) stats[pid].wins++; else stats[pid].losses++ })
    })

    const playerIds = Object.keys(stats)

    // Récupère rank_score + rank_score_delta depuis profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, level, avatar_url, badges, rank_score, rank_score_delta')
      .in('id', playerIds)

    const ranked = (profiles || [])
      .map(p => ({
        ...p,
        wins:    stats[p.id]?.wins    ?? 0,
        losses:  stats[p.id]?.losses  ?? 0,
        winRate: (stats[p.id]?.wins ?? 0) + (stats[p.id]?.losses ?? 0) > 0
          ? Math.round(((stats[p.id]?.wins ?? 0) / ((stats[p.id]?.wins ?? 0) + (stats[p.id]?.losses ?? 0))) * 100)
          : 0,
      }))
      .sort((a, b) => (b.rank_score ?? 1000) - (a.rank_score ?? 1000))

    setEloRankings(ranked)
    setLoadingElo(false)
  }

  const myClassicRank = rankings.findIndex(r => r.id === user?.id)
  const myEloRank     = eloRankings.findIndex(r => r.id === user?.id)

  // ── Rendu d'une ligne de tableau ─────────────────────────────
  function PlayerRow({ player, rank, isElo }) {
    const isMe = player.id === user?.id
    const delta = player.rank_score_delta ?? 0

    return (
      <tr
        className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${isMe ? 'bg-forest-50 hover:bg-forest-50' : ''}`}
        onClick={() => navigate(`/players/${player.id}`)}
      >
        {/* # */}
        <td className="py-3 pl-4 pr-1 w-8">
          {rank < 3
            ? <span className="text-base">{MEDAL[rank]}</span>
            : <span className="text-xs font-semibold text-gray-400">{rank + 1}</span>}
        </td>

        {/* Joueur */}
        <td className="py-3 px-1">
          <div className="flex items-center gap-2 min-w-0">
            {player.avatar_url ? (
              <img
                src={player.avatar_url}
                alt={player.name}
                className={`shrink-0 object-cover rounded-xl ${isMe ? 'ring-2 ring-forest-400' : ''}`}
                style={{ width: 34, height: 34 }}
              />
            ) : (
              <div
                className={`shrink-0 flex items-center justify-center text-xs font-bold rounded-xl ${isMe ? 'bg-forest-700 text-white' : 'bg-gray-100 text-gray-600'}`}
                style={{ width: 34, height: 34 }}
              >
                {player.name?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1">
                <p className={`text-xs font-semibold truncate ${isMe ? 'text-forest-900' : 'text-gray-900'}`}>
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

        {/* Score (classique : pts, ELO : rank_score + delta) */}
        <td className="py-3 px-1 text-center w-14">
          {isElo ? (
            <div>
              <span className="text-xs font-black text-gray-900">{(player.rank_score ?? 1000).toLocaleString('fr-FR')}</span>
              {delta !== 0 && (
                <div className={`text-center mt-0.5 text-xs font-bold px-1.5 py-px rounded-full inline-block ${
                  delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {delta > 0 ? `+${delta}` : `${delta}`}
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm font-bold text-gray-900">{player.points}</span>
          )}
        </td>

        {/* V */}
        <td className="py-3 px-1 text-center w-7">
          <span className="text-xs font-medium text-forest-800">{player.wins}</span>
        </td>

        {/* D */}
        <td className="py-3 px-1 text-center w-7">
          <span className="text-xs font-medium text-red-500">{player.losses}</span>
        </td>

        {/* % */}
        <td className="py-3 pl-1 pr-4 text-center w-9">
          <span className="text-xs text-gray-500">{player.winRate}%</span>
        </td>
      </tr>
    )
  }

  // ── Tableau ──────────────────────────────────────────────────
  function RankTable({ data, loading, isElo }) {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">🏆</div>
          <p className="font-semibold text-gray-700 text-base">Aucun match enregistré</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            Jouez une partie et enregistrez vos matchs pour apparaître dans le classement !
          </p>
          <Link to="/sessions" className="inline-block mt-4 px-4 py-2 bg-forest-900 text-white text-sm font-semibold rounded-xl hover:bg-forest-800 transition-colors">
            Voir les parties →
          </Link>
        </div>
      )
    }

    return (
      <div className="card p-0 overflow-hidden">
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left text-xs text-gray-500 font-medium py-3 pl-4 pr-1" style={{ width: 32 }}>#</th>
              <th className="text-left text-xs text-gray-500 font-medium py-3 px-1">Joueur</th>
              <th className="text-center text-xs text-gray-500 font-medium py-3 px-1" style={{ width: 56 }}>{isElo ? 'ELO' : 'Pts'}</th>
              <th className="text-center text-xs text-gray-500 font-medium py-3 px-1" style={{ width: 28 }}>V</th>
              <th className="text-center text-xs text-gray-500 font-medium py-3 px-1" style={{ width: 28 }}>D</th>
              <th className="text-center text-xs text-gray-500 font-medium py-3 pl-1 pr-4" style={{ width: 36 }}>%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((player, i) => (
              <PlayerRow key={player.id} player={player} rank={i} isElo={isElo} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Filtre de période (commun aux deux onglets) ──────────────
  const PeriodFilter = () => (
    <div className="flex bg-gray-100 rounded-xl p-1">
      {[
        { key: 'all',   label: 'Tout temps' },
        { key: 'month', label: 'Ce mois' },
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
  )

  // ── Rendu ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="section-title text-gray-900">Classement</h1>
        {activeTab === 'classic' && <PointsTooltip />}
        {activeTab === 'elo' && (
          <button
            onClick={() => setEloExplainerOpen(v => !v)}
            className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
              eloExplainerOpen
                ? 'bg-forest-700 text-white'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
            aria-label="Comprendre le système ELO"
          >
            ⚡
          </button>
        )}
      </div>

      {/* Onglets principaux */}
      <div className="flex -mx-4 border-b border-gray-200 bg-white px-4">
        {[
          { key: 'classic', label: 'Points classiques' },
          { key: 'elo',     label: '⚡ Classement ELO' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setEloExplainerOpen(false) }}
            className={`flex-1 py-3 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'text-forest-700 border-forest-600'
                : 'text-gray-400 border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Explainer ELO (drawer) */}
      {activeTab === 'elo' && <EloExplainer open={eloExplainerOpen} />}

      {/* Filtre de période */}
      <PeriodFilter />

      {/* Bannière "Ta position" */}
      {activeTab === 'classic' && myClassicRank >= 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--color-primary)' }}
        >
          <span className="text-2xl">{myClassicRank < 3 ? MEDAL[myClassicRank] : `#${myClassicRank + 1}`}</span>
          <div>
            <p className="text-sm font-semibold text-white">Ta position : {myClassicRank + 1}ème</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {rankings[myClassicRank].points} pts · {rankings[myClassicRank].wins}V / {rankings[myClassicRank].losses}D
            </p>
          </div>
        </div>
      )}

      {activeTab === 'elo' && myEloRank >= 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'var(--color-primary)' }}
        >
          <span className="text-2xl">{myEloRank < 3 ? MEDAL[myEloRank] : `#${myEloRank + 1}`}</span>
          <div>
            <p className="text-sm font-semibold text-white">Ta position : {myEloRank + 1}ème</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {(eloRankings[myEloRank].rank_score ?? 1000).toLocaleString('fr-FR')} pts ELO
              {eloRankings[myEloRank].rank_score_delta !== 0 && (
                <span className="ml-1.5 font-semibold">
                  ({eloRankings[myEloRank].rank_score_delta > 0
                    ? `+${eloRankings[myEloRank].rank_score_delta}`
                    : eloRankings[myEloRank].rank_score_delta})
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Label discret pour l'onglet ELO */}
      {activeTab === 'elo' && !loadingElo && eloRankings.length > 0 && (
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Joueurs actifs uniquement
        </p>
      )}

      {/* Tableau */}
      {activeTab === 'classic' && (
        <RankTable data={rankings} loading={loadingClassic} isElo={false} />
      )}
      {activeTab === 'elo' && (
        <RankTable data={eloRankings} loading={loadingElo} isElo={true} />
      )}

    </div>
  )
}
