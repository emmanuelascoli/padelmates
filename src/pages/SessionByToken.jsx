import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SessionByToken() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) { setNotFound(true); return }
    resolveToken()
  }, [token])

  async function resolveToken() {
    const { data } = await supabase
      .from('sessions')
      .select('id')
      .eq('private_token', token)
      .single()

    if (data?.id) {
      // Redirection transparente vers la page de détail standard
      navigate(`/sessions/${data.id}`, { replace: true })
    } else {
      setNotFound(true)
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-gray-900">Lien introuvable</h1>
          <p className="text-sm text-gray-500">
            Ce lien de partie privée est invalide ou a expiré.
            Demande le lien à jour à l'organisateur.
          </p>
          <Link to="/" className="inline-block btn-primary text-sm px-6 py-2.5">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-forest-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
