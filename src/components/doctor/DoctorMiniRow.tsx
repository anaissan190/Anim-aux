// src/components/doctor/DoctorMiniRow.tsx
// Ligne compacte praticien (avatar/initiales + nom + spécialité) —
// utilisée à la fois par "Mes favoris" et "Derniers praticiens
// consultés" sur l'accueil mobile patient, pour ne pas dupliquer le
// rendu entre les deux listes.
import { Link } from 'react-router-dom'

const AVATAR_COLORS = ['bg-sage-500', 'bg-moss-500', 'bg-[#c96406]']

export default function DoctorMiniRow({ doctor, colorIndex, isLast }: { doctor: any; colorIndex: number; isLast: boolean }) {
  const profile = doctor.profiles
  const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Praticien'
  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : '?'
  const bg = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]

  return (
    <Link to={`/doctor/${doctor.id}`}
      className={`flex items-center gap-3 px-3.5 py-3 ${!isLast ? 'border-b border-gray-50' : ''}`}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className={`w-11 h-11 rounded-full ${bg} text-white font-fredoka font-semibold text-sm flex items-center justify-center flex-shrink-0`}>
          {initials}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-fredoka text-[15px] font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-[12px] text-gray-500">{doctor.specialty}</p>
      </div>
      <span className="text-gray-300 font-bold text-lg">›</span>
    </Link>
  )
}
