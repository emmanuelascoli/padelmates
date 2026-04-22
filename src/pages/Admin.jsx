import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLES, LEVEL_LABEL, BADGES } from '../lib/constants'
import { format, isPast, formatDistanceToNow } from 'date-fns'
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
          { key: 'organizer', label: 'Organisateurs', color: 'text-forest-800' },
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
                ? 'bg-forest-900 text-white border-forest-700'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Members list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {filtered.map(m => (
            <div key={m.id} className="px-3 py-2.5">
              {/* Ligne identité */}
              <div className="flex items-center gap-2 mb-1.5">
                <Link to={`/players/${m.id}`} className="shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-7 h-7 bg-forest-100 text-forest-800 rounded-full flex items-center justify-center font-bold text-xs">
                      {m.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <Link to={`/players/${m.id}`} className="font-medium text-gray-900 hover:text-forest-800 transition-colors text-sm truncate">
                  {m.name}
                </Link>
                {m.role !== 'member' && <RoleBadge role={m.role} />}
                {m.badges?.length > 0 && (
                  <span className="text-sm" title={m.badges.map(b => BADGES[b]?.label).filter(Boolean).join(', ')}>
                    {m.badges.map(b => BADGES[b]?.emoji).filter(Boolean).join('')}
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto shrink-0">{LEVEL_LABEL[m.level] ?? '—'}</span>
                {m.id !== user?.id && (
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer ce compte"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Ligne contrôles */}
              <div className="flex items-center gap-1.5 flex-wrap pl-9">
                <RoleSelector memberId={m.id} currentRole={m.role ?? 'member'} onChanged={handleRoleChange} />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-10 text-center text-gray-400 text-sm">Aucun membre trouvé</div>
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
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
    if (!error) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'cancelled' } : s))
    } else {
      console.error('Cancel session error:', error.message)
      alert(`Erreur : ${error.message}`)
    }
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
                ? 'bg-forest-900 text-white border-forest-700'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
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
                  <div className="bg-forest-50 rounded-xl p-2 text-center min-w-[44px] shrink-0">
                    <div className="text-xs text-forest-700 font-medium uppercase">{format(date, 'MMM', { locale: fr })}</div>
                    <div className="text-lg font-bold text-forest-900 leading-none">{format(date, 'd')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to={`/sessions/${s.id}`} className="font-semibold text-gray-900 hover:text-forest-800 transition-colors truncate">
                        {s.title}
                      </Link>
                      {s.is_private && <span className="badge bg-purple-100 text-purple-700">🔒 Privée</span>}
                      {s.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
                      {s.status === 'open' && past && <span className="badge bg-gray-100 text-gray-500">Terminée</span>}
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
  const [recentMembers, setRecentMembers] = useState([])
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

    // 8 most recent members
    const { data: newMembers } = await supabase
      .from('profiles')
      .select('id, name, level, avatar_url, role, created_at')
      .order('created_at', { ascending: false })
      .limit(8)
    setRecentMembers(newMembers || [])

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
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
            className="text-xs px-3 py-2 bg-forest-900 hover:bg-forest-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
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
          { label: 'Membres', value: stats?.memberCount ?? 0, icon: '👥', color: 'text-forest-800' },
          { label: 'Parties créées', value: stats?.sessionCount ?? 0, icon: '📅', color: 'text-forest-800' },
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
            { label: '✓ Organisateurs Vérifiés', count: stats?.organizerCount ?? 0, color: 'bg-forest-700', total: stats?.memberCount || 1 },
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
                  <div className="w-8 h-8 bg-forest-100 text-forest-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <Link to={`/players/${p.id}`} className="flex-1 min-w-0 font-medium text-gray-900 hover:text-forest-800 transition-colors truncate text-sm">
                  {p.name}
                </Link>
                <span className="text-sm font-bold text-forest-800 shrink-0">{p.wins}V</span>
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
                  <div className="bg-forest-50 rounded-lg p-1.5 text-center min-w-[36px] shrink-0">
                    <div className="text-xs text-forest-700 font-medium uppercase leading-none">{format(date, 'MMM', { locale: fr })}</div>
                    <div className="text-sm font-bold text-forest-900 leading-none">{format(date, 'd')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400">📍 {s.location}</p>
                  </div>
                  {s.status === 'cancelled' && <span className="badge bg-red-100 text-red-600 text-xs shrink-0">Annulée</span>}
                  {s.status === 'open' && isPast(date) && <span className="badge bg-gray-100 text-gray-500 text-xs shrink-0">Terminée</span>}
                  {s.status === 'open' && !isPast(date) && <span className="badge bg-forest-100 text-forest-800 text-xs shrink-0">Ouverte</span>}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent new members */}
      {recentMembers.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">🆕 Derniers membres inscrits</h3>
          <div className="space-y-2">
            {recentMembers.map(m => (
              <Link
                key={m.id}
                to={`/players/${m.id}`}
                className="flex items-center gap-3 py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                {/* Avatar */}
                {m.avatar_url ? (
                  <img src={m.avatar_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-8 h-8 bg-forest-100 text-forest-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {m.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name + role */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{m.name}</span>
                    {m.role && m.role !== 'member' && <RoleBadge role={m.role} />}
                    {m.level && (
                      <span className="text-xs text-gray-400">{LEVEL_LABEL[m.level] ?? m.level}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.created_at
                      ? formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr })
                      : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab ELO ──────────────────────────────────────────────────
function TabElo() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [matchCount, setMatchCount] = useState(null)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState(null)

  useEffect(() => { fetchRanking() }, [])

  async function fetchRanking() {
    setLoading(true)
    const [{ data: profiles }, { count }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, avatar_url, level, rank_score, role')
        .order('rank_score', { ascending: false }),
      supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .not('winner_team', 'is', null),
    ])
    setPlayers(profiles || [])
    setMatchCount(count ?? 0)
    setLoading(false)
  }

  async function handleRecalculate() {
    setRecalculating(true)
    setRecalcResult(null)
    const { data, error } = await supabase.rpc('recalculate_all_elo')
    if (error) {
      setRecalcResult({ ok: false, msg: error.message })
    } else {
      setRecalcResult({ ok: true, msg: `${data} match${data > 1 ? 's' : ''} traité${data > 1 ? 's' : ''}.` })
      await fetchRanking()
    }
    setRecalculating(false)
  }

  const medalColor = i =>
    i === 0 ? 'text-yellow-400' :
    i === 1 ? 'text-gray-400'   :
    i === 2 ? 'text-orange-400' : 'text-gray-300'

  const medalEmoji = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null

  return (
    <div className="space-y-4">
      {/* Header info + recalculate */}
      <div className="card flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">🏆 Classement ELO — Aperçu Admin</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Départ : <strong>1000</strong> pts · Plancher : <strong>100</strong> pts ·
            {matchCount !== null && <> <strong>{matchCount}</strong> match{matchCount > 1 ? 's' : ''} pris en compte.</>}
          </p>
          <p className="text-xs text-orange-500 mt-0.5">Non visible par les membres pour l'instant.</p>
        </div>
        <div className="shrink-0 text-right">
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="text-xs px-3 py-2 bg-forest-900 hover:bg-forest-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {recalculating ? 'Calcul…' : 'Recalculer'}
          </button>
          {recalcResult && (
            <p className={`text-xs mt-1 ${recalcResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {recalcResult.ok ? '✓' : '✗'} {recalcResult.msg}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Top 3 podium */}
          {players.length >= 3 && (
            <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
              {[players[1], players[0], players[2]].map((p, podiumIdx) => {
                const rankIdx = podiumIdx === 0 ? 1 : podiumIdx === 1 ? 0 : 2
                const heights = ['pt-6 pb-4', 'pt-4 pb-4', 'pt-8 pb-4']
                return (
                  <div
                    key={p.id}
                    className={`bg-white flex flex-col items-center ${heights[podiumIdx]} px-2`}
                  >
                    <div className="text-2xl mb-1">{medalEmoji(rankIdx)}</div>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm
                        ${rankIdx === 0 ? 'bg-yellow-100 text-yellow-700' : rankIdx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-600'}`}>
                        {p.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs font-semibold text-gray-900 mt-1.5 text-center truncate w-full">{p.name}</p>
                    <p className={`text-base font-bold mt-0.5 ${medalColor(rankIdx)}`}>{p.rank_score}</p>
                    <p className="text-xs text-gray-400">pts</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Full ranking list */}
          <div className="divide-y divide-gray-50">
            {players.map((p, i) => (
              <Link
                key={p.id}
                to={`/players/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                {/* Position */}
                <div className="w-7 text-center shrink-0">
                  {medalEmoji(i)
                    ? <span className="text-lg">{medalEmoji(i)}</span>
                    : <span className={`text-sm font-bold ${medalColor(i)}`}>{i + 1}</span>
                  }
                </div>

                {/* Avatar */}
                {p.avatar_url ? (
                  <img src={p.avatar_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <div className="w-9 h-9 bg-forest-100 text-forest-800 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name + level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{p.name}</span>
                    {p.role !== 'member' && <RoleBadge role={p.role} />}
                  </div>
                  {p.level && (
                    <p className="text-xs text-gray-400">{LEVEL_LABEL[p.level] ?? p.level}</p>
                  )}
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <span className={`text-base font-bold ${i < 3 ? medalColor(i) : 'text-gray-700'}`}>
                    {p.rank_score}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">pts</span>
                </div>
              </Link>
            ))}
            {players.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">Aucun joueur</div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card bg-gray-50 border-gray-100 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1.5">⚖️ Points de base (selon l'écart de force)</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Match équilibré (diff 0–49)</span>        <span className="font-medium text-gray-700">±20 pts</span>
            <span>Favori gagne (diff 50–149)</span>          <span className="font-medium text-gray-700">±15 pts</span>
            <span>Favori gagne (diff 150+)</span>            <span className="font-medium text-gray-700">±10 pts</span>
            <span>Outsider gagne (diff 50–149)</span>        <span className="font-medium text-gray-700">±25 pts</span>
            <span>Outsider gagne (diff 150+)</span>          <span className="font-medium text-gray-700">±40 pts</span>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-2">
          <p className="text-xs font-semibold text-gray-700 mb-1.5">🎯 Bonus précision du score</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Très serré — écart 1 jeu (7-6, 6-5)</span>   <span className="font-medium text-red-500">−3 pts</span>
            <span>Standard — écart 2 jeux (6-4)</span>          <span className="font-medium text-gray-400">0 pts</span>
            <span>Dominant — écart 3–4 jeux (6-3, 6-2)</span>   <span className="font-medium text-green-600">+3 pts</span>
            <span>Écrasant — écart ≥ 5 jeux (6-1, 6-0)</span>   <span className="font-medium text-green-700">+6 pts</span>
          </div>
        </div>
      </div>
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
        <div className="w-8 h-8 border-4 border-forest-700 border-t-transparent rounded-full animate-spin" />
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
      <div className="grid grid-cols-4 bg-gray-100 rounded-xl p-1 gap-0.5">
        {[
          { key: 'members',  label: '👥 Membres' },
          { key: 'sessions', label: '📅 Parties' },
          { key: 'stats',    label: '📊 Stats' },
          { key: 'elo',      label: '🏆 ELO' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-2 text-xs font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-forest-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'members'  && <TabMembres />}
      {tab === 'sessions' && <TabParties />}
      {tab === 'stats'    && <TabStats />}
      {tab === 'elo'      && <TabElo />}
    </div>
  )
}
