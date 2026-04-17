import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LEVEL_OPTIONS } from '../lib/constants'

const LEVELS = LEVEL_OPTIONS

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    level: '3',
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!form.email.trim()) { setError('Entre ton adresse email.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setError('Erreur lors de l\'envoi. Vérifie ton adresse email.')
    } else {
      setSuccess('Un lien de réinitialisation a été envoyé à ton adresse email.')
    }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (error) {
      setError('Email ou mot de passe incorrect.')
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Le prénom et nom sont requis.')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          level: form.level,
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      navigate('/')
    } else {
      setSuccess('Vérifiez votre email pour confirmer votre compte.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 -mt-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🎾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PadelMates</h1>
          <p className="text-gray-500 text-sm mt-1">Gérez vos parties de padel entre amis</p>
        </div>

        {/* Tabs */}
        {mode !== 'forgot' && (
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
            {[
              { key: 'login', label: 'Connexion' },
              { key: 'register', label: 'Inscription' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setMode(key); setError(''); setSuccess('') }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  mode === key
                    ? 'bg-white text-blue-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Titre mot de passe oublié */}
        {mode === 'forgot' && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Mot de passe oublié</h2>
            <p className="text-sm text-gray-500 mt-1">Entre ton email pour recevoir un lien de réinitialisation.</p>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : mode === 'forgot' ? handleForgotPassword : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="label">Prénom et Nom *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="input"
                  placeholder="Marie Dupont"
                />
              </div>
              <div>
                <label className="label">Téléphone (pour Twint / Revolut)</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="input"
                  placeholder="+41 79 123 45 67"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Ce numéro sera visible des autres joueurs pour les remboursements.
                </p>
              </div>
              <div>
                <label className="label">Niveau de jeu</label>
                <select
                  name="level"
                  value={form.level}
                  onChange={handleChange}
                  className="input"
                >
                  {LEVELS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="input"
              placeholder="marie@exemple.ch"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="label">Mot de passe *</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                className="input"
                placeholder="Minimum 6 caractères"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading
              ? 'Chargement...'
              : mode === 'login'
                ? 'Se connecter'
                : mode === 'forgot'
                  ? 'Envoyer le lien'
                  : "Créer mon compte"}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-4 space-y-2 text-center">
            <button
              onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              className="text-sm text-blue-600 hover:underline block w-full"
            >
              Mot de passe oublié ?
            </button>
            <p className="text-sm text-gray-500">
              Pas encore de compte ?{' '}
              <button
                onClick={() => setMode('register')}
                className="text-blue-700 font-medium hover:underline"
              >
                S'inscrire
              </button>
            </p>
          </div>
        )}

        {mode === 'forgot' && (
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            className="text-sm text-gray-500 hover:text-gray-700 mt-4 block w-full text-center"
          >
            ← Retour à la connexion
          </button>
        )}
      </div>
    </div>
  )
}
