import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { formatDistanceToNow } from 'date-fns'
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

// ── Icônes par type ───────────────────────────────────────────────────────────

function NotifIcon({ type }) {
  const base = 'w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg'
  switch (type) {
    case 'friend_request':            return <div className={`${base} bg-blue-100`}>🤝</div>
    case 'friend_request_accepted':   return <div className={`${base} bg-green-100`}>✅</div>
    case 'player_joined':             return <div className={`${base} bg-green-100`}>🎾</div>
    case 'player_promoted':           return <div className={`${base} bg-green-100`}>🎉</div>
    case 'game_created':              return <div className={`${base} bg-forest-50`}>📅</div>
    case 'game_cancelled':            return <div className={`${base} bg-red-100`}>❌</div>
    case 'result_recorded':           return <div className={`${base} bg-orange-100`}>🏆</div>
    case 'payment_reminder':          return <div className={`${base} bg-yellow-100`}>💳</div>
    case 'missing_players_reminder':  return <div className={`${base} bg-orange-100`}>👥</div>
    default:                          return <div className={`${base} bg-gray-100`}>🔔</div>
  }
}

// ── Texte + lien par type ─────────────────────────────────────────────────────

// Formate une liste de noms en français : "Jean", "Jean et Marie",
// "Jean, Marie et 2 autres"
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
      return {
        text: `${data.from_user_name} veut vous ajouter en ami`,
        href: `/players/${data.from_user_id}`,
      }

    case 'friend_request_accepted':
      return {
        text: `${data.acceptor_name} a accepté votre demande d'ami`,
        href: `/players/${data.acceptor_id}`,
      }

    case 'player_joined': {
      // Compatibilité avec l'ancien format (player_name) et le nouveau (player_names[])
      const names = data.player_names ?? (data.player_name ? [data.player_name] : [])
      const plural = names.length > 1
      return {
        text: `${formatNames(names)} ${plural ? 'ont' : 'a'} rejoint votre partie${sessionSuffix}`,
        href: `/sessions/${data.session_id}`,
      }
    }

    case 'player_promoted':
      return {
        text: `🎉 Une place s'est libérée ! Tu as été inscrit à la partie${sessionSuffix}`,
        href: `/sessions/${data.session_id}`,
      }

    case 'game_created':
      return {
        text: `${data.organizer_name} a créé une partie${data.session_date ? ` le ${formatDate(data.session_date)}` : ''}${data.location ? ` à ${data.location}` : ''}`,
        href: `/sessions/${data.session_id}`,
      }

    case 'game_cancelled':
      return {
        text: `La partie${sessionSuffix} a été annulée`,
        href: `/sessions/${data.session_id}`,
      }

    case 'result_recorded': {
      const count = data.match_count ?? 1
      const prefix = count > 1
        ? `${count} matchs ont été enregistrés`
        : `${data.recorder_name} a enregistré le score`
      return {
        text: `${prefix} pour votre partie${data.session_date ? ` du ${formatDate(data.session_date)}` : ''}`,
        href: `/sessions/${data.session_id}`,
      }
    }

    case 'payment_reminder':
      return {
        text: `💳 Rappel — ta partie de demain${data.location ? ` à ${data.location}` : ''} : pense à régler ta part${data.amount ? ` (${data.amount} CHF)` : ''} avant la partie.`,
        href: `/sessions/${data.session_id}`,
      }

    case 'missing_players_reminder': {
      const spots = data.spots_remaining ?? (data.max_players - data.current_players)
      return {
        text: `⚠️ Ta partie de demain${data.location ? ` à ${data.location}` : ''} n'est pas complète — il manque encore ${spots} joueur${spots > 1 ? 's' : ''}.`,
        href: `/sessions/${data.session_id}`,
      }
    }

    default:
      return { text: 'Nouvelle notification', href: '/' }
  }
}

// ── Composant notif individuelle ──────────────────────────────────────────────

function NotifItem({ notif, justRead, onAction }) {
  const navigate  = useNavigate()
  const { text, href } = notifContent(notif)
  const isUnread  = !notif.read
  const isNew     = justRead.has(notif.id)

  function handleClick() {
    onAction(notif.id)
    navigate(href)
  }

  return (
    <div
      className={`
        relative px-4 py-3.5 flex items-start gap-3 cursor-pointer
        transition-colors duration-300
        ${isUnread || isNew
          ? 'bg-forest-50'
          : 'bg-white hover:bg-gray-50'}
        ${isNew ? 'animate-fade-out' : ''}
      `}
      onClick={handleClick}
    >
      {/* Pastille non-lue */}
      {isUnread && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-forest-700 rounded-full" />
      )}

      <NotifIcon type={notif.type} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
          {text}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notif.created_at)}</p>

        {/* Actions inline pour demande d'ami */}
        {notif.type === 'friend_request' && isUnread && (
          <FriendRequestActions notif={notif} onDone={() => onAction(notif.id)} />
        )}
      </div>
    </div>
  )
}

// ── Actions Accepter / Refuser ────────────────────────────────────────────────

function FriendRequestActions({ notif, onDone }) {
  const { user }    = useAuth()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // 'accepted' | 'refused'

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
      await supabase
        .from('friendships')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', friendship.id)
    }
    setDone(accept ? 'accepted' : 'refused')
    setBusy(false)
    onDone()
  }

  if (done === 'accepted') {
    return <p className="text-xs text-forest-700 font-semibold mt-1.5">✓ Demande acceptée</p>
  }
  if (done === 'refused') {
    return <p className="text-xs text-gray-400 mt-1.5">Demande refusée</p>
  }

  return (
    <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => respond(true)}
        disabled={busy}
        className="px-3 py-1.5 bg-forest-900 text-white text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-forest-800 transition-colors"
      >
        Accepter
      </button>
      <button
        onClick={() => respond(false)}
        disabled={busy}
        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-gray-50 transition-colors"
      >
        Refuser
      </button>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function Notifications() {
  const { notifications, loading, markAllRead, markOneRead } = useNotifications()
  const [justRead, setJustRead] = useState(new Set())

  // Dès que la page s'ouvre, on marque tout comme lu
  useEffect(() => {
    const unreadIds = new Set(notifications.filter(n => !n.read).map(n => n.id))
    if (unreadIds.size > 0) {
      setJustRead(unreadIds)
      markAllRead()
      // Effacer la surbrillance après 3 secondes
      const timer = setTimeout(() => setJustRead(new Set()), 3000)
      return () => clearTimeout(timer)
    }
  }, []) // Intentionnellement vide — on veut capturer les non-lues à l'ouverture

  function handleAction(notifId) {
    markOneRead(notifId)
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="section-title text-gray-900">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button
            onClick={markAllRead}
            className="text-xs text-forest-700 hover:underline font-medium"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="text-5xl mb-3">🔔</div>
            <p className="font-semibold text-gray-600">Aucune notification</p>
            <p className="text-sm text-gray-400 mt-1">Tu seras averti des demandes d'amis, nouvelles parties et résultats.</p>
          </div>
        ) : (
          notifications.map(notif => (
            <NotifItem
              key={notif.id}
              notif={notif}
              justRead={justRead}
              onAction={handleAction}
            />
          ))
        )}
      </div>
    </div>
  )
}
