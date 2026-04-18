import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_LABEL, ROLES } from '../lib/constants'

// Couleur de l'avatar selon le niveau
function getLevelColor(level) {
  const n = parseInt(level) || 0
  if (n <= 2) return 'bg-green-100 text-green-700'
  if (n <= 4) return 'bg-blue-100 text-blue-700'
  if (n <= 6) return 'bg-indigo-100 text-indigo-700'
  if (n <= 8) return 'bg-purple-100 text-purple-700'
  return 'bg-orange-100 text-orange-700'
}

const LEVEL_FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'beginner', label: 'Débutant (1–3)', min: 1, max: 3 },
  { key: 'mid', label: 'Intermédiaire (4–6)', min: 4, max: 6 },
  { key: 'advanced', label: 'Avancé (7–10)', min: 7, max: 10 },
]

export default function Members() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [friendships, setFriendships] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchMembers(), fetchFriendships()])
    setLoading(false)
  }

  async function fetchMembers() {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, level, avatar_url, role')
      .order('name', { ascending: true })
    setMembers(data || [])
  }

  async function fetchFriendships() {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    setFriendships(data || [])
  }

  function getFriendship(memberId) {
    return friendships.find(f =>
      (f.requester_id === user.id && f.addressee_id === memberId) ||
      (f.requester_id === memberId && f.addressee_id === user.id)
    ) || null
  }

  async function handleAddFriend(memberId) {
    setActionLoading(memberId)
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: memberId })
    await fetchFriendships()
    setActionLoading(null)
  }

  async function handleAccept(friendshipId, memberId) {
    setActionLoading(memberId)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    await fetchFriendships()
    setActionLoading(null)
  }

  async function handleRemove(friendshipId, memberId) {
    setActionLoading(memberId)
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await fetchFriendships()
    setActionLoading(null)
  }

  const activeFilter = LEVEL_FILTERS.find(f => f.key === levelFilter)

  const filtered = members.filter(m => {
    if (m.id === user?.id) return false
    if (!m.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (activeFilter?.min) {
      const n = parseInt(m.level) || 0
      if (n < activeFilter.min || n > activeFilter.max) return false
    }
    return true
  })

  const pendingRequests = members.filter(m => {
    const f = getFriendship(m.id)
    return f?.status === 'pending' && f?.addressee_id === user?.id
  })

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Membres</h1>

      {/* Demandes reçues */}
      {pendingRequests.length > 0 && (
        <div className="card border-red-100 bg-red-50">
          <h3 className="text-sm font-semibold text-red-700 mb-3">
            🔔 {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} d'ami reçue{pendingRequests.length > 1 ? 's' : ''}
          </h3>
          <div className="space-y-2">
            {pendingRequests.map(m => {
              const f = getFriendship(m.id)
              return (
                <div key={m.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${getLevelColor(m.level)}`}>
                      {m.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <Link to={`/players/${m.id}`} className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{m.name}</p>
                    <p className="text-xs text-gray-400">{LEVEL_LABEL[m.level] ?? '—'}</p>
                  </Link>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => handleAccept(f.id, m.id)} disabled={actionLoading === m.id}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                      Accepter
                    </button>
                    <button onClick={() => handleRemove(f.id, m.id)} disabled={actionLoading === m.id}
                      className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 hover:text-red-500 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                      Refuser
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un membre…" className="input pl-9" />
      </div>

      {/* Filtre par niveau */}
      <div className="flex gap-2 flex-wrap">
        {LEVEL_FILTERS.map(f => (
          <button key={f.key} onClick={() => setLevelFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              levelFilter === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <p>Aucun membre trouvé</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const f = getFriendship(m.id)
            const isFriend = f?.status === 'accepted'
            const isPendingSent = f?.status === 'pending' && f?.requester_id === user?.id
            const isPendingReceived = f?.status === 'pending' && f?.addressee_id === user?.id
            const isLoading = actionLoading === m.id

            return (
              <div key={m.id} className="card flex items-center gap-3">
                <Link to={`/players/${m.id}`} className="shrink-0">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} className="w-11 h-11 rounded-full object-cover" alt="" />
                  ) : (
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${getLevelColor(m.level)}`}>
                      {m.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <Link to={`/players/${m.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-medium text-gray-900 truncate">{m.name}</p>
                    {m.role === 'admin' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0">👑</span>
                    )}
                    {m.role === 'organizer' && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 shrink-0">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{LEVEL_LABEL[m.level] ?? '—'}</p>
                </Link>

                <div className="shrink-0">
                  {isFriend ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-blue-600 font-medium">✓ Amis</span>
                      <button onClick={() => handleRemove(f.id, m.id)} disabled={isLoading}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
                    </div>
                  ) : isPendingSent ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 italic">Demande envoyée</span>
                      <button onClick={() => handleRemove(f.id, m.id)} disabled={isLoading}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors">✕</button>
                    </div>
                  ) : isPendingReceived ? (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleAccept(f.id, m.id)} disabled={isLoading}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                        {isLoading ? '…' : 'Accepter'}
                      </button>
                      <button onClick={() => handleRemove(f.id, m.id)} disabled={isLoading}
                        className="px-2 py-1.5 border border-gray-200 text-gray-400 hover:text-red-500 text-xs rounded-lg transition-colors disabled:opacity-50">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => handleAddFriend(m.id)} disabled={isLoading}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 border border-blue-100">
                      {isLoading ? '…' : '+ Ami'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
