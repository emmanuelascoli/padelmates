import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const NotificationsContext = createContext({
  notifications:  [],
  unreadCount:    0,
  loading:        true,
  markAllRead:    async () => {},
  markOneRead:    async () => {},
  refresh:        async () => {},
})

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const channelRef                        = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  // ── Fetch initial ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user) { setNotifications([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }, [user])

  // ── Marquer tout comme lu ────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!user) return
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return

    // Optimistic update immédiat
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))

    await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds)
      .eq('user_id', user.id)
  }, [user, notifications])

  // ── Marquer une notif comme lue ──────────────────────────────────────────────
  const markOneRead = useCallback(async (notifId) => {
    if (!user) return
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n))
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notifId)
      .eq('user_id', user.id)
  }, [user])

  // ── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    refresh()

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new : n)
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [user?.id])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, markAllRead, markOneRead, refresh }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
