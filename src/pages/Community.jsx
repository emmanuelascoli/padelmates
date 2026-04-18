import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import Leaderboard from './Leaderboard'
import Members from './Members'

export default function Community() {
  // Allow pre-selecting tab via location state (e.g. navigate('/community', { state: { tab: 'members' } }))
  const location = useLocation()
  const defaultTab = location.state?.tab ?? 'leaderboard'
  const [tab, setTab] = useState(defaultTab)

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'leaderboard' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          🏆 Classement
        </button>
        <button
          onClick={() => setTab('members')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'members' ? 'bg-white text-blue-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          👥 Membres
        </button>
      </div>

      {/* Content */}
      {tab === 'leaderboard' ? <Leaderboard /> : <Members />}
    </div>
  )
}
