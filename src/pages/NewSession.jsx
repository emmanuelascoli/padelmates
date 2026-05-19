import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_OPTIONS } from '../lib/constants'

const DURATIONS = [
  { value: '1h',   label: '1h' },
  { value: '1h30', label: '1h30' },
  { value: '2h',   label: '2h' },
]

// Créneaux horaires de 7h00 à 23h45, de 15 en 15 min
const TIME_OPTIONS = (() => {
  const opts = []
  for (let h = 7; h <= 23; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 23 && m > 45) continue
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      opts.push({
        value: `${hh}:${mm}`,
        label: `${h}h${m === 0 ? '00' : mm}`,
      })
    }
  }
  return opts
})()

export default function NewSession() {
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const [form, setForm] = useState({
    date: tomorrowStr,
    time: '18:00',
    duration: '1h30',
    location: '',
    court_number: '',
    total_cost: '',
    level_min: '',
    level_max: '',
    isPrivate: false,
    organizerPlays: true,   // par défaut l'organisateur joue
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  // Coût par joueur calculé automatiquement (toujours 4 joueurs)
  const costPerPlayer = form.total_cost
    ? (parseFloat(form.total_cost) / 4).toFixed(2)
    : null

  // Vérification des moyens de paiement configurés
  const hasPaymentInfo = !!profile?.revolut_tag

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.location.trim()) {
      setError('Le lieu est obligatoire.')
      return
    }
    setLoading(true)
    setError('')

    // Générer le titre automatiquement
    const dateObj = new Date(`${form.date}T${form.time}`)
    const autoTitle = `Partie du ${format(dateObj, 'EEEE d MMMM', { locale: fr })}`

    const { data, error: insertError } = await supabase
      .from('sessions')
      .insert({
        organizer_id: user.id,
        title: autoTitle,
        date: form.date,
        time: form.time,
        duration: form.duration,
        location: form.court_number.trim()
          ? `${form.location} — Terrain ${form.court_number.trim()}`
          : form.location.trim(),
        cost_per_player: parseFloat(form.total_cost) / 4 || 0,
        max_players: 4,
        level_min: form.level_min || null,
        level_max: form.level_max || null,
        status: 'open',
        is_private: form.isPrivate,
      })
      .select()
      .single()

    if (insertError) {
      setError('Erreur : ' + insertError.message)
      setLoading(false)
      return
    }

    // Inscription automatique sauf si admin et a choisi de ne pas jouer
    if (!isAdmin || form.organizerPlays) {
      await supabase.from('session_participants').insert({
        session_id: data.id,
        user_id: user.id,
        payment_status: 'confirmed',
      })
    }

    navigate(`/sessions/${data.id}`)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Organiser une partie</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4 overflow-hidden">

        {/* Date (pleine largeur) — input natif caché derrière un div pour éviter l'overflow iOS */}
        <div>
          <label className="label">Date *</label>
          <div style={{ position: 'relative' }}>
            {/* Affichage custom : jour de semaine + date */}
            <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none', userSelect: 'none' }}>
              <span style={{ textTransform: 'capitalize', color: form.date ? '#111827' : '#9CA3AF' }}>
                {form.date
                  ? format(new Date(form.date + 'T12:00'), 'EEEE d MMMM yyyy', { locale: fr })
                  : 'Choisir une date'}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            {/* Input natif invisible mais cliquable par-dessus */}
            <input
              type="date" name="date" value={form.date} onChange={handleChange} required
              min={new Date().toISOString().split('T')[0]}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 1 }}
            />
          </div>
        </div>

        {/* Heure (select 15 min) + Durée sur la même ligne */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
          <div>
            <label className="label">Heure *</label>
            <select name="time" value={form.time} onChange={handleChange} required className="input">
              {TIME_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Durée</label>
            <div className="flex gap-1.5">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setForm({ ...form, duration: d.value })}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                    form.duration === d.value
                      ? 'bg-forest-900 text-white border-forest-700'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-forest-400'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lieu + terrain */}
        <div>
          <label className="label">Lieu *</label>
          <select name="location" value={form.location} onChange={handleChange} required className="input">
            <option value="">-- Choisir un lieu --</option>
            <option value="Bernex">Bernex</option>
            <option value="Cologny">Cologny</option>
            <option value="David Lloyd's Club">David Lloyd's Club</option>
            <option value="Jonction">Jonction</option>
            <option value="La Praille">La Praille</option>
            <option value="Les Acacias">Les Acacias</option>
            <option value="Padel Station">Padel Station</option>
            <option value="Parc des Evaux">Parc des Evaux</option>
            <option value="TC International Chambesy">TC International Chambesy</option>
          </select>
        </div>
        <div>
          <label className="label">Terrain <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <input
            type="text" name="court_number" value={form.court_number} onChange={handleChange}
            className="input" placeholder="ex : 3" maxLength={10}
          />
          {form.location && form.court_number.trim() && (
            <p className="text-xs text-forest-700 mt-1.5">
              📍 Affiché comme : <strong>{form.location} — Terrain {form.court_number.trim()}</strong>
            </p>
          )}
        </div>

        {/* Coût total */}
        <div>
          <label className="label">Coût total du court (CHF)</label>
          <input
            type="number" name="total_cost" value={form.total_cost} onChange={handleChange}
            min="0" step="0.5" className="input" placeholder="0"
          />
          {costPerPlayer && parseFloat(costPerPlayer) > 0 && (
            <div className="mt-2 bg-forest-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-forest-700 text-lg">÷</span>
              <p className="text-sm text-forest-900">
                Chaque joueur rembourse <strong>{costPerPlayer} CHF</strong>
              </p>
            </div>
          )}
          {costPerPlayer && parseFloat(costPerPlayer) > 0 && !hasPaymentInfo && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-orange-800 mb-1">💳 Configure tes moyens de paiement</p>
              <p className="text-sm text-orange-700">Pour recevoir les remboursements via Revolut, renseigne ton tag dans ton profil.</p>
              <button type="button" onClick={() => navigate('/profile')} className="mt-2 text-xs font-semibold text-orange-700 underline hover:text-orange-900 transition-colors">
                Configurer maintenant →
              </button>
            </div>
          )}
        </div>

        {/* Niveau souhaité */}
        <div>
          <label className="label">Niveau souhaité <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
            <div>
              <p className="text-xs text-gray-400 mb-1">Minimum</p>
              <select name="level_min" value={form.level_min} onChange={handleChange} className="input text-sm">
                <option value="">Pas de limite</option>
                {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Maximum</p>
              <select name="level_max" value={form.level_max} onChange={handleChange} className="input text-sm">
                <option value="">Pas de limite</option>
                {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Visibilité */}
        <div>
          <label className="label">Visibilité</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, isPrivate: false })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                !form.isPrivate
                  ? 'bg-forest-900 text-white border-forest-700'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-forest-300'
              }`}
            >
              🌍 Publique
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, isPrivate: true })}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                form.isPrivate
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
              }`}
            >
              🔒 Privée
            </button>
          </div>
          {form.isPrivate && (
            <p className="text-xs text-purple-700 mt-2 bg-purple-50 rounded-lg px-3 py-2">
              🔒 Cette partie n'apparaîtra pas dans les listes. Un lien unique sera généré pour inviter ton groupe.
            </p>
          )}
        </div>

        {/* Toggle organizer joue — admins uniquement */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setForm({ ...form, organizerPlays: !form.organizerPlays })}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: form.organizerPlays ? '#F0FDF4' : '#F7F5F1',
              border: form.organizerPlays ? '1.5px solid rgba(82,183,136,0.35)' : '1.5px solid rgba(0,0,0,0.08)',
              borderRadius: 14, padding: '12px 14px', textAlign: 'left', width: '100%', cursor: 'pointer',
            }}
          >
            <div style={{
              width: 40, height: 22, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: form.organizerPlays ? '#52B788' : '#D1D5DB', transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                left: form.organizerPlays ? 21 : 3,
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 13, color: '#0D1F14', marginBottom: 1 }}>Je joue dans cette partie</p>
              <p style={{ fontSize: 11, color: '#6B7C72', lineHeight: 1.4 }}>
                {form.organizerPlays
                  ? '3 places restantes pour les autres.'
                  : 'Tu organises sans jouer — 4 places libres.'}
              </p>
            </div>
          </button>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Création en cours...' : 'Créer la partie'}
        </button>
      </form>
    </div>
  )
}
