// src/pages/RendezVousPage.tsx
// "Mes rendez-vous" — jusqu'ici une section intégrée à PatientDashboard ;
// devient une page à part entière pour servir de destination à la barre de
// navigation mobile (voir MobileTabBar). Logique reprise telle quelle de
// PatientDashboard (mêmes hooks, même comportement) — seul l'habillage
// change entre desktop (Navbar classique) et mobile (MobileHeader/MobileTabBar).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import AnimalBackground from '@/components/ui/AnimalBackground'
import MobileHeader from '@/components/mobile/MobileHeader'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import AppointmentCard from '@/components/appointment/AppointmentCard'
import { usePatientAppointments } from '@/hooks/useData'
import { isFuture, isPast } from 'date-fns'

export default function RendezVousPage() {
  const { data: appointments = [], isLoading } = usePatientAppointments()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  const upcoming = appointments.filter(a => isFuture(new Date(a.start_at)) && a.status !== 'cancelled')
  const past = appointments.filter(a => isPast(new Date(a.start_at)) || a.status === 'cancelled')
  const display = tab === 'upcoming' ? upcoming : past

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

  const list = isLoading ? (
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
      {tab === 'upcoming' && (
        <Link to="/search" className="btn-primary inline-block mt-2 text-sm">Prendre un rendez-vous</Link>
      )}
    </div>
  ) : (
    <div className="space-y-3">
      {display.map(a => <AppointmentCard key={a.id} appointment={a as any} />)}
    </div>
  )

  return (
    <div className="relative min-h-screen bg-sage-50">
      <div className="relative z-10">

        {/* Desktop : inchangé */}
        <div className="hidden md:block">
          <AnimalBackground />
          <Navbar />
          <div className="max-w-3xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">📅 Mes rendez-vous</h1>
            {tabs}
            {list}
          </div>
        </div>

        {/* Mobile : coquille "Wow / Aurora" */}
        <div className="md:hidden pb-24">
          <MobileHeader className="bg-sage-100/60">
            <h1 className="font-fredoka text-2xl font-semibold text-gray-900">Mes rendez-vous</h1>
            <p className="font-nunito text-sm text-gray-500 mt-0.5">Passés et à venir</p>
          </MobileHeader>
          <div className="px-4 -mt-1">
            {tabs}
            {list}
          </div>
          <MobileTabBar />
        </div>
      </div>
    </div>
  )
}
