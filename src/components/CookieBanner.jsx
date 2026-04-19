import { useState, useEffect } from 'react'

const STORAGE_KEY = 'padelmates_cookies_acknowledged'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Afficher seulement si jamais fermé
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-0">
      {/* Sur mobile : au-dessus de la nav */}
      <div className="md:relative max-w-4xl mx-auto md:mb-0">
        <div className="bg-gray-900 text-white rounded-2xl md:rounded-none px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-xl md:shadow-none">
          <p className="flex-1 text-sm text-gray-200 leading-relaxed">
            🍪 PadelMates utilise uniquement des cookies nécessaires au fonctionnement (authentification, session). Aucun cookie publicitaire ni de traçage.{' '}
            <a href="/confidentialite" className="text-[#90C9A0] hover:text-[#7BC47B] underline underline-offset-2">
              En savoir plus
            </a>
          </p>
          <button
            onClick={dismiss}
            className="shrink-0 bg-white text-gray-900 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  )
}
