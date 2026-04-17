import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

function FriendAvatars({ participants, friendIds, friendProfiles }) {
  const friendsIn = (participants || [])
    .map(p => p.user_id)
    .filter(id => friendIds.includes(id))
    .slice(0, 3)

  if (friendsIn.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <div className="flex -space-x-1.5">
        {friendsIn.map(id => {
          const p = friendProfiles[id]
          return p?.avatar_url ? (
            <img key={id} src={p.avatar_url} className="w-5 h-5 rounded-full object-cover border border-white" alt="" />
          ) : (
            <div key={id} className="w-5 h-5 rounded-full bg-blue-200 border border-white flex items-center justify-center text-blue-700 font-bold text-xs">
              {p?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )
        })}
      </div>
      <span className="text-xs text-blue-600 font-medium">
        {friendsIn.length === 1
          ? `${friendProfiles[friendsIn[0]]?.name?.split(' ')[0] ?? 'Ami'} joue`
          : `${friendsIn.length} amis jouent`}
      </span>
    </div>
  )
}

const FILTERS = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passées' },
  { key: 'friends', label: '👥 Amis' },
]

function SessionRow({ session, friendIds, friendProfiles }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session.session_participants?.length ?? 0
  const spotsLeft = session.max_players - participantCount
  const isFull = spotsLeft <= 0

  return (
    <Link to={`/sessions/${session.id}`} className="card hover:shadow-md transition-shadow block">
      <div className="flex items-start gap-4">
        {/* Date block */}
        <div className="bg-blue-50 rounded-xl p-3 text-center min-w-[56px] shrink-0">
          <div className="text-xs text-blue-700 font-medium uppercase">
            {format(date, 'MMM', { locale: fr })}
          </div>
          <div className="text-2xl font-bold text-blue-800 leading-none">
            {format(date, 'd')}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{session.title}</span>
            {session.status === 'cancelled' ? (
              <span className="badge bg-red-100 text-red-600">Annulée</span>
            ) : isFull ? (
              <span className="badge bg-orange-100 text-orange-600">Complet</span>
            ) : (
              <span className="badge bg-blue-100 text-blue-800">{spotsLeft} place{spotsLeft > 1 ? 's' : ''}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(date, 'EEEE d MMMM', { locale: fr })} · {format(date, 'HH:mm')}
          </p>
          <p className="text-sm text-gray-400 truncate">📍 {session.location}</p>
          <FriendAvatars
            participants={session.session_participants}
            friendIds={friendIds}
            friendProfiles={friendProfiles}
          />
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <div className="font-semibold text-gray-900">
            {session.cost_per_player > 0 ? `${session.cost_per_player} CHF` : 'Gratuit'}
          </div>
          <div className="text-xs text-gray-400">par joueur</div>
        </div>
      </div>
    </Link>
  )
}

export default function Sessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [loading, setLoading] = useState(true)
  const [friendIds, setFriendIds] = useState([])
  const [friendProfiles, setFriendProfiles] = useState({})

  useEffect(() => {
    if (user) fetchFriendData()
  }, [user])

  useEffect(() => {
    fetchSessions()
  }, [filter])

  async function fetchFriendData() {
    const { data: fs } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (!fs?.length) return

    const ids = fs.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    setFriendIds(ids)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .in('id', ids)

    const map = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    setFriendProfiles(map)
  }

  async function getFriendSessionIds() {
    if (!user) return []
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

    if (!friendships?.length) return []

    const friendIds = friendships.map(f =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )

    const { data: participations } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('user_id', friendIds)

    return [...new Set((participations || []).map(p => p.session_id))]
  }

  async function fetchSessions() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (filter === 'friends') {
      const sessionIds = await getFriendSessionIds()
      if (sessionIds.length === 0) {
        setSessions([])
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('sessions')
        .select('*, session_participants(id, user_id)')
        .in('id', sessionIds)
        .gte('date', today)
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(30)
      setSessions(data || [])
      setLoading(false)
      return
    }

    let query = supabase
      .from('sessions')
      .select('*, session_participants(id, user_id)')
      .order('date', { ascending: filter === 'upcoming' })
      .order('time', { ascending: true })

    if (filter === 'upcoming') {
      query = query.gte('date', today).neq('status', 'cancelled')
    } else {
      query = query.lt('date', today)
    }

    const { data } = await query.limit(30)
    setSessions(data || [])
    setLoading(false)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Parties</h1>
        <Link to="/sessions/new" className="btn-primary text-sm py-2">
          + Organiser
        </Link>
      </div>

      {/* Filters */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              filter === key ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">📅</div>
          {filter === 'upcoming' ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie prévue</p>
              <p className="text-sm mt-1">Sois le premier à en organiser une !</p>
              <Link to="/sessions/new" className="btn-primary inline-block mt-4 text-sm">
                Organiser une partie
              </Link>
            </>
          ) : filter === 'friends' ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie avec tes amis</p>
              <p className="text-sm mt-1">Ajoute des amis depuis leur profil pour voir leurs parties ici.</p>
            </>
          ) : (
            <p className="font-medium text-gray-600">Aucune partie passée</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <SessionRow
              key={s.id}
              session={s}
              friendIds={friendIds}
              friendProfiles={friendProfiles}
            />
          ))}
        </div>
      )}
    </div>
  )
}
