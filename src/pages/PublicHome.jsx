import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Public session card ───────────────────────────────────────
function PublicSessionCard({ session, onJoin }) {
  const date = new Date(`${session.date}T${session.time}`)
  const participantCount = session._count ?? 0
  const spotsLeft = session.max_players - participantCount
  const isFull = spotsLeft <= 0
  const pct = Math.min(100, Math.round((participantCount / session.max_players) * 100))

  let dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')
  if (isToday(date))    dayLabel = 'AUJ.'
  if (isTomorrow(date)) dayLabel = 'DEM.'

  const timeFormatted = date.getMinutes() === 0
    ? `${date.getHours()}h`
    : `${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`

  const avatarSlots = Array.from({ length: Math.min(participantCount, 3) })

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 12 }}>
        {/* Date block */}
        <div style={{ background: '#14532d', borderRadius: 10, width: 48, flexShrink: 0, padding: '7px 0', textAlign: 'center', marginRight: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#6B9B7A', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>{dayLabel}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginTop: 2 }}>{format(date, 'd')}</div>
          <div style={{ fontSize: 9, color: '#6B9B7A', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#52B788', marginTop: 5, lineHeight: 1 }}>{timeFormatted}</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>{session.title}</div>
            {isFull && (
              <span style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                Complet
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{session.location}</span>
          </div>

          {/* Avatars + spots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <div style={{ display: 'flex' }}>
              {avatarSlots.map((_, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: '#E5E7EB', border: '2px solid #fff', marginLeft: i > 0 ? -7 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="#9CA3AF">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                </div>
              ))}
              {participantCount === 0 && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sois le premier !</span>}
            </div>
            {participantCount > 0 && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{participantCount} / {session.max_players} inscrits</span>}
            {!isFull && (
              <span style={{ background: '#DCFCE7', color: '#166534', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Slot bar */}
          <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: isFull ? '#EF4444' : '#4ade80', width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '0.5px solid #F3F4F6', padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Connecte-toi pour voir les joueurs
        </span>
        <button
          onClick={() => onJoin(session)}
          style={{ background: isFull ? '#F3F4F6' : '#14532d', color: isFull ? '#6B7280' : '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >
          {isFull ? "Liste d'attente" : 'Rejoindre →'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PublicHome() {
  const navigate = useNavigate()
  const [sessions, setSessions]             = useState([])
  const [communityStats, setCommunityStats] = useState({ players: 0, sessions: 0, matches: 0 })
  const [loading, setLoading]               = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    await Promise.all([fetchPublicSessions(), fetchCommunityStats()])
    setLoading(false)
  }

  async function fetchCommunityStats() {
    const [
      { count: players },
      { count: sessionsCount },
      { count: matchesCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).not('winner_team', 'is', null),
    ])
    setCommunityStats({ players: players ?? 0, sessions: sessionsCount ?? 0, matches: matchesCount ?? 0 })
  }

  async function fetchPublicSessions() {
    const today = new Date().toISOString().split('T')[0]
    const { data: sessionsData, error } = await supabase
      .from('sessions')
      .select('id, title, date, time, location, max_players, cost_per_player, level_min, level_max, status')
      .eq('status', 'open')
      .eq('is_private', false)
      .gte('date', today)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .limit(3)

    if (error || !sessionsData?.length) return

    const sessionIds = sessionsData.map(s => s.id)
    const { data: partsData } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('session_id', sessionIds)

    const countMap = {}
    ;(partsData || []).forEach(p => { countMap[p.session_id] = (countMap[p.session_id] ?? 0) + 1 })

    setSessions(sessionsData.map(s => ({ ...s, _count: countMap[s.id] ?? 0 })))
  }

  function handleJoin(session) {
    navigate(`/auth?join=${session.id}&mode=register`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F4F0', marginLeft: -16, marginRight: -16, marginTop: -24 }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div style={{ background: '#14532d', padding: '40px 22px 56px', position: 'relative', overflow: 'hidden' }}>
        {/* Décors subtils */}
        <div style={{ position: 'absolute', top: -80, right: -60,  width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: '5px 14px', marginBottom: 24 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>PadelMates · Genève</span>
          </div>

          {/* Grand titre typographique */}
          <h1 style={{ fontSize: 42, fontWeight: 700, color: '#fff', lineHeight: 1.0, letterSpacing: '-1.5px', margin: '0 0 16px' }}>
            Ton padel,<br />enfin<br />organisé.
          </h1>

          {/* Sous-titre court */}
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: '0 0 32px', maxWidth: 280 }}>
            Inscriptions, scores, classement —<br />tout au même endroit.
          </p>

          {/* CTA principal */}
          <button
            onClick={() => navigate('/auth?mode=register')}
            style={{ background: '#fff', color: '#14532d', border: 'none', borderRadius: 14, padding: '15px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 12 }}
          >
            Rejoindre la communauté →
          </button>

          {/* Liens discrets */}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', margin: 0 }}>
            Gratuit · 30 sec ·{' '}
            <span
              onClick={() => navigate('/auth?mode=login')}
              style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Déjà membre ?
            </span>
          </p>
        </div>
      </div>

      {/* ── Sheet ─────────────────────────────────────────────── */}
      <div style={{ background: '#F5F4F0', borderRadius: '24px 24px 0 0', marginTop: -20, padding: '24px 16px 52px', position: 'relative', zIndex: 2 }}>

        {/* ── Prochaines parties ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Prochaines parties</div>
          {!loading && sessions.length > 0 && (
            <span style={{ fontSize: 11, color: '#14532d', fontWeight: 500 }}>
              {sessions.length} ouvertes
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '36px 0' }}>
            <div style={{ width: 26, height: 26, border: '3px solid #14532d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px dashed #D1D5DB', padding: '28px 16px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Aucune partie prévue pour l'instant</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Inscris-toi pour organiser la prochaine !</div>
          </div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {sessions.map(s => (
              <PublicSessionCard key={s.id} session={s} onJoin={handleJoin} />
            ))}
          </div>
        )}

        {/* ── Stats communauté ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { val: communityStats.players,  label: 'joueurs' },
              { val: communityStats.sessions, label: 'parties' },
              { val: communityStats.matches,  label: 'matchs joués' },
            ].map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '16px 0', borderRight: i < 2 ? '0.5px solid #E2E0D8' : 'none' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA final ── */}
        <div style={{ background: '#14532d', borderRadius: 16, padding: '26px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>
            Prêt à jouer ? 🎾
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, marginBottom: 22 }}>
            Gratuit, sans app à installer.<br />Inscription en 30 secondes.
          </div>
          <button
            onClick={() => navigate('/auth?mode=register')}
            style={{ background: '#fff', color: '#14532d', border: 'none', borderRadius: 12, padding: '14px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', marginBottom: 14 }}
          >
            Créer mon compte gratuit →
          </button>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            Déjà membre ?{' '}
            <span
              onClick={() => navigate('/auth?mode=login')}
              style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Se connecter
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
