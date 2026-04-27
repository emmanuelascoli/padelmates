import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(null)
  const [profile, setProfile]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)
  const [oauthMeta, setOauthMeta]           = useState(null) // { name, avatar_url } from Google

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // "Don't remember me" check
        const sessionOnly  = localStorage.getItem('padelmates_session_only')
        const activeThisTab = sessionStorage.getItem('padelmates_active')
        if (sessionOnly === '1' && !activeThisTab) {
          supabase.auth.signOut()
          setLoading(false)
          return
        }
        setUser(session.user)
        fetchProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user)
      } else {
        setProfile(null)
        setNeedsProfileSetup(false)
        setOauthMeta(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(authUser) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (data) {
      setProfile(data)
      setNeedsProfileSetup(false)
      setOauthMeta(null)
      // Logue la connexion à chaque chargement de profil (anti-doublon 1h en DB)
      // Utilise .then(null, () => {}) plutôt que .catch() car le builder
      // Supabase est un "thenable" sans garantie de .catch()
      supabase.rpc('log_user_login').then(null, () => {})
    } else {
      // No profile yet — extract OAuth metadata for pre-fill
      const meta = authUser.user_metadata || {}
      setOauthMeta({
        name:       meta.full_name || meta.name || '',
        avatar_url: meta.picture   || meta.avatar_url || null,
      })
      setNeedsProfileSetup(true)
    }
    setLoading(false)
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const role      = profile?.role ?? 'member'
  const isAdmin   = role === 'admin'
  const isOrganizer = role === 'admin' || role === 'organizer'

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      needsProfileSetup, oauthMeta,
      role, isAdmin, isOrganizer,
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
