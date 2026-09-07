// src/components/doctor/DoctorCard.tsx
import { Link } from 'react-router-dom'
import StarRating from '@/components/ui/StarRating'
import { formatNextSlotLabel } from '@/lib/nextSlot'
import type { Doctor } from '@/types'

interface Props { doctor: Doctor & { profiles?: any }; distanceKm?: number; nextSlotAt?: string | null }

// Alterne le duo de couleurs de l'avatar (initiales) entre l'orange et le
// vert de la palette, dérivé de façon stable depuis l'id — pas d'ordre
// d'affichage à threader en prop pour ça. Repris de la maquette Main.dc.html.
function colorPairFromId(id: string) {
  const sum = [...id].reduce((s, c) => s + c.charCodeAt(0), 0)
  return sum % 2 === 0
    ? { bg: 'bg-sage-100', text: 'text-sage-700' }
    : { bg: 'bg-moss-100', text: 'text-moss-700' }
}

export default function DoctorCard({ doctor, distanceKm, nextSlotAt }: Props) {
  const name = doctor.profiles
    ? `${doctor.profiles.first_name} ${doctor.profiles.last_name}`
    : 'Praticien'
  const initials = doctor.profiles
    ? `${doctor.profiles.first_name?.[0] ?? ''}${doctor.profiles.last_name?.[0] ?? ''}`.toUpperCase()
    : name[0]
  const colors = colorPairFromId(doctor.id)

  return (
    <Link to={`/doctor/${doctor.id}`}
      className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4 group">
      {/* Avatar */}
      <div className={`w-14 h-14 rounded-full ${colors.bg} flex-shrink-0 overflow-hidden flex items-center justify-center`}>
        {doctor.profiles?.avatar_url ? (
          <img src={doctor.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className={`font-serif font-semibold text-base ${colors.text}`}>{initials}</span>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-serif font-semibold text-[16px] text-gray-900 group-hover:text-sage-600 transition-colors">
              {name}
            </h3>
            <p className="text-[13px] text-gray-500 mt-0.5">
              {doctor.specialty}
              {doctor.city && ` · ${doctor.city}${distanceKm !== undefined ? ` · ${distanceKm.toFixed(1)} km` : ''}`}
              {' · '}{doctor.average_rating.toFixed(1)} ({doctor.review_count} avis)
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {doctor.is_verified && <span className="badge-green">✓ Vérifié</span>}
            {doctor.home_visit && <span className="badge-green">🏠 À domicile</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          <StarRating rating={doctor.average_rating} size="sm" />
          <span className="font-medium text-gray-700 text-sm">{doctor.consultation_price}€</span>
        </div>
      </div>

      {/* Disponibilité + action — pastille + bouton pilule (maquette Main.dc.html) */}
      <div className="flex-shrink-0 flex items-center gap-3">
        {nextSlotAt && (
          <span className="hidden sm:inline-block bg-moss-100 text-moss-700 text-xs font-bold px-4 py-2 rounded-full whitespace-nowrap">
            {formatNextSlotLabel(new Date(nextSlotAt))}
          </span>
        )}
        <span className="bg-sage-600 group-hover:bg-sage-700 text-white text-[13px] font-bold px-5 py-2.5 rounded-full whitespace-nowrap transition-colors">
          Réserver
        </span>
      </div>
    </Link>
  )
}
