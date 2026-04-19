import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PasswordInput from '../components/PasswordInput'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase émet un événement PASSWORD_RECOVERY quand l'utilisateur
    // arrive depuis le lien de réinitialisation
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Erreur lors de la mise à jour. Réessaie.')
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/'), 2500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4 -mt-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-forest-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-3xl">🎾</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PadelMates</h1>
        </div>

        {success ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Mot de passe mis à jour !</h2>
            <p className="text-sm text-gray-500">Tu vas être redirigé vers l'accueil...</p>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500">Vérification du lien en cours...</p>
            <p className="text-xs text-gray-400 mt-2">
              Si cette page reste bloquée,{' '}
              <button onClick={() => navigate('/auth')} className="text-forest-700 hover:underline">
                retourne à la connexion
              </button>
              {' '}et refais une demande.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Nouveau mot de passe</h2>
            <p className="text-sm text-gray-500 mb-6">Choisis un nouveau mot de passe pour ton compte.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nouveau mot de passe *</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  required
                  minLength={6}
                  placeholder="Minimum 6 caractères"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Confirmer le mot de passe *</label>
                <PasswordInput
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError('') }}
                  required
                  minLength={6}
                  placeholder="Répète le mot de passe"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading ? 'Mise à jour...' : 'Enregistrer le nouveau mot de passe'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
