import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SESSION_KEY = 'padelmates_profile_sheet_dismissed'

export default function ProfileCompletionSheet() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [hand, setHand]       = useState('')
  const [side, setSide]       = useState('')
  const [closing, setClosing] = useState(false)

  // ── Initialise les valeurs depuis le profil ────────────────
  useEffect(() => {
    if (!user || !profile) return
    setHand(profile.dominant_hand || '')
    setSide(profile.court_side    || '')

    // Déjà renseigné ? On n'affiche rien
    if (profile.dominant_hand && profile.court_side) return
    // Déjà fermé cette session ?
    if (sessionStorage.getItem(SESSION_KEY)) return

    // Petite pause pour laisser la page se charger
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [user?.id, profile?.id])

  // ── Auto-fermeture quand les deux champs sont remplis ──────
  useEffect(() => {
    if (!visible) return
    if (hand && side) {
      const t = setTimeout(() => close(), 900)
      return () => clearTimeout(t)
    }
  }, [hand, side, visible])

  function close() {
    setClosing(true)
    sessionStorage.setItem(SESSION_KEY, '1')
    setTimeout(() => { setVisible(false); setClosing(false) }, 280)
  }

  async function saveHand(value) {
    const next = hand === value ? '' : value
    setHand(next)
    await supabase.from('profiles').update({ dominant_hand: next || null }).eq('id', user.id)
    await refreshProfile()
  }

  async function saveSide(value) {
    const next = side === value ? '' : value
    setSide(next)
    await supabase.from('profiles').update({ court_side: next || null }).eq('id', user.id)
    await refreshProfile()
  }

  if (!visible) return null

  const sheetStyle = {
    position:      'fixed',
    bottom:        0,
    left:          0,
    right:         0,
    background:    '#fff',
    borderRadius:  '22px 22px 0 0',
    padding:       '10px 20px 36px',
    zIndex:        1001,
    maxWidth:      520,
    margin:        '0 auto',
    animation:     closing ? 'slideDown 0.28s ease forwards' : 'slideUp 0.3s ease',
    boxShadow:     '0 -4px 32px rgba(0,0,0,0.12)',
  }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={close}
        style={{
          position:   'fixed',
          inset:       0,
          background: 'rgba(0,0,0,0.38)',
          zIndex:     1000,
          animation:  closing ? 'fadeOut 0.28s ease forwards' : 'fadeIn 0.22s ease',
        }}
      />

      {/* Bottom sheet */}
      <div style={sheetStyle}>

        {/* Handle */}
        <div style={{ width: 36, height: 3, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: '#F0F7F2', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
              Complète ton profil
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.45 }}>
              Aide les autres joueurs à mieux te connaître
            </div>
          </div>
        </div>

        {/* ── Main préférée ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Main préférée</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'gauche', label: '🤚 Gauche' },
              { value: 'droite', label: '🤚 Droite'  },
            ].map(opt => {
              const active = hand === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => saveHand(opt.value)}
                  style={{
                    flex:         1,
                    background:   active ? '#14532d' : '#F5F4F0',
                    border:       `1.5px solid ${active ? '#14532d' : '#E2E0D8'}`,
                    borderRadius: 11,
                    padding:      '12px 0',
                    fontSize:     13,
                    fontWeight:   active ? 600 : 500,
                    color:        active ? '#fff' : '#374151',
                    cursor:       'pointer',
                    transition:   'all 0.15s',
                  }}
                >
                  {opt.label}{active ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Côté sur le court ── */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Côté sur le court</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { value: 'gauche',   label: '◀ Gauche'  },
              { value: 'droite',   label: 'Droite ▶'   },
              { value: 'les_deux', label: '⇄ Les deux' },
            ].map(opt => {
              const active = side === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => saveSide(opt.value)}
                  style={{
                    flex:         1,
                    background:   active ? '#14532d' : '#F5F4F0',
                    border:       `1.5px solid ${active ? '#14532d' : '#E2E0D8'}`,
                    borderRadius: 11,
                    padding:      '11px 0',
                    fontSize:     12,
                    fontWeight:   active ? 600 : 500,
                    color:        active ? '#fff' : '#374151',
                    cursor:       'pointer',
                    transition:   'all 0.15s',
                    lineHeight:   1.3,
                  }}
                >
                  {opt.label}{active ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          borderTop:      '0.5px solid #F3F4F6',
          paddingTop:     14,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          <span
            onClick={() => { close(); navigate('/profile') }}
            style={{ fontSize: 13, color: '#14532d', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer' }}
          >
            Ajouter une photo →
          </span>
          <span
            onClick={close}
            style={{ fontSize: 13, color: '#9CA3AF', cursor: 'pointer' }}
          >
            Plus tard
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn    { from { opacity: 0 } to { opacity: 1 } }
        @keyframes fadeOut   { from { opacity: 1 } to { opacity: 0 } }
        @keyframes slideUp   { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes slideDown { from { transform: translateY(0) } to { transform: translateY(100%) } }
      `}</style>
    </>
  )
}
