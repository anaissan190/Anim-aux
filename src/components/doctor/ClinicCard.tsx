// src/components/doctor/ClinicCard.tsx
import { Link } from 'react-router-dom'

interface Props {
  clinic: {
    id: string
    name: string
    address: string | null
    city: string | null
    logo_url: string | null
    member_count: number
    specialties: string[] | null
    average_rating: number | null
  }
}

export default function ClinicCard({ clinic }: Props) {
  return (
    <Link to={`/cabinet/${clinic.id}`}
      className="card p-5 hover:shadow-md transition-shadow flex gap-4 group border-2 border-sage-100">
      <div className="w-16 h-16 rounded-2xl bg-sage-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {clinic.logo_url ? (
          <img src={clinic.logo_url} alt={clinic.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">🏥</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-sage-600 transition-colors">
              {clinic.name}
            </h3>
            <p className="text-sm text-sage-600 font-medium">
              🏥 Cabinet · {clinic.member_count} praticien{clinic.member_count > 1 ? 's' : ''}
            </p>
          </div>
          {clinic.average_rating != null && (
            <span className="text-xs text-gray-500 flex-shrink-0">⭐ {clinic.average_rating.toFixed(1)}</span>
          )}
        </div>

        {clinic.specialties && clinic.specialties.length > 0 && (
          <p className="text-xs text-gray-500 mt-1.5 truncate">{clinic.specialties.join(' · ')}</p>
        )}

        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {clinic.city && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {clinic.city}
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 self-center">
        <svg className="w-5 h-5 text-gray-300 group-hover:text-sage-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
