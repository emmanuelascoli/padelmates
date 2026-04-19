import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { LEVEL_OPTIONS, LEVEL_LABEL, ROLES } from '../lib/constants'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import PasswordInput from '../components/PasswordInput'
import { BadgeList } from '../components/BadgeList'

// ── Composant section Amis ────────────────────────────────────
function FriendsSection({ userId }) {
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { fetchFriends() }, [])

  async function fetchFriends() {
    setLoading(true)
    const { data: fs } = await supabase
      .from('friendships')
      .select('*, requester:profiles!friendships_requester_id_fkey(id, name, level, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, name, level, avatar_url)')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    const accepted = []
    const pending = []

    ;(fs || []).forEach(f => {
      const other = f.requester_id === userId ? f.addressee : f.requester
      if (f.status === 'accepted') accepted.push({ ...other, friendshipId: f.id })
      if (f.status === 'pending' && f.addressee_id === userId) pending.push({ ...other, friendshipId: f.id })
    })

    setFriends(accepted)
    setIncoming(pending)
    setLoading(false)
  }

  async function handleAccept(friendshipId) {
    setActionLoading(friendshipId)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    await fetchFriends()
    setActionLoading(null)
  }

  async function handleRemove(friendshipId) {
    setActionLoading(friendshipId)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await fetchFriends()
    setActionLoading(null)
  }

  const Avatar = ({ p, size = 'w-10 h-10', bg = 'bg-blue-100 text-blue-700' }) => (
    p.avatar_url
      ? <img src={p.avatar_url} className={`${size} rounded-full object-cover shrink-0`} alt="" />
      : <div className={`${size} ${bg} rounded-full flex items-center justify-center font-bold text-sm shrink-0`}>{p.name?.charAt(0).toUpperCase()}</div>
  )

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Demandes reçues */}
      {incoming.length > 0 && (
        <div className="card border-red-100 bg-red-50">
          <h3 className="text-sm font-semibold text-red-700 mb-3">
            🔔 {incoming.length} demande{incoming.length > 1 ? 's' : ''} reçue{incoming.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {incoming.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2">
                <Avatar p={p} bg="bg-red-100 text-red-600" />
                <Link to={`/players/${p.id}`} className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400">{LEVEL_LABEL[p.level] ?? '—'}</p>
                </Link>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleAccept(p.friendshipId)}
                    disabled={actionLoading === p.friendshipId}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionLoading === p.friendshipId ? '…' : 'Accepter'}
                  </button>
                  <button
                    onClick={() => handleRemove(p.friendshipId)}
                    disabled={actionLoading === p.friendshipId}
                    className="px-2 py-1.5 border border-gray-200 text-gray-400 hover:text-red-500 text-xs rounded-lg transition-colors"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des amis */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">
          Mes amis ({friends.length})
        </h3>
        {friends.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm">Aucun ami pour l'instant</p>
            <Link to="/members" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
              Parcourir les membres →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <Avatar p={p} />
                <Link to={`/players/${p.id}`} className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                  <p className="text-xs text-gray-400">{LEVEL_LABEL[p.level] ?? '—'}</p>
                </Link>
                <button
                  onClick={() => handleRemove(p.friendshipId)}
                  disabled={actionLoading === p.friendshipId}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors shrink-0"
                  title="Retirer des amis"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Suppression de compte ─────────────────────────────────────
function DeleteAccountSection({ userEmail, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const confirmed = confirmInput.trim().toLowerCase() === (userEmail ?? '').toLowerCase()

  async function handleDelete() {
    if (!confirmed) return
    setLoading(true)
    setError('')
    try {
      const { error: rpcError } = await supabase.rpc('delete_own_account')
      if (rpcError) throw rpcError
      onDeleted()
    } catch (e) {
      setError(e.message ?? 'Une erreur est survenue.')
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <div className="card border-red-100">
        <button
          onClick={() => setOpen(true)}
          className="w-full text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
        >
          Supprimer mon compte
        </button>
      </div>
    )
  }

  return (
    <div className="card border-red-200 bg-red-50 space-y-4">
      <div>
        <p className="font-semibold text-red-800">⚠️ Supprimer mon compte</p>
        <p className="text-sm text-red-700 mt-1">
          Cette action est <strong>irréversible</strong>. Toutes tes données seront supprimées : profil, inscriptions, historique de matchs, amis.
        </p>
      </div>

      <div>
        <label className="text-xs text-red-700 font-medium block mb-1">
          Pour confirmer, entre ton adresse email : <strong>{userEmail}</strong>
        </label>
        <input
          type="email"
          value={confirmInput}
          onChange={e => { setConfirmInput(e.target.value); setError('') }}
          className="input bg-white border-red-200 text-sm"
          placeholder={userEmail}
          autoComplete="off"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-100 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setConfirmInput(''); setError('') }}
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
  )
}

export default function Profile() {
  const { user, profile, refreshProfile, signOut, role } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', revolut_tag: '', level: '3' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ wins: 0, losses: 0, sessions: 0 })
  const [history, setHistory] = useState([])
  const [historyMatches, setHistoryMatches] = useState({})
  const [tab, setTab] = useState('info')
  const [pendingFriendCount, setPendingFriendCount] = useState(0)

  // Photo
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || '',
        revolut_tag: profile.revolut_tag || '',
        level: profile.level || '3',
      })
    }
    if (user) { fetchStats(); fetchHistory(); fetchPendingFriendCount() }
  }, [profile, user])

  async function fetchPendingFriendCount() {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
    setPendingFriendCount(count || 0)
  }

  async function fetchStats() {
    // Session count: exclude cancelled sessions
    const { data: parts } = await supabase
      .from('session_participants')
      .select('sessions!inner(status)')
      .eq('user_id', user.id)
    const sessionCount = (parts || []).filter(p => p.sessions?.status !== 'cancelled').length

    // Matches from non-cancelled sessions only (via valid_matches view)
    const { data: matches } = await supabase
      .from('valid_matches')
      .select('*')
      .or(`team1_player1.eq.${user.id},team1_player2.eq.${user.id},team2_player1.eq.${user.id},team2_player2.eq.${user.id}`)
      .not('winner_team', 'is', null)

    let wins = 0, losses = 0
    ;(matches || []).forEach(m => {
      const isTeam1 = m.team1_player1 === user.id || m.team1_player2 === user.id
      if ((isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2)) wins++
      else losses++
    })
    setStats({ wins, losses, sessions: sessionCount || 0 })
  }

  async function fetchHistory() {
    // Sessions participées
    const { data: parts } = await supabase
      .from('session_participants')
      .select('*, sessions(id, date, time, location, title, status, max_players)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(20)

    const sessions = (parts || []).filter(p => p.sessions).map(p => p.sessions)
    setHistory(sessions)

    if (!sessions.length) return

    // Matchs joués dans ces sessions
    const sessionIds = sessions.map(s => s.id)
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .in('session_id', sessionIds)
      .or(`team1_player1.eq.${user.id},team1_player2.eq.${user.id},team2_player1.eq.${user.id},team2_player2.eq.${user.id}`)
      .not('winner_team', 'is', null)

    if (!matches?.length) return

    // Récupérer les noms des joueurs
    const playerIds = [...new Set(matches.flatMap(m =>
      [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].filter(Boolean)
    ))]
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', playerIds)
    const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]))

    // Grouper par session
    const bySession = {}
    matches.forEach(m => {
      if (!bySession[m.session_id]) bySession[m.session_id] = []
      const isTeam1 = m.team1_player1 === user.id || m.team1_player2 === user.id
      const won = (isTeam1 && m.winner_team === 1) || (!isTeam1 && m.winner_team === 2)
      bySession[m.session_id].push({
        ...m,
        won,
        t1: [nameMap[m.team1_player1], nameMap[m.team1_player2]].filter(Boolean).join(' & '),
        t2: [nameMap[m.team2_player1], nameMap[m.team2_player2]].filter(Boolean).join(' & '),
      })
    })
    setHistoryMatches(bySession)
  }

  // ── Profile save ──────────────────────────────────────────────
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setSaved(false); setError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est requis.'); return }
    setLoading(true); setError('')

    if (!profile) {
      // Créer le profil s'il n'existe pas encore
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        revolut_tag: form.revolut_tag.trim().replace(/^@/, '') || null,
        level: form.level,
      })
      if (insertError) { setError(insertError.message); setLoading(false); return }
    } else {
      const { error: updateError } = await supabase.from('profiles').update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        revolut_tag: form.revolut_tag.trim().replace(/^@/, '') || null,
        level: form.level,
      }).eq('id', user.id)
      if (updateError) { setError(updateError.message); setLoading(false); return }
    }

    setSaved(true)
    await refreshProfile()
    setLoading(false)
  }

  // ── Photo upload ──────────────────────────────────────────────
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Veuillez sélectionner une image (JPG, PNG…)'); return
    }
    if (file.size > 3 * 1024 * 1024) {
      setPhotoError("L'image doit faire moins de 3 MB"); return
    }
    setPhotoLoading(true); setPhotoError('')

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setPhotoError('Erreur upload : ' + uploadError.message)
      setPhotoLoading(false); return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    await refreshProfile()
    setPhotoLoading(false)
  }

  // ── Password change ───────────────────────────────────────────
  const handlePwChange = async (e) => {
    e.preventDefault()
    if (pwForm.newPw.length < 6) { setPwError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Les mots de passe ne correspondent pas.'); return }
    setPwLoading(true); setPwError(''); setPwSaved(false)

    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    if (error) { setPwError(error.message) }
    else { setPwSaved(true); setPwForm({ current: '', newPw: '', confirm: '' }) }
    setPwLoading(false)
  }

  const winRate = stats.wins + stats.losses > 0
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
    : 0

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Mon Profil</h1>

      {/* Avatar + stats */}
      <div className="card text-center py-6">
        {/* Photo */}
        <div className="relative inline-block mb-3">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="avatar"
              className="w-24 h-24 rounded-full object-cover mx-auto shadow-md border-4 border-white ring-2 ring-blue-100"
            />
          ) : (
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <span className="text-4xl font-bold text-white">
                {profile?.name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? '?'}
              </span>
            </div>
          )}
          {/* Upload button overlay */}
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
        </div>
        {photoLoading && <p className="text-xs text-blue-600 mb-1">Upload en cours…</p>}
        {photoError && <p className="text-xs text-red-500 mb-1">{photoError}</p>}

        <h2 className="text-xl font-bold text-gray-900">{profile?.name || <span className="text-gray-400 italic">Nom non renseigné</span>}</h2>
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
        {role && role !== 'member' && (() => {
          const r = ROLES[role]
          return (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border mb-2 ${r.color} ${r.border}`}>
              {r.badge} {r.label}
            </span>
          )
        })()}
        {/* Badges */}
        {profile?.badges?.length > 0 && (
          <div className="mt-2 mb-1">
            <BadgeList badges={profile.badges} size="lg" className="justify-center" />
          </div>
        )}
        {profile?.level && (
          <div className="px-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-500 font-medium">Niveau</span>
              <span className="text-xs font-semibold text-blue-700">{LEVEL_LABEL[profile.level] ?? profile.level}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-gradient-to-r from-blue-400 to-indigo-600 transition-all"
                style={{ width: `${(parseInt(profile.level) / 10) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Parties', value: stats.sessions, color: 'text-gray-800' },
          { label: 'Victoires', value: stats.wins, color: 'text-blue-700' },
          { label: 'Défaites', value: stats.losses, color: 'text-red-500' },
          { label: '% Victoire', value: `${winRate}%`, color: 'text-gray-700' },
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
          { key: 'info', label: 'Mon profil' },
          { key: 'history', label: `Historique (${history.length})` },
          { key: 'amis', label: 'Amis' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`relative flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
            {key === 'amis' && pendingFriendCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                {pendingFriendCount > 9 ? '9+' : pendingFriendCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB : Historique ── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <p>Aucune partie jouée pour l'instant</p>
            </div>
          ) : history.map(s => {
            const date = new Date(`${s.date}T${s.time}`)
            const past = isPast(date)
            const matches = historyMatches[s.id] || []
            const wins = matches.filter(m => m.won).length
            const losses = matches.filter(m => !m.won).length
            return (
              <div key={s.id} className="card space-y-3">
                {/* Session header */}
                <Link to={`/sessions/${s.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="bg-blue-50 rounded-xl p-2 text-center min-w-[44px] shrink-0">
                    <div className="text-xs text-blue-600 font-medium uppercase">{format(date, 'MMM', { locale: fr })}</div>
                    <div className="text-lg font-bold text-blue-800 leading-none">{format(date, 'd')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.title}</p>
                    <p className="text-sm text-gray-400">📍 {s.location} · {format(date, 'HH:mm')}</p>
                  </div>
                  {matches.length > 0 && (
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-blue-600">{wins}V</span>
                      <span className="text-gray-300 mx-1">·</span>
                      <span className="text-sm font-bold text-red-500">{losses}D</span>
                    </div>
                  )}
                </Link>

                {/* Matchs de cette session */}
                {matches.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-50">
                    {matches.map((m, i) => (
                      <div key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${m.won ? 'bg-blue-50' : 'bg-red-50'}`}>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${m.won ? 'bg-blue-200 text-blue-800' : 'bg-red-200 text-red-700'}`}>
                          {m.won ? 'V' : 'D'}
                        </span>
                        <span className="flex-1 truncate text-gray-700">
                          <span className={m.won ? 'font-semibold' : ''}>{m.t1}</span>
                          <span className="text-gray-400 mx-1">vs</span>
                          <span className={!m.won ? 'font-semibold' : ''}>{m.t2}</span>
                        </span>
                        <span className="font-bold text-gray-700 shrink-0">
                          {m.team1_score}–{m.team2_score}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {matches.length === 0 && past && (
                  <p className="text-xs text-gray-400 pt-1 border-t border-gray-50">Aucun match enregistré pour cette partie</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB : Amis ── */}
      {tab === 'amis' && <FriendsSection userId={user.id} />}

      {/* ── TAB : Mon profil ── */}
      {tab === 'info' && <>

      {/* Edit form */}
      <form onSubmit={handleSave} className="card space-y-4">
        <h3 className="font-semibold text-gray-900">Mes informations</h3>

        {!profile && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm">
            👋 Complète ton profil pour apparaître dans le classement et les parties.
          </div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
        {saved && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">✅ Profil mis à jour !</div>}

        <div>
          <label className="label">Prénom et Nom *</label>
          <input type="text" name="name" value={form.name} onChange={handleChange} required className="input" placeholder="Marie Dupont" />
        </div>
        {/* Moyens de paiement */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-700">💳 Revolut</h4>
            <span className="text-xs text-gray-400">(pour recevoir les remboursements)</span>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#191C1F] text-white text-xs font-bold shrink-0">R</span>
              Revolut — Ton tag
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium select-none">@</span>
              <input
                type="text"
                name="revolut_tag"
                value={form.revolut_tag}
                onChange={e => {
                  setForm({ ...form, revolut_tag: e.target.value.replace(/^@/, '') })
                  setSaved(false); setError('')
                }}
                className="input pl-7"
                placeholder="ton-tag-revolut"
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Trouvable dans Revolut → Profil → Partager. Sans le @.</p>
          </div>
        </div>
        <div>
          <label className="label">Niveau de jeu (officiel padel)</label>
          <select name="level" value={form.level} onChange={handleChange} className="input">
            {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </form>

      {/* Password change */}
      <form onSubmit={handlePwChange} className="card space-y-4">
        <h3 className="font-semibold text-gray-900">Changer de mot de passe</h3>
        {pwError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{pwError}</div>}
        {pwSaved && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">✅ Mot de passe mis à jour !</div>}
        <div>
          <label className="label">Nouveau mot de passe</label>
          <PasswordInput
            value={pwForm.newPw} minLength={6}
            onChange={e => { setPwForm({ ...pwForm, newPw: e.target.value }); setPwError(''); setPwSaved(false) }}
            placeholder="Minimum 6 caractères" required
          />
        </div>
        <div>
          <label className="label">Confirmer le mot de passe</label>
          <PasswordInput
            value={pwForm.confirm} minLength={6}
            onChange={e => { setPwForm({ ...pwForm, confirm: e.target.value }); setPwError('') }}
            placeholder="Répète le nouveau mot de passe" required
          />
        </div>
        <button type="submit" disabled={pwLoading} className="btn-secondary w-full">
          {pwLoading ? 'Mise à jour...' : 'Changer le mot de passe'}
        </button>
      </form>

      {/* Admin panel shortcut */}
      {role === 'admin' && (
        <div className="card bg-purple-50 border-purple-100">
          <Link to="/admin" className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-purple-900">👑 Panneau d'administration</p>
              <p className="text-xs text-purple-600 mt-0.5">Gérer les membres, les parties et les statistiques</p>
            </div>
            <svg className="w-5 h-5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {/* Sign out */}
      <div className="card">
        <button onClick={signOut} className="btn-secondary w-full text-red-600 border-red-200 hover:bg-red-50">
          Se déconnecter
        </button>
      </div>

      {/* Delete account */}
      <DeleteAccountSection userEmail={user?.email} onDeleted={signOut} />

      </> /* fin tab === 'info' */}
    </div>
  )
}
