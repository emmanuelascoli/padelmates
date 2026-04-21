import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_SHORT, BADGES } from '../lib/constants'

// ── Session Card ─────────────────────────────────────────────
function SessionCard({ session, userId }) {
  const date       = new Date(`${session.date}T${session.time}`)
  const count      = session.session_participants?.length ?? 0
  const max        = session.max_players
  const isFull     = count >= max
  const isPastSess = isPast(date)
  const registered = (session.session_participants || []).some(p => p.user_id === userId)
  const pct        = Math.min(100, Math.round((count / max) * 100))

  let dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')
  if (isToday(date))    dayLabel = 'AUJ.'
  if (isTomorrow(date)) dayLabel = 'DEM.'

  return (
    <Link to={`/sessions/${session.id}`} className="block bg-white rounded-2xl shadow-sm overflow-hidden mb-3 active:scale-[0.99] transition-transform">
      <div className="flex items-stretch">

        {/* ── Date column ── */}
        <div className="w-[72px] bg-[#1A3528] flex flex-col items-center justify-center py-4 shrink-0">
          <span className="text-[#6B9B7A] text-[10px] font-semibold tracking-widest uppercase leading-none">
            {dayLabel}
          </span>
          <span className="text-white text-[28px] font-bold leading-tight mt-0.5">
            {format(date, 'd')}
          </span>
          <span className="text-[#6B9B7A] text-[10px] uppercase tracking-wide leading-none">
            {format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}
          </span>
          <span className="text-[#7BC47B] text-xs font-semibold mt-1.5 leading-none">
            {format(date, 'HH:mm')}
          </span>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 px-4 py-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="font-bold text-gray-900 text-[15px] leading-snug">{session.title}</span>
            {registered && (
              <span className="shrink-0 inline-flex items-center gap-1 bg-[#E8F5EC] text-[#1A6B3A] text-[11px] font-semibold px-2 py-0.5 rounded-full">
                ✓ Inscrit
              </span>
            )}
            {!isPastSess && isFull && !registered && (
              <span className="shrink-0 inline-flex items-center bg-orange-100 text-orange-600 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                Complet
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-gray-400 text-xs mb-2.5">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.location}
          </div>

          {/* Slot bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
            <div
              className={`h-1.5 rounded-full ${isFull ? 'bg-orange-400' : 'bg-[#4CAF6F]'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">{count} / {max} joueurs</span>
            {isFull
              ? <span className="text-orange-500 font-semibold">Complet</span>
              : <span className="text-[#1A6B3A] font-semibold">{max - count} place{max - count > 1 ? 's' : ''} dispo</span>
            }
          </div>
        </div>

      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function Home() {
  const { user, profile, signOut } = useAuth()
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [totalUpcoming, setTotalUpcoming]       = useState(0)
  const [myStats, setMyStats]  = useState({ wins: 0, played: 0, friends: 0 })
  const [loading, setLoading]  = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [{ data: sessions }, { count: total }] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, session_participants(id, user_id), organizer:profiles!sessions_organizer_id_fkey(name, badges)')
        .gte('date', today)
        .neq('status', 'cancelled')
        .eq('is_private', false)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .limit(5),
      supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('date', today)
        .neq('status', 'cancelled')
        .eq('is_private', false),
    ])

    setUpcomingSessions(sessions || [])
    setTotalUpcoming(total ?? 0)

    if (profile) {
      const { data: matches } = await supabase
        .from('valid_matches')
        .select('*')
        .or(`team1_player1.eq.${profile.id},team1_player2.eq.${profile.id},team2_player1.eq.${profile.id},team2_player2.eq.${profile.id}`)
        .not('winner_team', 'is', null)

      let wins = 0
      ;(matches || []).forEach(m => {
        const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
        if ((isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)) wins++
      })

      const { count: friends } = await supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
        .eq('status', 'accepted')

      setMyStats({ wins, played: matches?.length ?? 0, friends: friends ?? 0 })
    }

    setLoading(false)
  }

  const firstName = profile?.name?.split(' ')[0] ?? 'Joueur'
  const levelLabel = LEVEL_SHORT[profile?.level] ?? ''

  return (
    // Outer container — the beige bg shows at the very top behind the banner
    <div className="-mx-4 -mt-6">

      {/* ── Green banner ────────────────────────────────── */}
      <div className="bg-[#1A3528] px-5 pt-7 pb-16">

        {/* Greeting row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[#6B9B7A] text-sm font-medium tracking-wide">Bonjour,</p>
            <h1 className="text-white text-[36px] font-bold leading-tight tracking-tight mt-0.5">
              {firstName}
            </h1>
            {levelLabel && (
              <span className="inline-flex items-center gap-2 mt-2.5 bg-[#243D2C] text-[#90C9A0] text-xs font-medium px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF6F]" />
                {levelLabel}
              </span>
            )}
          </div>
          <div className="w-12 h-12 bg-[#243D2C]/60 rounded-2xl flex items-center justify-center text-2xl mt-1">
            🎾
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 rounded-2xl overflow-hidden bg-[#243D2C]/50">
          {[
            { value: myStats.played, label: 'Parties' },
            { value: myStats.wins,   label: 'Victoires' },
            { value: myStats.friends, label: 'Amis actifs' },
          ].map((s, i) => (
            <div key={s.label} className={`py-3.5 text-center ${i < 2 ? 'border-r border-[#1A3528]/60' : ''}`}>
              <div className="text-white text-2xl font-bold">{s.value}</div>
              <div className="text-[#6B9B7A] text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── White sheet (overlaps banner) ───────────────── */}
      <div className="bg-white rounded-t-3xl -mt-8 px-4 pt-6 pb-10 min-h-screen">

        {/* Buttons */}
        <div className="flex gap-3 mb-6">
          <Link
            to="/sessions/new"
            className="flex-1 flex items-center justify-center gap-2 bg-[#1A3528] hover:bg-[#243D2C] text-white font-semibold text-sm py-3.5 rounded-2xl transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Organiser une partie
          </Link>
          <Link
            to="/sessions"
            className="flex items-center justify-center bg-white border border-gray-200 text-gray-700 font-semibold text-sm py-3.5 px-5 rounded-2xl shadow-sm hover:bg-gray-50 transition-colors"
          >
            Voir tout
          </Link>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base">Prochaines parties</h3>
          <Link to="/sessions" className="text-sm text-[#1A6B3A] font-medium hover:underline">
            Tout voir →
          </Link>
        </div>

        {/* Sessions */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-[3px] border-[#1A3528] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingSessions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm font-medium text-gray-500">Aucune partie prévue</p>
            <Link to="/sessions/new" className="text-sm text-[#1A6B3A] hover:underline mt-2 inline-block font-medium">
              Organiser la première →
            </Link>
          </div>
        ) : (
          <>
            {upcomingSessions.map(s => <SessionCard key={s.id} session={s} userId={user?.id} />)}
            {totalUpcoming > 5 && (
              <Link
                to="/sessions"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-500 hover:border-forest-300 hover:text-forest-700 hover:bg-forest-50 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {totalUpcoming - 5} autre{totalUpcoming - 5 > 1 ? 's' : ''} partie{totalUpcoming - 5 > 1 ? 's' : ''} à venir
              </Link>
            )}
          </>
        )}

        {/* Sign out */}
        <div className="text-center pt-4">
          <button onClick={signOut} className="text-xs text-gray-300 hover:text-gray-500 transition-colors">
            Se déconnecter
          </button>
        </div>

      </div>
    </div>
  )
}
