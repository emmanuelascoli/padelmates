import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Accueil',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-gray-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    to: '/sessions',
    label: 'Parties',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-gray-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    to: '/community',
    label: 'Communauté',
    // Match both /community, /leaderboard and /members as "active"
    matchPaths: ['/community', '/leaderboard', '/members'],
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-gray-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    to: '/profile',
    label: 'Profil',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-gray-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
]

export default function Navbar() {
  const location = useLocation()
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (user) fetchPendingCount()
  }, [location.pathname, user])

  async function fetchPendingCount() {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
    setPendingCount(count || 0)
  }

  function isActive(item) {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p)))
    }
    return location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
  }

  if (!user) return null

  return (
    <>
      {/* Desktop top navbar */}
      <header className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🎾</span>
            <span className="font-bold text-gray-900 text-lg">PadelMates</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(item => {
              const active = isActive(item)
              const isProfile = item.to === '/profile'
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-blue-50 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.icon(active)}
                  {item.label}
                  {isProfile && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎾</span>
            <span className="font-bold text-gray-900">PadelMates</span>
          </div>
          {pendingCount > 0 && (
            <Link to="/profile" className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
              demande{pendingCount > 1 ? 's' : ''} d'ami
            </Link>
          )}
        </div>
      </header>

      {/* Mobile bottom navbar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex">
          {NAV_ITEMS.map(item => {
            const active = isActive(item)
            const isProfile = item.to === '/profile'
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative flex-1 flex flex-col items-center py-2 gap-0.5"
              >
                {item.icon(active)}
                <span className={`text-xs ${active ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                  {item.label}
                </span>
                {isProfile && pendingCount > 0 && (
                  <span className="absolute top-1 right-1/4 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
