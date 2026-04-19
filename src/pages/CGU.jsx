import { Link } from 'react-router-dom'

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2 leading-relaxed">{children}</div>
    </section>
  )
}

export default function CGU() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-blue-600 hover:underline">← Retour</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Conditions Générales d'Utilisation</h1>
        <p className="text-sm text-gray-400 mt-1">Dernière mise à jour : {new Date().toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="card space-y-6">

        <Section title="1. Objet et acceptation">
          <p>
            Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation
            de la plateforme PadelMates, accessible à l'adresse <strong>padelmates.ch</strong> (ci-après « le Service »).
          </p>
          <p>
            En créant un compte sur PadelMates, l'utilisateur accepte sans réserve les présentes CGU.
            Si l'utilisateur n'accepte pas ces conditions, il doit s'abstenir d'utiliser le Service.
          </p>
        </Section>

        <Section title="2. Description du Service">
          <p>
            PadelMates est une plateforme de gestion de parties de padel entre joueurs.
            Elle permet notamment de :
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Créer et rejoindre des parties de padel</li>
            <li>Consulter les résultats des matchs et un classement</li>
            <li>Gérer les paiements entre joueurs (à titre indicatif)</li>
            <li>Communiquer au sein d'un groupe de joueurs</li>
          </ul>
          <p>
            Le Service est fourni à titre gratuit dans sa version actuelle.
            L'exploitant se réserve le droit de modifier cette offre avec préavis raisonnable.
          </p>
        </Section>

        <Section title="3. Accès et création de compte">
          <p>
            L'accès au Service est réservé aux personnes majeures ou ayant obtenu l'autorisation de leur représentant légal.
            L'utilisation requiert la création d'un compte avec une adresse email valide.
          </p>
          <p>
            L'utilisateur est responsable de la confidentialité de ses identifiants de connexion
            et de toute activité réalisée depuis son compte.
            Toute utilisation frauduleuse doit être signalée sans délai à l'exploitant.
          </p>
        </Section>

        <Section title="4. Règles d'utilisation">
          <p>L'utilisateur s'engage à :</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Fournir des informations exactes et à jour lors de l'inscription</li>
            <li>Respecter les autres membres de la communauté</li>
            <li>Honorer les parties auxquelles il s'est inscrit ou à se désinscrire dans les délais prévus</li>
            <li>Ne pas utiliser le Service à des fins commerciales, illicites ou contraires aux présentes CGU</li>
            <li>Ne pas tenter de porter atteinte au bon fonctionnement technique du Service</li>
          </ul>
          <p>
            L'exploitant se réserve le droit de suspendre ou supprimer tout compte ne respectant pas ces règles.
          </p>
        </Section>

        <Section title="5. Responsabilité">
          <p>
            PadelMates est une plateforme d'organisation et de mise en relation entre joueurs.
            L'exploitant n'est pas responsable des activités sportives organisées via le Service,
            ni des litiges entre utilisateurs concernant les paiements, la participation aux parties
            ou tout autre aspect de leur relation.
          </p>
          <p>
            Chaque utilisateur est responsable de sa condition physique et de sa sécurité
            lors de la pratique du padel. Il est recommandé de souscrire une assurance sportive adaptée.
          </p>
          <p>
            L'exploitant met tout en œuvre pour assurer la disponibilité du Service,
            mais ne garantit pas une disponibilité ininterrompue.
          </p>
        </Section>

        <Section title="6. Propriété intellectuelle">
          <p>
            Le contenu de la plateforme (textes, code, design, logo) est protégé par le droit suisse
            de la propriété intellectuelle. Toute reproduction ou utilisation sans autorisation est interdite.
          </p>
          <p>
            Les contenus publiés par les utilisateurs (nom, photo de profil) restent leur propriété.
            En les téléversant, ils accordent à PadelMates une licence limitée pour les afficher dans le cadre du Service.
          </p>
        </Section>

        <Section title="7. Résiliation">
          <p>
            L'utilisateur peut supprimer son compte à tout moment depuis les paramètres de son profil.
            Cette suppression entraîne l'effacement de ses données personnelles conformément à la
            politique de confidentialité.
          </p>
          <p>
            L'exploitant peut suspendre ou supprimer un compte en cas de violation des présentes CGU,
            après notification préalable sauf en cas de faute grave.
          </p>
        </Section>

        <Section title="8. Modifications des CGU">
          <p>
            L'exploitant se réserve le droit de modifier les présentes CGU à tout moment.
            Les utilisateurs seront informés des modifications substantielles par email ou notification dans l'application.
            La poursuite de l'utilisation du Service après modification vaut acceptation des nouvelles CGU.
          </p>
        </Section>

        <Section title="9. Droit applicable et for juridique">
          <p>
            Les présentes CGU sont régies par le droit suisse.
            Tout litige relatif à l'interprétation ou à l'exécution des présentes CGU sera soumis
            à la compétence exclusive des tribunaux du canton de Genève, Suisse.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Pour toute question relative aux présentes CGU :{' '}
            <a href="mailto:contact@padelmates.ch" className="text-blue-600 hover:underline">
              contact@padelmates.ch
            </a>
          </p>
        </Section>

      </div>

      <div className="text-center pb-4">
        <Link to="/confidentialite" className="text-sm text-blue-600 hover:underline">
          Lire aussi : Politique de confidentialité →
        </Link>
      </div>
    </div>
  )
}
