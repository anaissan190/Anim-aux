// src/components/doctor/DoctorCard.tsx
import { Link } from 'react-router-dom'
import StarRating from '@/components/ui/StarRating'
import { formatNextSlotLabel } from '@/lib/nextSlot'
import type { Doctor } from '@/types'

interface Props { doctor: Doctor & { profiles?: any }; distanceKm?: number; nextSlotAt?: string | null }

export default function DoctorCard({ doctor, distanceKm, nextSlotAt }: Props) {
  const name = doctor.profiles
    ? `${doctor.profiles.first_name} ${doctor.profiles.last_name}`
    : 'Praticien'

  return (
    <Link to={`/doctor/${doctor.id}`}
      className="card p-5 hover:shadow-md transition-shadow flex gap-4 group">
      {/* Avatar */}
      <div className="w-16 h-16 rounded-2xl bg-sage-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {doctor.profiles?.avatar_url ? (
          <img src={doctor.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-bold text-sage-600">{name[0]}</span>
        )}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-sage-600 transition-colors">
              {name}
            </h3>
            <p className="text-sm text-sage-600 font-medium">{doctor.specialty}</p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {doctor.is_verified && <span className="badge-green">✓ Vérifié</span>}
            {doctor.home_visit && <span className="badge-green">🏠 À domicile</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-1.5">
          <StarRating rating={doctor.average_rating} size="sm" />
          <span className="text-xs text-gray-500">
            {doctor.average_rating.toFixed(1)} ({doctor.review_count} avis)
          </span>
        </div>

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {doctor.city && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {doctor.city}{distanceKm !== undefined && ` · ${distanceKm.toFixed(1)} km`}
            </span>
          )}
          <span className="font-medium text-gray-700">{doctor.consultation_price}€</span>
        </div>

        {nextSlotAt && (
          <p className="text-xs text-sage-600 font-medium mt-1.5">
            🕐 {formatNextSlotLabel(new Date(nextSlotAt))}
          </p>
        )}
      </div>

      <div className="flex-shrink-0 self-center">
        <svg className="w-5 h-5 text-gray-300 group-hover:text-sage-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
