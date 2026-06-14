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

// ── Feature card (bénéfice-first) ─────────────────────────────
function FeatureCard({ emoji, bg, hook, hookColor, title, desc }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', padding: '13px 12px 11px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: 32, height: 32, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{emoji}</div>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: hookColor }}>{hook}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', lineHeight: 1.35 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}

// ── App preview card (hero) ───────────────────────────────────
function AppPreview() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '11px 13px', marginBottom: 22, border: '1px solid rgba(255,255,255,0.15)', transform: 'rotate(-0.8deg)' }}>
      {/* Mini banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 1 }}>Bonjour,</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Thomas</div>
        </div>
        <div style={{ fontSize: 16 }}>🎾</div>
      </div>
      {/* Mini stats 3-up */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
        {[
          { val: '1042', lbl: 'ELO' },
          { val: '68%',  lbl: 'Victoires' },
          { val: '#4',   lbl: 'Classement' },
        ].map(s => (
          <div key={s.lbl} style={{ background: '#F5F4F0', borderRadius: 8, padding: '6px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{s.val}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{s.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PublicHome() {
  const navigate = useNavigate()
  const [sessions, setSessions]         = useState([])
  const [communityStats, setCommunityStats] = useState({ players: 0, sessions: 0, matches: 0 })
  const [loading, setLoading]           = useState(true)

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

      {/* ── Hero ────────────────────────────────────────── */}
      <div style={{ background: '#14532d', padding: '32px 20px 50px', position: 'relative', overflow: 'hidden' }}>
        {/* Décors */}
        <div style={{ position: 'absolute', top: -60, right: -50,  width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top:  20, right:  30,  width:  80, height:  80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: '5px 13px', marginBottom: 18 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>PadelMates · Genève</span>
          </div>

          {/* Tagline */}
          <h1 style={{ fontSize: 30, fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: 10 }}>
            Ton groupe padel,<br />
            <span style={{ color: '#86efac' }}>enfin organisé</span>
          </h1>
          <p style={{ fontSize: 13, color: '#90C9A0', lineHeight: 1.65, marginBottom: 20, maxWidth: 300 }}>
            Finis les groupes WhatsApp qui partent dans tous les sens. Inscriptions, scores, classement — tout au même endroit.
          </p>

          {/* App preview */}
          <AppPreview />

          {/* CTAs — boutons lisibles sur fond vert */}
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 16 }}>
            <button
              onClick={() => navigate('/auth?mode=register')}
              style={{
                background: '#fff',
                color: '#14532d',
                border: 'none',
                borderRadius: 12,
                padding: '13px 18px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                flex: 1,
              }}
            >
              Créer mon compte gratuit
            </button>
            <button
              onClick={() => navigate('/auth?mode=login')}
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.45)',
                borderRadius: 12,
                padding: '13px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Se connecter
            </button>
          </div>

          {/* Reassurance */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {['Gratuit', 'Inscription en 30 sec', "Pas d'app à installer"].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6B9B7A' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sheet ───────────────────────────────────────── */}
      <div style={{ background: '#F5F4F0', borderRadius: '24px 24px 0 0', marginTop: -20, padding: '20px 16px 40px', position: 'relative', zIndex: 2 }}>

        {/* ── 1. Prochaines parties (social proof en premier) ── */}
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 10 }}>Prochaines parties</div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <div style={{ width: 26, height: 26, border: '3px solid #14532d', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '0.5px dashed #D1D5DB', padding: '28px 16px', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Aucune partie prévue pour l'instant</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Inscris-toi pour organiser la prochaine !</div>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            {sessions.map(s => (
              <PublicSessionCard key={s.id} session={s} onJoin={handleJoin} />
            ))}
          </div>
        )}

        {/* ── 2. Comment ça marche ── */}
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 10 }}>Comment ça marche</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 20 }}>
          {[
            { icon: '👤', title: 'Inscris-toi en 30 sec', sub: 'Email ou Google' },
            { icon: '🎾', title: 'Rejoins une partie', sub: 'Vois les places dispo' },
            { icon: '🏆', title: 'Suis ta progression', sub: 'ELO, stats, classement' },
          ].map((step, i) => (
            <>
              <div key={step.title} style={{ flex: 1, background: '#fff', borderRadius: 12, border: '0.5px solid #E5E7EB', padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{step.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#111827', marginBottom: 3, lineHeight: 1.3 }}>{step.title}</div>
                <div style={{ fontSize: 9, color: '#9CA3AF', lineHeight: 1.4 }}>{step.sub}</div>
              </div>
              {i < 2 && <div key={`arrow-${i}`} style={{ fontSize: 13, color: '#D1D5DB', flexShrink: 0, marginTop: 28 }}>›</div>}
            </>
          ))}
        </div>

        {/* ── 3. Pourquoi PadelMates (bénéfice-first) ── */}
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 10 }}>Pourquoi PadelMates</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <FeatureCard emoji="📅" bg="#F0FDF4" hook="Organisateurs" hookColor="#15803d" title="Finis les WA désorganisés" desc="Crée ta partie en 1 min, liste d'attente auto." />
          <FeatureCard emoji="🏆" bg="#FFF7ED" hook="Compétition"   hookColor="#B45309" title="Sache où tu en es"        desc="Classement ELO en temps réel après chaque match." />
          <FeatureCard emoji="👥" bg="#EFF6FF" hook="Social"        hookColor="#1D4ED8" title="Retrouve tes partenaires" desc="Bilan face à chaque adversaire, stats communes." />
          <FeatureCard emoji="💸" bg="#FDF4FF" hook="Paiements"     hookColor="#7E22CE" title="Vois qui te doit quoi"    desc="Paiements Revolut intégrés, suivi en 1 coup d'œil." />
        </div>

        {/* ── 4. Témoignage ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', padding: '12px 14px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0 }}>SL</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#FBBF24', fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>★★★★★</div>
            <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.55, fontStyle: 'italic', marginBottom: 5 }}>
              "On était 20 joueurs à s'organiser sur WhatsApp, c'était ingérable. Depuis PadelMates, tout le monde voit les créneaux et les inscriptions se font toutes seules."
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>Sophie L. · joueuse depuis 6 mois</div>
          </div>
        </div>

        {/* ── 5. Stats communauté ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #E2E0D8', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { val: communityStats.players,  label: 'joueurs' },
              { val: communityStats.sessions, label: 'parties' },
              { val: communityStats.matches,  label: 'matchs joués' },
            ].map((s, i) => (
              <div key={s.label} style={{ textAlign: 'center', padding: '14px 0', borderRight: i < 2 ? '0.5px solid #E2E0D8' : 'none' }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#111827' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 6. CTA final ── */}
        <div style={{ background: '#14532d', borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 500, color: '#fff', marginBottom: 6 }}>Rejoins le groupe 🎾</div>
          <div style={{ fontSize: 13, color: '#90C9A0', lineHeight: 1.55, marginBottom: 18 }}>
            Gratuit, sans app à installer.<br />Inscription en 30 secondes.
          </div>
          <button
            onClick={() => navigate('/auth?mode=register')}
            style={{ background: '#fff', color: '#14532d', border: 'none', borderRadius: 12, padding: '13px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}
          >
            Créer mon compte gratuit →
          </button>
          <div style={{ fontSize: 12, color: '#6B9B7A', marginTop: 10 }}>
            Déjà membre ?{' '}
            <span onClick={() => navigate('/auth?mode=login')} style={{ color: '#90C9A0', textDecoration: 'underline', cursor: 'pointer' }}>
              Se connecter
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
