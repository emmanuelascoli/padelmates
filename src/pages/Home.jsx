import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_SHORT } from '../lib/constants'

// ── ELO Sparkline ─────────────────────────────────────────────
function EloChart({ points }) {
  if (!points || points.length < 2) return null

  const W = 300, H = 90
  const padL = 38, padR = 10, padT = 14, padB = 14

  const minVal = Math.min(...points)
  const maxVal = Math.max(...points)
  const range  = maxVal - minVal || 1

  const cx = (i) => padL + (i / (points.length - 1)) * (W - padL - padR)
  const cy = (v) => padT + (1 - (v - minVal) / range) * (H - padT - padB)

  const linePath = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${cx(points.length - 1).toFixed(1)},${(H - padB).toFixed(1)} L${cx(0).toFixed(1)},${(H - padB).toFixed(1)} Z`

  const trend     = points[points.length - 1] >= points[0]
  const stroke    = trend ? '#3D7A52' : '#E05252'
  const fillColor = trend ? 'rgba(61,122,82,0.08)' : 'rgba(224,82,82,0.08)'

  // 3 y-axis ticks clamped inside the SVG
  const ticks = [
    { v: maxVal, y: Math.max(padT + 6,  cy(maxVal)) },
    { v: Math.round((maxVal + minVal) / 2), y: cy((maxVal + minVal) / 2) },
    { v: minVal, y: Math.min(H - padB - 2, cy(minVal)) },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
      {/* Area fill */}
      <path d={areaPath} fill={fillColor} />
      {/* Baseline */}
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#F3F4F6" strokeWidth="1" />
      {/* Line */}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last dot */}
      <circle cx={cx(points.length - 1)} cy={cy(points[points.length - 1])} r="3.5" fill={stroke} />
      {/* Y-axis labels */}
      {ticks.map((t, i) => (
        <text key={i} x={padL - 4} y={t.y + 3.5} textAnchor="end" fontSize="9" fill="#9CA3AF" fontFamily="inherit">
          {t.v}
        </text>
      ))}
    </svg>
  )
}

// ── Session Card ──────────────────────────────────────────────
function SessionCard({ session, userId }) {
  const date       = new Date(`${session.date}T${session.time}`)
  const count      = session.session_participants?.length ?? 0
  const max        = session.max_players
  const isFull     = count >= max
  const isPastSess = isPast(date)
  const registered = (session.session_participants || []).some(p => p.user_id === userId)
  const pct        = Math.min(100, Math.round((count / max) * 100))

  let dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')
  if (isToday(date))    dayLabel = 'AUJ.'
  if (isTomorrow(date)) dayLabel = 'DEM.'

  return (
    <Link to={`/sessions/${session.id}`} className="block bg-white rounded-2xl shadow-sm mb-3 active:scale-[0.99] transition-transform border border-gray-100">
      <div className="flex items-center">
        {/* Date block */}
        <div className="w-14 bg-primary rounded-xl m-3 flex flex-col items-center justify-center py-[10px] shrink-0">
          <span className="text-[#6B9B7A] text-[10px] font-semibold tracking-widest uppercase leading-none">{dayLabel}</span>
          <span className="text-white text-[26px] font-bold leading-tight mt-0.5">{format(date, 'd')}</span>
          <span className="text-[#6B9B7A] text-[10px] uppercase tracking-wide leading-none">{format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}</span>
          <span className="text-accent font-bold text-xs mt-1.5 leading-none">{format(date, 'HH:mm')}</span>
        </div>
        {/* Content */}
        <div className="flex-1 pr-4 py-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-bold text-gray-900 text-[15px] leading-snug">{session.title}</span>
            {registered && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-accent-bg text-forest-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                ✓ Inscrit
              </span>
            )}
            {!isPastSess && isFull && !registered && (
              <span
                className="shrink-0 inline-flex items-center text-[11px] font-bold px-[9px] py-[3px] rounded-[20px]"
                style={{ background: 'var(--color-red-bg)', color: 'var(--color-red)' }}
              >
                Complet
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-2.5">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.location}
          </div>
          <div className="w-full bg-gray-100 rounded-[3px] h-[6px] mb-1.5">
            <div
              className={`h-[6px] rounded-[3px] transition-all ${isFull ? 'bg-[var(--color-red)]' : 'bg-accent'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">{count} / {max} joueurs</span>
            {isFull
              ? <span className="font-semibold" style={{ color: 'var(--color-red)' }}>Complet</span>
              : <span className="text-forest-700 font-semibold">{max - count} place{max - count > 1 ? 's' : ''} dispo</span>
            }
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Player Mini Card ──────────────────────────────────────────
function PlayerCard({ player }) {
  const winRate  = player.games > 0 ? Math.round((player.wins / player.games) * 100) : 0
  const initials = (player.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const isGood   = winRate >= 50

  return (
    <Link to={`/members/${player.id}`} className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform min-w-0">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
        {initials}
      </div>
      <span className="text-[11px] font-semibold text-gray-700 leading-tight w-[52px] truncate text-center">
        {player.name?.split(' ')[0] ?? '—'}
      </span>
      <div className="flex flex-col items-center gap-0.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isGood ? 'bg-accent-bg text-forest-700' : 'bg-red-50 text-red-400'}`}>
          {winRate}%
        </span>
        <span className="text-[9px] text-gray-300">{player.games}j</span>
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function Home() {
  const { user, profile, signOut } = useAuth()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [totalUpcoming, setTotalUpcoming]       = useState(0)
  const [myStats, setMyStats]         = useState({ wins: 0, played: 0 })
  const [topPartners, setTopPartners]   = useState([])
  const [topOpponents, setTopOpponents] = useState([])
  const [eloHistory, setEloHistory]     = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [profile?.id])

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [{ data: sessions }, { count: total }, { data: rawMatches }] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, session_participants(id, user_id)')
        .gte('date', today)
        .neq('status', 'cancelled')
        .eq('is_private', false)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(5),
      supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('date', today)
        .neq('status', 'cancelled')
        .eq('is_private', false),
      supabase
        .from('valid_matches')
        .select('*')
        .or(`team1_player1.eq.${profile.id},team1_player2.eq.${profile.id},team2_player1.eq.${profile.id},team2_player2.eq.${profile.id}`)
        .not('winner_team', 'is', null)
        .order('played_at', { ascending: true }),
    ])

    setUpcomingSessions(sessions || [])
    setTotalUpcoming(total ?? 0)

    const matches = rawMatches || []

    // ── Stats ───────────────────────────────────────────────
    let wins = 0
    matches.forEach(m => {
      const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
      if ((isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)) wins++
    })
    setMyStats({ wins, played: matches.length })

    // ── ELO history (approximation locale) ─────────────────
    if (matches.length >= 2) {
      let elo = 1000
      const history = [elo]
      matches.forEach(m => {
        const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
        const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
        const ws   = m.winner_team === 1 ? m.team1_score : m.team2_score
        const ls   = m.winner_team === 1 ? m.team2_score : m.team1_score
        const diff = (ws ?? 0) - (ls ?? 0)

        let pts = 20
        if (diff === 1)      pts = 17
        else if (diff === 2) pts = 20
        else if (diff <= 4)  pts = 23
        else                 pts = 26

        elo = Math.max(100, elo + (won ? pts : -pts))
        history.push(elo)
      })
      setEloHistory(history)
    }

    // ── Partners & Opponents ────────────────────────────────
    const partnerMap  = {}
    const opponentMap = {}
    const getOrCreate = (map, id) => {
      if (!map[id]) map[id] = { id, games: 0, wins: 0 }
      return map[id]
    }

    matches.forEach(m => {
      const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
      const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)

      const partnerIds  = isT1
        ? [m.team1_player1, m.team1_player2]
        : [m.team2_player1, m.team2_player2]

      const opponentIds = isT1
        ? [m.team2_player1, m.team2_player2]
        : [m.team1_player1, m.team1_player2]

      partnerIds.filter(id => id && id !== profile.id).forEach(id => {
        const p = getOrCreate(partnerMap, id); p.games++; if (won) p.wins++
      })
      opponentIds.filter(Boolean).forEach(id => {
        const o = getOrCreate(opponentMap, id); o.games++; if (won) o.wins++
      })
    })

    const topP = Object.values(partnerMap).sort((a, b) => b.games - a.games).slice(0, 4)
    const topO = Object.values(opponentMap).sort((a, b) => b.games - a.games).slice(0, 4)

    const allIds = [...new Set([...topP, ...topO].map(p => p.id).filter(Boolean))]
    if (allIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', allIds)
      const nameMap = Object.fromEntries((profileData || []).map(p => [p.id, p.name]))
      topP.forEach(p => { p.name = nameMap[p.id] ?? 'Joueur' })
      topO.forEach(p => { p.name = nameMap[p.id] ?? 'Joueur' })
    }

    setTopPartners(topP)
    setTopOpponents(topO)
    setLoading(false)
  }

  const firstName  = profile?.name?.split(' ')[0] ?? 'Joueur'
  const levelLabel = LEVEL_SHORT[profile?.level] ?? ''
  const winRate    = myStats.played > 0 ? Math.round((myStats.wins / myStats.played) * 100) : 0
  const eloScore   = profile?.rank_score ?? 1000
  const eloDelta   = profile?.rank_score_delta ?? 0

  return (
    <div className="-mx-4 -mt-6">

      {/* ── Green banner ──────────────────────────────────── */}
      <div className="bg-primary px-5 pt-7 pb-16 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full bg-white/[0.05]" />
        <div className="absolute top-6 right-10 w-16 h-16 rounded-full bg-white/[0.06]" />
        <div className="absolute -bottom-4 right-4 w-28 h-28 rounded-full bg-white/[0.04]" />
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        {/* Greeting */}
        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-[#6B9B7A] text-sm font-medium tracking-wide">Bonjour,</p>
            <h1 className="text-white text-[36px] font-bold leading-tight tracking-tight mt-0.5">
              {firstName}
            </h1>
            {levelLabel && (
              <span className="inline-flex items-center gap-2 mt-2.5 bg-primary-hover text-[#90C9A0] text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                {levelLabel}
              </span>
            )}
          </div>
          <div className="w-12 h-12 bg-primary-hover/60 rounded-2xl flex items-center justify-center text-2xl mt-1 relative z-10">
            🎾
          </div>
        </div>
      </div>

      {/* ── Beige sheet ───────────────────────────────────── */}
      <div className="bg-[#F7F7F5] rounded-t-3xl -mt-8 px-4 pt-6 pb-10 min-h-screen">

        {/* Action buttons */}
        <div className="flex gap-3 mb-5">
          <Link
            to="/sessions/new"
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm py-3.5 rounded-2xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Organiser une partie
          </Link>
          <Link
            to="/sessions"
            className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 font-semibold text-sm py-3.5 px-5 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            Voir tout
          </Link>
        </div>

        {/* Stats card */}
        <div className="bg-white rounded-2xl shadow-sm mb-5 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            <div className="py-4 text-center">
              <div className="text-[22px] font-bold text-gray-900 leading-none">{myStats.played}</div>
              <div className="text-[11px] text-gray-400 mt-1">Parties</div>
            </div>
            <div className="py-4 text-center">
              <div className="text-[22px] font-bold text-gray-900 leading-none">
                {winRate}<span className="text-sm font-medium text-gray-400">%</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Victoires</div>
            </div>
            <div className="py-4 text-center">
              <div className="flex items-center justify-center gap-1 leading-none">
                <span className="text-[22px] font-bold text-gray-900">{eloScore}</span>
                {eloDelta !== 0 && (
                  <span className={`text-[10px] font-bold px-1 py-0.5 rounded self-start mt-0.5 ${
                    eloDelta > 0 ? 'bg-accent-bg text-forest-700' : 'bg-red-50 text-red-500'
                  }`}>
                    {eloDelta > 0 ? '+' : ''}{eloDelta}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">Score ELO</div>
            </div>
          </div>
        </div>

        {/* Prochaines parties */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title text-gray-900">Prochaines parties</h3>
          <Link to="/sessions" className="text-sm text-forest-700 font-medium hover:underline">
            Tout voir →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingSessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center mb-5 shadow-sm">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm font-medium text-gray-500">Aucune partie prévue</p>
            <Link to="/sessions/new" className="text-sm text-forest-700 hover:underline mt-2 inline-block font-medium">
              Organiser la première →
            </Link>
          </div>
        ) : (
          <>
            {upcomingSessions.map(s => <SessionCard key={s.id} session={s} userId={user?.id} />)}
            {totalUpcoming > 5 && (
              <Link
                to="/sessions"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-500 hover:border-forest-300 hover:text-forest-700 hover:bg-forest-50 transition-all mb-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {totalUpcoming - 5} autre{totalUpcoming - 5 > 1 ? 's' : ''} partie{totalUpcoming - 5 > 1 ? 's' : ''} à venir
              </Link>
            )}
          </>
        )}

        {/* Empty state nouveau joueur */}
        {!loading && myStats.played === 0 && (
          <div className="bg-white rounded-2xl p-5 text-center mb-5 shadow-sm mt-2">
            <div className="text-3xl mb-2">🏸</div>
            <p className="text-sm font-semibold text-gray-700">Première partie en vue ?</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
              Inscris-toi à une partie pour voir tes stats, tes partenaires et ton classement apparaître ici.
            </p>
          </div>
        )}

        {/* Partenaires & Adversaires */}
        {!loading && myStats.played > 0 && (topPartners.length > 0 || topOpponents.length > 0) && (
          <div className="mt-4">
            {topPartners.length > 0 && (
              <div className="mb-4">
                <h3 className="section-title text-gray-900 mb-3">Mes partenaires</h3>
                <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
                  <div className="flex justify-around gap-2">
                    {topPartners.map(p => <PlayerCard key={p.id} player={p} />)}
                  </div>
                </div>
              </div>
            )}
            {topOpponents.length > 0 && (
              <div className="mb-4">
                <h3 className="section-title text-gray-900 mb-3">Mes adversaires</h3>
                <div className="bg-white rounded-2xl px-4 py-4 shadow-sm">
                  <div className="flex justify-around gap-2">
                    {topOpponents.map(p => <PlayerCard key={p.id} player={p} />)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Évolution ELO */}
        {!loading && eloHistory.length >= 3 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="section-title text-gray-900">Évolution ELO</h3>
              <span className="text-[11px] text-gray-400">
                {eloHistory.length - 1} match{eloHistory.length - 1 > 1 ? 's' : ''}
              </span>
            </div>
            <div className="bg-white rounded-2xl px-4 pt-4 pb-3 shadow-sm">
              <EloChart points={eloHistory} />
              <div className="flex justify-between mt-1.5 text-[10px] text-gray-300 px-1">
                <span>1ère partie</span>
                <span>Aujourd'hui</span>
              </div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <div className="text-center pt-2">
          <button onClick={signOut} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
            Se déconnecter
          </button>
        </div>

      </div>
    </div>
  )
}
