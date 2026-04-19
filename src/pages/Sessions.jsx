import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BADGES } from '../lib/constants'

// ── Helpers filtre niveau ────────────────────────────────────
const LEVEL_RANGES = {
  '1-3':  [1, 3],
  '4-6':  [4, 6],
  '7-10': [7, 10],
}

function matchesLevel(session, active) {
  if (active.size === 0) return true
  // Pas de contrainte de niveau → ouvert à tous les niveaux
  if (!session.level_min && !session.level_max) return true
  const sMin = session.level_min ? parseInt(session.level_min) : 1
  const sMax = session.level_max ? parseInt(session.level_max) : 10
  return [...active].some(key => {
    const [fMin, fMax] = LEVEL_RANGES[key]
    return sMin <= fMax && sMax >= fMin   // chevauchement des plages
  })
}

function matchesTime(session, active) {
  if (active.size === 0) return true
  const h = parseInt((session.time || '00:00').split(':')[0])
  const slots = {
    morning: h >= 6  && h < 12,
    noon:    h >= 12 && h < 17,
    evening: h >= 17,
  }
  return [...active].some(key => slots[key])
}

function matchesFriends(session, active, friendIds) {
  if (!active) return true
  return (session.session_participants || []).some(p => friendIds.includes(p.user_id))
}

// ── Sous-composants ──────────────────────────────────────────
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
            <div key={id} className="w-5 h-5 rounded-full bg-blue-200 border border-white flex items-center justify-center text-forest-800 font-bold text-xs">
              {p?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )
        })}
      </div>
      <span className="text-xs text-forest-700 font-medium">
        {friendsIn.length === 1
          ? `${friendProfiles[friendsIn[0]]?.name?.split(' ')[0] ?? 'Ami'} joue`
          : `${friendsIn.length} amis jouent`}
      </span>
    </div>
  )
}

function SlotBar({ current, max }) {
  const pct = Math.min(100, Math.round((current / max) * 100))
  const isFull = current >= max
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{current} / {max} joueurs</span>
        {isFull
          ? <span className="text-orange-500 font-medium">Complet</span>
          : <span className="text-green-600 font-medium">{max - current} place{max - current > 1 ? 's' : ''} dispo</span>}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${isFull ? 'bg-orange-400' : pct >= 75 ? 'bg-yellow-400' : 'bg-green-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SessionRow({ session, userId, friendIds, friendProfiles }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session.session_participants?.length ?? 0
  const isRegistered = (session.session_participants || []).some(p => p.user_id === userId)

  return (
    <Link to={`/sessions/${session.id}`} className="card hover:shadow-md transition-shadow block">
      <div className="flex items-start gap-4">
        {/* Date block */}
        <div className="bg-forest-50 rounded-xl p-3 text-center min-w-[56px] shrink-0">
          <div className="text-xs text-forest-800 font-medium uppercase">
            {format(date, 'MMM', { locale: fr })}
          </div>
          <div className="text-2xl font-bold text-forest-900 leading-none">
            {format(date, 'd')}
          </div>
          <div className="text-xs text-forest-700 mt-0.5">
            {format(date, 'HH:mm')}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{session.title}</span>
            {session.is_private && (
              <span className="badge bg-purple-100 text-purple-700">🔒 Privée</span>
            )}
            {isRegistered && (
              <span className="badge bg-green-100 text-green-700">✓ Inscrit</span>
            )}
            {session.status === 'cancelled' && (
              <span className="badge bg-red-100 text-red-600">Annulée</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(date, 'EEEE d MMMM', { locale: fr })}
          </p>
          <p className="text-sm text-gray-400 truncate">📍 {session.location}</p>
          {(session.level_min || session.level_max) && (
            <p className="text-xs text-gray-400 mt-0.5">
              🎯 Niv. {session.level_min ?? '?'}{session.level_max && session.level_min !== session.level_max ? `–${session.level_max}` : ''}
            </p>
          )}
          {session.organizer?.name && (
            <p className="text-xs text-gray-400 mt-0.5">
              👤 {session.organizer.name}
              {session.organizer.badges?.length > 0 && (
                <span className="ml-1" title={session.organizer.badges.map(b => BADGES[b]?.label).filter(Boolean).join(', ')}>
                  {session.organizer.badges.map(b => BADGES[b]?.emoji).filter(Boolean).join('')}
                </span>
              )}
            </p>
          )}
          <FriendAvatars
            participants={session.session_participants}
            friendIds={friendIds}
            friendProfiles={friendProfiles}
          />
          <SlotBar current={participantCount} max={session.max_players} />
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

// ── Pill toggle helper ───────────────────────────────────────
function Pill({ active, onClick, children, color = 'blue' }) {
  const colors = {
    blue:   active ? 'bg-forest-900 text-white border-forest-700'     : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300',
    green:  active ? 'bg-green-600 text-white border-green-600'   : 'bg-white text-gray-600 border-gray-200 hover:border-green-300',
    orange: active ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${colors[color]}`}
    >
      {children}
    </button>
  )
}

const TABS = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'past',     label: 'Passées' },
  { key: 'friends',  label: '👥 Amis' },
  { key: 'mine',     label: '🔒 Mes parties' },
]

export default function Sessions() {
  const { user } = useAuth()
  const [sessions, setSessions]         = useState([])
  const [tab, setTab]                   = useState('upcoming')
  const [loading, setLoading]           = useState(true)
  const [friendIds, setFriendIds]       = useState([])
  const [friendProfiles, setFriendProfiles] = useState({})

  // ── Filtres secondaires (client-side) ──────────────────────
  const [levelActive, setLevelActive]   = useState(new Set())   // '1-3' | '4-6' | '7-10'
  const [timeActive, setTimeActive]     = useState(new Set())   // 'morning' | 'noon' | 'evening'
  const [friendsOnly, setFriendsOnly]   = useState(false)

  const hasActiveFilters = levelActive.size > 0 || timeActive.size > 0 || friendsOnly

  function resetFilters() {
    setLevelActive(new Set())
    setTimeActive(new Set())
    setFriendsOnly(false)
  }

  function toggleSet(setter, key) {
    setter(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Reset filtres quand on change d'onglet
  useEffect(() => { resetFilters() }, [tab])

  useEffect(() => {
    if (user) fetchFriendData()
  }, [user])

  useEffect(() => {
    fetchSessions()
  }, [tab])

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
    setFriendProfiles(Object.fromEntries((profiles || []).map(p => [p.id, p])))
  }

  async function getFriendSessionIds() {
    if (!user) return []
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    if (!friendships?.length) return []
    const fIds = friendships.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id)
    const { data: participations } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('user_id', fIds)
    return [...new Set((participations || []).map(p => p.session_id))]
  }

  async function fetchSessions() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    if (tab === 'mine') {
      const [{ data: organized }, { data: participated }] = await Promise.all([
        supabase.from('sessions').select('id').eq('organizer_id', user.id),
        supabase.from('session_participants').select('session_id').eq('user_id', user.id),
      ])
      const myIds = [...new Set([
        ...(organized || []).map(s => s.id),
        ...(participated || []).map(p => p.session_id),
      ])]
      if (myIds.length === 0) { setSessions([]); setLoading(false); return }
      const { data } = await supabase
        .from('sessions')
        .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name, badges)')
        .in('id', myIds)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(50)
      setSessions(data || [])
      setLoading(false)
      return
    }

    if (tab === 'friends') {
      const sessionIds = await getFriendSessionIds()
      if (sessionIds.length === 0) { setSessions([]); setLoading(false); return }
      const { data } = await supabase
        .from('sessions')
        .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name, badges)')
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
      .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name, badges)')
      .eq('is_private', false)
      .order('date', { ascending: tab === 'upcoming' })
      .order('time', { ascending: true })

    if (tab === 'upcoming') {
      query = query.gte('date', today).neq('status', 'cancelled')
    } else {
      query = query.lt('date', today)
    }

    const { data } = await query.limit(50)
    setSessions(data || [])
    setLoading(false)
  }

  // ── Filtrage client-side ─────────────────────────────────────
  const filteredSessions = sessions.filter(s =>
    matchesLevel(s, levelActive) &&
    matchesTime(s, timeActive) &&
    matchesFriends(s, friendsOnly, friendIds)
  )

  // Afficher les filtres secondaires seulement sur ces onglets
  const showSecondaryFilters = tab === 'upcoming' || tab === 'past' || tab === 'friends'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Parties</h1>
        <Link to="/sessions/new" className="btn-primary text-sm py-2">
          + Organiser
        </Link>
      </div>

      {/* Onglets principaux */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-forest-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtres secondaires */}
      {showSecondaryFilters && (
        <div className="card py-3 space-y-3">
          {/* Niveau */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium w-12 shrink-0">Niveau</span>
            <Pill active={levelActive.has('1-3')}  onClick={() => toggleSet(setLevelActive, '1-3')}  color="blue">1–3</Pill>
            <Pill active={levelActive.has('4-6')}  onClick={() => toggleSet(setLevelActive, '4-6')}  color="blue">4–6</Pill>
            <Pill active={levelActive.has('7-10')} onClick={() => toggleSet(setLevelActive, '7-10')} color="blue">7–10</Pill>
          </div>

          {/* Créneau + Amis */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium w-12 shrink-0">Créneau</span>
            <Pill active={timeActive.has('morning')} onClick={() => toggleSet(setTimeActive, 'morning')} color="orange">🌅 Matin</Pill>
            <Pill active={timeActive.has('noon')}    onClick={() => toggleSet(setTimeActive, 'noon')}    color="orange">☀️ Midi</Pill>
            <Pill active={timeActive.has('evening')} onClick={() => toggleSet(setTimeActive, 'evening')} color="orange">🌆 Soir</Pill>
          </div>

          {/* Amis (masqué dans l'onglet Amis qui filtre déjà) */}
          {tab !== 'friends' && friendIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium w-12 shrink-0">Amis</span>
              <Pill active={friendsOnly} onClick={() => setFriendsOnly(v => !v)} color="green">
                👥 Avec des amis
              </Pill>
            </div>
          )}

          {/* Bouton reset */}
          {hasActiveFilters && (
            <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {filteredSessions.length} résultat{filteredSessions.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={resetFilters}
                className="text-xs text-forest-700 hover:underline font-medium"
              >
                Effacer les filtres ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">
            {hasActiveFilters ? '🔍' : '📅'}
          </div>
          {hasActiveFilters ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie pour ces filtres</p>
              <button onClick={resetFilters} className="text-sm text-forest-700 hover:underline mt-2">
                Effacer les filtres
              </button>
            </>
          ) : tab === 'upcoming' ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie prévue</p>
              <p className="text-sm mt-1">Sois le premier à en organiser une !</p>
              <Link to="/sessions/new" className="btn-primary inline-block mt-4 text-sm">
                Organiser une partie
              </Link>
            </>
          ) : tab === 'friends' ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie avec tes amis</p>
              <p className="text-sm mt-1">Ajoute des amis depuis leur profil pour voir leurs parties ici.</p>
            </>
          ) : tab === 'mine' ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie pour toi</p>
              <p className="text-sm mt-1">Inscris-toi à une partie ou organises-en une !</p>
            </>
          ) : (
            <p className="font-medium text-gray-600">Aucune partie passée</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map(s => (
            <SessionRow
              key={s.id}
              session={s}
              userId={user?.id}
              friendIds={friendIds}
              friendProfiles={friendProfiles}
            />
          ))}
        </div>
      )}
    </div>
  )
}
