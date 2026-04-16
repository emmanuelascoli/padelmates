import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'

const FILTERS = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Passées' },
]

function SessionRow({ session }) {
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
  const [sessions, setSessions] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSessions()
  }, [filter])

  async function fetchSessions() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    let query = supabase
      .from('sessions')
      .select('*, session_participants(id)')
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
          ) : (
            <p className="font-medium text-gray-600">Aucune partie passée</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => <SessionRow key={s.id} session={s} />)}
        </div>
      )}
    </div>
  )
}
