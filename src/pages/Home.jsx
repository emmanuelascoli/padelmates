import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_SHORT } from '../lib/constants'

// Consistent avatar color from string
function avatarColor(str = '') {
  const colors = ['#2563EB','#059669','#7C3AED','#D97706','#DC2626','#0891B2','#9333EA','#16A34A']
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

// ── Inline SVG Chart ──────────────────────────────────────────
function EvoChart({ points }) {
  if (!points || points.length < 2) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9CA3AF' }}>
      Jouez votre premier match pour voir votre évolution
    </div>
  )
  const W = 308, H = 80, padL = 6, padR = 6, padT = 10, padB = 18
  const innerW = W - padL - padR, innerH = H - padT - padB
  const mn = Math.min(...points), mx = Math.max(...points)
  const range = mx - mn || 1
  const xs = points.map((_, i) => padL + i * innerW / (points.length - 1))
  const ys = points.map(v => padT + innerH - ((v - mn) / range) * innerH)
  const polyline = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)} ` +
    xs.slice(1).map((x, i) => `L${x.toFixed(1)},${ys[i + 1].toFixed(1)}`).join(' ') +
    ` L${xs[xs.length - 1].toFixed(1)},${(H - padB).toFixed(1)} L${xs[0].toFixed(1)},${(H - padB).toFixed(1)} Z`
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1]
  const lastVal = points[points.length - 1]
  const labelX = lastX > W - 56 ? lastX - 38 : lastX + 6

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'hidden' }}>
      <defs>
        <clipPath id="cc"><rect x={padL} y={padT} width={innerW} height={innerH + 2} /></clipPath>
      </defs>
      <path d={areaPath} fill="rgba(20,83,45,0.07)" clipPath="url(#cc)" />
      <polyline points={polyline} fill="none" stroke="#14532d" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#cc)" />
      {xs.slice(0, -1).map((x, i) => (
        <circle key={i} cx={x.toFixed(1)} cy={ys[i].toFixed(1)} r="2" fill="#14532d" opacity="0.5" />
      ))}
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="6" fill="rgba(20,83,45,0.12)" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="3.5" fill="#14532d" />
      <rect x={labelX} y={lastY - 9} width="36" height="14" rx="4" fill="#14532d" />
      <text x={labelX + 18} y={lastY + 1} textAnchor="middle" fontSize="9" fill="white" fontWeight="500">{lastVal} pts</text>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#E5E7EB" strokeWidth="0.5" />
      <text x={padL} y={H - 4} fontSize="8" fill="#9CA3AF">M1</text>
      <text x={W - padR} y={H - 4} fontSize="8" fill="#9CA3AF" textAnchor="end">M{points.length}</text>
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
    <Link to={`/sessions/${session.id}`}
      className="block bg-white rounded-2xl mb-2 active:scale-[0.99] transition-transform"
      style={{ border: '0.5px solid #E5E7EB' }}
    >
      <div className="flex items-center">
        <div className="bg-primary rounded-xl m-2 flex flex-col items-center justify-center py-2 shrink-0" style={{ width: 52 }}>
          <span className="text-[#6B9B7A] text-[10px] font-semibold tracking-widest uppercase leading-none">{dayLabel}</span>
          <span className="text-white text-[26px] font-bold leading-tight mt-0.5">{format(date, 'd')}</span>
          <span className="text-[#6B9B7A] text-[10px] uppercase tracking-wide leading-none">{format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}</span>
          <span className="text-accent font-bold text-[12px] mt-1 leading-none">{format(date, 'HH:mm')}</span>
        </div>
        <div className="flex-1 pr-3 py-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className="font-bold text-gray-900 text-[14px] leading-snug">{session.title}</span>
            {registered && (
              <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#166534' }}>Inscrit</span>
            )}
            {!isPastSess && isFull && !registered && (
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Complet</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-[10px] mb-1.5">
            <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.location}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 bg-gray-100 rounded-[2px] h-[3px]" style={{ overflow: 'hidden' }}>
              <div className="h-[3px] rounded-[2px]"
                style={{ width: `${pct}%`, background: isFull ? '#EF4444' : '#4ade80' }} />
            </div>
            <span className="text-[9px] shrink-0" style={{ color: isFull ? '#EF4444' : '#15803d', fontWeight: 500 }}>
              {isFull ? 'Complet' : `${max - count} dispo`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function Home() {
  const { user, profile, signOut } = useAuth()

  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [totalUpcoming, setTotalUpcoming]       = useState(0)
  const [myStats, setMyStats]       = useState({ wins: 0, losses: 0, played: 0, points: 0 })
  const [eloRank, setEloRank]       = useState(null)
  const [recentForm, setRecentForm] = useState([])
  const [topPartners, setTopPartners]   = useState([])
  const [topRivals, setTopRivals]       = useState([])
  const [eloHistory, setEloHistory]     = useState([])
  const [ptsHistory, setPtsHistory]     = useState([])
  const [chartTab, setChartTab]         = useState('elo')
  const [playersTab, setPlayersTab]     = useState('partners')
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    if (profile?.id) fetchData()
  }, [profile?.id])

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    // ── Phase 1 : requêtes parallèles indépendantes ─────────
    const [
      { data: myParticipations },
      { data: rawMatches },
      { data: allMatchRows },
    ] = await Promise.all([
      // Sessions où le joueur est inscrit
      supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', profile.id),
      // Mes matchs (stats + historique)
      supabase
        .from('valid_matches')
        .select('*')
        .or(`team1_player1.eq.${profile.id},team1_player2.eq.${profile.id},team2_player1.eq.${profile.id},team2_player2.eq.${profile.id}`)
        .not('winner_team', 'is', null)
        .order('played_at', { ascending: true }),
      // Tous les matchs → pour le classement ELO (identique à la page Communauté)
      supabase
        .from('valid_matches')
        .select('team1_player1,team1_player2,team2_player1,team2_player2')
        .not('winner_team', 'is', null),
    ])

    // ── Phase 2 : requêtes dépendant de la phase 1 ──────────
    const mySessionIds = (myParticipations || []).map(p => p.session_id)

    // Identifiants uniques de tous les joueurs ayant joué au moins 1 match
    const allPlayerIds = [
      ...new Set(
        (allMatchRows || [])
          .flatMap(m => [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2])
          .filter(Boolean)
      ),
    ]

    const [
      { data: sessions },
      { count: total },
      { data: rankedProfiles },
    ] = await Promise.all([
      mySessionIds.length > 0
        ? supabase
            .from('sessions')
            .select('*, session_participants(id, user_id)')
            .in('id', mySessionIds)
            .gte('date', today)
            .neq('status', 'cancelled')
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [] }),
      mySessionIds.length > 0
        ? supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .in('id', mySessionIds)
            .gte('date', today)
            .neq('status', 'cancelled')
        : Promise.resolve({ count: 0 }),
      allPlayerIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, rank_score')
            .in('id', allPlayerIds)
        : Promise.resolve({ data: [] }),
    ])

    setUpcomingSessions(sessions || [])
    setTotalUpcoming(total ?? 0)

    // ── Classement ELO (même logique que la page Communauté) ─
    // Seuls les joueurs ayant joué ≥ 1 match sont pris en compte
    const sortedElo = (rankedProfiles || []).sort(
      (a, b) => (b.rank_score ?? 1000) - (a.rank_score ?? 1000)
    )
    const myEloIdx = sortedElo.findIndex(p => p.id === profile.id)
    setEloRank(myEloIdx >= 0 ? myEloIdx + 1 : null)

    const matches = rawMatches || []

    // ── Stats ───────────────────────────────────────────────
    let wins = 0, losses = 0
    matches.forEach(m => {
      const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
      const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
      if (won) wins++; else losses++
    })
    const played = matches.length
    const points = wins * 3 + losses * 1
    setMyStats({ wins, losses, played, points })

    // ── Forme récente (5 derniers matchs) ───────────────────
    setRecentForm(
      [...matches].reverse().slice(0, 5).reverse().map(m => {
        const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
        return (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2) ? 'W' : 'L'
      })
    )

    // ── Historiques ELO & Points ─────────────────────────────
    if (matches.length >= 2) {
      let elo = 1000, pts = 0
      const eloH = [elo], ptsH = [pts]
      matches.forEach(m => {
        const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
        const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
        const ws   = m.winner_team === 1 ? m.team1_score : m.team2_score
        const ls   = m.winner_team === 1 ? m.team2_score : m.team1_score
        const diff = (ws ?? 0) - (ls ?? 0)
        let eloPts = diff === 1 ? 17 : diff <= 2 ? 20 : diff <= 4 ? 23 : 26
        elo = Math.max(100, elo + (won ? eloPts : -eloPts))
        pts += won ? 3 : 1
        eloH.push(elo)
        ptsH.push(pts)
      })
      setEloHistory(eloH)
      setPtsHistory(ptsH)
    }

    // ── Partenaires & Rivaux ─────────────────────────────────
    const partnerMap = {}, rivalMap = {}
    const getOrCreate = (map, id) => {
      if (!map[id]) map[id] = { id, games: 0, wins: 0 }
      return map[id]
    }
    matches.forEach(m => {
      const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
      const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
      const partnerIds = (isT1
        ? [m.team1_player1, m.team1_player2]
        : [m.team2_player1, m.team2_player2]
      ).filter(id => id && id !== profile.id)
      const rivalIds = (isT1
        ? [m.team2_player1, m.team2_player2]
        : [m.team1_player1, m.team1_player2]
      ).filter(Boolean)
      partnerIds.forEach(id => { const p = getOrCreate(partnerMap, id); p.games++; if (won) p.wins++ })
      rivalIds.forEach(id   => { const p = getOrCreate(rivalMap,   id); p.games++; if (won) p.wins++ })
    })
    const topP = Object.values(partnerMap).sort((a, b) => b.games - a.games).slice(0, 4)
    const topR = Object.values(rivalMap).sort((a, b) => b.games - a.games).slice(0, 4)

    const allIds = [...new Set([...topP, ...topR].map(p => p.id).filter(Boolean))]
    if (allIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles').select('id, name').in('id', allIds)
      const nameMap = Object.fromEntries((profileData || []).map(p => [p.id, p.name]))
      topP.forEach(p => { p.name = nameMap[p.id] ?? 'Joueur' })
      topR.forEach(p => { p.name = nameMap[p.id] ?? 'Joueur' })
    }
    setTopPartners(topP)
    setTopRivals(topR)
    setLoading(false)
  }

  const firstName  = profile?.name?.split(' ')[0] ?? 'Joueur'
  const levelLabel = LEVEL_SHORT[profile?.level] ?? ''
  const eloScore   = profile?.rank_score ?? 1000
  const eloDelta   = profile?.rank_score_delta ?? 0
  const winRate    = myStats.played > 0 ? Math.round((myStats.wins / myStats.played) * 100) : 0

  const streak = (() => {
    if (!recentForm.length) return null
    const last = recentForm[recentForm.length - 1]
    let count = 0
    for (let i = recentForm.length - 1; i >= 0; i--) {
      if (recentForm[i] === last) count++; else break
    }
    return count >= 2 ? `${count} ${last === 'W' ? 'victoires' : 'défaites'} d'affilée` : null
  })()

  const chartPoints = chartTab === 'elo' ? eloHistory : ptsHistory
  const playersList = playersTab === 'partners' ? topPartners : topRivals

  return (
    <div className="-mx-4 -mt-6">

      {/* ── Banner ─────────────────────────────────────── */}
      <div style={{ background: '#14532d', padding: '28px 20px 44px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', borderRadius:'50%', width:210, height:210, right:-50, top:-70, background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', borderRadius:'50%', width:100, height:100, right:30, top:5,   background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', borderRadius:'50%', width:150, height:150, right:10, bottom:-90, background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:12, color:'#6B9B7A', fontWeight:500, letterSpacing:'0.05em', marginBottom:4 }}>Bonjour,</div>
              <div style={{ fontSize:34, fontWeight:500, color:'#fff', lineHeight:1.05 }}>{firstName}</div>
            </div>
            <div style={{ width:48, height:48, background:'rgba(255,255,255,0.08)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🎾</div>
          </div>
          <div style={{ display:'flex', gap:7, marginTop:12, flexWrap:'wrap' }}>
            {levelLabel && (
              <div style={{ background:'rgba(255,255,255,0.1)', color:'#90C9A0', fontSize:11, fontWeight:500, padding:'5px 11px', borderRadius:999, display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80' }} />
                {levelLabel}
              </div>
            )}
            {eloRank && myStats.played > 0 && (
              <div style={{ background:'rgba(251,191,36,0.15)', color:'#fbbf24', fontSize:11, fontWeight:500, padding:'5px 11px', borderRadius:999 }}>
                ✦ #{eloRank} ELO
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sheet ──────────────────────────────────────── */}
      <div style={{ background:'#F5F4F0', borderRadius:'24px 24px 0 0', marginTop:-20, padding:'18px 14px 32px', minHeight:'100vh', position:'relative', zIndex:2 }}>

        {/* Buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:18 }}>
          <Link to="/sessions/new"
            style={{ background:'#14532d', color:'#fff', fontSize:13, fontWeight:500, border:'none', borderRadius:13, padding:'12px 14px', display:'flex', alignItems:'center', gap:7, textDecoration:'none' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Organiser une partie
          </Link>
          <Link to="/sessions"
            style={{ background:'#fff', color:'#374151', fontSize:13, fontWeight:500, border:'0.5px solid #E5E7EB', borderRadius:13, padding:'12px 14px', textDecoration:'none', whiteSpace:'nowrap', display:'flex', alignItems:'center' }}
          >
            Voir tout
          </Link>
        </div>

        {/* Mes prochaines parties (seulement celles où je suis inscrit) */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>Mes prochaines parties</div>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}>
            <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingSessions.length === 0 ? (
          <div style={{ background:'#fff', borderRadius:14, border:'0.5px dashed #D1D5DB', padding:16, textAlign:'center', marginBottom:14 }}>
            <div style={{ fontSize:20, marginBottom:5 }}>📅</div>
            <div style={{ fontSize:12, color:'#6B7280', marginBottom:6 }}>Vous n'êtes inscrit à aucune partie à venir</div>
            <Link to="/sessions"
              style={{ fontSize:11, fontWeight:500, color:'#14532d', background:'#DCFCE7', border:'none', borderRadius:999, padding:'6px 14px', textDecoration:'none', display:'inline-block' }}
            >Rejoindre une partie →</Link>
          </div>
        ) : (
          <div style={{ marginBottom:14 }}>
            {upcomingSessions.map(s => <SessionCard key={s.id} session={s} userId={user?.id} />)}
            {totalUpcoming > 5 && (
              <Link to="/sessions"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', fontSize:11, color:'#6B7280', textDecoration:'none' }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {totalUpcoming - 5} autre{totalUpcoming - 5 > 1 ? 's' : ''} à venir
              </Link>
            )}
          </div>
        )}

        {/* Ma forme récente */}
        {!loading && (
          <>
            <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Ma forme récente</div>
            <div style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', padding:12, marginBottom:14, display:'flex', gap:5, alignItems:'center' }}>
              {recentForm.length === 0 ? (
                <>
                  {[0,1,2,3,4].map(i => (
                    <span key={i} style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, background:'#F3F4F6', color:'#9CA3AF' }}>·</span>
                  ))}
                  <span style={{ flex:1, height:1, background:'#E5E7EB' }} />
                  <span style={{ fontSize:10, color:'#9CA3AF', whiteSpace:'nowrap' }}>Aucun match joué</span>
                </>
              ) : (
                <>
                  {recentForm.map((r, i) => (
                    <span key={i} style={{
                      width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:10, fontWeight:500,
                      background: r === 'W' ? '#DCFCE7' : '#FEE2E2',
                      color:      r === 'W' ? '#166534' : '#B91C1C',
                    }}>{r === 'W' ? 'V' : 'D'}</span>
                  ))}
                  {recentForm.length < 5 && Array.from({ length: 5 - recentForm.length }).map((_, i) => (
                    <span key={`e${i}`} style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, background:'#F3F4F6', color:'#9CA3AF' }}>·</span>
                  ))}
                  <span style={{ flex:1, height:1, background:'#E5E7EB' }} />
                  {streak && <span style={{ fontSize:10, color:'#6B7280', whiteSpace:'nowrap' }}>{streak}</span>}
                </>
              )}
            </div>
          </>
        )}

        {/* Mes stats 2×2 */}
        {!loading && (
          <>
            <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Mes stats</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8, marginBottom:14 }}>
              {[
                {
                  val: eloScore,
                  lbl: 'Score ELO',
                  badge: eloDelta !== 0 ? `${eloDelta > 0 ? '+' : ''}${eloDelta} dernier match` : `${myStats.played} partie${myStats.played > 1 ? 's' : ''}`,
                  badgeGood: eloDelta > 0,
                },
                {
                  val: `${winRate}%`,
                  lbl: 'Taux de victoire',
                  badge: myStats.played > 0 ? `sur ${myStats.played} partie${myStats.played > 1 ? 's' : ''}` : '—',
                  badgeGood: winRate >= 50,
                },
                {
                  val: eloRank ? `#${eloRank}` : '—',
                  lbl: 'Classement ELO',
                  badge: myStats.played > 0 ? 'classement général' : 'après 1ère partie',
                  badgeGood: false,
                },
                {
                  val: myStats.points,
                  lbl: 'Points classiques',
                  badge: myStats.played > 0 ? `${myStats.wins}V / ${myStats.losses}D` : '—',
                  badgeGood: false,
                },
              ].map((s, i) => (
                <div key={i} style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', padding:12, opacity: myStats.played === 0 && i > 0 ? 0.4 : 1 }}>
                  <div style={{ fontSize:22, fontWeight:500, color:'#111827', lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'#6B7280', marginTop:3 }}>{s.lbl}</div>
                  <div style={{ fontSize:9, fontWeight:500, padding:'2px 6px', borderRadius:999, marginTop:5, display:'inline-block',
                    background: s.badgeGood ? '#DCFCE7' : '#F3F4F6',
                    color:      s.badgeGood ? '#166534' : '#6B7280',
                  }}>{s.badge}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Évolution */}
        {!loading && (
          <div style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', padding:'12px 12px 8px', marginBottom:14, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>Évolution</div>
              <div style={{ display:'flex', gap:3 }}>
                {['elo','pts'].map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    style={{
                      fontSize:10, fontWeight:500, padding:'4px 10px', borderRadius:999,
                      border: `0.5px solid ${chartTab === t ? '#14532d' : '#E5E7EB'}`,
                      background: chartTab === t ? '#14532d' : 'none',
                      color:      chartTab === t ? '#fff' : '#6B7280',
                      cursor:'pointer',
                    }}
                  >{t === 'elo' ? 'ELO' : 'Points'}</button>
                ))}
              </div>
            </div>
            <EvoChart points={chartPoints} />
          </div>
        )}

        {/* Partenaires & Rivaux */}
        {!loading && (
          <>
            <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Partenaires &amp; Rivaux</div>
            <div style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', overflow:'hidden', marginBottom:14 }}>
              <div style={{ display:'flex', borderBottom:'0.5px solid #E5E7EB' }}>
                {[['partners','Partenaires'],['rivals','Rivaux']].map(([key, label]) => (
                  <button key={key} onClick={() => setPlayersTab(key)}
                    style={{
                      flex:1, padding:9, fontSize:11, fontWeight:500, background:'none', border:'none', cursor:'pointer',
                      color:        playersTab === key ? '#14532d' : '#6B7280',
                      borderBottom: `2px solid ${playersTab === key ? '#14532d' : 'transparent'}`,
                      marginBottom: '-1px',
                    }}
                  >{label}</button>
                ))}
              </div>
              {playersList.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', fontSize:11, color:'#9CA3AF' }}>
                  Jouez des parties pour voir vos stats ici
                </div>
              ) : playersList.map((p, i) => {
                const pWinRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0
                const pLosses = p.games - p.wins
                const initials = (p.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 1)
                const color = avatarColor(p.id || '')
                return (
                  <Link key={p.id} to={`/players/${p.id}`}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderBottom: i < playersList.length - 1 ? '0.5px solid #E5E7EB' : 'none', textDecoration:'none' }}
                  >
                    <div style={{ fontSize:11, color:'#9CA3AF', width:14, textAlign:'center', flexShrink:0 }}>{i + 1}</div>
                    <div style={{ width:30, height:30, borderRadius:9, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'#fff', flexShrink:0 }}>
                      {initials}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'#111827' }}>{p.name}</div>
                      <div style={{ fontSize:10, color:'#6B7280', marginTop:1 }}>
                        {playersTab === 'partners'
                          ? `${p.games} partie${p.games > 1 ? 's' : ''} ensemble`
                          : `${p.games} confrontation${p.games > 1 ? 's' : ''}`}
                      </div>
                    </div>
                    {playersTab === 'partners' ? (
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'#14532d' }}>{pWinRate}%</div>
                        <div style={{ fontSize:9, color:'#9CA3AF', marginTop:1 }}>victoires</div>
                        <div style={{ width:44, height:4, background:'#E5E7EB', borderRadius:2, overflow:'hidden', marginTop:3 }}>
                          <div style={{ width:`${pWinRate}%`, height:'100%', background:'#14532d', borderRadius:2 }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0 }}>
                        <div style={{ display:'flex', gap:3 }}>
                          <span style={{ fontSize:9, fontWeight:500, padding:'1px 5px', borderRadius:999, background:'#DCFCE7', color:'#166534' }}>{p.wins}V</span>
                          <span style={{ fontSize:9, fontWeight:500, padding:'1px 5px', borderRadius:999, background:'#FEE2E2', color:'#B91C1C' }}>{pLosses}D</span>
                        </div>
                        <div style={{ fontSize:9, color:'#9CA3AF', marginTop:3 }}>
                          {p.wins > pLosses ? 'Avantage' : p.wins === pLosses ? 'Égalité' : 'Défavorable'}
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {/* Sign out */}
        <div style={{ textAlign:'center', paddingTop:4 }}>
          <button onClick={signOut} style={{ fontSize:11, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer' }}>
            Se déconnecter
          </button>
        </div>

      </div>
    </div>
  )
}
