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
    level: '3',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
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
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
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
          <div className="flex-1 h-1 bg-blue-600 rounded-full" />
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</div>
          <span className="text-xs text-blue-700 font-semibold">Étape 2 / 2</span>
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
            <label className="label">Téléphone <span className="text-gray-400 font-normal">(pour Twint / Revolut)</span></label>
            <input
              type="tel" name="phone" value={form.phone} onChange={handleChange}
              className="input" placeholder="+41 79 123 45 67"
            />
            <p className="text-xs text-gray-400 mt-1">Visible des autres joueurs pour les remboursements.</p>
          </div>

          <div>
            <label className="label">Niveau de jeu</label>
            <select name="level" value={form.level} onChange={handleChange} className="input">
              {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Création…' : 'Rejoindre PadelMates →'}
          </button>
        </form>
      </div>
    </div>
  )
}
