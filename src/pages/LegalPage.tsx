// src/pages/LegalPage.tsx
// CGU + politique de confidentialité, sur une seule page (ancres /cgu et
// /confidentialite) — contenu basé sur la checklist CNIL, informations de
// l'entreprise renseignées (SIRET obtenu le 29/07/2026), en attente de
// relecture par un professionnel du droit avant validation définitive.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'

export default function LegalPage() {
  const location = useLocation()

  useEffect(() => {
    const id = location.pathname === '/confidentialite' ? 'confidentialite' : 'cgu'
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <BackButton fallback="/" />

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-8">
          Document renseigné avec les informations de l'entreprise — en attente de relecture par un professionnel du droit avant validation définitive.
        </div>

        <h1 id="cgu" className="text-2xl font-bold text-gray-900 mb-1 scroll-mt-24">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-sm text-gray-400 mb-8">Dernière mise à jour : 30 juillet 2026</p>

        <div className="card p-6 space-y-6 mb-10">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Objet</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») ont pour objet de définir les modalités et conditions d'utilisation de la plateforme Animéaux (ci-après « la Plateforme »), accessible à l'adresse monanimeaux.fr, éditée par Anaïs SAN BIAGIO, entrepreneur individuel, dont le siège est situé 169 avenue Vauban, 93190 Livry-Gargan, immatriculée sous le SIRET 107 512 907 00018.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Animéaux est une plateforme de mise en relation entre propriétaires d'animaux et praticiens du secteur animalier (vétérinaires, ostéopathes, toiletteurs, éducateurs canins, et autres professions listées sur la Plateforme), permettant la recherche de praticiens, la prise de rendez-vous en ligne et le suivi du dossier de santé des animaux.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Toute utilisation de la Plateforme implique l'acceptation pleine et entière des présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Rôle d'Animéaux</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Animéaux est un intermédiaire technique de mise en relation. <strong>Animéaux n'est pas praticien, ne dispense aucun soin, conseil médical ou vétérinaire, et n'intervient pas dans la relation contractuelle entre le propriétaire de l'animal et le praticien choisi.</strong>
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Chaque praticien inscrit sur la Plateforme est seul responsable de la qualité, de la conformité réglementaire et de l'exécution des prestations qu'il propose, ainsi que des informations qu'il renseigne sur son profil (qualifications, tarifs, disponibilités).
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Animéaux ne garantit pas la disponibilité effective d'un praticien, ni l'exactitude des informations qu'il publie, mais met en place des mécanismes raisonnables de vérification et de signalement (article 6).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Accès à la Plateforme et création de compte</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              L'accès à la Plateforme est ouvert à toute personne physique majeure. La création d'un compte nécessite la fourniture d'informations exactes et à jour.
            </p>
            <ul className="text-sm text-gray-600 leading-relaxed mt-2 list-disc list-inside space-y-1">
              <li><strong>Propriétaire d'animal (patient)</strong> — recherche de praticiens, prise de rendez-vous, gestion du dossier de santé de ses animaux.</li>
              <li><strong>Praticien</strong> — gestion d'un agenda, de tarifs, d'une patientèle, éventuellement au sein d'un cabinet.</li>
              <li><strong>Secrétariat</strong> — accès accordé par un praticien à un membre de son équipe, restreint aux informations du cabinet.</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Chaque utilisateur est responsable de la confidentialité de ses identifiants et de toute activité effectuée depuis son compte.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Prise de rendez-vous</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              La prise de rendez-vous via la Plateforme constitue un engagement entre le propriétaire de l'animal et le praticien concerné. Les conditions d'annulation, de retard ou d'absence sont celles définies par le praticien ; Animéaux ne s'interpose pas dans ces relations, sauf en cas de manquement aux présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Contenus publiés par les utilisateurs</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Les utilisateurs peuvent publier des contenus : avis, messages, documents relatifs à la santé d'un animal, photos. Chaque utilisateur reste responsable des contenus qu'il publie et garantit qu'ils ne portent atteinte à aucun droit de tiers, ne sont ni diffamatoires, ni trompeurs, ni contraires à l'ordre public.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Les avis doivent refléter une expérience réelle avec le praticien concerné. Tout avis frauduleux ou dénigrant sans fondement pourra être retiré.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Signalement et modération</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tout utilisateur peut signaler un contenu, un profil ou un comportement contraire aux présentes CGU via le bouton « Signaler » disponible sous chaque avis et sur chaque fiche praticien, examiné par l'équipe de modération d'Animéaux. Animéaux se réserve le droit de suspendre ou supprimer tout compte ou contenu en cas de manquement manifeste.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">7. Suppression de compte</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tout utilisateur peut supprimer définitivement son compte et l'ensemble des données associées directement depuis son espace, à tout moment. Cette suppression est irréversible.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">8. Responsabilité et disponibilité du service</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Animéaux met en œuvre les moyens raisonnables pour assurer l'accès et le bon fonctionnement de la Plateforme, sans garantie de continuité absolue. Animéaux ne saurait être tenu responsable des dommages résultant de l'utilisation de la Plateforme, ni des actes ou omissions des praticiens ou des autres utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">9. Évolution des CGU</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Animéaux se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par email. La poursuite de l'utilisation après modification vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">10. Droit applicable</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité ; à défaut, les tribunaux français compétents seront saisis.
            </p>
          </section>
        </div>

        <h1 id="confidentialite" className="text-2xl font-bold text-gray-900 mb-1 scroll-mt-24">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-gray-400 mb-8">Établie conformément au RGPD et à la loi Informatique et Libertés.</p>

        <div className="card p-6 space-y-6">
          <section>
            <h2 className="font-semibold text-gray-900 mb-2">1. Responsable du traitement</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Le responsable du traitement des données à caractère personnel collectées sur Animéaux est Anaïs SAN BIAGIO (entrepreneur individuel, SIRET 107 512 907 00018), 169 avenue Vauban, 93190 Livry-Gargan, contactable à contact@monanimeaux.fr.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">2. Données collectées</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-600">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Catégorie</th>
                    <th className="py-2 pr-3 font-medium">Données</th>
                    <th className="py-2 font-medium">Finalité</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Compte', 'Email, mot de passe (chiffré), rôle', 'Authentification, accès au service'],
                    ['Profil', "Nom, prénom, téléphone, photo, adresse, contact d'urgence", 'Identification, mise en relation'],
                    ['Profil praticien', 'Spécialité, n° RPPS, bio, tarifs, adresse pro., géolocalisation', 'Référencement, recherche'],
                    ['Animaux', 'Nom, espèce, race, naissance, poids, photo, identification', "Suivi du dossier de l'animal"],
                    ['Santé animale', 'Vaccins, poids, actes de soin, documents', 'Suivi médical, partagé avec le praticien consulté'],
                    ['Rendez-vous', 'Date, motif, statut', 'Gestion des rendez-vous'],
                    ['Échanges', 'Messages, avis', "Communication, retour d'expérience"],
                  ].map(([cat, data, purpose]) => (
                    <tr key={cat} className="border-b border-gray-50 last:border-0 align-top">
                      <td className="py-2 pr-3 font-medium text-gray-800 whitespace-nowrap">{cat}</td>
                      <td className="py-2 pr-3">{data}</td>
                      <td className="py-2">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mt-3">
              Ces données concernent des animaux, non des personnes physiques, et ne sont donc pas des « données de santé » au sens strict du RGPD (article 9). Elles restent traitées avec la même rigueur, car associées à des données personnelles identifiantes (le propriétaire).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">3. Base légale et finalités</h2>
            <ul className="text-sm text-gray-600 leading-relaxed list-disc list-inside space-y-1">
              <li><strong>Exécution du contrat</strong> — création de compte, prise de rendez-vous, dossier de santé animal.</li>
              <li><strong>Intérêt légitime</strong> — amélioration du service, prévention de la fraude.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">4. Destinataires des données</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Les données d'un utilisateur ne sont accessibles qu'à : l'utilisateur lui-même ; le ou les praticiens avec lesquels un rendez-vous confirmé ou passé existe, pour le dossier de l'animal concerné ; les membres d'un même cabinet, pour le suivi partagé de la patientèle ; le personnel d'Animéaux en cas de nécessité.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Les données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires par des tiers.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">5. Sous-traitants techniques</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Animéaux fait appel à <strong>Supabase</strong> (base de données, authentification — hébergé dans l'Union européenne, région Frankfurt), <strong>Vercel</strong> (hébergement du site — hébergé aux États-Unis) et <strong>Resend</strong> (emails transactionnels — société américaine). Ces prestataires agissent en tant que sous-traitants au sens du RGPD ; les transferts hors UE s'appuient sur les garanties proposées par ces prestataires (clauses contractuelles types ou équivalent), à faire confirmer précisément lors de la relecture juridique.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">6. Durée de conservation</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Les données sont conservées pendant toute la durée d'utilisation du compte. En cas de suppression du compte, les données sont supprimées immédiatement et de façon irréversible.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">7. Sécurité</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Chaque utilisateur ne peut techniquement accéder qu'aux données qui le concernent ou pour lesquelles il dispose d'une autorisation explicite. Les mots de passe ne sont jamais stockés en clair.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">8. Droits des utilisateurs</h2>
            <ul className="text-sm text-gray-600 leading-relaxed list-disc list-inside space-y-1">
              <li><strong>Droit d'accès</strong> — obtenir une copie des données le concernant.</li>
              <li><strong>Droit de rectification</strong> — corriger des données inexactes, depuis son profil.</li>
              <li><strong>Droit à l'effacement</strong> — suppression du compte, disponible depuis la Plateforme.</li>
              <li><strong>Droit à la portabilité</strong> — recevoir ses données dans un format structuré.</li>
              <li><strong>Droit d'opposition et de limitation</strong> du traitement.</li>
            </ul>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Ces droits peuvent être exercés en écrivant à contact@monanimeaux.fr. En cas de réponse insatisfaisante, réclamation possible auprès de la CNIL (www.cnil.fr).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">9. Cookies et traceurs</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              La Plateforme utilise uniquement un stockage technique nécessaire au fonctionnement du service (maintien de la session). Aucun outil de mesure d'audience ou traceur publicitaire n'est utilisé à ce jour.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900 mb-2">10. Mineurs</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              La Plateforme n'est pas destinée aux personnes mineures. La création de compte est réservée aux personnes majeures.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
