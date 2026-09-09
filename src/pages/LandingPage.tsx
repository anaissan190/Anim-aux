// src/pages/LandingPage.tsx
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import SearchBar from '@/components/search/SearchBar'
import { useAuthStore } from '@/lib/authStore'
import { PRACTITIONER_TYPES } from '@/lib/practitionerTypes'
import logoNavbar from '@/assets/logo-navbar.webp'

// Toutes les catégories de la liste fermée des métiers, sauf "Autre" qui
// n'a pas de sens comme raccourci de recherche.
const SPECIALTIES = PRACTITIONER_TYPES.filter(t => t.id !== 'autre')
  .map(t => ({ icon: t.icon, name: t.label }))

// "Comment ça marche" dépend de qui regarde : un patient/visiteur veut
// savoir comment réserver, un praticien connecté veut savoir comment gérer
// son activité — les étapes de réservation n'ont aucun sens pour lui.
const STEPS_PATIENT = [
  { n: '1', t: 'Recherchez', d: 'Entrez votre spécialité et votre ville. Filtrez par disponibilité, prix ou note.' },
  { n: '2', t: 'Choisissez', d: 'Consultez les profils, les avis patients et choisissez votre créneau.' },
  { n: '3', t: 'Confirmez', d: 'Prenez rendez-vous en quelques secondes. Confirmation par email immédiate.' },
]
const STEPS_DOCTOR = [
  { n: '1', t: 'Créez votre profil', d: 'Renseignez votre spécialité, votre bio et vos disponibilités.' },
  { n: '2', t: 'Recevez des demandes', d: 'Les patients réservent directement selon vos créneaux disponibles.' },
  { n: '3', t: 'Échangez avec vos patients', d: 'Confirmez les RDV, gérez le dossier de leurs animaux, messagerie intégrée.' },
]

export default function LandingPage() {
  const { user } = useAuthStore()

  const steps = user?.role === 'doctor' ? STEPS_DOCTOR : STEPS_PATIENT

  return (
    <div className="relative min-h-screen bg-sage-50">
      {/* Desktop : inchangé */}
      <div className="hidden md:block">
        <div className="relative z-10">
          <Navbar />

          {/* Hero */}
          <section className="py-20 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <span className="inline-block bg-sage-100 text-sage-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
                Votre animal, notre priorité
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
                Trouvez un praticien,<br />
                <span className="text-sage-600">prenez rendez-vous en ligne</span>
              </h1>
              <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
                Plus de 5 000 professionnels de santé disponibles.
                Consultez les avis, choisissez votre créneau, confirmez en 1 clic.
              </p>
              <div className="flex justify-center">
                <SearchBar large />
              </div>
            </div>
          </section>

          {/* Comment ça marche */}
          <section className="py-16 px-4 bg-[#FFFAF0]">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
                Comment ça marche ?
              </h2>
              <div className="grid sm:grid-cols-3 gap-8">
                {steps.map(step => (
                  <div key={step.n} className="text-center">
                    <div className="w-12 h-12 bg-sage-500 text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4">
                      {step.n}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{step.t}</h3>
                    <p className="text-sm text-gray-500">{step.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Spécialités */}
          <section className="py-16 px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
                Consultez par spécialité
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {SPECIALTIES.map(s => (
                  <Link key={s.name} to={`/search?specialty=${encodeURIComponent(s.name)}`}
                    className="card p-3 text-center hover:shadow-md hover:border-sage-200 transition-all group">
                    <div className="text-2xl mb-2">{s.icon}</div>
                    <p className="text-xs font-medium text-gray-700 group-hover:text-sage-600 transition-colors leading-tight">
                      {s.name}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* CTA médecins — en dernier, uniquement pour les visiteurs non
              connectés : un patient ou un praticien déjà connecté n'a pas à
              voir cette proposition de création de compte. */}
          {!user && (
            <section className="py-16 px-4 bg-[#FFFAF0]">
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Vous êtes praticien ?</h2>
                <p className="text-gray-500 mb-6">
                  Rejoignez Animéaux et gérez votre agenda en ligne. Gratuit pendant 3 mois.
                </p>
                <Link to="/register?role=doctor" className="btn-primary inline-flex items-center gap-2">
                  Créer mon profil praticien →
                </Link>
              </div>
            </section>
          )}

          <Footer />
        </div>
      </div>

      {/* Mobile : alignée sur l'identité desktop (Lora/Public Sans, fond
          crème, pilules orange) depuis le 07/09/2026 — reprend la même
          structure que la coquille "Wow / Aurora" précédente (mascotte,
          recherche en une carte, double CTA) mais avec les couleurs/polices
          du reste de la refonte plutôt que Fredoka/Nunito et le fond orange.
          Toujours volontairement épuré : rien sous le bloc recherche/CTA. */}
      <div className="md:hidden min-h-screen bg-[#FFFAF0]">
        {/* "Se connecter" / "Créer un compte" ici, en haut — retiré du bas
            de l'écran (retour d'Anaïs du 07/09/2026). Même ligne que le
            logo (h-12, taille validée), alignés à droite — boutons
            resserrés pour tenir à côté du logo à 375px. */}
        <div className="flex items-center justify-between gap-1.5 px-4 pt-4 pb-1">
          <img src={logoNavbar} alt="Animéaux" className="h-12 w-auto flex-shrink-0" />
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link to="/register" className="whitespace-nowrap text-[11px] font-medium text-gray-900 bg-white border border-sand-200 rounded-full px-2 py-1.5">
              Créer un compte
            </Link>
            <Link to="/login" className="whitespace-nowrap text-[11px] font-medium text-white bg-sage-500 hover:bg-sage-600 rounded-full px-2 py-1.5 transition-colors">
              Se connecter
            </Link>
          </div>
        </div>

        <div className="px-4 pt-10 pb-6 text-center">
          <span className="inline-block bg-sage-100 text-sage-700 text-xs font-bold px-3 py-1 rounded-full mt-3 mb-3">
            Votre animal, notre priorité
          </span>
          <h1 className="text-[28px] font-bold leading-tight">
            Trouvez un praticien,<br /><span className="text-sage-600">prenez RDV en ligne</span>
          </h1>
          <p className="text-sm text-gray-500 mt-3 mb-5 max-w-[280px] mx-auto">
            Plus de 5 000 professionnels disponibles. Avis, créneaux, confirmation en 1 clic.
          </p>

          <div className="card p-3 text-left">
            <SearchBar lightButton greenCityField />
          </div>
        </div>
      </div>
    </div>
  )
}
