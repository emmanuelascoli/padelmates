import { Link } from 'react-router-dom'

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

function DataRow({ label, value }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-500 shrink-0 w-44">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  )
}

export default function Confidentialite() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-blue-600 hover:underline">← Retour</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Politique de confidentialité</h1>
        <p className="text-sm text-gray-400 mt-1">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}Conforme à la nLPD suisse (en vigueur depuis le 1er septembre 2023)
        </p>
      </div>

      <div className="card space-y-6">

        <Section title="1. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles collectées via PadelMates est :
          </p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 mt-2">
            <DataRow label="Nom" value="Emmanuel Ascoli" />
            <DataRow label="Email de contact" value="contact@padelmates.ch" />
            <DataRow label="Site web" value="padelmates.ch" />
          </div>
        </Section>

        <Section title="2. Données collectées">
          <p>Dans le cadre de l'utilisation de PadelMates, les données suivantes sont collectées :</p>

          <div className="space-y-3 mt-2">
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="font-semibold text-blue-900 text-xs uppercase tracking-wide mb-2">Données d'inscription</p>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Adresse email (authentification, notifications)</li>
                <li>• Prénom et nom (affiché aux autres membres)</li>
                <li>• Numéro de téléphone (facultatif — visible uniquement des membres connectés)</li>
                <li>• Photo de profil (facultatif — stockée sur serveur européen)</li>
                <li>• Niveau de jeu padel (affiché sur le profil)</li>
              </ul>
            </div>

            <div className="bg-green-50 rounded-xl p-3">
              <p className="font-semibold text-green-900 text-xs uppercase tracking-wide mb-2">Données d'utilisation</p>
              <ul className="space-y-1 text-sm text-green-800">
                <li>• Participation aux parties (date, lieu, joueurs)</li>
                <li>• Résultats des matchs (score, équipes)</li>
                <li>• Liens d'amitié entre membres</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-2">Données techniques</p>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Cookies de session (authentification uniquement — nécessaires au fonctionnement)</li>
                <li>• Aucun cookie publicitaire ni de traçage tiers</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section title="3. Finalités du traitement">
          <p>Les données sont utilisées exclusivement pour :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Permettre l'identification et l'authentification des utilisateurs</li>
            <li>Gérer les inscriptions aux parties et les résultats</li>
            <li>Envoyer des notifications liées à l'utilisation du Service (confirmations, rappels de parties)</li>
            <li>Afficher les profils et statistiques au sein de la communauté</li>
            <li>Garantir la sécurité et le bon fonctionnement de la plateforme</li>
          </ul>
          <p className="mt-2 text-xs bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2">
            ✅ Les données ne sont jamais revendues ni partagées avec des tiers à des fins commerciales.
          </p>
        </Section>

        <Section title="4. Hébergement et localisation des données">
          <p>
            PadelMates utilise <strong>Supabase</strong> comme base de données et service d'authentification.
            Les données sont hébergées dans des centres de données situés dans l'<strong>Union Européenne</strong>.
          </p>
          <p>
            Les photos de profil sont stockées dans le service de stockage de Supabase,
            dans l'UE, et accessibles uniquement via des URLs authentifiées non publiques.
          </p>
          <p>
            Les emails transactionnels (confirmations, rappels) sont envoyés via <strong>Resend</strong>,
            un service conforme au RGPD européen.
          </p>
        </Section>

        <Section title="5. Durée de conservation">
          <p>
            Les données sont conservées pendant toute la durée d'utilisation du compte.
            En cas de suppression du compte par l'utilisateur, l'ensemble des données personnelles
            est effacé dans un délai de <strong>30 jours</strong>, à l'exception des données
            nécessaires au respect d'obligations légales.
          </p>
          <p>
            Les logs de notifications (historique des emails envoyés) sont conservés
            <strong>12 mois</strong> à des fins de débogage.
          </p>
        </Section>

        <Section title="6. Vos droits (nLPD)">
          <p>
            Conformément à la loi fédérale sur la protection des données (nLPD),
            vous disposez des droits suivants sur vos données personnelles :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Droit d'accès</strong> — obtenir une copie de vos données</li>
            <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> — supprimer votre compte et vos données</li>
            <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> — vous opposer à un traitement spécifique</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez-nous à{' '}
            <a href="mailto:contact@padelmates.ch" className="text-blue-600 hover:underline">
              contact@padelmates.ch
            </a>
            . Nous répondrons dans un délai de <strong>30 jours</strong>.
          </p>
          <p>
            Vous pouvez également supprimer votre compte directement depuis votre profil
            (Profil → Supprimer mon compte), ce qui efface immédiatement l'ensemble de vos données.
          </p>
        </Section>

        <Section title="7. Sécurité">
          <p>
            PadelMates met en œuvre les mesures techniques suivantes pour protéger vos données :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Connexion chiffrée (HTTPS / TLS) sur toutes les pages</li>
            <li>Mots de passe stockés sous forme hachée (jamais en clair)</li>
            <li>Accès aux données restreint par des politiques de sécurité au niveau base de données (Row Level Security)</li>
            <li>Numéros de téléphone visibles uniquement des membres authentifiés, jamais indexés publiquement</li>
          </ul>
        </Section>

        <Section title="8. Cookies">
          <p>
            PadelMates utilise uniquement des cookies <strong>strictement nécessaires</strong> au fonctionnement :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cookie de session Supabase (authentification, durée : session ou 1 an selon préférence)</li>
            <li>Préférence «Rester connecté» (stocké localement dans le navigateur)</li>
          </ul>
          <p>
            Aucun cookie de traçage, publicitaire ou d'analyse tiers n'est utilisé.
            Ces cookies étant nécessaires au fonctionnement, ils ne requièrent pas de consentement explicite
            en vertu du droit suisse et européen.
          </p>
        </Section>

        <Section title="9. Contact et réclamation">
          <p>
            Pour toute question relative à la protection de vos données :{' '}
            <a href="mailto:contact@padelmates.ch" className="text-blue-600 hover:underline">
              contact@padelmates.ch
            </a>
          </p>
          <p>
            En cas de litige non résolu, vous pouvez vous adresser au
            Préposé fédéral à la protection des données et à la transparence (PFPDT) :{' '}
            <a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              www.edoeb.admin.ch
            </a>
          </p>
        </Section>

      </div>

      <div className="text-center pb-4">
        <Link to="/mentions-legales" className="text-sm text-blue-600 hover:underline">
          Lire aussi : Mentions légales →
        </Link>
      </div>
    </div>
  )
}
