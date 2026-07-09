// src/pages/DoctorPage.tsx
import { useParams, Link } from 'react-router-dom'
import { useDoctor, useDoctorReviews } from '@/hooks/useData'
import { useAuthStore } from '@/lib/authStore'
import Navbar from '@/components/ui/Navbar'
import StarRating from '@/components/ui/StarRating'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function DoctorPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const { data: doctor, isLoading } = useDoctor(id!)
  const { data: reviews = [] } = useDoctorReviews(id!)

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-48 bg-gray-200 rounded-2xl" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  )

  if (!doctor) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Praticien introuvable.</p>
        <Link to="/search" className="btn-primary mt-4 inline-block">Retour à la recherche</Link>
      </div>
    </div>
  )

  const name = doctor.profiles
    ? `${doctor.profiles.first_name} ${doctor.profiles.last_name}`
    : 'Praticien'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">

          {/* Colonne principale */}
          <div className="md:col-span-2 space-y-5">
            {/* En-tête */}
            <div className="card p-6 flex gap-5">
              <div className="w-20 h-20 rounded-2xl bg-sage-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {doctor.profiles?.avatar_url ? (
                  <img src={doctor.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-sage-600">{name[0]}</span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{name}</h1>
                <p className="text-sage-600 font-medium">{doctor.specialty}</p>
                {doctor.city && <p className="text-sm text-gray-500 mt-1">📍 {doctor.address ?? doctor.city}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <StarRating rating={doctor.average_rating} />
                  <span className="text-sm text-gray-500">
                    {doctor.average_rating.toFixed(1)} ({doctor.review_count} avis)
                  </span>
                  {doctor.is_verified && <span className="badge-green">✓ Vérifié</span>}
                </div>
              </div>
            </div>

            {/* Bio */}
            {doctor.bio && (
              <div className="card p-6">
                <h2 className="font-semibold text-gray-900 mb-3">À propos</h2>
                <div
                  className="text-gray-600 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(doctor.bio) }}
                />
              </div>
            )}

            {/* Carte */}
            {doctor.lat && doctor.lng && (
              <div className="card p-6">
                <h2 className="font-semibold text-gray-900 mb-3">Localisation</h2>
                <div className="h-48 bg-sage-50 rounded-xl flex items-center justify-center text-sage-400 text-sm">
                  📍 {doctor.address ?? doctor.city}
                  <br />
                  <span className="text-xs text-gray-400">(carte Leaflet — activée avec coordonnées réelles)</span>
                </div>
              </div>
            )}

            {/* Avis */}
            <div className="card p-6">
              <h2 className="font-semibold text-gray-900 mb-4">
                Avis patients ({reviews.length})
              </h2>
              {reviews.length === 0 ? (
                <p className="text-sm text-gray-400">Aucun avis pour le moment.</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map(r => (
                    <div key={r.id} className="border-b border-gray-50 pb-4 last:border-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 bg-sage-100 rounded-full flex items-center justify-center text-xs text-sage-700 font-medium">
                          {(r as any).profiles?.first_name?.[0] ?? '?'}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {(r as any).profiles?.first_name ?? 'Patient anonyme'}
                        </span>
                        <StarRating rating={r.rating} size="sm" />
                        <span className="text-xs text-gray-400 ml-auto">
                          {format(new Date(r.created_at), 'd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                      {r.comment && <p className="text-sm text-gray-600 ml-9">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — prise de RDV */}
          <div className="md:col-span-1">
            <div className="card p-5 sticky top-24">
              <h2 className="font-semibold text-gray-900 mb-1">Prendre rendez-vous</h2>
              <p className="text-2xl font-bold text-sage-600 mb-4">
                {doctor.consultation_price}€
                <span className="text-sm font-normal text-gray-400 ml-1">/ consultation</span>
              </p>
              {user ? (
                <Link to={`/book/${doctor.id}`} className="btn-primary block text-center">
                  Voir les disponibilités
                </Link>
              ) : (
                <div className="space-y-2">
                  <Link to="/login" className="btn-primary block text-center">Se connecter</Link>
                  <Link to="/register" className="btn-secondary block text-center text-sm">Créer un compte</Link>
                </div>
              )}
              {doctor.profiles?.phone && (
                <a href={`tel:${doctor.profiles.phone}`}
                  className="btn-secondary block text-center text-sm mt-2">
                  📞 {doctor.profiles.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
