// src/pages/ClinicPage.tsx
// Fiche publique d'un cabinet : infos générales + équipe complète des
// praticiens membres, chacun avec ses disponibilités hebdomadaires. Clic
// sur un praticien → sa fiche individuelle (/doctor/:id) pour réserver.
import { useParams, Link } from 'react-router-dom'
import Navbar from '@/components/ui/Navbar'
import BackButton from '@/components/ui/BackButton'
import StarRating from '@/components/ui/StarRating'
import { useClinicInfo, useClinicTeam, useDoctorsAvailabilities } from '@/hooks/useData'

const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function ClinicPage() {
  const { id } = useParams<{ id: string }>()
  const { data: clinic, isLoading: clinicLoading } = useClinicInfo(id)
  const { data: team = [], isLoading: teamLoading } = useClinicTeam(id)
  const doctorIds = team.map((m: any) => m.doctor_id)
  const { data: availabilities = [] } = useDoctorsAvailabilities(doctorIds)

  const isLoading = clinicLoading || teamLoading

  if (isLoading) return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-48 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  )

  if (!clinic) return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Cabinet introuvable.</p>
        <Link to="/search" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FFFAF0]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BackButton fallback="/search" />

        {/* En-tête cabinet */}
        <div className="card p-6 flex gap-5 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-sage-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
            {clinic.logo_url
              ? <img src={clinic.logo_url} alt={clinic.name} className="w-full h-full object-cover" />
              : <span className="text-3xl">🏥</span>}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{clinic.name}</h1>
            <p className="text-sage-600 font-medium">🏥 Cabinet · {team.length} praticien{team.length > 1 ? 's' : ''}</p>
            {(clinic.address || clinic.city) && (
              <p className="text-sm text-gray-500 mt-1">📍 {clinic.address ?? clinic.city}</p>
            )}
            {clinic.phone && (
              <a href={`tel:${clinic.phone}`} className="text-sm text-sage-600 mt-1 inline-block hover:underline">
                📞 {clinic.phone}
              </a>
            )}
          </div>
        </div>

        {/* Équipe */}
        <h2 className="font-semibold text-gray-900 mb-3">Notre équipe</h2>
        {team.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-gray-400 text-sm">Aucun praticien référencé pour ce cabinet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {team.map((m: any) => {
              const name = `${m.first_name} ${m.last_name}`
              const doctorAvail = availabilities.filter((a: any) => a.doctor_id === m.doctor_id)
              const days = [...new Set(doctorAvail.map((a: any) => a.day_of_week))].sort()
              return (
                <Link key={m.doctor_id} to={`/doctor/${m.doctor_id}`}
                  className="card p-5 hover:shadow-md transition-shadow flex gap-4 group">
                  <div className="w-16 h-16 rounded-2xl bg-sage-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
                      : <span className="text-2xl font-bold text-sage-600">{name[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 group-hover:text-sage-600 transition-colors">{name}</h3>
                        <p className="text-sm text-sage-600 font-medium">{m.specialty}</p>
                      </div>
                      {m.is_verified && <span className="badge-green flex-shrink-0">✓ Vérifié</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <StarRating rating={m.average_rating} size="sm" />
                      <span className="text-xs text-gray-500">{Number(m.average_rating).toFixed(1)} ({m.review_count} avis)</span>
                      <span className="text-xs font-medium text-gray-700">{m.consultation_price}€</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {days.length > 0
                        ? `📅 Disponible : ${days.map(d => DAYS_SHORT[d as number]).join(', ')}`
                        : 'Aucune disponibilité renseignée'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 self-center">
                    <svg className="w-5 h-5 text-gray-300 group-hover:text-sage-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
