import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Auth from './pages/Auth'
import Home from './pages/Home'
import PublicHome from './pages/PublicHome'
import ProfileSetup from './pages/ProfileSetup'
import Sessions from './pages/Sessions'
import NewSession from './pages/NewSession'
import SessionDetail from './pages/SessionDetail'
import Leaderboard from './pages/Leaderboard'
import Community from './pages/Community'
import Profile from './pages/Profile'
import PlayerProfile from './pages/PlayerProfile'
import ResetPassword from './pages/ResetPassword'
import Members from './pages/Members'
import Admin from './pages/Admin'
import SessionByToken from './pages/SessionByToken'
import CGU from './pages/CGU'
import Confidentialite from './pages/Confidentialite'
import MentionsLegales from './pages/MentionsLegales'
import Footer from './components/Footer'
import CookieBanner from './components/CookieBanner'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-forest-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AppRoutes() {
  const { user, loading, needsProfileSetup } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-forest-900 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // User is authenticated but has no profile yet (e.g. just signed in with Google)
  if (user && needsProfileSetup) {
    return <ProfileSetup />
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#EAE0D0]">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-6 pb-28 md:pb-6">
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Home: public landing for guests, app home for authenticated */}
            <Route path="/" element={user ? <Home /> : <PublicHome />} />

            {/* Session detail: public teaser for guests (handled inside component), full view for auth */}
            <Route path="/sessions/:id" element={<SessionDetail />} />

            {/* Private session access via unique token */}
            <Route path="/partie/:token" element={<SessionByToken />} />

            {/* Legal pages — public, no auth required */}
            <Route path="/cgu" element={<CGU />} />
            <Route path="/confidentialite" element={<Confidentialite />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />

            {/* Protected routes */}
            <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/sessions/new" element={<ProtectedRoute><NewSession /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
            <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
            <Route path="/players/:id" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
      <CookieBanner />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
