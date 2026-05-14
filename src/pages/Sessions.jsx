import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Lieux connus (synchronisés avec NewSession) ───────────────
const KNOWN_VENUES = [
  'Bernex', 'Cologny', "David Lloyd's Club", 'Jonction',
  'La Praille', 'Les Acacias', 'Padel Station',
  'Parc des Evaux', 'TC International Chambesy',
]

// ── Helpers filtres ───────────────────────────────────────────
const LEVEL_RANGES = { '1-3': [1,3], '4-6': [4,6], '7-10': [7,10] }

function matchesLevel(s, active) {
  if (active.size === 0) return true
  if (!s.level_min && !s.level_max) return true
  const sMin = s.level_min ? parseInt(s.level_min) : 1
  const sMax = s.level_max ? parseInt(s.level_max) : 10
  return [...active].some(k => {
    const [a, b] = LEVEL_RANGES[k]
    return sMin <= b && sMax >= a
  })
}

function matchesTime(s, active) {
  if (active.size === 0) return true
  const h = parseInt((s.time || '00:00').split(':')[0])
  const slots = { morning: h >= 6 && h < 12, noon: h >= 12 && h < 17, evening: h >= 17 }
  return [...active].some(k => slots[k])
}

function extractVenue(loc) {
  if (!loc) return loc
  return loc
    .replace(/\s*[-–—]\s*(court|terrain|piste|field|salle)\s*\d+\s*$/i, '')
    .replace(/\s+(court|terrain|piste|field|salle)\s*\d+\s*$/i, '')
    .replace(/\s*[-–—]\s*\d+\s*$/i, '')
    .replace(/\s+\d+\s*$/i, '')
    .trim()
}

function matchesLocation(s, active) {
  if (active.size === 0) return true
  return active.has(extractVenue(s.location))
}

function matchesOpen(s, openOnly) {
  if (!openOnly) return true
  return (s.session_participants?.length ?? 0) < s.max_players
}

// ── Titre calculé depuis la date ──────────────────────────────
function sessionTitle(date) {
  return 'Partie du ' + format(date, 'EEEE d MMMM', { locale: fr })
}

// ── Amis présents ─────────────────────────────────────────────
function FriendAvatars({ participants, friendIds, friendProfiles }) {
  const friendsIn = (participants || [])
    .map(p => p.user_id)
    .filter(id => friendIds.includes(id))
    .slice(0, 3)
  if (friendsIn.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <div className="flex" style={{ marginRight: 2 }}>
        {friendsIn.map((id, i) => {
          const p = friendProfiles[id]
          return p?.avatar_url ? (
            <img key={id} src={p.avatar_url}
              className="w-5 h-5 rounded-full object-cover"
              style={{ border: '1.5px solid #fff', marginLeft: i ? -6 : 0 }}
              alt="" />
          ) : (
            <div key={id}
              className="w-5 h-5 rounded-full bg-forest-100 flex items-center justify-center text-forest-800 font-bold text-[8px]"
              style={{ border: '1.5px solid #fff', marginLeft: i ? -6 : 0 }}>
              {p?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )
        })}
      </div>
      <span className="text-[10px] text-forest-700 font-medium">
        {friendsIn.length === 1
          ? `${friendProfiles[friendsIn[0]]?.name?.split(' ')[0] ?? 'Ami'} joue`
          : `${friendsIn.length} amis jouent`}
      </span>
    </div>
  )
}

// ── Séparateur de section ─────────────────────────────────────
function SectionSep({ label }) {
  return (
    <div className="flex items-center gap-2 mb-2 mt-1">
      <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  )
}

// ── Carte de session ──────────────────────────────────────────
function SessionCard({ session, userId, friendIds, friendProfiles }) {
  const date        = new Date(`${session.date}T${session.time}`)
  const count       = session.session_participants?.length ?? 0
  const max         = session.max_players
  const isFull      = count >= max
  const isRegistered = (session.session_participants || []).some(p => p.user_id === userId)
  const isCancelled  = session.status === 'cancelled'
  const pct         = Math.min(100, Math.round((count / max) * 100))

  const dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')
  const title    = sessionTitle(date)

  // Couleur dégradée de la barre
  const barGradient = isFull
    ? 'linear-gradient(90deg, #fca5a5, #dc2626)'
    : 'linear-gradient(90deg, #86efac, #16a34a)'

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="flex items-stretch bg-white rounded-2xl mb-2 active:scale-[0.99] transition-transform"
      style={{ border: '0.5px solid #E5E7EB', textDecoration: 'none' }}
    >
      {/* Boîte date */}
      <div className="bg-primary rounded-xl m-2 flex flex-col items-center justify-center py-2 shrink-0"
        style={{ width: 46 }}>
        <span className="text-[#6B9B7A] text-[9px] font-semibold tracking-widest uppercase leading-none">{dayLabel}</span>
        <span className="text-white text-[20px] font-bold leading-tight mt-0.5">{format(date, 'd')}</span>
        <span className="text-[#6B9B7A] text-[9px] uppercase tracking-wide leading-none">
          {format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}
        </span>
        <span className="text-accent font-bold text-[10px] mt-1 leading-none">{format(date, 'HH:mm')}</span>
      </div>

      {/* Corps */}
      <div className="flex-1 py-2.5 pr-3 pl-2 min-w-0">
        {/* Titre + badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-medium text-gray-900 text-[12.5px] leading-snug">{title}</span>
          <div className="flex gap-1 shrink-0 flex-wrap justify-end">
            {session.is_private && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">🔒</span>
            )}
            {isCancelled && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Annulée</span>
            )}
            {!isCancelled && isRegistered && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#166534' }}>
                Inscrit
              </span>
            )}
            {!isCancelled && !isRegistered && isFull && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
                Complet
              </span>
            )}
          </div>
        </div>

        {/* Lieu */}
        <div className="flex items-center gap-1 text-[11px] mb-1" style={{ color: '#6B7280' }}>
          <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {session.location}
        </div>

        {/* Organisateur (sans prix ni niveau) */}
        {session.organizer?.name && (
          <div className="flex items-center gap-1 text-[11px] mb-1" style={{ color: '#6B7280' }}>
            <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {session.organizer.name}
          </div>
        )}

        {/* Amis */}
        <FriendAvatars
          participants={session.session_participants}
          friendIds={friendIds}
          friendProfiles={friendProfiles}
        />

        {/* Barre de progression dégradée */}
        {!isCancelled && (
          <div className="mt-1.5">
            <div className="w-full h-[4px] rounded-[2px] mb-1.5" style={{ background: '#F3F4F6', overflow: 'hidden' }}>
              <div className="h-full rounded-[2px]" style={{ width: `${pct}%`, background: barGradient }} />
            </div>
            {/* Texte sous la barre : places dispo uniquement si non complet */}
            {!isFull && (
              <span className="text-[10px] font-medium" style={{ color: '#15803d' }}>
                {max - count} place{max - count > 1 ? 's' : ''} disponible{max - count > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Pill filtre ───────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-7 px-3 rounded-full text-[10px] font-medium transition-all shrink-0 whitespace-nowrap"
      style={active
        ? { background: '#14532d', color: '#fff', border: '1px solid #14532d' }
        : { background: '#F9F9F8', border: '0.5px solid #E5E7EB', color: '#374151' }
      }
    >
      {children}
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────
const TABS = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'past',     label: 'Passées' },
]

export default function Sessions() {
  const { user } = useAuth()
  const [sessions, setSessions]   = useState([])
  const [tab, setTab]             = useState('upcoming')
  const [loading, setLoading]     = useState(true)
  const [friendIds, setFriendIds] = useState([])
  const [friendProfiles, setFriendProfiles] = useState({})

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
  useEffect(() => { if (user) fetchFriendData() }, [user])
  useEffect(() => { fetchSessions() }, [tab])

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
      .from('profiles').select('id, name, avatar_url').in('id', ids)
    setFriendProfiles(Object.fromEntries((profiles || []).map(p => [p.id, p])))
  }

  async function fetchSessions() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    let query = supabase
      .from('sessions')
      .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name)')
      .eq('is_private', false)
      .order('date', { ascending: tab === 'upcoming' })
      .order('time', { ascending: true })

    if (tab === 'upcoming') {
      query = query.gte('date', today).neq('status', 'cancelled')
    } else {
      query = query.lt('date', today)
    }

    const { data } = await query.limit(60)
    setSessions(data || [])
    setLoading(false)
  }

  // Filtrage client-side
  const filtered = sessions.filter(s =>
    matchesLevel(s, levelActive) &&
    matchesTime(s, timeActive) &&
    matchesLocation(s, locationActive) &&
    matchesOpen(s, openOnly)
  )

  // Séparation mes parties / toutes les parties (uniquement sur "À venir")
  const mine  = filtered.filter(s => (s.session_participants || []).some(p => p.user_id === user?.id))
  const other = filtered.filter(s => !(s.session_participants || []).some(p => p.user_id === user?.id))

  const cardProps = { userId: user?.id, friendIds, friendProfiles }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="section-title text-gray-900">Parties</h1>
        <Link to="/sessions/new" className="btn-primary text-sm py-2">+ Organiser</Link>
      </div>

      {/* Onglets */}
      <div className="flex bg-[#ECEAE5] rounded-xl p-1 gap-0.5">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-[9px] transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtres (seulement sur À venir) */}
      {tab === 'upcoming' && (
        <div className="bg-white rounded-2xl p-3 space-y-2.5" style={{ border: '0.5px solid #E5E7EB' }}>

          {/* Niveau */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400 font-medium w-10 shrink-0">Niveau</span>
            <Pill active={levelActive.has('1-3')}  onClick={() => toggleSet(setLevelActive, '1-3')}>1–3</Pill>
            <Pill active={levelActive.has('4-6')}  onClick={() => toggleSet(setLevelActive, '4-6')}>4–6</Pill>
            <Pill active={levelActive.has('7-10')} onClick={() => toggleSet(setLevelActive, '7-10')}>7–10</Pill>
          </div>

          {/* Créneau */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-400 font-medium w-10 shrink-0">Créneau</span>
            <Pill active={timeActive.has('morning')} onClick={() => toggleSet(setTimeActive, 'morning')}>Matin</Pill>
            <Pill active={timeActive.has('noon')}    onClick={() => toggleSet(setTimeActive, 'noon')}>Midi</Pill>
            <Pill active={timeActive.has('evening')} onClick={() => toggleSet(setTimeActive, 'evening')}>Soir</Pill>
          </div>

          {/* Lieu (scroll horizontal) */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-medium w-10 shrink-0">Lieu</span>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5" style={{ flexWrap: 'nowrap' }}>
              {KNOWN_VENUES.map(loc => (
                <Pill key={loc} active={locationActive.has(loc)} onClick={() => toggleSet(setLocationActive, loc)}>
                  {loc}
                </Pill>
              ))}
            </div>
          </div>

          {/* Séparateur + Places dispo */}
          <div className="border-t pt-2 flex items-center justify-between" style={{ borderColor: '#F3F4F6' }}>
            <Pill active={openOnly} onClick={() => setOpenOnly(v => !v)}>
              Places disponibles
            </Pill>
            {hasActiveFilters && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-400">
                  {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
                </span>
                <button onClick={resetFilters} className="text-[10px] text-forest-700 font-medium hover:underline">
                  Effacer ×
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl text-center py-12" style={{ border: '0.5px solid #E5E7EB' }}>
          <div className="text-4xl mb-3">{hasActiveFilters ? '🔍' : '📅'}</div>
          {hasActiveFilters ? (
            <>
              <p className="font-medium text-gray-600 text-sm">Aucune partie pour ces filtres</p>
              <button onClick={resetFilters} className="text-sm text-forest-700 hover:underline mt-2">Effacer les filtres</button>
            </>
          ) : tab === 'upcoming' ? (
            <>
              <p className="font-medium text-gray-600 text-sm">Aucune partie prévue</p>
              <p className="text-sm text-gray-400 mt-1">Sois le premier à en organiser une !</p>
              <Link to="/sessions/new" className="btn-primary inline-block mt-4 text-sm">Organiser une partie</Link>
            </>
          ) : (
            <p className="font-medium text-gray-600 text-sm">Aucune partie passée</p>
          )}
        </div>
      ) : tab === 'upcoming' ? (
        <>
          {mine.length > 0 && (
            <div>
              <SectionSep label="Mes parties" />
              {mine.map(s => <SessionCard key={s.id} session={s} {...cardProps} />)}
            </div>
          )}
          {other.length > 0 && (
            <div>
              <SectionSep label="Toutes les parties" />
              {other.map(s => <SessionCard key={s.id} session={s} {...cardProps} />)}
            </div>
          )}
        </>
      ) : (
        <div>
          {filtered.map(s => <SessionCard key={s.id} session={s} {...cardProps} />)}
        </div>
      )}
    </div>
  )
}
