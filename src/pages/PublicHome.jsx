import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Public session card ───────────────────────────────────────
function PublicSessionCard({ session, onJoin, dimmed = false }) {
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
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '0.5px solid #E2E0D8',
        overflow: 'hidden',
        opacity: dimmed ? 0.6 : 1,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: 12 }}>
        {/* Date block */}
        <div style={{
          background: '#14532d', borderRadius: 10, width: 48, flexShrink: 0,
          padding: '7px 0', textAlign: 'center', marginRight: 12,
        }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#6B9B7A', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>{dayLabel}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.15, marginTop: 2 }}>{format(date, 'd')}</div>
          <div style={{ fontSize: 9, color: '#6B9B7A', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#52B788', marginTop: 5, lineHeight: 1 }}>{timeFormatted}</div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>
              {session.title}
            </div>
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
                <div key={i} style={{
                  width: 22, height: 22, borderRadius: '50%', background: '#E5E7EB',
                  border: '2px solid #fff', marginLeft: i > 0 ? -7 : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="#9CA3AF">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                  </svg>
                </div>
              ))}
              {participantCount === 0 && (
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Sois le premier !</span>
              )}
            </div>
            {participantCount > 0 && (
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>{participantCount} / {session.max_players} inscrits</span>
            )}
            {!isFull && (
              <span style={{ background: '#DCFCE7', color: '#166534', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 999, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {spotsLeft} place{spotsLeft > 1 ? 's' : ''} libre{spotsLeft > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Slot bar */}
          <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: isFull ? 'linear-gradient(90deg,#fca5a5,#dc2626)' : 'linear-gradient(90deg,#86efac,#16a34a)',
              width: `${pct}%`,
            }} />
          </div>
        </div>
      </div>

      {/* Footer row */}
      {!dimmed && (
        <div style={{ borderTop: '0.5px solid #F3F4F6', padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            Connecte-toi pour voir les joueurs
          </span>
          <button
            onClick={() => onJoin(session)}
            style={{
              background: isFull ? '#F3F4F6' : '#14532d',
              color: isFull ? '#6B7280' : '#fff',
              border: 'none', borderRadius: 8,
              padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            {isFull ? "Liste d'attente" : 'Rejoindre →'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────────
function FeatureCard({ emoji, bg, title, desc }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', padding: '14px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 34, height: 34, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emoji}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.55 }}>{desc}</div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PublicHome() {
  const navigate = useNavigate()
  const [sessions, setSessions]   = useState([])
  const [communityStats, setCommunityStats] = useState({ players: 0, sessions: 0, matches: 0 })
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetchAll()
  }, [])

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
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'open').neq('status', 'cancelled'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).not('winner_team', 'is', null),
    ])
    setCommunityStats({
      players:  players  ?? 0,
      sessions: sessionsCount ?? 0,
      matches:  matchesCount  ?? 0,
    })
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
    ;(partsData || []).forEach(p => {
      countMap[p.session_id] = (countMap[p.session_id] ?? 0) + 1
    })

    setSessions(sessionsData.map(s => ({ ...s, _count: countMap[s.id] ?? 0 })))
  }

  function handleJoin(session) {
    navigate(`/auth?join=${session.id}&mode=register`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F4F0', marginLeft: -16, marginRight: -16, marginTop: -24 }}>

      {/* ── Hero ── */}
      <div style={{ background: '#14532d', padding: '36px 20px 52px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* App pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 14px', marginBottom: 20 }}>
            <span style={{ fontSize: 16 }}>🎾</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>PadelMates · Genève</span>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: 12 }}>
            Ton groupe padel,<br />organisé sans effort
          </h1>
          <p style={{ fontSize: 14, color: '#90C9A0', lineHeight: 1.6, marginBottom: 24, maxWidth: 320 }}>
            Inscriptions, paiements, classement ELO — tout au même endroit, pour toi et tes partenaires.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/auth?mode=register')}
              style={{ background: 'rgba(255,255,255,0.95)', color: '#14532d', border: 'none', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              Créer mon compte gratuit
            </button>
            <button
              onClick={() => navigate('/auth?mode=login')}
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.75)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              Se connecter
            </button>
          </div>

          {/* Reassurance */}
          <div style={{ display: 'flex', gap: 18, marginTop: 20, flexWrap: 'wrap' }}>
            {['Gratuit', 'Inscription en 30 sec', 'Pas d\'app à installer'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6B9B7A' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sheet ── */}
      <div style={{ background: '#F5F4F0', borderRadius: '24px 24px 0 0', marginTop: -20, padding: '20px 16px 40px', position: 'relative', zIndex: 2 }}>

        {/* Community stats */}
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { val: communityStats.players,  label: 'joueurs' },
              { val: communityStats.sessions, label: 'parties jouées' },
              { val: communityStats.matches,  label: 'matchs joués' },
            ].map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '14px 0', borderRight: i < 2 ? '0.5px solid #E2E0D8' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#111827' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 10 }}>Ce que tu peux faire</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <FeatureCard emoji="📅" bg="#F0FDF4" title="Organiser une partie"    desc="Crée une session en 1 min, gère les inscriptions et la liste d'attente automatiquement." />
          <FeatureCard emoji="🏆" bg="#FFF7ED" title="Classement ELO"          desc="Suis ton évolution match après match et compare-toi à tous les joueurs du groupe." />
          <FeatureCard emoji="👥" bg="#EFF6FF" title="Partenaires & Rivaux"    desc="Retrouve avec qui tu joues le plus et ton bilan face à chaque adversaire." />
          <FeatureCard emoji="💸" bg="#FDF4FF" title="Paiements Revolut"       desc="Les joueurs te remboursent via Revolut. L'organisateur voit qui a payé en un coup d'œil." />
        </div>

        {/* Upcoming sessions */}
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 10 }}>Prochaines parties</div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 28, height: 28, border: '3px solid #14532d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px dashed #D1D5DB', padding: '28px 16px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Aucune partie prévue pour l'instant</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Inscris-toi pour organiser la prochaine !</div>
          </div>
        ) : (
          <>
            {sessions.map((s, i) => (
              <PublicSessionCard key={s.id} session={s} onJoin={handleJoin} dimmed={i > 0} />
            ))}
          </>
        )}

        {/* Final CTA */}
        <div style={{ background: '#14532d', borderRadius: 16, padding: '22px 18px', textAlign: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', marginBottom: 6 }}>Rejoins le groupe 🎾</div>
          <div style={{ fontSize: 13, color: '#90C9A0', lineHeight: 1.55, marginBottom: 18 }}>
            Gratuit, sans app à installer.<br />Inscription en 30 secondes.
          </div>
          <button
            onClick={() => navigate('/auth?mode=register')}
            style={{ background: 'rgba(255,255,255,0.95)', color: '#14532d', border: 'none', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
          >
            Créer mon compte gratuit →
          </button>
          <div style={{ fontSize: 12, color: '#6B9B7A', marginTop: 10 }}>
            Déjà membre ?{' '}
            <span
              onClick={() => navigate('/auth?mode=login')}
              style={{ color: '#90C9A0', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Se connecter
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
