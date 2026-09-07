// src/pages/PatientDashboard.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import AppointmentCard from '@/components/appointment/AppointmentCard'
import { usePatientAppointments, useFavorites } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import { isFuture, isPast } from 'date-fns'
import MobileHeader from '@/components/mobile/MobileHeader'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import CatMascot from '@/components/mobile/CatMascot'
import DoctorMiniRow from '@/components/doctor/DoctorMiniRow'
import PushNotificationBanner from '@/components/ui/PushNotificationBanner'

export default function PatientDashboard() {
  const { profile } = useAuthStore()
  const { data: appointments = [], isLoading } = usePatientAppointments()
  const { data: favorites = [] } = useFavorites()
  const navigate = useNavigate()

  const [mobileSpecialty, setMobileSpecialty] = useState('')
  const [mobileCity, setMobileCity] = useState('')

  function handleMobileSearch(e: React.FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (mobileSpecialty) p.set('specialty', mobileSpecialty)
    if (mobileCity) p.set('city', mobileCity)
    navigate(`/search?${p.toString()}`)
  }

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  const upcoming = appointments.filter(a => isFuture(new Date(a.start_at)) && a.status !== 'cancelled')
  const past = appointments.filter(a => isPast(new Date(a.start_at)) || a.status === 'cancelled')
  const display = tab === 'upcoming' ? upcoming : past

  // Praticiens distincts, dans l'ordre du RDV le plus récent (appointments
  // est déjà trié par start_at décroissant côté requête) — pour la section
  // "Derniers praticiens consultés" de l'accueil mobile.
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

  return (
    <div className="relative min-h-screen bg-sage-50">
      <div className="relative z-10">
      <div className="hidden md:block">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Bienvenue */}
        <div className="mb-9 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-bold text-gray-900">
              Bonjour, {profile?.first_name ?? 'Patient'} 👋
            </h1>
            <p className="text-gray-500 text-[15px] mt-1.5">Gérez vos animaux et vos rendez-vous.</p>
          </div>
          {/* Orange (accent), pas vert — retour d'Anaïs du 07/09/2026 : le
              vert de la maquette DashboardMix ne correspond pas à la couleur
              d'action de l'appli, réservée à l'orange partout ailleurs
              (Réserver, Confirmer...). Un cran plus clair que le bouton
              btn-primary standard (sage-500 au lieu de sage-600) — celui-ci
              est gros et bien en vue en haut de l'accueil, le ton plein
              rendait trop foncé à cet endroit. */}
          <Link to="/search"
            className="bg-sage-500 hover:bg-sage-600 text-white font-medium text-sm px-6 py-3 rounded-full transition-colors whitespace-nowrap flex-shrink-0">
            + Prendre rendez-vous
          </Link>
        </div>

        <PushNotificationBanner />

        {/* Colonne principale (RDV) + barre latérale (actions rapides,
            favoris, derniers praticiens consultés — ces deux dernières
            sections n'existaient jusqu'ici que sur mobile). "Mes animaux"
            retiré de cet écran (déjà son propre onglet dans la barre —
            retour d'Anaïs, 07/09/2026). Élargi à max-w-5xl (au lieu de
            max-w-3xl) : une seule colonne étroite laissait beaucoup de
            vide sur grand écran. */}
        <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">

        {/* Mes rendez-vous */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {tab === 'upcoming' ? 'Prochains rendez-vous' : 'Rendez-vous passés'}
            </p>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-full w-fit">
              {(['upcoming', 'past'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors
                    ${tab === t ? 'bg-white text-sage-600 shadow-sm' : 'text-gray-500'}`}>
                  {t === 'upcoming' ? `À venir (${upcoming.length})` : `Passés (${past.length})`}
                </button>
              ))}
            </div>
          </div>

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
              {tab === 'upcoming' && (
                <Link to="/search" className="btn-primary inline-block mt-2 text-sm">
                  Prendre un rendez-vous
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {display.map(a => <AppointmentCard key={a.id} appointment={a as any} />)}
            </div>
          )}
        </div>
        </div>

        {/* Barre latérale : actions rapides + favoris + derniers
            praticiens consultés (repris de la coquille mobile). */}
        <div className="space-y-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Actions rapides</p>
            <div className="card p-2 space-y-1">
              <Link to="/search" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <span>🔍</span> Nouveau RDV
              </Link>
              <Link to="/documents" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <span>📄</span> Documents
              </Link>
            </div>
          </div>

          {favorites.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">⭐ Mes favoris</p>
              <div className="card overflow-hidden">
                {favorites.map((fav: any, i) => (
                  <DoctorMiniRow key={fav.id} doctor={fav.doctors} colorIndex={i} isLast={i === favorites.length - 1} />
                ))}
              </div>
            </div>
          )}

          {recentDoctors.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Derniers praticiens consultés</p>
              <div className="card overflow-hidden">
                {recentDoctors.map((doc, i) => (
                  <DoctorMiniRow key={doc.id} doctor={doc} colorIndex={i} isLast={i === recentDoctors.length - 1} />
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
      </div>

      {/* Mobile : coquille "Wow / Aurora" — validée sur aperçu avant ce chantier */}
      <div className="md:hidden pb-24 min-h-screen bg-sage-200">
        <MobileHeader>
          {/* Mascotte : petite, casée dans le coin haut-droit près des
              icônes — position exacte de l'aperçu validé (pas centrée/agrandie).
              Sera remplacée par le dessin des deux chats de la cliente. */}
          <CatMascot size={72} animate className="absolute top-[42px] right-2 drop-shadow-lg" />
          <span className="absolute top-11 right-20 text-[12px] text-sage-100 animate-twinkle">✦</span>
          <span className="absolute top-20 right-9 text-[18px] text-white animate-twinkle [animation-delay:.8s]">✦</span>
          <span className="absolute top-3 right-28 text-[10px] text-sage-100 animate-twinkle [animation-delay:1.6s]">✦</span>

          <h1 className="font-fredoka text-[28px] font-semibold text-gray-900 leading-tight mt-6">
            Bonjour {profile?.first_name ?? 'Patient'}
          </h1>
          <p className="font-nunito text-sm text-gray-700/80 mt-0.5">Prête pour la prochaine visite ?</p>

          <form onSubmit={handleMobileSearch}
            className="bg-white/95 rounded-2xl shadow-sm mt-4 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <span className="text-sm">🩺</span>
              <div className="flex-1 min-w-0">
                <label className="block text-[8px] font-bold text-gray-400 tracking-wide">SPÉCIALITÉ OU NOM</label>
                <input value={mobileSpecialty} onChange={e => setMobileSpecialty(e.target.value)}
                  placeholder="Vétérinaire, Dr Martin..."
                  className="w-full text-[13px] text-gray-900 placeholder:text-gray-400 outline-none bg-transparent" />
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="text-sm">📍</span>
              <div className="flex-1 min-w-0">
                <label className="block text-[8px] font-bold text-gray-400 tracking-wide">LIEU</label>
                <input value={mobileCity} onChange={e => setMobileCity(e.target.value)}
                  placeholder="Ville, code postal..."
                  className="w-full text-[13px] text-gray-900 placeholder:text-gray-400 outline-none bg-transparent" />
              </div>
            </div>
            <button type="submit" className="w-full bg-sage-500 py-2.5 font-fredoka text-sm font-semibold text-white">
              🔍 Rechercher
            </button>
          </form>
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {['🩺 Vétérinaire', '✂️ Toiletteur', '🦴 Ostéo', '🧠 Comportementaliste', '🐕 Éducateur canin'].map(c => (
              <Link key={c} to="/search"
                className="flex-shrink-0 bg-white/60 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-bold text-sage-700">
                {c}
              </Link>
            ))}
          </div>
        </MobileHeader>

        <div className="px-4 -mt-1 relative z-10">
          <PushNotificationBanner />

          {favorites.length > 0 && (
            <div className="animate-rise-in mb-5">
              <p className="font-fredoka text-sm font-semibold text-gray-900 mb-2">⭐ Mes favoris</p>
              <div className="bg-white rounded-2xl shadow-sm border border-white/70 overflow-hidden">
                {favorites.map((fav: any, i) => (
                  <DoctorMiniRow key={fav.id} doctor={fav.doctors} colorIndex={i} isLast={i === favorites.length - 1} mobile />
                ))}
              </div>
            </div>
          )}

          {recentDoctors.length > 0 && (
            <div className="animate-rise-in">
              <p className="font-fredoka text-sm font-semibold text-gray-900 mb-2">Derniers praticiens consultés</p>
              <div className="bg-white rounded-2xl shadow-sm border border-white/70 overflow-hidden">
                {recentDoctors.map((doc, i) => (
                  <DoctorMiniRow key={doc.id} doctor={doc} colorIndex={i} isLast={i === recentDoctors.length - 1} mobile />
                ))}
              </div>
            </div>
          )}
        </div>

        <MobileTabBar />
      </div>
      </div>
    </div>
  )
}
