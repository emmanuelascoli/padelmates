import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return dateStr
  }
}

function timeAgo(ts) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: fr })
  } catch {
    return ''
  }
}

// ── Groupement temporel ───────────────────────────────────────────────────────

function getGroup(ts) {
  try {
    const d = new Date(ts)
    if (isToday(d))     return 'today'
    if (isYesterday(d)) return 'yesterday'
    return 'earlier'
  } catch {
    return 'earlier'
  }
}

const GROUP_LABELS = {
  today:     "Aujourd'hui",
  yesterday: 'Hier',
  earlier:   'Plus tôt',
}

// ── Icônes SVG par type ───────────────────────────────────────────────────────

const ICON_CALENDAR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const ICON_TROPHY = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
  </svg>
)
const ICON_PEOPLE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
)
const ICON_BALL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
  </svg>
)
const ICON_BELL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)
const ICON_CANCEL = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
)
const ICON_CARD = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
)
const ICON_STAR = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

// Icon config: { bg, color, icon }
const ICON_CONFIG = {
  game_created:             { bg: '#E8F5EE', color: '#2D6A4F', icon: ICON_CALENDAR },
  game_cancelled:           { bg: '#FEF2F2', color: '#DC2626', icon: ICON_CANCEL },
  result_recorded:          { bg: '#FFFBEB', color: '#D97706', icon: ICON_TROPHY },
  friend_request:           { bg: '#EFF6FF', color: '#3B82F6', icon: ICON_PEOPLE },
  friend_request_accepted:  { bg: '#EFF6FF', color: '#3B82F6', icon: ICON_PEOPLE },
  player_joined:            { bg: '#E8F5EE', color: '#2D6A4F', icon: ICON_BALL },
  player_promoted:          { bg: '#F5F3FF', color: '#7C3AED', icon: ICON_STAR },
  payment_reminder:         { bg: '#FFFBEB', color: '#D97706', icon: ICON_CARD },
  missing_players_reminder: { bg: '#FFF7ED', color: '#EA580C', icon: ICON_PEOPLE },
}

function NotifIcon({ type }) {
  const cfg = ICON_CONFIG[type] ?? { bg: '#F3F4F6', color: '#6B7280', icon: ICON_BELL }
  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{ width: 40, height: 40, borderRadius: 12, background: cfg.bg, color: cfg.color }}
    >
      {cfg.icon}
    </div>
  )
}

// ── Texte + lien par type ─────────────────────────────────────────────────────

function formatNames(names = []) {
  if (names.length === 0) return 'Quelqu\'un'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} et ${names[1]}`
  const rest = names.length - 2
  return `${names[0]}, ${names[1]} et ${rest} autre${rest > 1 ? 's' : ''}`
}

function notifContent(notif) {
  const { type, data } = notif
  const sessionSuffix = `${data.session_date ? ` du ${formatDate(data.session_date)}` : ''}${data.location ? ` à ${data.location}` : ''}`

  switch (type) {
    case 'friend_request':
      return { text: `${data.from_user_name} veut vous ajouter en ami`, href: `/players/${data.from_user_id}` }
    case 'friend_request_accepted':
      return { text: `${data.acceptor_name} a accepté votre demande d'ami`, href: `/players/${data.acceptor_id}` }
    case 'player_joined': {
      const names = data.player_names ?? (data.player_name ? [data.player_name] : [])
      const plural = names.length > 1
      return { text: `${formatNames(names)} ${plural ? 'ont' : 'a'} rejoint votre partie${sessionSuffix}`, href: `/sessions/${data.session_id}` }
    }
    case 'player_promoted':
      return { text: `Une place s'est libérée ! Tu as été inscrit à la partie${sessionSuffix}`, href: `/sessions/${data.session_id}` }
    case 'game_created':
      return { text: `${data.organizer_name} a créé une partie${data.session_date ? ` le ${formatDate(data.session_date)}` : ''}${data.location ? ` à ${data.location}` : ''}`, href: `/sessions/${data.session_id}` }
    case 'game_cancelled':
      return { text: `La partie${sessionSuffix} a été annulée`, href: `/sessions/${data.session_id}` }
    case 'result_recorded': {
      const count = data.match_count ?? 1
      const prefix = count > 1 ? `${count} matchs ont été enregistrés` : `${data.recorder_name} a enregistré le score`
      return { text: `${prefix} pour votre partie${data.session_date ? ` du ${formatDate(data.session_date)}` : ''}`, href: `/sessions/${data.session_id}` }
    }
    case 'payment_reminder':
      return { text: `Rappel — ta partie de demain${data.location ? ` à ${data.location}` : ''} : pense à régler ta part${data.amount ? ` (${data.amount} CHF)` : ''} avant la partie.`, href: `/sessions/${data.session_id}` }
    case 'missing_players_reminder': {
      const spots = data.spots_remaining ?? (data.max_players - data.current_players)
      return { text: `Ta partie de demain${data.location ? ` à ${data.location}` : ''} n'est pas complète — il manque encore ${spots} joueur${spots > 1 ? 's' : ''}.`, href: `/sessions/${data.session_id}` }
    }
    default:
      return { text: 'Nouvelle notification', href: '/' }
  }
}

// ── Composant notif individuelle ──────────────────────────────────────────────

function NotifItem({ notif, justRead, onAction, isLast }) {
  const navigate = useNavigate()
  const { text, href } = notifContent(notif)
  const isUnread = !notif.read
  const isNew    = justRead.has(notif.id)

  function handleClick() {
    onAction(notif.id)
    navigate(href)
  }

  return (
    <div
      className={`relative flex items-start gap-3 cursor-pointer transition-colors ${isUnread || isNew ? 'bg-[#F7FAF8]' : 'bg-white hover:bg-gray-50'}`}
      style={{ padding: '14px 16px', borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)' }}
      onClick={handleClick}
    >
      {/* Pastille non-lue */}
      {isUnread && (
        <span
          className="absolute"
          style={{ left: 5, top: '50%', transform: 'translateY(-50%)', width: 5, height: 5, background: '#52B788', borderRadius: '50%' }}
        />
      )}

      <NotifIcon type={notif.type} />

      <div className="flex-1 min-w-0">
        <p
          className="text-sm leading-snug text-gray-900"
          style={{
            fontWeight: isUnread ? 700 : 500,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {text}
        </p>
        <p className="text-xs text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>

        {notif.type === 'friend_request' && isUnread && (
          <FriendRequestActions notif={notif} onDone={() => onAction(notif.id)} />
        )}
      </div>
    </div>
  )
}

// ── Actions Accepter / Refuser ────────────────────────────────────────────────

function FriendRequestActions({ notif, onDone }) {
  const { user }        = useAuth()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  async function respond(accept) {
    if (busy || done) return
    setBusy(true)
    const { data: friendship } = await supabase
      .from('friendships')
      .select('id')
      .eq('requester_id', notif.data.from_user_id)
      .eq('addressee_id', user.id)
      .maybeSingle()
    if (friendship) {
      await supabase.from('friendships').update({ status: accept ? 'accepted' : 'declined' }).eq('id', friendship.id)
    }
    setDone(accept ? 'accepted' : 'refused')
    setBusy(false)
    onDone()
  }

  if (done === 'accepted') return <p className="text-xs text-forest-700 font-semibold mt-1.5">✓ Demande acceptée</p>
  if (done === 'refused')  return <p className="text-xs text-gray-400 mt-1.5">Demande refusée</p>

  return (
    <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
      <button onClick={() => respond(true)} disabled={busy}
        className="px-3 py-1.5 bg-forest-900 text-white text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-forest-800 transition-colors">
        Accepter
      </button>
      <button onClick={() => respond(false)} disabled={busy}
        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-gray-50 transition-colors">
        Refuser
      </button>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Notifications() {
  const { notifications, loading, markAllRead, markOneRead } = useNotifications()
  const [justRead, setJustRead] = useState(new Set())

  useEffect(() => {
    const unreadIds = new Set(notifications.filter(n => !n.read).map(n => n.id))
    if (unreadIds.size > 0) {
      setJustRead(unreadIds)
      markAllRead()
      const timer = setTimeout(() => setJustRead(new Set()), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  function handleAction(notifId) {
    markOneRead(notifId)
  }

  // Groupement temporel
  const groups = { today: [], yesterday: [], earlier: [] }
  notifications.forEach(n => {
    groups[getGroup(n.created_at)].push(n)
  })
  const orderedGroups = [
    { key: 'today',     label: GROUP_LABELS.today,     items: groups.today },
    { key: 'yesterday', label: GROUP_LABELS.yesterday, items: groups.yesterday },
    { key: 'earlier',   label: GROUP_LABELS.earlier,   items: groups.earlier },
  ].filter(g => g.items.length > 0)

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="section-title text-gray-900">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllRead} className="text-xs text-forest-700 hover:underline font-medium">
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 px-4">
          <div className="text-5xl mb-3">🔔</div>
          <p className="font-semibold text-gray-600">Aucune notification</p>
          <p className="text-sm text-gray-400 mt-1">Tu seras averti des demandes d'amis, nouvelles parties et résultats.</p>
        </div>
      ) : (
        orderedGroups.map(group => (
          <div key={group.key}>
            {/* Group title */}
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9CA3AF', marginBottom: 10 }}>
              {group.label}
            </p>
            {/* Group card */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              {group.items.map((notif, i) => (
                <NotifItem
                  key={notif.id}
                  notif={notif}
                  justRead={justRead}
                  onAction={handleAction}
                  isLast={i === group.items.length - 1}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
