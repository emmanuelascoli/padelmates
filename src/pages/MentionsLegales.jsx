import { Link } from 'react-router-dom'

function Row({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-36 shrink-0 mb-1 sm:mb-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-gray-700">{children}</span>
    </div>
  )
}

export default function MentionsLegales() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-forest-700 hover:underline">← Retour</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Mentions légales</h1>
        <p className="text-sm text-gray-400 mt-1">
          Conformément aux exigences du droit suisse applicable aux services en ligne.
        </p>
      </div>

      {/* Exploitant */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-900 mb-4">Éditeur et exploitant du site</h2>
        <div className="divide-y divide-gray-50">
          <Row label="Nom">Emmanuel Ascoli</Row>
          <Row label="Statut">Particulier</Row>
          <Row label="Canton">Genève, Suisse</Row>
          <Row label="Email">
            <a href="mailto:contact@padelmates.ch" className="text-forest-700 hover:underline">
              contact@padelmates.ch
            </a>
          </Row>
          <Row label="Site web">
            <a href="https://padelmates.ch" className="text-forest-700 hover:underline">
              padelmates.ch
            </a>
          </Row>
        </div>
      </div>

      {/* Hébergement */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-900 mb-4">Hébergement</h2>
        <div className="divide-y divide-gray-50">
          <Row label="Hébergeur web">
            Vercel Inc. — 340 Pine Street, Suite 701, San Francisco, CA 94104, USA<br />
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-forest-700 hover:underline text-xs">
              vercel.com
            </a>
          </Row>
          <Row label="Base de données">
            Supabase Inc. — données hébergées dans l'Union Européenne (Frankfurt)<br />
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-forest-700 hover:underline text-xs">
              supabase.com
            </a>
          </Row>
        </div>
      </div>

      {/* Données personnelles */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-900 mb-4">Protection des données</h2>
        <div className="divide-y divide-gray-50">
          <Row label="Responsable">Emmanuel Ascoli</Row>
          <Row label="Loi applicable">
            Loi fédérale sur la protection des données (nLPD) — Suisse,
            en vigueur depuis le 1er septembre 2023
          </Row>
          <Row label="Contact RGPD / nLPD">
            <a href="mailto:contact@padelmates.ch" className="text-forest-700 hover:underline">
              contact@padelmates.ch
            </a>
          </Row>
          <Row label="Autorité de contrôle">
            Préposé fédéral à la protection des données (PFPDT) —{' '}
            <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener noreferrer" className="text-forest-700 hover:underline">
              edoeb.admin.ch
            </a>
          </Row>
        </div>
      </div>

      {/* Propriété intellectuelle */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-900 mb-3">Propriété intellectuelle</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          L'ensemble du contenu de ce site (code, design, textes, logo) est la propriété
          exclusive de l'exploitant et est protégé par le droit suisse de la propriété intellectuelle.
          Toute reproduction, même partielle, est interdite sans autorisation préalable écrite.
        </p>
      </div>

      {/* Droit applicable */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-900 mb-3">Droit applicable</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Le présent site est soumis au droit suisse. Tout litige relatif à son utilisation
          relève de la compétence exclusive des tribunaux du canton de Genève, Suisse.
        </p>
      </div>

      {/* Liens */}
      <div className="flex flex-wrap gap-4 justify-center pb-4 text-sm">
        <Link to="/cgu" className="text-forest-700 hover:underline">CGU →</Link>
        <Link to="/confidentialite" className="text-forest-700 hover:underline">Politique de confidentialité →</Link>
      </div>
    </div>
  )
}
