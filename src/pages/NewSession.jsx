import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_OPTIONS } from '../lib/constants'

const DURATIONS = [
  { value: '1h',   label: '1 heure' },
  { value: '1h30', label: '1h30' },
  { value: '2h',   label: '2 heures' },
]

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

      <form onSubmit={handleSubmit} className="card space-y-5">

        {/* Date + Heure */}
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <label className="label">Date *</label>
            <input
              type="date" name="date" value={form.date} onChange={handleChange} required
              min={new Date().toISOString().split('T')[0]} className="input"
            />
          </div>
          <div className="min-w-0">
            <label className="label">Heure *</label>
            <input type="time" name="time" value={form.time} onChange={handleChange} required className="input w-full" />
          </div>
        </div>

        {/* Durée */}
        <div>
          <label className="label">Durée</label>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setForm({ ...form, duration: d.value })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  form.duration === d.value
                    ? 'bg-forest-900 text-white border-forest-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-forest-500'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lieu */}
        <div className="space-y-3">
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
            <label className="label">Numéro du terrain <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input
              type="text"
              name="court_number"
              value={form.court_number}
              onChange={handleChange}
              className="input"
              placeholder="ex : 3"
              maxLength={10}
            />
            {form.location && form.court_number.trim() && (
              <p className="text-xs text-forest-700 mt-1.5">
                📍 Affiché comme : <strong>{form.location} — Terrain {form.court_number.trim()}</strong>
              </p>
            )}
          </div>
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
              <p className="text-sm font-semibold text-orange-800 mb-1">
                💳 Configure tes moyens de paiement
              </p>
              <p className="text-sm text-orange-700">
                Pour recevoir les remboursements via Revolut, renseigne ton tag dans ton profil.
              </p>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="mt-2 text-xs font-semibold text-orange-700 underline hover:text-orange-900 transition-colors"
              >
                Configurer maintenant →
              </button>
            </div>
          )}
        </div>

        {/* Niveau souhaité */}
        <div>
          <label className="label">Niveau souhaité (optionnel)</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Niveau minimum</p>
              <select name="level_min" value={form.level_min} onChange={handleChange} className="input text-sm">
                <option value="">Pas de limite</option>
                {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Niveau maximum</p>
              <select name="level_max" value={form.level_max} onChange={handleChange} className="input text-sm">
                <option value="">Pas de limite</option>
                {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
          {form.level_min && form.level_max && (
            <p className="text-xs text-gray-400 mt-1">
              Niveau souhaité : entre {form.level_min} et {form.level_max}
            </p>
          )}
        </div>

        {/* Visibilité : publique / privée */}
        <div>
          <label className="label mb-2">Visibilité</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, isPrivate: false })}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                !form.isPrivate
                  ? 'bg-forest-900 text-white border-forest-700 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-forest-300'
              }`}
            >
              <span>🌍</span> Publique
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, isPrivate: true })}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                form.isPrivate
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-purple-300'
              }`}
            >
              <span>🔒</span> Privée
            </button>
          </div>
          {form.isPrivate && (
            <p className="text-xs text-purple-700 mt-2 bg-purple-50 rounded-lg px-3 py-2">
              🔒 Cette partie n'apparaîtra pas dans les listes. Un lien unique sera généré pour que tu puisses inviter ton groupe.
            </p>
          )}
        </div>

        {/* Toggle : organizer joue ou pas — admins uniquement */}
        {isAdmin && <button
          type="button"
          onClick={() => setForm({ ...form, organizerPlays: !form.organizerPlays })}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: form.organizerPlays ? '#F0FDF4' : '#F7F5F1',
            border: form.organizerPlays ? '1.5px solid rgba(82,183,136,0.35)' : '1.5px solid rgba(0,0,0,0.08)',
            borderRadius: 14, padding: '14px 16px', textAlign: 'left', width: '100%', cursor: 'pointer',
          }}
        >
          {/* Toggle pill */}
          <div style={{
            width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative', transition: 'background 0.2s',
            background: form.organizerPlays ? '#52B788' : '#D1D5DB',
          }}>
            <div style={{
              position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%', background: '#fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
              left: form.organizerPlays ? 21 : 3,
            }} />
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: '#0D1F14', marginBottom: 2 }}>
              Je joue dans cette partie
            </p>
            <p style={{ fontSize: 12, color: '#6B7C72', lineHeight: 1.45 }}>
              {form.organizerPlays
                ? "Tu seras inscrit en tant que joueur — 3 places restantes pour les autres."
                : "Tu organises sans jouer — les 4 places sont libres. Les joueurs te remboursent via Revolut."}
            </p>
          </div>
        </button>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Création en cours...' : 'Créer la partie'}
        </button>
      </form>
    </div>
  )
}
