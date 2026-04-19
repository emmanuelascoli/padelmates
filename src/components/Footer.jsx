import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-white mt-8 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto px-4 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Branding */}
          <p className="text-xs text-gray-400">
            © {year} PadelMates — Tous droits réservés
          </p>

          {/* Legal links */}
          <nav className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/cgu" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              CGU
            </Link>
            <span className="text-gray-200">·</span>
            <Link to="/confidentialite" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Confidentialité
            </Link>
            <span className="text-gray-200">·</span>
            <Link to="/mentions-legales" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Mentions légales
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
