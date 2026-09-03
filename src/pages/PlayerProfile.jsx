import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_LABEL } from '../lib/constants'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

const IconStar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#52B788" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

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
  const [matchFilter, setMatchFilter] = useState('all')
  const [sessionMap, setSessionMap] = useState({})
  const [friendship, setFriendship] = useState(null)
  const [friendLoading, setFriendLoading] = useState(false)
  const [mutualFriends, setMutualFriends] = useState([])

  const isOwnProfile = user?.id === id

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchProfile(), fetchMatchStats(), fetchSessions(), fetchFriendship(), fetchMutualFriends()])
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

  async function fetchMutualFriends() {
    if (!user || user.id === id) return

    // Appel RPC SECURITY DEFINER — contourne le RLS pour lire les deux côtés
    const { data } = await supabase.rpc('get_mutual_friends', {
      viewer_id: user.id,
      target_id: id,
    })

    setMutualFriends(data || [])
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

    const enriched = matches.slice(0, 15).map(m => ({
      ...m,
      t1p1_name: nameMap[m.team1_player1] || '?',
      t1p2_name: nameMap[m.team1_player2] || '?',
      t2p1_name: nameMap[m.team2_player1] || '?',
      t2p2_name: nameMap[m.team2_player2] || '?',
    }))
    setRecentMatches(enriched)

    // Fetch session details for grouping
    const sessionIds = [...new Set(enriched.map(m => m.session_id).filter(Boolean))]
    if (sessionIds.length > 0) {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, date, time, location')
        .in('id', sessionIds)
      setSessionMap(Object.fromEntries((sessions || []).map(s => [s.id, s])))
    }
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
      .sort((a, b) => {
        const da = new Date(`${a.date}T${a.time}`)
        const db = new Date(`${b.date}T${b.time}`)
        return db - da
      })

    setRecentSessions(sessions) // Keep all for display (cancelled shown with badge)
    setStats(s => ({ ...s, sessionCount: sessions.filter(s => s.status !== 'cancelled').length }))
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-forest-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!profile) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Joueur introuvable.</p>
      <Link to="/leaderboard" className="text-forest-700 hover:underline mt-2 inline-block">← Classement</Link>
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

      {/* ── Header joueur ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1B4332 0%, #2D6A4F 100%)' }}
      >
        {/* Top section: avatar + info */}
        <div className="flex items-start gap-4 px-5 pt-6 pb-5">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                style={{ width: 80, height: 80, borderRadius: 22, objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }}
              />
            ) : (
              <div
                className="flex items-center justify-center"
                style={{ width: 80, height: 80, borderRadius: 22, background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.15)' }}
              >
                <span style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>
                  {profile.name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-white font-bold text-xl leading-tight truncate">{profile.name}</h1>
            {profile.level && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>
                {LEVEL_LABEL[profile.level]}
              </p>
            )}

            {/* ELO badge */}
            {profile.rank_score > 0 && (
              <div
                className="inline-flex items-center gap-1.5 mt-2.5"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  padding: '5px 12px',
                }}
              >
                <IconStar />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{profile.rank_score}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>ELO</span>
              </div>
            )}

            {/* Main + position pills */}
            {(profile.dominant_hand || profile.court_side) && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {profile.dominant_hand && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
                    borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                    fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap',
                  }}>
                    🖐 Main {profile.dominant_hand}
                  </span>
                )}
                {profile.court_side && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px',
                    borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                    fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap',
                  }}>
                    {profile.court_side === 'gauche' ? '◀' : profile.court_side === 'droite' ? '▶' : '↔'}{' '}
                    {profile.court_side === 'les_deux' ? 'Les deux côtés' : `Côté ${profile.court_side}`}
                  </span>
                )}
              </div>
            )}

            {/* Amis en commun */}
            {mutualFriends.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <div style={{ display: 'flex' }}>
                  {mutualFriends.slice(0, 3).map((f, i) => (
                    f.avatar_url ? (
                      <img
                        key={f.id} src={f.avatar_url} alt=""
                        style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '2px solid #1B4332', marginRight: i < 2 ? -6 : 0, position: 'relative', zIndex: 3 - i }}
                      />
                    ) : (
                      <div
                        key={f.id}
                        style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2px solid #1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', marginRight: i < 2 ? -6 : 0, position: 'relative', zIndex: 3 - i }}
                      >
                        {f.name?.charAt(0).toUpperCase()}
                      </div>
                    )
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', paddingLeft: 4 }}>
                  {mutualFriends.length} ami{mutualFriends.length > 1 ? 's' : ''} en commun
                </span>
              </div>
            )}

          </div>
        </div>

        {/* Friend / own-profile actions */}
        <div className="px-5 pb-5">
          {isOwnProfile && (
            <Link
              to="/profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
              }}
            >
              Modifier mon profil →
            </Link>
          )}
          {!isOwnProfile && (
            <div className="flex items-center gap-2">
              {!friendship && (
                <button
                  onClick={handleAddFriend}
                  disabled={friendLoading}
                  className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {friendLoading ? '...' : '+ Ajouter comme ami'}
                </button>
              )}
              {friendship?.status === 'pending' && friendship.requester_id === user?.id && (
                <>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Demande envoyée</span>
                  <button onClick={handleRemoveFriend} disabled={friendLoading} className="text-xs text-red-300 hover:text-red-200">
                    Annuler
                  </button>
                </>
              )}
              {friendship?.status === 'pending' && friendship.addressee_id === user?.id && (
                <>
                  <button
                    onClick={handleAcceptFriend}
                    disabled={friendLoading}
                    className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    {friendLoading ? '...' : '✓ Accepter'}
                  </button>
                  <button onClick={handleRemoveFriend} disabled={friendLoading} className="text-xs text-red-300 hover:text-red-200">
                    Refuser
                  </button>
                </>
              )}
              {friendship?.status === 'accepted' && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>✓ Amis</span>
                  <button onClick={handleRemoveFriend} disabled={friendLoading} className="text-xs text-red-300 hover:text-red-200 ml-2">
                    Retirer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats band ── */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Parties',   value: stats.sessionCount },
            { label: 'Matchs',    value: stats.matchCount },
            { label: 'Victoires', value: stats.wins },
            { label: 'Win%',      value: `${winRate}%` },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: '16px 0',
                textAlign: 'center',
                borderRight: i < 3 ? '1px solid rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0D1F14', lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
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
              tab === key ? 'bg-white text-forest-900 shadow-sm' : 'text-gray-500'
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
                      <div className="w-10 h-10 bg-forest-100 rounded-full flex items-center justify-center font-bold text-forest-800 text-sm shrink-0">
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
                        <span className="text-forest-700">{opp.wins}V</span>
                        {' · '}
                        <span className="text-red-500">{opp.losses}D</span>
                      </p>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${oppWinRate >= 50 ? 'bg-forest-700' : 'bg-red-400'}`}
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

      {/* Tab Matchs — groupés par session */}
      {tab === 'matches' && (() => {
        if (recentMatches.length === 0) return (
          <div className="card text-center py-10 text-gray-400">
            <div className="text-4xl mb-2">🎾</div>
            <p>Aucun match enregistré</p>
          </div>
        )

        // Helpers relation viewer / viewed player
        const userInMatch = (m) => !!user && [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].includes(user.id)
        const isTeammateMatch = (m) => {
          if (!user || !userInMatch(m)) return false
          const viewedT1 = m.team1_player1 === id || m.team1_player2 === id
          const userT1   = m.team1_player1 === user.id || m.team1_player2 === user.id
          return viewedT1 === userT1
        }

        const teammateCount = recentMatches.filter(m => isTeammateMatch(m)).length
        const opponentCount = recentMatches.filter(m => userInMatch(m) && !isTeammateMatch(m)).length

        // Stats viewer vs viewed
        const sharedMatches = recentMatches.filter(m => userInMatch(m))
        const sharedWins = sharedMatches.filter(m => {
          const uT1 = m.team1_player1 === user?.id || m.team1_player2 === user?.id
          return (uT1 && m.winner_team === 1) || (!uT1 && m.winner_team === 2)
        }).length
        const sharedLosses = sharedMatches.length - sharedWins
        const sharedWinRate = sharedMatches.length > 0 ? Math.round(sharedWins / sharedMatches.length * 100) : 0

        // Filter
        const filtered = recentMatches.filter(m => {
          if (matchFilter === 'teammate') return isTeammateMatch(m)
          if (matchFilter === 'opponent') return userInMatch(m) && !isTeammateMatch(m)
          return true
        })

        // Group by session
        const groups = {}
        filtered.forEach(m => {
          const sid = m.session_id || 'no-session'
          if (!groups[sid]) groups[sid] = []
          groups[sid].push(m)
        })
        const sortedSids = Object.keys(groups).sort((a, b) => {
          const sa = sessionMap[a], sb = sessionMap[b]
          if (!sa || !sb) return 0
          return new Date(`${sb.date}T${sb.time}`) - new Date(`${sa.date}T${sa.time}`)
        })

        // Render name with highlight
        const renderName = (name, playerId, align = 'left') => {
          const isViewed = playerId === id
          const isViewer = playerId === user?.id
          return (
            <span key={playerId} style={{
              display: 'block', lineHeight: 1.4, fontSize: 12,
              fontWeight: isViewed ? 700 : 500,
              color: isViewed ? '#14532d' : '#374151',
              textAlign: align,
            }}>
              {name}{isViewer && !isViewed ? ' (vous)' : ''}
            </span>
          )
        }

        return (
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'all',      label: `Tous (${recentMatches.length})` },
                { key: 'teammate', label: `Coéquipier (${teammateCount})` },
                { key: 'opponent', label: `Adversaire (${opponentCount})` },
              ].map(f => (
                <button key={f.key} onClick={() => setMatchFilter(f.key)} style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '5px 11px', borderRadius: 20, cursor: 'pointer',
                  border: matchFilter === f.key ? 'none' : '1px solid #E5E7EB',
                  background: matchFilter === f.key ? '#14532d' : '#fff',
                  color: matchFilter === f.key ? '#fff' : '#6B7280',
                  whiteSpace: 'nowrap',
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Stats partagées */}
            {user && sharedMatches.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[
                  { val: `${sharedWins}V`,       color: '#16A34A', lbl: 'Victoires' },
                  { val: `${sharedLosses}D`,      color: '#EF4444', lbl: 'Défaites' },
                  { val: `${sharedWinRate}%`,     color: '#111827', lbl: 'Win rate' },
                ].map(s => (
                  <div key={s.lbl} style={{ flex: 1, background: '#fff', borderRadius: 10, border: '0.5px solid #E5E7EB', padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            )}

            {filtered.length === 0 && (
              <div className="card text-center py-8 text-gray-400 text-sm">Aucun match pour ce filtre</div>
            )}

            {/* Groupes par session */}
            {sortedSids.map(sid => {
              const session = sessionMap[sid]
              const sessionDt = session ? new Date(`${session.date}T${session.time}`) : null

              return (
                <div key={sid} style={{ marginBottom: 10 }}>
                  {/* Header session */}
                  {session && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 6px' }}>
                      <span style={{ background: '#14532d', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                        {format(sessionDt, 'EEE d MMM', { locale: fr })}
                      </span>
                      <span style={{ fontSize: 11, color: '#6B7280', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {session.location} · {format(sessionDt, 'HH:mm')}
                      </span>
                      <Link to={`/sessions/${sid}`} style={{ flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </Link>
                    </div>
                  )}

                  {/* Match cards */}
                  {groups[sid].map(m => {
                    const isViewedT1 = m.team1_player1 === id || m.team1_player2 === id
                    const viewedWon = (isViewedT1 && m.winner_team === 1) || (!isViewedT1 && m.winner_team === 2)
                    const t1Won = m.winner_team === 1

                    return (
                      <div key={m.id} style={{
                        background: '#fff', borderRadius: 13,
                        border: '0.5px solid #E5E7EB',
                        borderLeft: `3px solid ${viewedWon ? '#16A34A' : '#EF4444'}`,
                        padding: '11px 12px', marginBottom: 6,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {/* Équipe 1 */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, color: t1Won ? '#16A34A' : '#9CA3AF' }}>
                              {t1Won ? 'Victoire' : 'Défaite'}
                            </div>
                            {renderName(m.t1p1_name, m.team1_player1)}
                            {m.team1_player2 && renderName(m.t1p2_name, m.team1_player2)}
                          </div>
                          {/* Score */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '0 4px' }}>
                            <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: t1Won ? '#16A34A' : '#9CA3AF' }}>{m.team1_score}</span>
                            <span style={{ fontSize: 13, color: '#D1D5DB' }}>—</span>
                            <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1, color: !t1Won ? '#16A34A' : '#9CA3AF' }}>{m.team2_score}</span>
                          </div>
                          {/* Équipe 2 */}
                          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, color: !t1Won ? '#16A34A' : '#9CA3AF', textAlign: 'right' }}>
                              {!t1Won ? 'Victoire' : 'Défaite'}
                            </div>
                            {renderName(m.t2p1_name, m.team2_player1, 'right')}
                            {m.team2_player2 && renderName(m.t2p2_name, m.team2_player2, 'right')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}

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
                    <div className="bg-forest-50 rounded-xl p-2 text-center min-w-[44px] shrink-0">
                      <div className="text-xs text-forest-700 font-medium">{format(date, 'MMM', { locale: fr })}</div>
                      <div className="text-lg font-bold text-forest-900 leading-none">{format(date, 'd')}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{s.title}</p>
                      <p className="text-sm text-gray-400">📍 {s.location} · {format(date, 'HH:mm')}</p>
                    </div>
                    {s.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
                    {past && s.status !== 'cancelled' && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
                    {!past && s.status === 'open' && <span className="badge bg-forest-100 text-forest-800">À venir</span>}
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
