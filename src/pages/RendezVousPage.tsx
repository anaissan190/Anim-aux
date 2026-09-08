// src/pages/RendezVousPage.tsx
// "Mes rendez-vous" — jusqu'ici une section intégrée à PatientDashboard ;
// devient une page à part entière pour servir de destination à la barre de
// navigation mobile (voir MobileTabBar). Logique reprise telle quelle de
// PatientDashboard (mêmes hooks, même comportement) — seul l'habillage
// change entre desktop (Navbar classique) et mobile (MobileHeader/MobileTabBar).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import MobileHeader from '@/components/mobile/MobileHeader'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import AppointmentCard from '@/components/appointment/AppointmentCard'
import DoctorMiniRow from '@/components/doctor/DoctorMiniRow'
import { usePatientAppointments } from '@/hooks/useData'
import { isFuture, isPast } from 'date-fns'

export default function RendezVousPage() {
  const { data: appointments = [], isLoading } = usePatientAppointments()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  const upcoming = appointments.filter(a => isFuture(new Date(a.start_at)) && a.status !== 'cancelled')
  const past = appointments.filter(a => isPast(new Date(a.start_at)) || a.status === 'cancelled')
  const display = tab === 'upcoming' ? upcoming : past

  // Praticiens distincts déjà consultés, dans l'ordre du RDV le plus récent
  // (appointments trié par start_at décroissant côté requête) — même
  // dérivation que "Derniers praticiens consultés" sur l'accueil patient
  // (PatientDashboard.tsx), pour permettre de reprendre RDV en un clic
  // directement depuis "Mes rendez-vous" (demande d'Anaïs du 08/09/2026).
  const recentDoctors = (() => {
    const seen = new Set<string>()
    const list: any[] = []
    for (const a of appointments) {
      const doc = (a as any).doctors
      if (doc?.id && !seen.has(doc.id)) {
        seen.add(doc.id)
        list.push(doc)
      }
    }
    return list.slice(0, 5)
  })()

  const recentDoctorsSection = recentDoctors.length > 0 && (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Praticiens déjà consultés</p>
      <div className="card overflow-hidden">
        {recentDoctors.map((doc, i) => (
          <DoctorMiniRow key={doc.id} doctor={doc} colorIndex={i} isLast={i === recentDoctors.length - 1} />
        ))}
      </div>
    </div>
  )

  const tabs = (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
      {(['upcoming', 'past'] as const).map(t => (
        <button key={t} onClick={() => setTab(t)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
          {t === 'upcoming' ? `À venir (${upcoming.length})` : `Passés (${past.length})`}
        </button>
      ))}
    </div>
  )

  // key={tab} : force un remount (donc une nouvelle animation d'entrée) au
  // changement d'onglet À venir/Passés, plutôt qu'un simple patch React
  // invisible — retour d'Anaïs du 08/09/2026 sur l'aperçu de micro-interactions.
  const list = (
    <div key={tab} className="animate-rise-in">
    {isLoading ? (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card p-4 flex gap-4 animate-pulse">
            <div className="w-14 h-16 bg-gray-100 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-gray-100 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    ) : display.length === 0 ? (
      <div className="card p-12 text-center">
        <div className="text-4xl mb-4">{tab === 'upcoming' ? '📅' : '📂'}</div>
        <p className="font-medium text-gray-700 mb-2">
          {tab === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
        </p>
      </div>
    ) : (
      <div className="space-y-3">
        {display.map((a, i) => (
          <div key={a.id} className="animate-rise-in" style={{ animationDelay: `${i * 60}ms` }}>
            <AppointmentCard appointment={a as any} />
          </div>
        ))}
      </div>
    )}
    </div>
  )

  return (
    <div className="relative min-h-screen bg-sage-50">
      <div className="relative z-10">

        {/* Desktop : bouton "Nouveau rendez-vous" toujours accessible (avant,
            réservé au CTA de l'état vide — demande d'Anaïs du 08/09/2026) +
            suggestion des praticiens déjà consultés, pour reprendre RDV en
            un clic sans repasser par une recherche. */}
        <div className="hidden md:block">
          <Navbar />
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">📅 Mes rendez-vous</h1>
              <Link to="/search" className="btn-primary text-sm">+ Nouveau rendez-vous</Link>
            </div>
            {recentDoctorsSection}
            {tabs}
            {list}
          </div>
        </div>

        {/* Mobile : coquille "Wow / Aurora" */}
        <div className="md:hidden pb-24 animate-mobile-slide-in">
          <MobileHeader className="bg-sage-100/60">
            <h1 className="font-playfair text-2xl font-bold text-gray-900">Mes rendez-vous</h1>
            <p className="text-sm text-gray-500 mt-0.5">Passés et à venir</p>
            <Link to="/search" className="btn-primary text-sm inline-block mt-3">+ Nouveau rendez-vous</Link>
          </MobileHeader>
          <div className="px-4 -mt-1">
            {recentDoctorsSection}
            {tabs}
            {list}
          </div>
          <MobileTabBar />
        </div>
      </div>
    </div>
  )
}
