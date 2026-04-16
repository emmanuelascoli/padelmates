import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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
    to: '/leaderboard',
    label: 'Classement',
    icon: (active) => (
      <svg className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-gray-500'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
              const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-blue-50 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.icon(active)}
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 flex items-center h-14">
          <span className="text-xl mr-2">🎾</span>
          <span className="font-bold text-gray-900">PadelMates</span>
        </div>
      </header>

      {/* Mobile bottom navbar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex">
          {NAV_ITEMS.map(item => {
            const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex-1 flex flex-col items-center py-2 gap-0.5"
              >
                {item.icon(active)}
                <span className={`text-xs ${active ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
