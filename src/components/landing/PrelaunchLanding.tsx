// src/components/landing/PrelaunchLanding.tsx
// Accueil du site pendant la phase de pré-lancement (migration 137) : s'adresse aux praticiens,
// pas aux propriétaires (le service n'est pas encore ouvert). La date d'ouverture vient des
// réglages admin ; sans date, le texte reste « Ouverture bientôt ».
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import { PLAN_OFFERS, VAT_NOTE } from '@/lib/subscription'
import { launchLabel } from '@/lib/prelaunch'

const STEPS = [
  { n: '1', t: 'Créez votre compte', d: 'Votre métier, votre ville, votre justificatif professionnel. Notre équipe le valide.' },
  { n: '2', t: 'Choisissez votre formule', d: "Dites-nous laquelle vous intéresse. Aucun paiement avant l'ouverture, et vous pourrez en changer." },
  { n: '3', t: 'Préparez votre profil', d: 'Bio, tarifs, disponibilités : tout est prêt quand les premiers propriétaires arrivent.' },
]

export default function PrelaunchLanding({ launchDate }: { launchDate: string | null }) {
  const label = launchLabel(launchDate)
  return (
    <div className="min-h-screen bg-sage-50" data-testid="prelaunch-landing">
      <Navbar />

      <section className="py-14 md:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block bg-sage-100 text-sage-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            {label}
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
            Rejoignez les premiers praticiens<br />
            <span className="text-sage-600">d&apos;Animéaux</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mb-8 max-w-xl mx-auto">
            Créez votre profil dès maintenant, préparez votre agenda et soyez prêt le jour de l&apos;ouverture aux
            propriétaires d&apos;animaux. Pré-inscription gratuite, sans engagement.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/register?role=doctor" className="btn-primary">Je me pré-inscris</Link>
            <Link to="/login" className="btn-secondary">J&apos;ai déjà un compte</Link>
          </div>
        </div>
      </section>

      <section className="py-14 px-4 bg-[#FFFAF0]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Comment ça marche ?</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(s => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 bg-sage-500 text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4">{s.n}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{s.t}</h3>
                <p className="text-sm text-gray-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Trois formules, aucune obligation aujourd&apos;hui</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {(['free', 'pro', 'cabinet'] as const).map(id => {
              const o = PLAN_OFFERS[id]
              return (
                <div key={id} className="card p-6">
                  <h3 className="font-serif text-xl font-bold text-gray-900">{o.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{o.tagline}</p>
                  <p className="font-serif text-3xl font-bold text-sage-600">
                    {o.priceHt ? <>{o.priceHt} €<span className="font-sans text-sm font-normal text-gray-500"> / mois</span></> : '0 €'}
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
                    {o.features.filter(f => f.included).map(f => (
                      <li key={f.label} className="flex gap-2"><span className="text-moss-700 font-bold" aria-hidden="true">✓</span><span>{f.label}</span></li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">Prix mensuels, {VAT_NOTE}. Résiliable à tout moment.</p>
        </div>
      </section>

      <section className="py-14 px-4 bg-[#FFFAF0] text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-5">Prêt à faire partie des premiers ?</h2>
        <Link to="/register?role=doctor" className="btn-primary inline-block">Je me pré-inscris</Link>
      </section>

      <Footer />
    </div>
  )
}
