import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, LEVEL_LABEL, BADGES } from '../lib/constants'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Role Badge ───────────────────────────────────────────────
function RoleBadge({ role }) {
  const r = ROLES[role] ?? ROLES.member
  if (!r.badge && role === 'member') return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${r.color} ${r.border}`}>
      {r.badge && <span>{r.badge}</span>}
      {r.label}
    </span>
  )
}

// ── Role Selector ────────────────────────────────────────────
function RoleSelector({ memberId, currentRole, onChanged }) {
  const [loading, setLoading] = useState(false)

  async function setRole(newRole) {
    if (newRole === currentRole) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', memberId)
    if (!error) onChanged(memberId, newRole)
    setLoading(false)
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {Object.entries(ROLES).map(([key, r]) => (
        <button
          key={key}
          disabled={loading || currentRole === key}
          onClick={() => setRole(key)}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
            currentRole === key
              ? `${r.color} ${r.border} cursor-default`
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
          }`}
        >
          {r.badge ? `${r.badge} ` : ''}{r.label}
        </button>
      ))}
    </div>
  )
}

// ── Verified organizer badge toggle ─────────────────────────
function VerifiedBadgeToggle({ memberId, currentBadges, onChanged }) {
  const hasIt = (currentBadges || []).includes('verified_organizer')
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const { error } = await supabase.rpc('admin_toggle_verified_organizer', {
      uid: memberId,
      grant_badge: !hasIt,
    })
    if (!error) {
      const next = hasIt
        ? (currentBadges || []).filter(b => b !== 'verified_organizer')
        : [...(currentBadges || []), 'verified_organizer']
      onChanged(memberId, next)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50 ${
        hasIt
          ? 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
      }`}
    >
      <span>{BADGES.verified_organizer.emoji}</span>
      {hasIt ? 'Retirer Organisateur Vérifié' : 'Attribuer Organisateur Vérifié'}
    </button>
  )
}

// ── Delete user modal ────────────────────────────────────────
function DeleteUserModal({ member, onConfirm, onCancel }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const confirmed = input.trim().toLowerCase() === member.name?.trim().toLowerCase()

  async function handleDelete() {
    if (!confirmed) return
    setLoading(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('admin_delete_user', { target_uid: member.id })
    if (rpcError) { setError(rpcError.message); setLoading(false); return }
    onConfirm(member.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div>
          <p className="font-bold text-red-700 text-lg">⚠️ Supprimer un compte</p>
          <p className="text-sm text-gray-600 mt-1">
            Tu es sur le point de supprimer définitivement le compte de{' '}
            <strong>{member.name}</strong>. Cette action est <strong>irréversible</strong> :
            profil, inscriptions, historique de matchs et amis seront supprimés.
            Les parties qu'il a organisées seront annulées.
          </p>
        </div>

        <div>
          <label className="text-xs text-red-700 font-medium block mb-1">
            Pour confirmer, tape le nom du membre : <strong>{member.name}</strong>
          </label>
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            className="input bg-white border-red-200 text-sm"
            placeholder={member.name}
            autoComplete="off"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleDelete}
            disabled={!confirmed || loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab Membres ──────────────────────────────────────────────
function TabMembres() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, level, avatar_url, role, phone, badges')
      .order('name', { ascending: true })
    setMembers(data || [])
    setLoading(false)
  }

  function handleRoleChange(memberId, newRole) {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
  }

  function handleBadgesChange(memberId, newBadges) {
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, badges: newBadges } : m))
  }

  function handleDeleted(memberId) {
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setDeleteTarget(null)
  }

  const filtered = members.filter(m => {
    if (!m.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    return true
  })

  const counts = {
    all: members.length,
    admin: members.filter(m => m.role === 'admin').length,
    organizer: members.filter(m => m.role === 'organizer').length,
    member: members.filter(m => m.role === 'member' || !m.role).length,
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'admin', label: 'Admins', color: 'text-purple-700' },
          { key: 'organizer', label: 'Organisateurs', color: 'text-blue-700' },
          { key: 'member', label: 'Membres', color: 'text-gray-700' },
        ].map(s => (
          <div key={s.key} className="card text-center py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{counts[s.key]}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un membre…" className="input pl-9" />
      </div>

      {/* Role filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: `Tous (${counts.all})` },
          { key: 'admin', label: `👑 Admins (${counts.admin})` },
          { key: 'organizer', label: `✓ Organisateurs (${counts.organizer})` },
          { key: 'member', label: `Membres (${counts.member})` },
        ].map(f => (
          <button key={f.key} onClick={() => setRoleFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              roleFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.id} className="card space-y-3">
              {/* Header row */}
              <div className="flex items-center gap-3">
                <Link to={`/players/${m.id}`} className="shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {m.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/players/${m.id}`} className="font-medium text-gray-900 hover:text-blue-700 transition-colors">
                      {m.name}
                    </Link>
                    {m.role !== 'member' && <RoleBadge role={m.role} />}
                    {m.id === user?.id && (
                      <span className="text-xs text-gray-400 italic">(vous)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{LEVEL_LABEL[m.level] ?? '—'}</p>
                </div>
                {/* Supprimer — désactivé pour son propre compte */}
                {m.id !== user?.id && (
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer ce compte"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Role selector */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Rôle :</p>
                <RoleSelector
                  memberId={m.id}
                  currentRole={m.role ?? 'member'}
                  onChanged={handleRoleChange}
                />
              </div>

              {/* Badge Organisateur Vérifié */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Badge :</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <VerifiedBadgeToggle
                    memberId={m.id}
                    currentBadges={m.badges}
                    onChanged={handleBadgesChange}
                  />
                  {m.badges?.length > 0 && (
                    <span className="text-xs text-gray-400">
                      Badges actifs : {m.badges.map(b => `${BADGES[b]?.emoji} ${BADGES[b]?.label}`).filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card text-center py-10 text-gray-400">Aucun membre trouvé</div>
          )}
        </div>
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <DeleteUserModal
          member={deleteTarget}
          onConfirm={handleDeleted}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ── Tab Parties ──────────────────────────────────────────────
function TabParties() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming')
  const [actionLoading, setActionLoading] = useState(null)
  const [confirmCancelId, setConfirmCancelId] = useState(null)

  useEffect(() => { fetchSessions() }, [])

  async function fetchSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('*, organizer:profiles!sessions_organizer_id_fkey(id, name), _count:session_participants(count)')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  async function handleCancelSession(sessionId) {
    setConfirmCancelId(null)
    setActionLoading(sessionId)
    await supabase.from('sessions').update({ status: 'cancelled' }).eq('id', sessionId)
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'cancelled' } : s))
    setActionLoading(null)
  }

  async function handleReopenSession(sessionId) {
    setActionLoading(sessionId)
    await supabase.from('sessions').update({ status: 'open' }).eq('id', sessionId)
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'open' } : s))
    setActionLoading(null)
  }

  const now = new Date()
  const filtered = sessions.filter(s => {
    const sessionDate = new Date(`${s.date}T${s.time}`)
    if (filter === 'upcoming') return sessionDate >= now && s.status !== 'cancelled'
    if (filter === 'past') return sessionDate < now
    if (filter === 'cancelled') return s.status === 'cancelled'
    return true
  })

  const counts = {
    upcoming: sessions.filter(s => new Date(`${s.date}T${s.time}`) >= now && s.status !== 'cancelled').length,
    past: sessions.filter(s => new Date(`${s.date}T${s.time}`) < now).length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
    all: sessions.length,
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'upcoming', label: `À venir (${counts.upcoming})` },
          { key: 'past', label: `Passées (${counts.past})` },
          { key: 'cancelled', label: `Annulées (${counts.cancelled})` },
          { key: 'all', label: `Toutes (${counts.all})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              filter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">Aucune partie</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const date = new Date(`${s.date}T${s.time}`)
            const past = isPast(date)
            return (
              <div key={s.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-50 rounded-xl p-2 text-center min-w-[44px] shrink-0">
                    <div className="text-xs text-blue-600 font-medium uppercase">{format(date, 'MMM', { locale: fr })}</div>
                    <div className="text-lg font-bold text-blue-800 leading-none">{format(date, 'd')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/sessions/${s.id}`} className="font-semibold text-gray-900 hover:text-blue-700 transition-colors truncate">
                        {s.title}
                      </Link>
                      {s.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
                      {s.status === 'open' && past && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
                      {s.status === 'open' && !past && <span className="badge bg-blue-100 text-blue-700">Ouverte</span>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">📍 {s.location} · {format(date, 'HH:mm')}</p>
                    <p className="text-xs text-gray-400">👤 {s.organizer?.name}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {s.status !== 'cancelled' && !past && confirmCancelId !== s.id && (
                      <button
                        onClick={() => setConfirmCancelId(s.id)}
                        disabled={actionLoading === s.id}
                        className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === s.id ? '…' : 'Annuler'}
                      </button>
                    )}
                    {s.status !== 'cancelled' && !past && confirmCancelId === s.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleCancelSession(s.id)}
                          disabled={actionLoading === s.id}
                          className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-50"
                        >
                          {actionLoading === s.id ? '…' : 'Confirmer'}
                        </button>
                        <button
                          onClick={() => setConfirmCancelId(null)}
                          className="text-xs px-2 py-1 bg-white text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          Non
                        </button>
                      </div>
                    )}
                    {s.status === 'cancelled' && (
                      <button
                        onClick={() => handleReopenSession(s.id)}
                        disabled={actionLoading === s.id}
                        className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === s.id ? '…' : 'Réouvrir'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab Statistiques ─────────────────────────────────────────
function TabStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [topPlayers, setTopPlayers] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)

  async function handleRefreshAllBadges() {
    setRefreshing(true)
    setRefreshResult(null)
    const { data, error } = await supabase.rpc('admin_refresh_all_badges')
    if (error) setRefreshResult({ ok: false, msg: error.message })
    else setRefreshResult({ ok: true, msg: `${data} profils mis à jour.` })
    setRefreshing(false)
  }

  useEffect(() => { fetchStats() }, [])

  async function fetchStats() {
    setLoading(true)

    // Total members
    const { count: memberCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Total sessions
    const { count: sessionCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })

    // Open (upcoming) sessions
    const { count: openCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .gte('date', new Date().toISOString().split('T')[0])

    // Total matches
    const { count: matchCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })

    // Admin & organizer counts
    const { count: adminCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')

    const { count: organizerCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'organizer')

    setStats({ memberCount, sessionCount, openCount, matchCount, adminCount, organizerCount })

    // Top players (by wins) — valid_matches excludes cancelled sessions
    const { data: matches } = await supabase.from('valid_matches').select('*').not('winner_team', 'is', null)
    if (matches?.length) {
      const winsMap = {}
      const gamesMap = {}
      matches.forEach(m => {
        const players = [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].filter(Boolean)
        players.forEach(pid => {
          gamesMap[pid] = (gamesMap[pid] || 0) + 1
        })
        const winners = m.winner_team === 1
          ? [m.team1_player1, m.team1_player2]
          : [m.team2_player1, m.team2_player2]
        winners.filter(Boolean).forEach(pid => {
          winsMap[pid] = (winsMap[pid] || 0) + 1
        })
      })

      const sorted = Object.entries(winsMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

      if (sorted.length) {
        const playerIds = sorted.map(([id]) => id)
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', playerIds)
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setTopPlayers(sorted.map(([id, wins]) => ({
          ...profileMap[id],
          wins,
          games: gamesMap[id] || 0,
          rate: Math.round((wins / (gamesMap[id] || 1)) * 100),
        })))
      }
    }

    // 5 most recent sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, title, date, time, location, status')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(5)
    setRecentSessions(sessions || [])

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Recalculate badges */}
      <div className="card flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900 text-sm">🏅 Recalculer tous les badges</p>
          <p className="text-xs text-gray-400 mt-0.5">À faire après un import de données ou en fin de mois pour mettre à jour "En forme".</p>
        </div>
        <div className="shrink-0 text-right">
          <button
            onClick={handleRefreshAllBadges}
            disabled={refreshing}
            className="text-xs px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {refreshing ? 'En cours…' : 'Recalculer'}
          </button>
          {refreshResult && (
            <p className={`text-xs mt-1 ${refreshResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {refreshResult.ok ? '✓' : '✗'} {refreshResult.msg}
            </p>
          )}
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Membres', value: stats?.memberCount ?? 0, icon: '👥', color: 'text-blue-700' },
          { label: 'Parties créées', value: stats?.sessionCount ?? 0, icon: '📅', color: 'text-indigo-700' },
          { label: 'Parties à venir', value: stats?.openCount ?? 0, icon: '🟢', color: 'text-green-700' },
          { label: 'Matchs joués', value: stats?.matchCount ?? 0, icon: '🎾', color: 'text-orange-700' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Role distribution */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Répartition des rôles</h3>
        <div className="space-y-2">
          {[
            { label: '👑 Administrateurs', count: stats?.adminCount ?? 0, color: 'bg-purple-500', total: stats?.memberCount || 1 },
            { label: '✓ Organisateurs Vérifiés', count: stats?.organizerCount ?? 0, color: 'bg-blue-500', total: stats?.memberCount || 1 },
            { label: '● Membres', count: (stats?.memberCount ?? 0) - (stats?.adminCount ?? 0) - (stats?.organizerCount ?? 0), color: 'bg-gray-400', total: stats?.memberCount || 1 },
          ].map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span className="font-medium">{r.label}</span>
                <span>{r.count}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`${r.color} h-2 rounded-full transition-all`}
                  style={{ width: `${Math.round((r.count / r.total) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top players */}
      {topPlayers.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">🏆 Top 5 joueurs (victoires)</h3>
          <div className="space-y-2">
            {topPlayers.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-5 text-center shrink-0 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                  {i + 1}
                </span>
                {p.avatar_url ? (
                  <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <Link to={`/players/${p.id}`} className="flex-1 min-w-0 font-medium text-gray-900 hover:text-blue-700 transition-colors truncate text-sm">
                  {p.name}
                </Link>
                <span className="text-sm font-bold text-blue-700 shrink-0">{p.wins}V</span>
                <span className="text-xs text-gray-400 shrink-0">{p.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Dernières parties créées</h3>
          <div className="space-y-1.5">
            {recentSessions.map(s => {
              const date = new Date(`${s.date}T${s.time}`)
              return (
                <Link key={s.id} to={`/sessions/${s.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="bg-blue-50 rounded-lg p-1.5 text-center min-w-[36px] shrink-0">
                    <div className="text-xs text-blue-600 font-medium uppercase leading-none">{format(date, 'MMM', { locale: fr })}</div>
                    <div className="text-sm font-bold text-blue-800 leading-none">{format(date, 'd')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400">📍 {s.location}</p>
                  </div>
                  {s.status === 'cancelled' && <span className="badge bg-red-100 text-red-600 text-xs shrink-0">Annulée</span>}
                  {s.status === 'open' && isPast(date) && <span className="badge bg-gray-100 text-gray-500 text-xs shrink-0">Terminée</span>}
                  {s.status === 'open' && !isPast(date) && <span className="badge bg-blue-100 text-blue-700 text-xs shrink-0">Ouverte</span>}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Admin Page ──────────────────────────────────────────
export default function Admin() {
  const { isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('members')

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/', { replace: true })
  }, [isAdmin, authLoading, navigate])

  if (authLoading || !isAdmin) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            👑 Administration
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion du groupe PadelMates</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'members', label: '👥 Membres' },
          { key: 'sessions', label: '📅 Parties' },
          { key: 'stats', label: '📊 Statistiques' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'members'  && <TabMembres />}
      {tab === 'sessions' && <TabParties />}
      {tab === 'stats'    && <TabStats />}
    </div>
  )
}
