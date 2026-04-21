import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BADGES } from '../lib/constants'

// ── Helpers filtres ──────────────────────────────────────────
const LEVEL_RANGES = {
  '1-3':  [1, 3],
  '4-6':  [4, 6],
  '7-10': [7, 10],
}

function matchesLevel(session, active) {
  if (active.size === 0) return true
  if (!session.level_min && !session.level_max) return true
  const sMin = session.level_min ? parseInt(session.level_min) : 1
  const sMax = session.level_max ? parseInt(session.level_max) : 10
  return [...active].some(key => {
    const [fMin, fMax] = LEVEL_RANGES[key]
    return sMin <= fMax && sMax >= fMin
  })
}

function matchesTime(session, active) {
  if (active.size === 0) return true
  const h = parseInt((session.time || '00:00').split(':')[0])
  const slots = { morning: h >= 6 && h < 12, noon: h >= 12 && h < 17, evening: h >= 17 }
  return [...active].some(key => slots[key])
}

// Extrait le nom du lieu sans le numéro de terrain
// "Padel Club - Court 2" → "Padel Club"
// "Centre Sportif Terrain 3" → "Centre Sportif"
// "Club du Lac - 4" → "Club du Lac"
function extractVenue(location) {
  if (!location) return location
  return location
    .replace(/\s*[-–—]\s*(court|terrain|piste|field|salle)\s*\d+\s*$/i, '')
    .replace(/\s+(court|terrain|piste|field|salle)\s*\d+\s*$/i, '')
    .replace(/\s*[-–—]\s*\d+\s*$/i, '')
    .replace(/\s+\d+\s*$/i, '')
    .trim()
}

function matchesLocation(session, active) {
  if (active.size === 0) return true
  return active.has(extractVenue(session.location))
}

function matchesOpen(session, openOnly) {
  if (!openOnly) return true
  const count = session.session_participants?.length ?? 0
  return count < session.max_players
}

// ── FriendAvatars (toujours affiché sur les cartes) ──────────
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
            <div key={id} className="w-5 h-5 rounded-full bg-forest-100 border border-white flex items-center justify-center text-forest-800 font-bold text-xs">
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

// ── Session card ─────────────────────────────────────────────
function SessionRow({ session, userId, friendIds, friendProfiles }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session.session_participants?.length ?? 0
  const isRegistered = (session.session_participants || []).some(p => p.user_id === userId)

  return (
    <Link to={`/sessions/${session.id}`} className="block bg-white rounded-2xl shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      <div className="flex items-stretch">
        {/* Date block */}
        <div className="w-[72px] bg-[#1A3528] flex flex-col items-center justify-center py-4 shrink-0">
          <span className="text-[#6B9B7A] text-[10px] font-semibold tracking-widest uppercase leading-none">
            {format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')}
          </span>
          <span className="text-white text-[26px] font-bold leading-tight mt-0.5">
            {format(date, 'd')}
          </span>
          <span className="text-[#6B9B7A] text-[10px] uppercase tracking-wide leading-none">
            {format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}
          </span>
          <span className="text-[#7BC47B] text-xs font-semibold mt-1.5 leading-none">
            {format(date, 'HH:mm')}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 px-4 py-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-bold text-gray-900 text-[15px] leading-snug">{session.title}</span>
            <div className="flex gap-1 shrink-0 flex-wrap justify-end">
              {session.is_private && <span className="badge bg-purple-100 text-purple-700">🔒</span>}
              {isRegistered && (
                <span className="inline-flex items-center gap-1 bg-[#E8F5EC] text-[#1A6B3A] text-[11px] font-semibold px-2 py-0.5 rounded-full">✓ Inscrit</span>
              )}
              {session.status === 'cancelled' && <span className="badge bg-red-100 text-red-600">Annulée</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.location}
          </div>

          {session.organizer?.name && (
            <p className="text-xs text-gray-400 mb-1.5">
              👤 {session.organizer.name}
              {session.organizer.badges?.length > 0 && (
                <span className="ml-1" title={session.organizer.badges.map(b => BADGES[b]?.label).filter(Boolean).join(', ')}>
                  {session.organizer.badges.map(b => BADGES[b]?.emoji).filter(Boolean).join('')}
                </span>
              )}
              {session.cost_per_player > 0 && (
                <span className="ml-1 font-medium text-gray-500">· {session.cost_per_player} CHF</span>
              )}
            </p>
          )}

          <FriendAvatars
            participants={session.session_participants}
            friendIds={friendIds}
            friendProfiles={friendProfiles}
          />

          {/* Slot bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 mb-1">
            <div
              className={`h-1.5 rounded-full ${participantCount >= session.max_players ? 'bg-orange-400' : 'bg-[#4CAF6F]'}`}
              style={{ width: `${Math.min(100, Math.round((participantCount / session.max_players) * 100))}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">{participantCount} / {session.max_players} joueurs</span>
            {participantCount >= session.max_players
              ? <span className="text-orange-500 font-semibold">Complet</span>
              : <span className="text-[#1A6B3A] font-semibold">{session.max_players - participantCount} dispo</span>
            }
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Pill helper ──────────────────────────────────────────────
function Pill({ active, onClick, children, color = 'forest' }) {
  const colors = {
    forest: active ? 'bg-forest-900 text-white border-forest-700' : 'bg-white text-gray-600 border-gray-200 hover:border-forest-300',
    green:  active ? 'bg-[#1A6B3A] text-white border-[#1A6B3A]'  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300',
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

// Lieux connus — toujours affichés dans le filtre même sans partie
const KNOWN_VENUES = [
  'Bernex',
  'Parc des Evaux',
  'TC International Chambesy',
]

const TABS = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'past',     label: 'Passées' },
  { key: 'mine',     label: 'Mes parties' },
]

export default function Sessions() {
  const { user } = useAuth()
  const [sessions, setSessions]     = useState([])
  const [tab, setTab]               = useState('upcoming')
  const [loading, setLoading]       = useState(true)
  const [friendIds, setFriendIds]   = useState([])
  const [friendProfiles, setFriendProfiles] = useState({})

  // ── Filtres ──────────────────────────────────────────────────
  const [levelActive, setLevelActive]       = useState(new Set())
  const [timeActive, setTimeActive]         = useState(new Set())
  const [locationActive, setLocationActive] = useState(new Set())
  const [openOnly, setOpenOnly]             = useState(false)

  const hasActiveFilters = levelActive.size > 0 || timeActive.size > 0 || locationActive.size > 0 || openOnly

  function resetFilters() {
    setLevelActive(new Set())
    setTimeActive(new Set())
    setLocationActive(new Set())
    setOpenOnly(false)
  }

  function toggleSet(setter, key) {
    setter(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
        .gte('date', today)               // uniquement futures
        .neq('status', 'cancelled')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(50)
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
    matchesLocation(s, locationActive) &&
    matchesOpen(s, openOnly)
  )

  // Lieux uniques : lieux connus + lieux des parties (sans doublons, triés)
  const uniqueLocations = [...new Set([
    ...KNOWN_VENUES,
    ...sessions.map(s => extractVenue(s.location)).filter(Boolean),
  ])].sort()

  const showFilters = tab === 'upcoming' || tab === 'past' || tab === 'mine'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Parties</h1>
        <Link to="/sessions/new" className="btn-primary text-sm py-2">
          + Organiser
        </Link>
      </div>

      {/* Onglets */}
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

      {/* Filtres */}
      {showFilters && (
        <div className="card py-3 space-y-3">

          {/* Niveau */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium w-12 shrink-0">Niveau</span>
            <Pill active={levelActive.has('1-3')}  onClick={() => toggleSet(setLevelActive, '1-3')}>1–3</Pill>
            <Pill active={levelActive.has('4-6')}  onClick={() => toggleSet(setLevelActive, '4-6')}>4–6</Pill>
            <Pill active={levelActive.has('7-10')} onClick={() => toggleSet(setLevelActive, '7-10')}>7–10</Pill>
          </div>

          {/* Créneau */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium w-12 shrink-0">Créneau</span>
            <Pill active={timeActive.has('morning')} onClick={() => toggleSet(setTimeActive, 'morning')} color="orange">🌅 Matin</Pill>
            <Pill active={timeActive.has('noon')}    onClick={() => toggleSet(setTimeActive, 'noon')}    color="orange">☀️ Midi</Pill>
            <Pill active={timeActive.has('evening')} onClick={() => toggleSet(setTimeActive, 'evening')} color="orange">🌆 Soir</Pill>
          </div>

          {/* Lieux (dynamique) */}
          {uniqueLocations.length > 1 && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs text-gray-500 font-medium w-12 shrink-0 pt-1">Lieu</span>
              <div className="flex gap-1.5 flex-wrap">
                {uniqueLocations.map(loc => (
                  <Pill
                    key={loc}
                    active={locationActive.has(loc)}
                    onClick={() => toggleSet(setLocationActive, loc)}
                    color="forest"
                  >
                    📍 {loc}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {/* Places disponibles (seulement sur À venir et Mes parties) */}
          {(tab === 'upcoming' || tab === 'mine') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium w-12 shrink-0">Dispo</span>
              <Pill active={openOnly} onClick={() => setOpenOnly(v => !v)} color="green">
                ✅ Places disponibles
              </Pill>
            </div>
          )}

          {/* Reset */}
          {hasActiveFilters && (
            <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {filteredSessions.length} résultat{filteredSessions.length !== 1 ? 's' : ''}
              </span>
              <button onClick={resetFilters} className="text-xs text-forest-700 hover:underline font-medium">
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
          <div className="text-5xl mb-3">{hasActiveFilters ? '🔍' : '📅'}</div>
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
          ) : tab === 'mine' ? (
            <>
              <p className="font-medium text-gray-600">Aucune partie à venir</p>
              <p className="text-sm mt-1">Inscris-toi à une partie ou organises-en une !</p>
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
