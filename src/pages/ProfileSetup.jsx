import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { LEVEL_OPTIONS } from '../lib/constants'

/**
 * Shown after Google OAuth (or any sign-in without a profile).
 * Pre-fills name + avatar from oauthMeta, user completes phone + level.
 */
export default function ProfileSetup() {
  const { user, oauthMeta, refreshProfile } = useAuth()

  const [form, setForm] = useState({
    name:  oauthMeta?.name  || '',
    phone: '',
    level: '',   // vide → choix obligatoire
  })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [cguAccepted, setCguAccepted] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Le prénom et nom sont obligatoires (minimum 2 caractères).')
      return
    }
    if (!form.level) {
      setError('Merci de choisir ton niveau de jeu.')
      return
    }
    if (!cguAccepted) {
      setError('Tu dois accepter les CGU et la politique de confidentialité pour continuer.')
      return
    }
    setLoading(true); setError('')

    const { error: err } = await supabase.from('profiles').insert({
      id:         user.id,
      name:       form.name.trim(),
      phone:      form.phone.trim() || null,
      level:      form.level,
      avatar_url: oauthMeta?.avatar_url || null,
    })

    if (err) { setError(err.message); setLoading(false); return }
    await refreshProfile()
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">

        {/* Header */}
        <div className="text-center mb-6">
          {oauthMeta?.avatar_url ? (
            <img
              src={oauthMeta.avatar_url}
              alt="avatar"
              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white shadow-md"
            />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-forest-800 to-forest-800 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
              <span className="text-3xl font-bold text-white">
                {form.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">Finalise ton profil</h1>
          <p className="text-sm text-gray-500 mt-1">Encore quelques infos pour rejoindre PadelMates</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 h-1 bg-forest-900 rounded-full" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-forest-900 text-white text-xs font-bold">2</div>
          <span className="text-xs text-forest-800 font-semibold">Étape 2 / 2</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">
              Prénom et Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text" name="name" value={form.name} onChange={handleChange}
              required minLength={2} className="input" placeholder="Marie Dupont"
            />
            {oauthMeta?.name && (
              <p className="text-xs text-green-600 mt-1">✓ Récupéré depuis Google</p>
            )}
          </div>

          <div>
            <label className="label">Téléphone <span className="text-gray-400 font-normal">(facultatif)</span></label>
            <input
              type="tel" name="phone" value={form.phone} onChange={handleChange}
              className="input" placeholder="+41 79 123 45 67"
            />
            <p className="text-xs text-gray-400 mt-1">Visible des autres joueurs pour les remboursements.</p>
          </div>

          <div className={`rounded-xl p-4 border-2 transition-colors ${form.level ? 'border-forest-200 bg-forest-50' : 'border-orange-200 bg-orange-50'}`}>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Ton niveau de padel <span className="text-red-500">*</span>
            </label>
            {!form.level && (
              <p className="text-xs text-orange-600 font-medium mb-2">
                ⚠️ Obligatoire — ce niveau sera affiché sur ton profil et utilisé pour les filtres de parties.
              </p>
            )}
            <select
              name="level"
              value={form.level}
              onChange={handleChange}
              required
              className={`w-full border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-forest-900/15 focus:border-forest-700 text-gray-900 transition-all duration-150 ${
                form.level ? 'bg-white border-forest-200' : 'bg-white border-orange-300 text-gray-400'
              }`}
            >
              <option value="" disabled>— Choisir mon niveau —</option>
              {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            {form.level && (
              <p className="text-xs text-forest-700 mt-1.5 font-medium">✓ Niveau sélectionné</p>
            )}
          </div>

          {/* Case CGU obligatoire */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <div
              onClick={() => setCguAccepted(v => !v)}
              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors shrink-0 mt-0.5 ${cguAccepted ? 'bg-forest-900 border-forest-700' : 'bg-white border-gray-300'}`}
            >
              {cguAccepted && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-600 leading-snug">
              J'accepte les{' '}
              <a href="/cgu" target="_blank" className="text-forest-700 hover:underline font-medium">CGU</a>
              {' '}et la{' '}
              <a href="/confidentialite" target="_blank" className="text-forest-700 hover:underline font-medium">politique de confidentialité</a>
              {' '}<span className="text-red-500">*</span>
            </span>
          </label>

          <button type="submit" disabled={loading || !cguAccepted || !form.level} className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Création…' : 'Rejoindre PadelMates →'}
          </button>
        </form>
      </div>
    </div>
  )
}
