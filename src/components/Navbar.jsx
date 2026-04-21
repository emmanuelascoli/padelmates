import { useLocation, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconHome = ({ active }) => (
  <svg className={`w-5 h-5 ${active ? 'text-forest-900' : 'text-gray-400'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)
const IconCalendar = ({ active }) => (
  <svg className={`w-5 h-5 ${active ? 'text-forest-900' : 'text-gray-400'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const IconCommunity = ({ active }) => (
  <svg className={`w-5 h-5 ${active ? 'text-forest-900' : 'text-gray-400'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const IconProfile = ({ active }) => (
  <svg className={`w-5 h-5 ${active ? 'text-forest-900' : 'text-gray-400'}`} fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const IconBell = ({ active, className = '' }) => (
  <svg
    className={`w-5 h-5 ${active ? 'text-forest-900' : 'text-gray-400'} ${className}`}
    fill={active ? 'currentColor' : 'none'}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={active ? 0 : 1.8}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const LEFT_ITEMS = [
  { to: '/',        label: 'Accueil',  icon: IconHome },
  { to: '/sessions',label: 'Parties',  icon: IconCalendar },
]
const RIGHT_ITEMS = [
  { to: '/community', label: 'Communauté', icon: IconCommunity, matchPaths: ['/community', '/leaderboard', '/members'] },
  { to: '/profile',   label: 'Profil',     icon: IconProfile },
]
const ALL_DESKTOP_ITEMS = [...LEFT_ITEMS, ...RIGHT_ITEMS]

// ── Badge helper ──────────────────────────────────────────────────────────────
function Badge({ count }) {
  if (!count || count === 0) return null
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none ring-2 ring-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default function Navbar() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, isAdmin } = useAuth()
  const { unreadCount, markAllRead } = useNotifications()

  function isActive(item) {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p || (p !== '/' && location.pathname.startsWith(p)))
    }
    return location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
  }

  const bellActive = location.pathname === '/notifications'

  function handleBellClick() {
    markAllRead()
    navigate('/notifications')
  }

  if (!user) return null

  return (
    <>
      {/* ── Desktop top navbar ───────────────────────────── */}
      <header className="hidden md:block bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 mr-6">
            <div className="w-9 h-9 bg-forest-900 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-lg">🎾</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">PadelMates</span>
          </Link>

          {/* Nav items */}
          <nav className="flex items-center gap-0.5 flex-1">
            {ALL_DESKTOP_ITEMS.map(item => {
              const active = isActive(item)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    active ? 'text-forest-900 bg-forest-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <item.icon active={active} />
                  {item.label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-forest-900 rounded-full" />
                  )}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                to="/admin"
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/admin' ? 'text-purple-700 bg-purple-50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <svg className={`w-5 h-5 ${location.pathname === '/admin' ? 'text-purple-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
          </nav>

          {/* Cloche + CTA desktop */}
          <div className="flex items-center gap-2 ml-2">
            {/* Cloche */}
            <button
              onClick={handleBellClick}
              className={`relative p-2 rounded-xl transition-all ${
                bellActive ? 'bg-forest-50 text-forest-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
              aria-label="Notifications"
            >
              <IconBell active={bellActive} />
              <Badge count={unreadCount} />
            </button>

            {/* CTA */}
            <Link to="/sessions/new" className="btn-primary text-sm py-2 px-4 gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Créer
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ───────────────────────────────── */}
      <header className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-forest-900 rounded-xl flex items-center justify-center">
              <span className="text-sm">🎾</span>
            </div>
            <span className="font-bold text-gray-900">PadelMates</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <Link to="/admin" className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                location.pathname === '/admin'
                  ? 'bg-purple-100 border-purple-200 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-600'
              }`}>
                👑 Admin
              </Link>
            )}
            {/* Cloche mobile */}
            <button
              onClick={handleBellClick}
              className={`relative p-2 rounded-xl transition-all ${
                bellActive ? 'bg-forest-50' : 'hover:bg-gray-50'
              }`}
              aria-label="Notifications"
            >
              <IconBell active={bellActive} />
              <Badge count={unreadCount} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom navbar with FAB ────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 shadow-[0_-1px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-end">
          {/* Left items */}
          {LEFT_ITEMS.map(item => {
            const active = isActive(item)
            return (
              <Link key={item.to} to={item.to} className="relative flex-1 flex flex-col items-center pt-2.5 pb-2 gap-0.5">
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-forest-900 rounded-full" />}
                <item.icon active={active} />
                <span className={`text-xs ${active ? 'text-forest-900 font-semibold' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* FAB — centre */}
          <div className="flex-1 flex justify-center pb-2">
            <Link
              to="/sessions/new"
              className="w-14 h-14 bg-forest-900 rounded-2xl flex items-center justify-center shadow-lg shadow-forest-900/30 -translate-y-3 active:scale-95 transition-transform"
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>

          {/* Right items */}
          {RIGHT_ITEMS.map(item => {
            const active = isActive(item)
            return (
              <Link key={item.to} to={item.to} className="relative flex-1 flex flex-col items-center pt-2.5 pb-2 gap-0.5">
                {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-forest-900 rounded-full" />}
                <item.icon active={active} />
                <span className={`text-xs ${active ? 'text-forest-900 font-semibold' : 'text-gray-400'}`}>
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
